import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import {
  ACCOUNTS,
  ADMIN_ONLY_HREFS,
  ADMIN_ONLY_ROUTES,
  API_BASE_URL,
  E2E_STORAGE_STATES,
  SESSION_COOKIE_NAME,
  WEB_BASE_URL,
  loginViaApi,
  refreshE2EStorageStates,
  type E2EAccount,
} from "./support/psms-e2e";

function attachRuntimeFailureGuards(page: Page) {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    const text = message.text();
    const isHydrationWarning =
      message.type() === "warning" &&
      /hydration|did not match|recoverable/i.test(text);

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

    failures.push(
      `requestfailed: ${request.method()} ${url} ${errorText}`.trim()
    );
  });

  return () => {
    expect(failures, failures.join("\n")).toEqual([]);
  };
}

function sidebar(page: Page) {
  return page
    .locator("aside")
    .filter({ has: page.locator('a[href="/sales"]') });
}

async function expectSessionCookie(
  context: BrowserContext,
  expected: "present" | "absent"
) {
  await expect
    .poll(async () => {
      const cookies = await context.cookies(WEB_BASE_URL);

      return cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME);
    })
    .toBe(expected === "present");
}

async function loginFromBrowser(page: Page, account: E2EAccount) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("아이디").fill(account.loginId);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function logoutFromBrowser(page: Page) {
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

async function sessionCookieValue(context: BrowserContext) {
  const cookies = await context.cookies(WEB_BASE_URL);

  return (
    cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME)?.value ?? null
  );
}

test.describe("PSMS browser auth flow", () => {
  test("ADMIN can log in through the browser and log out cleanly", async ({
    page,
    context,
    request,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    await loginFromBrowser(page, ACCOUNTS.admin);
    await expectSessionCookie(context, "present");
    await expect(page).toHaveURL(/\/(?:\?|$)/);
    await expect(sidebar(page)).toBeVisible();

    for (const href of ADMIN_ONLY_HREFS) {
      await expect(sidebar(page).locator(`a[href="${href}"]`)).toBeVisible();
    }

    await test.info().attach("admin-browser-login", {
      body: await page.screenshot({ caret: "initial", fullPage: true }),
      contentType: "image/png",
    });

    await logoutFromBrowser(page);
    await expectSessionCookie(context, "absent");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();

    await refreshE2EStorageStates(request);
    assertNoRuntimeFailures();
  });

  test("STAFF can log in but cannot open admin-only routes", async ({
    page,
    context,
    request,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    await loginFromBrowser(page, ACCOUNTS.staff);
    await expectSessionCookie(context, "present");
    await expect(page).toHaveURL(/\/(?:\?|$)/);
    await expect(sidebar(page)).toBeVisible();

    for (const href of ADMIN_ONLY_HREFS) {
      await expect(sidebar(page).locator(`a[href="${href}"]`)).toHaveCount(0);
    }

    for (const route of [
      ...ADMIN_ONLY_ROUTES,
      "/settings/base?tab=backup",
      "/settings/base?tab=restore",
    ]) {
      await test.step(`STAFF is forbidden from ${route}`, async () => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/forbidden(?:\?|$)/);
        await expect(
          page.getByRole("heading", { name: "접근 권한이 없습니다" })
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "대시보드로 이동" })
        ).toBeVisible();
      });
    }

    const staffSessionToken = await sessionCookieValue(context);
    expect(staffSessionToken).toBeTruthy();

    for (const path of [
      "/admin/staffs/page-data",
      "/admin/base/page-data?tab=stores",
      "/admin/policies/page-data",
    ]) {
      await test.step(`STAFF API is forbidden from ${path}`, async () => {
        const response = await request.get(`${API_BASE_URL}${path}`, {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(
              staffSessionToken ?? ""
            )}`,
          },
        });
        const json = (await response.json()) as {
          ok: boolean;
          code?: string;
        };

        expect(response.status()).toBe(403);
        expect(json.ok).toBe(false);
        expect(json.code).toBe("FORBIDDEN");
      });
    }

    await test.info().attach("staff-browser-forbidden", {
      body: await page.screenshot({ caret: "initial", fullPage: true }),
      contentType: "image/png",
    });

    await refreshE2EStorageStates(request);
    assertNoRuntimeFailures();
  });

  test("invalid login stays on login without creating a session", async ({
    page,
    context,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("아이디").fill(ACCOUNTS.admin.loginId);
    await page.getByLabel("비밀번호").fill("WrongPassword123!");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator("#login-status")).toContainText(
      "계정 또는 비밀번호를 확인해 주세요."
    );
    await expectSessionCookie(context, "absent");

    assertNoRuntimeFailures();
  });

  test("revoked browser cookie returns to login", async ({
    page,
    context,
    request,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);
    const login = await loginViaApi(request, ACCOUNTS.admin);
    const webUrl = new URL(WEB_BASE_URL);

    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: login.sessionToken,
        domain: webUrl.hostname,
        path: "/",
        expires: Math.floor(Date.parse(login.expiresAt) / 1000),
        httpOnly: true,
        secure: webUrl.protocol === "https:",
        sameSite: "Strict",
      },
    ]);

    const logoutResponse = await request.post(`${API_BASE_URL}/auth/logout`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(
          login.sessionToken
        )}`,
      },
    });

    expect(logoutResponse.status()).toBe(200);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();

    await refreshE2EStorageStates(request);
    assertNoRuntimeFailures();
  });

  test("malformed browser cookie returns to login", async ({
    page,
    context,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);
    const webUrl = new URL(WEB_BASE_URL);

    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: "malformed-session-token",
        domain: webUrl.hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: webUrl.protocol === "https:",
        sameSite: "Strict",
      },
    ]);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();

    assertNoRuntimeFailures();
  });

  test.describe("redirect with existing ADMIN storageState", () => {
    test.use({ storageState: E2E_STORAGE_STATES.admin });

    test("login page redirects an authenticated session to workspace", async ({
      page,
    }) => {
      const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/(?:\?|$)/);
      await expect(sidebar(page)).toBeVisible();

      assertNoRuntimeFailures();
    });
  });
});
