import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_STORAGE_STATES } from "./support/psms-e2e";

const DESIGN_DENSITY_ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/sales", name: "sales-management" },
  { path: "/sales/new", name: "sales-entry" },
  { path: "/receivables", name: "receivables" },
  { path: "/customers", name: "customers" },
  { path: "/schedule", name: "schedule" },
  { path: "/inventory", name: "inventory" },
  { path: "/staffs", name: "staffs" },
  { path: "/settings/base", name: "base-info" },
  { path: "/settings/policies", name: "policies" },
] as const;

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

async function expectNoPageLevelScroll(page: Page) {
  const overflowTolerancePx = 2;
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main");

    return {
      docScrollHeight: doc.scrollHeight,
      docClientHeight: doc.clientHeight,
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      mainScrollHeight: main?.scrollHeight ?? null,
      mainClientHeight: main?.clientHeight ?? null,
      mainScrollWidth: main?.scrollWidth ?? null,
      mainClientWidth: main?.clientWidth ?? null,
    };
  });

  expect(
    metrics.docScrollHeight,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual(metrics.docClientHeight + overflowTolerancePx);
  expect(
    metrics.docScrollWidth,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual(metrics.docClientWidth + overflowTolerancePx);
  expect(
    metrics.bodyScrollHeight,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + overflowTolerancePx);
  expect(
    metrics.bodyScrollWidth,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual(metrics.bodyClientWidth + overflowTolerancePx);
  expect(
    metrics.mainScrollHeight,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual((metrics.mainClientHeight ?? 0) + overflowTolerancePx);
  expect(
    metrics.mainScrollWidth,
    JSON.stringify(metrics, null, 2)
  ).toBeLessThanOrEqual((metrics.mainClientWidth ?? 0) + overflowTolerancePx);
}

test.describe("Phase 1 design density gate", () => {
  test.use({ storageState: E2E_STORAGE_STATES.admin });

  for (const route of DESIGN_DENSITY_ROUTES) {
    test(`${route.name} fits without page-level scroll`, async ({
      page,
    }, testInfo) => {
      const assertNoRuntimeFailures = attachRuntimeFailureGuards(page);

      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator("aside").first()).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expectNoPageLevelScroll(page);

      await testInfo.attach(`${route.name}-${testInfo.project.name}`, {
        body: await page.screenshot({ caret: "initial", fullPage: false }),
        contentType: "image/png",
      });

      assertNoRuntimeFailures();
    });
  }
});
