import {
  createHmac,
  randomBytes,
  scrypt,
  type ScryptOptions,
} from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import type { CredentialTokenPurpose } from "../../packages/shared/src/credential-token";

import {
  API_BASE_URL,
  WEB_BASE_URL,
  WORKSPACE_ROOT,
  SESSION_COOKIE_NAME,
  loginViaApi,
} from "./support/psms-e2e";

test.use({
  screenshot: "off",
  trace: "off",
  video: "off",
});

type PrismaClient = typeof import("../../packages/db/src/client").prisma;
type SharedModule = {
  buildCredentialTokenActiveKey: (
    userId: string,
    purpose: CredentialTokenPurpose
  ) => string;
  generateCredentialToken: () => string;
  hashCredentialToken: (
    rawToken: string,
    purpose: CredentialTokenPurpose
  ) => string;
  hashPassword: (password: string) => Promise<string>;
  hashSessionToken: (sessionToken: string) => string;
};

type CredentialFixture = {
  loginId: string;
  name: string;
  password: string;
  rawToken: string;
  tokenHash: string;
  tokenId: string;
  userId: string;
};

const CREDENTIAL_COOKIE_NAMES = {
  STAFF_ACTIVATION: "psms_staff_activation_token",
  PASSWORD_RESET: "psms_password_reset_token",
} as const satisfies Record<CredentialTokenPurpose, string>;

const CREDENTIAL_COMPLETION_COOKIE_NAMES = {
  STAFF_ACTIVATION: "psms_staff_activation_completed",
  PASSWORD_RESET: "psms_password_reset_completed",
} as const satisfies Record<CredentialTokenPurpose, string>;

const CREDENTIAL_PATHS = {
  STAFF_ACTIVATION: "/staff-activation",
  PASSWORD_RESET: "/password-reset",
} as const satisfies Record<CredentialTokenPurpose, string>;

const EXPECTED_COOKIE_SECURE =
  new URL(WEB_BASE_URL).protocol === "https:" ||
  process.env.NODE_ENV === "production";
const PASSWORD_TOKEN_BYTES = 32;
const PASSWORD_TOKEN_HASH_PREFIX = "v1:hmac-sha256";
const SESSION_HASH_PREFIX = "v1:hmac-sha256";
const COMPLETION_MARKER_PATTERN =
  /^v1\.\d{13}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/;
const SCRYPT_PARAMS = {
  keyLength: 64,
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;
const HASH_PREFIX = "scrypt";
const E2E_CREDENTIAL_RATE_LIMIT_PATH = path.resolve(
  process.env.PSMS_CREDENTIAL_RATE_LIMIT_FILE?.trim() ||
    path.join(WORKSPACE_ROOT, ".tmp/e2e/credential-token-rate-limit.json")
);

function attachRuntimeFailureGuards(page: Page) {
  const failures: string[] = [];
  const consoleMessages: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    const text = message.text();
    const isHydrationWarning =
      message.type() === "warning" &&
      /hydration|did not match|recoverable/i.test(text);

    consoleMessages.push(text);

    if (message.type() === "error" || isHydrationWarning) {
      failures.push(`console.${message.type()}: ${text}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "";

    if (url.includes("/_next/webpack-hmr") || url.endsWith("/favicon.ico")) {
      return;
    }

    if (url.includes("/_next/static/") && errorText === "net::ERR_ABORTED") {
      return;
    }

    if (url.includes("/__nextjs_font/") && errorText === "net::ERR_ABORTED") {
      return;
    }

    if (url.includes("_rsc=") && errorText === "net::ERR_ABORTED") {
      return;
    }

    const failure =
      `requestfailed: ${request.method()} ${url} ${errorText}`.trim();

    failedRequests.push(failure);
    failures.push(failure);
  });

  return {
    assertNoRuntimeFailures() {
      expect(failures, failures.join("\n")).toEqual([]);
    },
    assertNoSecretLogs(secrets: string[]) {
      const payload = JSON.stringify({ consoleMessages, failedRequests });

      for (const secret of secrets) {
        expect(payload).not.toContain(secret);
      }
    },
  };
}

function uniqueLoginId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .slice(0, 32)
    .toLowerCase();
}

function requiredEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for credential token E2E fixtures.`);
  }

  return value;
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

const credentialShared: SharedModule = {
  buildCredentialTokenActiveKey(userId, purpose) {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new Error("Credential token activeKey requires userId.");
    }

    return `${normalizedUserId}:${purpose}`;
  },
  generateCredentialToken() {
    return randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");
  },
  hashCredentialToken(rawToken, purpose) {
    const digest = createHmac("sha256", requiredEnv("PASSWORD_TOKEN_SECRET"))
      .update(purpose, "utf8")
      .update("\0", "utf8")
      .update(rawToken, "utf8")
      .digest("base64url");

    return `${PASSWORD_TOKEN_HASH_PREFIX}:${digest}`;
  },
  async hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await deriveKey(
      password,
      salt,
      SCRYPT_PARAMS.keyLength,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
        maxmem: SCRYPT_PARAMS.maxmem,
      }
    );

    return [
      HASH_PREFIX,
      `N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}`,
      salt.toString("base64url"),
      derivedKey.toString("base64url"),
    ].join("$");
  },
  hashSessionToken(sessionToken) {
    const digest = createHmac("sha256", requiredEnv("AUTH_SECRET"))
      .update(sessionToken, "utf8")
      .digest("base64url");

    return `${SESSION_HASH_PREFIX}:${digest}`;
  },
};

