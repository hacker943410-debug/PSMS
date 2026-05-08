import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_STORAGE_STATES } from "./support/psms-e2e";

type PrismaClient = typeof import("../../packages/db/src/client").prisma;

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

    if (url.includes("_rsc=") && errorText === "net::ERR_ABORTED") {
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

function uniqueLoginId(prefix: string, projectName: string) {
  return `${prefix}${projectName.replace(/\D/g, "")}${Date.now()
    .toString(36)
    .slice(-5)}${Math.random().toString(36).slice(2, 5)}`
    .slice(0, 32)
    .toLowerCase();
}

async function expectNoSecretText(page: Page) {
  const secretText = /비밀번호|패스워드|암호/i;

  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('[autocomplete="new-password"]')).toHaveCount(0);
  await expect(page.locator('input[name*="password" i]')).toHaveCount(0);
  await expect(page.locator('input[name*="token" i]')).toHaveCount(0);
  await expect(page.locator('input[name*="secret" i]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Drawer panel"]')).not.toContainText(
    secretText
  );
}

async function getPrisma() {
  const { prisma } = await import("../../packages/db/src/client");

  return prisma;
}

async function activeStoreId(prisma: PrismaClient) {
  const store = await prisma.store.upsert({
    where: {
      code: "E2E-ADMIN-STAFF-CREDENTIAL",
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      code: "E2E-ADMIN-STAFF-CREDENTIAL",
      name: "E2E Admin Staff Credential Store",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return store.id;
}

async function createCredentialTarget(
  prisma: PrismaClient,
  input: {
    loginId: string;
    name: string;
    status: "ACTIVE" | "INACTIVE";
  }
) {
  const storeId = await activeStoreId(prisma);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.loginId,
      passwordHash: "credential-target-password-hash-not-used",
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
}

async function activeCredentialRequestCount(
  prisma: PrismaClient,
  input: {
    userId: string;
    purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET";
  }
) {
  return prisma.userPasswordToken.count({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

async function expectDrawerHasNoCredentialSecrets(
  page: Page,
  secrets: string[]
) {
  const drawer = page.locator('[aria-label="Drawer panel"]');
  const [drawerText, drawerHtml] = await Promise.all([
    drawer.innerText(),
    drawer.evaluate((element) => element.innerHTML),
  ]);
  const payload = `${page.url()}\n${drawerText}\n${drawerHtml}`;

  for (const secret of secrets) {
    if (payload.includes(secret)) {
      throw new Error("Credential secret leaked into the staff drawer UI.");
    }
  }

  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="token"]')).toHaveCount(0);
}

async function capturedDeliveryTokens() {
  const captureUrl =
    process.env.PSMS_E2E_CREDENTIAL_DELIVERY_CAPTURE_URL?.trim();

  if (!captureUrl) {
    return [];
  }

  const response = await fetch(captureUrl);
  const payload = (await response.json()) as {
    deliveries?: Array<{ token?: unknown }>;
  };

  return (payload.deliveries ?? [])
    .map((delivery) => delivery.token)
    .filter((token): token is string => typeof token === "string");
}

test.describe("Admin staff mutation UI", () => {
  test.use({ storageState: E2E_STORAGE_STATES.admin });

  test("validates the create drawer without exposing secret fields", async ({
    page,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    await page.goto("/staffs", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "신규 직원 등록" }).click();

    const drawer = page.locator('[aria-label="Drawer panel"]');
    await expect(
      drawer.getByRole("heading", { name: "신규 직원 등록" })
    ).toBeVisible();
    await expectNoSecretText(page);

    await drawer.getByRole("button", { name: "등록" }).click();
    await expect(
      drawer.getByText("이름은 2자 이상이어야 합니다.")
    ).toBeVisible();
    await expect(
      drawer.getByText("아이디는 4자 이상이어야 합니다.")
    ).toBeVisible();
    await expectNoSecretText(page);
    assertNoRuntimeFailures();
  });

  test("creates an inactive admin account from the password-free drawer", async ({
    page,
  }, testInfo) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);
    const uniqueSuffix = `${testInfo.project.name.replace(/\D/g, "")}${Date.now()
      .toString(36)
      .slice(-5)}`;
    const loginId = `e2eadm${uniqueSuffix}`.slice(0, 32).toLowerCase();
    const staffName = `E2E 관리자 ${uniqueSuffix}`;

    await page.goto("/staffs", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "신규 직원 등록" }).click();

    const drawer = page.locator('[aria-label="Drawer panel"]');
    await expect(
      drawer.getByRole("heading", { name: "신규 직원 등록" })
    ).toBeVisible();
    await expectNoSecretText(page);

    await drawer.getByLabel("이름").fill(staffName);
    await drawer.getByLabel("아이디").fill(loginId.toUpperCase());
    await drawer.locator('select[name="role"]').selectOption("ADMIN");
    await expect(drawer.locator('select[name="role"]')).toHaveValue("ADMIN");
    await expect(drawer.locator('select[name="storeId"]')).toHaveValue("");
    await drawer.getByLabel("연락처").fill("010-7777-1234");
    await expectNoSecretText(page);

    await drawer.getByRole("button", { name: "등록" }).click();
    await expect(
      drawer.getByText("비활성 직원 계정을 등록했습니다.")
    ).toBeVisible();
    await expectNoSecretText(page);

    await drawer.getByLabel("신규 직원 등록 닫기").click();
    await page.getByLabel("검색").fill(loginId);
    await page.getByRole("button", { name: "조회" }).click();

    const createdRow = page.getByRole("row", { name: new RegExp(staffName) });
    await expect(createdRow).toBeVisible();
    await createdRow
      .getByRole("link", { name: new RegExp(`${staffName} 직원 상세 보기`) })
      .click();

    const detailDrawer = page.locator('[aria-label="Drawer panel"]');
    await expect(
      detailDrawer.getByRole("heading", { name: "직원 상세" })
    ).toBeVisible();
    await expect(detailDrawer.getByLabel("아이디 또는 이메일")).toHaveValue(
      loginId
    );
    await expect(detailDrawer.getByText("비활성 상태입니다.")).toBeVisible();
    await expectNoSecretText(page);
    assertNoRuntimeFailures();
  });

  test("validates status reason and surfaces no-change update response", async ({
    page,
  }) => {
    await page.goto("/staffs", { waitUntil: "domcontentloaded" });

    await page
      .getByLabel(/직원 상세 보기/)
      .first()
      .click();

    const drawer = page.locator('[aria-label="Drawer panel"]');
    await expect(
      drawer.getByRole("heading", { name: "직원 상세" })
    ).toBeVisible();

    await drawer.getByRole("button", { name: /처리 저장/ }).click();
    await expect(drawer.getByText("변경 사유를 입력해 주세요.")).toBeVisible();

    await drawer.getByRole("link", { name: "수정" }).click();
    await expect(
      drawer.getByRole("heading", { name: "직원 정보 수정" })
    ).toBeVisible();

    await drawer.getByRole("button", { name: "저장" }).click();
    await expect(drawer.getByText("변경된 내용이 없습니다.")).toBeVisible();
  });

  test("issues and revokes account access requests from the staff detail drawer", async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE !== "OUT_OF_BAND_APPROVED",
      "Credential delivery webhook is required for issue success assertions."
    );

    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);
    const prisma = await getPrisma();
    const inactiveTarget = await createCredentialTarget(prisma, {
      loginId: uniqueLoginId("inactiveux", testInfo.project.name),
      name: "E2E 활성화 요청 대상",
      status: "INACTIVE",
    });
    const activeTarget = await createCredentialTarget(prisma, {
      loginId: uniqueLoginId("activeux", testInfo.project.name),
      name: "E2E 접근 요청 대상",
      status: "ACTIVE",
    });

    await page.goto(`/staffs?detail=${inactiveTarget.id}`, {
      waitUntil: "domcontentloaded",
    });

    const drawer = page.locator('[aria-label="Drawer panel"]');
    await expect(
      drawer.getByRole("heading", { name: "직원 상세" })
    ).toBeVisible();
    await expect(
      drawer.getByText("계정 접근 요청", { exact: true })
    ).toBeVisible();
    await expect(drawer.getByText("대기 중인 요청 없음")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "회수할 요청 없음" })
    ).toBeDisabled();

    await drawer.getByRole("button", { name: "활성화 요청 발급" }).click();
    await expect(
      drawer.getByText("처리 사유를 입력해 주세요.").first()
    ).toBeVisible();

    await drawer
      .getByLabel("활성화 요청 발급 사유")
      .fill("E2E 활성화 요청 발급");
    await drawer.getByRole("button", { name: "활성화 요청 발급" }).click();
    await expect(
      drawer.getByText("활성화 요청을 승인된 채널로 전달했습니다.")
    ).toBeVisible();
    await expect
      .poll(() =>
        activeCredentialRequestCount(prisma, {
          userId: inactiveTarget.id,
          purpose: "STAFF_ACTIVATION",
        })
      )
      .toBe(1);
    await expect(drawer.getByText("활성화 요청 대기 중")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "활성화 요청 회수" })
    ).toBeEnabled();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      drawer.getByRole("heading", { name: "직원 상세" })
    ).toBeVisible();
    await expect(drawer.getByText("활성화 요청 대기 중")).toBeVisible();

    await drawer
      .getByLabel("활성화 요청 회수 사유")
      .fill("E2E 활성화 요청 회수");
    await drawer.getByRole("button", { name: "활성화 요청 회수" }).click();
    await expect(
      drawer.getByText(/활성화 요청 1건을 회수했습니다\./)
    ).toBeVisible();
    await expect
      .poll(() =>
        activeCredentialRequestCount(prisma, {
          userId: inactiveTarget.id,
          purpose: "STAFF_ACTIVATION",
        })
      )
      .toBe(0);
    await expect(drawer.getByText("대기 중인 요청 없음")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "회수할 요청 없음" })
    ).toBeDisabled();

    await page.goto(`/staffs?detail=${activeTarget.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      drawer.getByText("계정 접근 요청", { exact: true })
    ).toBeVisible();
    await expect(drawer.getByText("대기 중인 요청 없음")).toBeVisible();
    await drawer
      .getByLabel("접근 재설정 요청 발급 사유")
      .fill("E2E 접근 재설정 요청 발급");
    await drawer.getByRole("button", { name: "접근 재설정 요청 발급" }).click();
    await expect(
      drawer.getByText("접근 재설정 요청을 승인된 채널로 전달했습니다.")
    ).toBeVisible();
    await expect
      .poll(() =>
        activeCredentialRequestCount(prisma, {
          userId: activeTarget.id,
          purpose: "PASSWORD_RESET",
        })
      )
      .toBe(1);
    await expect(drawer.getByText("접근 재설정 요청 대기 중")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "접근 재설정 요청 회수" })
    ).toBeEnabled();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      drawer.getByRole("heading", { name: "직원 상세" })
    ).toBeVisible();
    await expect(drawer.getByText("접근 재설정 요청 대기 중")).toBeVisible();

    await drawer
      .getByLabel("접근 재설정 요청 회수 사유")
      .fill("E2E 접근 재설정 요청 회수");
    await drawer.getByRole("button", { name: "접근 재설정 요청 회수" }).click();
    await expect(
      drawer.getByText(/접근 재설정 요청 1건을 회수했습니다\./)
    ).toBeVisible();
    await expect
      .poll(() =>
        activeCredentialRequestCount(prisma, {
          userId: activeTarget.id,
          purpose: "PASSWORD_RESET",
        })
      )
      .toBe(0);
    await expect(drawer.getByText("대기 중인 요청 없음")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "회수할 요청 없음" })
    ).toBeDisabled();

    const deliveredTokens = await capturedDeliveryTokens();
    const credentialHashes = (
      await prisma.userPasswordToken.findMany({
        where: {
          userId: {
            in: [inactiveTarget.id, activeTarget.id],
          },
        },
        select: {
          tokenHash: true,
        },
      })
    ).map((token) => token.tokenHash);

    expect(deliveredTokens.length).toBeGreaterThanOrEqual(2);
    await expectDrawerHasNoCredentialSecrets(page, [
      ...credentialHashes,
      ...deliveredTokens,
    ]);
    await expectNoSecretText(page);
    assertNoRuntimeFailures();
  });
});
