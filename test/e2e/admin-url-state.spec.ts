import { expect, test } from "@playwright/test";

import { E2E_STORAGE_STATES } from "./support/psms-e2e";

function expectSearchParams(
  pageUrl: string,
  expected: Record<string, string | null>
) {
  const url = new URL(pageUrl);

  for (const [key, value] of Object.entries(expected)) {
    expect(url.searchParams.get(key), `${key} in ${url}`).toBe(value);
  }
}

test.describe("Admin foundation URL state", () => {
  test.use({ storageState: E2E_STORAGE_STATES.admin });

  test("staff drawer opens from mode param and close preserves list filters", async ({
    page,
  }) => {
    await page.goto("/staffs?role=STAFF&status=ACTIVE&page=2&mode=create", {
      waitUntil: "domcontentloaded",
    });

    const drawer = page.locator('[aria-label="Drawer panel"]');
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("heading", { name: "신규 직원 등록" })
    ).toBeVisible();

    await drawer.getByLabel("신규 직원 등록 닫기").click();
    await expect(page).toHaveURL(/\/staffs\?role=STAFF&status=ACTIVE&page=2$/);
    await expect(page.locator('[aria-label="Drawer panel"]')).toHaveCount(0);
  });

  test("staff filters, pagination, row open, and create action update URL", async ({
    page,
  }) => {
    await page.goto("/staffs?role=STAFF&status=ACTIVE&page=2", {
      waitUntil: "domcontentloaded",
    });

    await page.getByLabel("검색").fill("seed");
    await page.getByLabel("역할").selectOption("ADMIN");
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(/\/staffs\?/);
    expectSearchParams(page.url(), {
      q: "seed",
      role: "ADMIN",
      page: "1",
      detail: null,
      mode: null,
    });

    await page
      .getByLabel(/직원 상세 보기/)
      .first()
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("detail"))
      .not.toBeNull();
    await expect(page.locator('[aria-label="Drawer panel"]')).toBeVisible();

    await page.getByRole("link", { name: "신규 직원 등록" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("mode"))
      .toBe("create");
    await expect(
      page.locator('[aria-label="Drawer panel"]').getByRole("heading", {
        name: "신규 직원 등록",
      })
    ).toBeVisible();
  });

  test("base tab changes reset page and overlay while preserving filters", async ({
    page,
  }) => {
    await page.goto(
      "/settings/base?tab=deviceModels&status=ACTIVE&q=Galaxy&page=3&pageSize=20&detail=device-005&mode=edit",
      { waitUntil: "domcontentloaded" }
    );

    await expect(page.locator('[aria-label="Drawer panel"]')).toBeVisible();
    await page.getByRole("link", { name: "통신사" }).click();

    await expect(page).toHaveURL(
      /\/settings\/base\?tab=carriers&status=ACTIVE&q=Galaxy&pageSize=20$/
    );
    await expect(page.locator('[aria-label="Drawer panel"]')).toHaveCount(0);
  });

  test("base search, pagination, row open, and create action update URL", async ({
    page,
  }) => {
    await page.goto("/settings/base?tab=deviceModels&page=3&pageSize=20", {
      waitUntil: "domcontentloaded",
    });

    await page.getByPlaceholder("기종 검색").fill("Galaxy");
    await page.getByLabel("기초정보 검색").click();

    await expect(page).toHaveURL(/\/settings\/base\?/);
    expectSearchParams(page.url(), {
      tab: "deviceModels",
      q: "Galaxy",
      page: "1",
      pageSize: "20",
      detail: null,
      mode: null,
    });

    await expect(page.getByRole("button", { name: "삭제" })).toBeDisabled();

    await page.getByRole("link", { name: "신규 등록" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("mode"))
      .toBe("create");
  });

  test("policies detail panel is controlled by detail param", async ({
    page,
  }) => {
    await page.goto("/settings/policies", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[aria-label="정책 상세 패널"]')).toHaveCount(0);

    await page.goto(
      "/settings/policies?status=ACTIVE&detail=POL-001&confirm=activate",
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.locator('[aria-label="정책 상세 패널"]')).toBeVisible();

    await page.getByLabel("정책 상세 닫기").click();
    await expect(page).toHaveURL(/\/settings\/policies\?status=ACTIVE$/);
    await expect(page.locator('[aria-label="정책 상세 패널"]')).toHaveCount(0);
  });

  test("policies filters, pagination, row open, and create action update URL", async ({
    page,
  }) => {
    await page.goto("/settings/policies?page=2&detail=POL-001", {
      waitUntil: "domcontentloaded",
    });

    await page.locator('select[name="salesType"]').selectOption("NEW");
    await page.locator('select[name="status"]').selectOption("ACTIVE");
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(/\/settings\/policies\?/);
    expectSearchParams(page.url(), {
      carrierId: "all",
      salesType: "NEW",
      status: "ACTIVE",
      page: "1",
      detail: null,
      mode: null,
    });

    await page.getByRole("link", { name: "신규 정책 등록" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("mode"))
      .toBe("create");
  });
});