async function getPrismaAndShared() {
  const { prisma } = await import("../../packages/db/src/client");

  return {
    prisma,
    shared: credentialShared,
  };
}

async function resetCredentialTokenRateLimit() {
  if (!E2E_CREDENTIAL_RATE_LIMIT_PATH.startsWith(WORKSPACE_ROOT)) {
    throw new Error(
      `Unsafe credential rate-limit test path: ${E2E_CREDENTIAL_RATE_LIMIT_PATH}`
    );
  }

  await Promise.all([
    rm(E2E_CREDENTIAL_RATE_LIMIT_PATH, { force: true }),
    rm(`${E2E_CREDENTIAL_RATE_LIMIT_PATH}.lock`, {
      force: true,
      recursive: true,
    }),
  ]);
}

async function activeStoreId(prisma: PrismaClient) {
  const store = await prisma.store.upsert({
    where: {
      code: "E2E-CREDENTIAL-TOKEN",
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      code: "E2E-CREDENTIAL-TOKEN",
      name: "E2E Credential Token Store",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return store.id;
}

async function createCredentialFixture(
  prisma: PrismaClient,
  shared: SharedModule,
  input: {
    purpose: CredentialTokenPurpose;
    status: "ACTIVE" | "INACTIVE";
    password: string;
    loginPrefix: string;
    name: string;
  }
): Promise<CredentialFixture> {
  const storeId = await activeStoreId(prisma);
  const loginId = uniqueLoginId(input.loginPrefix);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: loginId,
      passwordHash: await shared.hashPassword(input.password),
      role: "STAFF",
      status: input.status,
      storeId,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
  const rawToken = shared.generateCredentialToken();
  const tokenHash = shared.hashCredentialToken(rawToken, input.purpose);
  const token = await prisma.userPasswordToken.create({
    data: {
      userId: user.id,
      purpose: input.purpose,
      tokenHash,
      activeKey: shared.buildCredentialTokenActiveKey(user.id, input.purpose),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "credential-token-browser.spec",
    },
    select: {
      id: true,
    },
  });

  return {
    loginId: user.email,
    name: user.name,
    password: input.password,
    rawToken,
    tokenHash,
    tokenId: token.id,
    userId: user.id,
  };
}

async function credentialCookie(
  context: BrowserContext,
  purpose: CredentialTokenPurpose
) {
  const cookies = await context.cookies(
    `${WEB_BASE_URL}${CREDENTIAL_PATHS[purpose]}`
  );

  return cookies.find(
    (cookie) => cookie.name === CREDENTIAL_COOKIE_NAMES[purpose]
  );
}

async function credentialCompletionCookie(
  context: BrowserContext,
  purpose: CredentialTokenPurpose
) {
  const cookies = await context.cookies(
    `${WEB_BASE_URL}${CREDENTIAL_PATHS[purpose]}`
  );

  return cookies.find(
    (cookie) => cookie.name === CREDENTIAL_COMPLETION_COOKIE_NAMES[purpose]
  );
}

async function expectCredentialCookieStored(
  context: BrowserContext,
  purpose: CredentialTokenPurpose,
  rawToken: string
) {
  const cookie = await credentialCookie(context, purpose);

  expect(cookie).toBeTruthy();
  expect(cookie?.value).toBe(rawToken);
  expect(cookie?.path).toBe(CREDENTIAL_PATHS[purpose]);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(cookie?.secure).toBe(EXPECTED_COOKIE_SECURE);
}

async function expectCredentialCompletionCookieSigned(
  context: BrowserContext,
  purpose: CredentialTokenPurpose
) {
  const cookie = await credentialCompletionCookie(context, purpose);

  if (!cookie) {
    throw new Error(`Missing ${purpose} credential completion cookie.`);
  }

  expect(cookie.value).not.toBe("1");
  expect(cookie.value).toMatch(COMPLETION_MARKER_PATTERN);
  expect(cookie.path).toBe(CREDENTIAL_PATHS[purpose]);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(cookie.secure).toBe(EXPECTED_COOKIE_SECURE);

  return cookie;
}

async function expectCredentialCookiesCleared(context: BrowserContext) {
  await expect
    .poll(async () => {
      const cookies = await context.cookies([
        `${WEB_BASE_URL}/staff-activation`,
        `${WEB_BASE_URL}/password-reset`,
      ]);

      return cookies.some((cookie) =>
        Object.values(CREDENTIAL_COOKIE_NAMES).includes(
          cookie.name as (typeof CREDENTIAL_COOKIE_NAMES)[CredentialTokenPurpose]
        )
      );
    })
    .toBe(false);
}

async function expectCredentialCompletionCookieCleared(
  context: BrowserContext,
  purpose: CredentialTokenPurpose
) {
  await expect
    .poll(async () =>
      Boolean(await credentialCompletionCookie(context, purpose))
    )
    .toBe(false);
}

async function setCredentialCompletionCookie(
  context: BrowserContext,
  purpose: CredentialTokenPurpose,
  value: string
) {
  const webUrl = new URL(WEB_BASE_URL);

  await context.addCookies([
    {
      name: CREDENTIAL_COMPLETION_COOKIE_NAMES[purpose],
      value,
      domain: webUrl.hostname,
      path: CREDENTIAL_PATHS[purpose],
      expires: Math.floor(Date.now() / 1000) + 60,
      httpOnly: true,
      secure: webUrl.protocol === "https:",
      sameSite: "Strict",
    },
  ]);
}

function tamperCompletionMarker(value: string) {
  const replacement = value.endsWith("A") ? "B" : "A";

  return `${value.slice(0, -1)}${replacement}`;
}

async function expectSessionCookieCleared(context: BrowserContext) {
  await expect
    .poll(async () => {
      const cookies = await context.cookies(WEB_BASE_URL);

      return cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME);
    })
    .toBe(false);
}

async function expectNoSecretLeak(page: Page, secrets: string[]) {
  const [content, bodyText] = await Promise.all([
    page.content(),
    page.locator("body").innerText(),
  ]);
  const payload = `${page.url()}\n${content}\n${bodyText}`;

  for (const secret of secrets) {
    expect(payload).not.toContain(secret);
  }

  await expect(page.locator('input[name="token"]')).toHaveCount(0);
  await expect(page.locator(`input[value="${secrets[0]}"]`)).toHaveCount(0);
}

async function openCredentialLink(
  page: Page,
  purpose: CredentialTokenPurpose,
  rawToken: string
) {
  const path = CREDENTIAL_PATHS[purpose];
  const response = await page.goto(`${path}?token=${rawToken}`, {
    waitUntil: "networkidle",
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(new RegExp(`${path}(?:$|\\?)`));
  expect(new URL(page.url()).searchParams.has("token")).toBe(false);
}

async function rejectLogin(
  request: APIRequestContext,
  loginId: string,
  password: string
) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      loginId,
      password,
    },
  });
  const json = (await response.json()) as { ok: boolean; code?: string };

  expect(response.status()).toBe(403);
  expect(json.ok).toBe(false);
  expect(json.code).toBe("FORBIDDEN");
}

