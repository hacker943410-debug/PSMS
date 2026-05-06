import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_STORAGE_STATES } from "./support/psms-e2e";

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

async function expectNoSecretText(page: Page) {
  const secretText =
    /비밀번호|패스워드|암호|password|temporary|initial|reset|secret|token|session/i;

  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('[autocomplete="new-password"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Drawer panel"]')).not.toContainText(
    secretText
  );
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
});
