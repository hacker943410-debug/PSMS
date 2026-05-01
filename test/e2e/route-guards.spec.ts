import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  ACCOUNTS,
  ADMIN_ONLY_HREFS,
  ADMIN_ONLY_ROUTES,
  API_BASE_URL,
  E2E_STORAGE_STATES,
  GENERAL_WORKSPACE_ROUTES,
  STAFF_VISIBLE_HREFS,
  WEB_BASE_URL,
} from "./support/psms-e2e";

let cacheBustSequence = 0;

function pathWithCacheBust(path: string) {
  const url = new URL(path, WEB_BASE_URL);
  url.searchParams.set("__e2e", `${Date.now()}-${cacheBustSequence++}`);

  return `${url.pathname}${url.search}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function gotoRoute(page: Page, path: string) {
  await page.goto(pathWithCacheBust(path), { waitUntil: "domcontentloaded" });
}

async function expectWorkspaceRoute(page: Page, path: string) {
  await gotoRoute(page, path);

  const routePattern =
    path === "/" ? /\/(?:\?|$)/ : new RegExp(`${escapeRegExp(path)}(?:\\?|$)`);

  await expect(page).toHaveURL(routePattern);
  await expect(sidebar(page)).toBeVisible();
}

async function attachScreenshot(page: Page, name: string) {
  await test.info().attach(name, {
    body: await page.screenshot({ caret: "initial", fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("PSMS auth and route guards", () => {
  test("login page exposes local test accounts and API health is reachable", async ({
    page,
    request,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    const healthResponse = await request.get(`${API_BASE_URL}/health`);
    expect(healthResponse.status()).toBe(200);

    const health = await healthResponse.json();
    expect(health.ok).toBe(true);
    expect(health.port).toBe(4273);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[name="loginId"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.locator("code", { hasText: ACCOUNTS.admin.loginId })
    ).toBeVisible();
    await expect(
      page.locator("code", { hasText: ACCOUNTS.staff.loginId })
    ).toBeVisible();
    await attachScreenshot(page, "login-page-test-accounts");

    assertNoRuntimeFailures();
  });

  test("unauthenticated workspace routes redirect to login", async ({
    page,
  }) => {
    const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

    for (const path of [...GENERAL_WORKSPACE_ROUTES, ...ADMIN_ONLY_ROUTES]) {
      await test.step(`${path} redirects to /login`, async () => {
        await gotoRoute(page, path);
        await expect(page).toHaveURL(/\/login(?:\?|$)/);
        await expect(page.locator('input[name="loginId"]')).toBeVisible();
      });
    }

    assertNoRuntimeFailures();
  });

  test.describe("ADMIN storageState", () => {
    test.use({ storageState: E2E_STORAGE_STATES.admin });

    test("can access workspace and admin-only routes", async ({ page }) => {
      const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

      await expectWorkspaceRoute(page, "/");
      await attachScreenshot(page, "admin-dashboard");

      for (const href of ADMIN_ONLY_HREFS) {
        await expect(sidebar(page).locator(`a[href="${href}"]`)).toBeVisible();
      }

      for (const path of [...GENERAL_WORKSPACE_ROUTES, ...ADMIN_ONLY_ROUTES]) {
        await test.step(`ADMIN can open ${path}`, async () => {
          await expectWorkspaceRoute(page, path);
        });
      }

      await attachScreenshot(page, "admin-admin-only-route");
      assertNoRuntimeFailures();
    });
  });

  test.describe("STAFF storageState", () => {
    test.use({ storageState: E2E_STORAGE_STATES.staff });

    test("can access general routes and is blocked from admin-only routes", async ({
      page,
    }) => {
      const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

      await expectWorkspaceRoute(page, "/");
      await attachScreenshot(page, "staff-dashboard");

      for (const href of ADMIN_ONLY_HREFS) {
        await expect(sidebar(page).locator(`a[href="${href}"]`)).toHaveCount(0);
      }

      for (const href of STAFF_VISIBLE_HREFS) {
        await expect(sidebar(page).locator(`a[href="${href}"]`)).toBeVisible();
      }

      for (const path of GENERAL_WORKSPACE_ROUTES) {
        await test.step(`STAFF can open ${path}`, async () => {
          await expectWorkspaceRoute(page, path);
        });
      }

      for (const path of ADMIN_ONLY_ROUTES) {
        await test.step(`STAFF is forbidden from ${path}`, async () => {
          await gotoRoute(page, path);
          await expect(page).toHaveURL(/\/forbidden(?:\?|$)/);
        });
      }

      await attachScreenshot(page, "staff-forbidden");
      assertNoRuntimeFailures();
    });
  });
});