async function addSessionCookie(
  context: BrowserContext,
  sessionToken: string,
  expiresAt: string
) {
  const webUrl = new URL(WEB_BASE_URL);

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      domain: webUrl.hostname,
      path: "/",
      expires: Math.floor(Date.parse(expiresAt) / 1000),
      httpOnly: true,
      secure: webUrl.protocol === "https:",
      sameSite: "Strict",
    },
  ]);
}

async function captureCredentialActionRequest(
  page: Page,
  path: string,
  submit: () => Promise<void>
) {
  const requestPromise = page.waitForRequest((request) => {
    return (
      request.method() === "POST" && new URL(request.url()).pathname === path
    );
  });

  await submit();

  const actionRequest = await requestPromise;

  return {
    headers: actionRequest.headers(),
    postData:
      actionRequest.postDataBuffer() ??
      Buffer.from(actionRequest.postData() ?? ""),
    url: actionRequest.url(),
  };
}

function toCookieHeader(
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>
) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function toForgedCrossSiteHeaders(
  headers: Record<string, string>,
  cookieHeader: string
) {
  const forged = {
    ...headers,
    cookie: cookieHeader,
    origin: WEB_BASE_URL,
    "sec-fetch-site": "cross-site",
  };

  delete forged.host;
  delete forged["content-length"];

  return forged;
}

test.describe("Credential token browser flow", () => {
  test.beforeEach(async () => {
    await resetCredentialTokenRateLimit();
  });

  test("staff activation consumes a valid token, clears cookies, and rejects replay", async ({
    page,
    context,
    request,
  }) => {
    const { prisma, shared } = await getPrismaAndShared();
    const fixture = await createCredentialFixture(prisma, shared, {
      purpose: "STAFF_ACTIVATION",
      status: "INACTIVE",
      password: "ActivationOriginal#2026",
      loginPrefix: "acte2e",
      name: "E2E 활성화 대상",
    });
    const newPassword = "ActivationReady#2026";
    const guards = attachRuntimeFailureGuards(page);

    await openCredentialLink(page, "STAFF_ACTIVATION", fixture.rawToken);
    await expectCredentialCookieStored(
      context,
      "STAFF_ACTIVATION",
      fixture.rawToken
    );
    await expect(
      page.getByRole("heading", { name: "직원 계정 활성화" })
    ).toBeVisible();
    await expect(page.getByText(fixture.name)).toBeVisible();
    await expect(page.getByText(fixture.loginId)).toBeVisible();
    await expectNoSecretLeak(page, [fixture.rawToken, fixture.tokenHash]);

    await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
    await page.getByLabel("새 비밀번호 확인").fill(newPassword);
    await page.getByRole("button", { name: "계정 활성화" }).click();

    await expect(
      page.getByRole("heading", { name: "계정 활성화가 완료되었습니다." })
    ).toBeVisible();
    await expectCredentialCookiesCleared(context);
    const completionCookie = await expectCredentialCompletionCookieSigned(
      context,
      "STAFF_ACTIVATION"
    );
    await expectSessionCookieCleared(context);
    await expectNoSecretLeak(page, [
      fixture.rawToken,
      fixture.tokenHash,
      newPassword,
    ]);

    const userAfter = await prisma.user.findUnique({
      where: { id: fixture.userId },
      select: { status: true },
    });
    const tokenAfter = await prisma.userPasswordToken.findUnique({
      where: { id: fixture.tokenId },
      select: { activeKey: true, usedAt: true, revokedAt: true },
    });

    expect(userAfter?.status).toBe("ACTIVE");
    expect(tokenAfter?.activeKey).toBeNull();
    expect(tokenAfter?.usedAt).toBeTruthy();
    expect(tokenAfter?.revokedAt).toBeNull();

    await loginViaApi(request, {
      loginId: fixture.loginId,
      password: newPassword,
    });

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "계정 활성화가 완료되었습니다." })
    ).toBeVisible();

    await setCredentialCompletionCookie(
      context,
      "STAFF_ACTIVATION",
      tamperCompletionMarker(completionCookie.value)
    );
    await page.goto("/staff-activation", {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.goto(`/staff-activation?token=${fixture.rawToken}`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/staff-activation(?:$|\?)/);
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expectNoSecretLeak(page, [fixture.rawToken, fixture.tokenHash]);

    guards.assertNoRuntimeFailures();
    guards.assertNoSecretLogs([
      fixture.rawToken,
      fixture.tokenHash,
      newPassword,
    ]);
  });

  test("password reset revokes existing sessions, changes the password, and rejects replay", async ({
    page,
    context,
    request,
  }) => {
    const { prisma, shared } = await getPrismaAndShared();
    const fixture = await createCredentialFixture(prisma, shared, {
      purpose: "PASSWORD_RESET",
      status: "ACTIVE",
      password: "ResetOriginal#2026",
      loginPrefix: "resete2e",
      name: "E2E 재설정 대상",
    });
    const existingLogin = await loginViaApi(request, {
      loginId: fixture.loginId,
      password: fixture.password,
    });
    const existingSessionHash = shared.hashSessionToken(
      existingLogin.sessionToken
    );
    const newPassword = "ResetReady#2026";
    const guards = attachRuntimeFailureGuards(page);

    await addSessionCookie(
      context,
      existingLogin.sessionToken,
      existingLogin.expiresAt
    );
    await openCredentialLink(page, "PASSWORD_RESET", fixture.rawToken);
    await expectCredentialCookieStored(
      context,
      "PASSWORD_RESET",
      fixture.rawToken
    );
    await expect(
      page.getByRole("heading", { name: "비밀번호 재설정" })
    ).toBeVisible();
    await expect(page.getByText(fixture.name)).toBeVisible();
    await expectNoSecretLeak(page, [fixture.rawToken, fixture.tokenHash]);

    await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
    await page.getByLabel("새 비밀번호 확인").fill(newPassword);
    await page.getByRole("button", { name: "비밀번호 재설정" }).click();

    await expect(
      page.getByRole("heading", { name: "비밀번호 재설정이 완료되었습니다." })
    ).toBeVisible();
    await expectCredentialCookiesCleared(context);
    await expectCredentialCompletionCookieSigned(context, "PASSWORD_RESET");
    await expectSessionCookieCleared(context);
    await expectNoSecretLeak(page, [
      fixture.rawToken,
      fixture.tokenHash,
      newPassword,
    ]);

    const sessionAfter = await prisma.session.findUnique({
      where: { sessionTokenHash: existingSessionHash },
      select: { revokedAt: true },
    });
    const tokenAfter = await prisma.userPasswordToken.findUnique({
      where: { id: fixture.tokenId },
      select: { activeKey: true, usedAt: true, revokedAt: true },
    });

    expect(sessionAfter?.revokedAt).toBeTruthy();
    expect(tokenAfter?.activeKey).toBeNull();
    expect(tokenAfter?.usedAt).toBeTruthy();
    expect(tokenAfter?.revokedAt).toBeNull();

    await rejectLogin(request, fixture.loginId, fixture.password);
    await loginViaApi(request, {
      loginId: fixture.loginId,
      password: newPassword,
    });

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "비밀번호 재설정이 완료되었습니다." })
    ).toBeVisible();

    await page.goto(`/password-reset?token=${fixture.rawToken}`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/password-reset(?:$|\?)/);
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expectNoSecretLeak(page, [fixture.rawToken, fixture.tokenHash]);

    guards.assertNoRuntimeFailures();
    guards.assertNoSecretLogs([
      fixture.rawToken,
      fixture.tokenHash,
      newPassword,
    ]);
  });

  test("cross-site complete attempts are rejected before consuming the token", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const { prisma, shared } = await getPrismaAndShared();
    const fixture = await createCredentialFixture(prisma, shared, {
      purpose: "STAFF_ACTIVATION",
      status: "INACTIVE",
      password: "CrossSiteOriginal#2026",
      loginPrefix: "crosse2e",
      name: "E2E 출처 차단 대상",
    });
    const blockedPassword = "CrossSiteBlocked#2026";

    await openCredentialLink(page, "STAFF_ACTIVATION", fixture.rawToken);
    await expectCredentialCookieStored(
      context,
      "STAFF_ACTIVATION",
      fixture.rawToken
    );

    const captureFixture = await createCredentialFixture(prisma, shared, {
      purpose: "STAFF_ACTIVATION",
      status: "INACTIVE",
      password: "CrossSiteCaptureOriginal#2026",
      loginPrefix: "xsitecap",
      name: "E2E 출처 캡처 대상",
    });
    const captureContext = await browser.newContext();
    const capturePage = await captureContext.newPage();

    let actionRequest: Awaited<
      ReturnType<typeof captureCredentialActionRequest>
    >;

    try {
      await openCredentialLink(
        capturePage,
        "STAFF_ACTIVATION",
        captureFixture.rawToken
      );
      actionRequest = await captureCredentialActionRequest(
        capturePage,
        "/staff-activation",
        async () => {
          await capturePage
            .getByLabel("새 비밀번호", { exact: true })
            .fill(blockedPassword);
          await capturePage
            .getByLabel("새 비밀번호 확인")
            .fill(blockedPassword);
          await capturePage
            .getByRole("button", { name: "계정 활성화" })
            .click();
        }
      );
      await expect(
        capturePage.getByRole("heading", {
          name: "계정 활성화가 완료되었습니다.",
        })
      ).toBeVisible();
    } finally {
      await captureContext.close();
    }

    const response = await request.post(actionRequest.url, {
      headers: toForgedCrossSiteHeaders(
        actionRequest.headers,
        toCookieHeader(await context.cookies(WEB_BASE_URL))
      ),
      data: actionRequest.postData,
    });
    const body = await response.text();

    expect(response.status()).toBeLessThan(500);
    expect(body).toContain("요청 출처를 확인할 수 없습니다.");

    const userAfter = await prisma.user.findUnique({
      where: { id: fixture.userId },
      select: { status: true },
    });
    const tokenAfter = await prisma.userPasswordToken.findUnique({
      where: { id: fixture.tokenId },
      select: { activeKey: true, usedAt: true, revokedAt: true },
    });

    expect(userAfter?.status).toBe("INACTIVE");
    expect(tokenAfter?.activeKey).toBeTruthy();
    expect(tokenAfter?.usedAt).toBeNull();
    expect(tokenAfter?.revokedAt).toBeNull();
    await expectCredentialCookieStored(
      context,
      "STAFF_ACTIVATION",
      fixture.rawToken
    );
    await expectNoSecretLeak(page, [
      fixture.rawToken,
      fixture.tokenHash,
      blockedPassword,
    ]);
  });

  test("forged completion markers do not show success screens", async ({
    page,
    context,
  }) => {
    const guards = attachRuntimeFailureGuards(page);

    await setCredentialCompletionCookie(context, "STAFF_ACTIVATION", "1");
    await page.goto("/staff-activation", {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "계정 활성화가 완료되었습니다." })
    ).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await setCredentialCompletionCookie(context, "PASSWORD_RESET", "1");
    await page.goto("/password-reset", {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "비밀번호 재설정이 완료되었습니다." })
    ).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    guards.assertNoRuntimeFailures();
  });

  test("new token links clear stale completion markers before verification", async ({
    page,
    context,
  }) => {
    const { prisma, shared } = await getPrismaAndShared();
    const fixture = await createCredentialFixture(prisma, shared, {
      purpose: "STAFF_ACTIVATION",
      status: "INACTIVE",
      password: "CleanupOriginal#2026",
      loginPrefix: "cleane2e",
      name: "E2E 완료 마커 제거 대상",
    });
    const guards = attachRuntimeFailureGuards(page);

    await setCredentialCompletionCookie(context, "STAFF_ACTIVATION", "1");
    await openCredentialLink(page, "STAFF_ACTIVATION", fixture.rawToken);

    await expectCredentialCompletionCookieCleared(context, "STAFF_ACTIVATION");
    await expectCredentialCookieStored(
      context,
      "STAFF_ACTIVATION",
      fixture.rawToken
    );
    await expect(
      page.getByRole("heading", { name: "직원 계정 활성화" })
    ).toBeVisible();
    await expect(page.getByText(fixture.loginId)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
    await expectNoSecretLeak(page, [fixture.rawToken, fixture.tokenHash]);

    guards.assertNoRuntimeFailures();
    guards.assertNoSecretLogs([fixture.rawToken, fixture.tokenHash]);
  });

  test("invalid and rate-limited credential links stay safe without secret leakage", async ({
    page,
    context,
  }) => {
    const { shared } = await getPrismaAndShared();
    const invalidToken = shared.generateCredentialToken();
    const guards = attachRuntimeFailureGuards(page);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await openCredentialLink(page, "PASSWORD_RESET", invalidToken);
      await expect(
        page.getByRole("heading", { name: "요청 링크 확인 필요" })
      ).toBeVisible();
      await expect(
        page.getByText("요청 링크가 만료되었거나 이미 사용되었습니다.")
      ).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expectNoSecretLeak(page, [invalidToken]);
    }

    await openCredentialLink(page, "PASSWORD_RESET", invalidToken);
    await expect(
      page.getByRole("heading", { name: "요청 링크 확인 필요" })
    ).toBeVisible();
    await expect(
      page.getByText("요청 시도가 많습니다. 잠시 후 다시 시도해 주세요.")
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expectNoSecretLeak(page, [invalidToken]);

    const cookie = await credentialCookie(context, "PASSWORD_RESET");

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/password-reset");
    guards.assertNoRuntimeFailures();
    guards.assertNoSecretLogs([invalidToken]);
  });
});
