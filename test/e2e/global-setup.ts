import { chromium, request } from "@playwright/test";
import type { Browser, BrowserContext } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  ACCOUNTS,
  API_BASE_URL,
  E2E_AUTH_DIR,
  E2E_STORAGE_STATES,
  WEB_BASE_URL,
  WORKSPACE_ROOT,
} from "./support/psms-e2e";

const E2E_VIEWPORT = { width: 1586, height: 992 };

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const child = spawn(
      isWindows ? (process.env.ComSpec ?? "cmd.exe") : command,
      isWindows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args,
      {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          PSMS_SEED_ADMIN_PASSWORD:
            process.env.PSMS_SEED_ADMIN_PASSWORD || ACCOUNTS.admin.password,
          PSMS_SEED_STAFF_PASSWORD:
            process.env.PSMS_SEED_STAFF_PASSWORD || ACCOUNTS.staff.password,
          SEED_RESET_PASSWORDS: "true",
          SEED_RESET_PASSWORD_LOGIN_IDS: [
            ACCOUNTS.admin.loginId,
            ACCOUNTS.staff.loginId,
          ].join(","),
        },
        stdio: "inherit",
      }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function assertApiHealth() {
  const api = await request.newContext();

  try {
    const response = await api.get(`${API_BASE_URL}/health`);

    if (response.status() !== 200) {
      throw new Error(`API health returned ${response.status()}`);
    }

    const health = await response.json();

    if (health.ok !== true || health.port !== 4273) {
      throw new Error("API health did not confirm PSMS API on port 4273.");
    }
  } finally {
    await api.dispose();
  }
}

async function loginAndSaveStorageState(
  browser: Browser,
  account: (typeof ACCOUNTS)["admin"],
  storageStatePath: string
) {
  const context = await browser.newContext({
    baseURL: WEB_BASE_URL,
    viewport: E2E_VIEWPORT,
  });
  const page = await context.newPage();

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="loginId"]').fill(account.loginId);
    await page.locator('input[name="password"]').fill(account.password);

    await page.locator('button[type="submit"]').click();

    const deadline = Date.now() + 30_000;
    let hasSessionCookie = false;

    while (Date.now() < deadline) {
      const cookies = await context.cookies(WEB_BASE_URL);
      hasSessionCookie = cookies.some(
        (cookie) => cookie.name === "psms_session"
      );

      if (hasSessionCookie) {
        break;
      }

      await page.waitForTimeout(250);
    }

    if (!hasSessionCookie) {
      const loginStatus = await page
        .locator("#login-status")
        .textContent({ timeout: 1_000 })
        .catch(() => null);

      throw new Error(
        `${account.loginId} login did not create psms_session. ${loginStatus ?? ""}`.trim()
      );
    }

    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/", { waitUntil: "domcontentloaded" });
    }

    await context.storageState({ path: storageStatePath });
  } finally {
    await context.close();
  }
}

export default async function globalSetup() {
  await rm(E2E_AUTH_DIR, { force: true, recursive: true });
  await mkdir(E2E_AUTH_DIR, { recursive: true });

  if (process.env.PSMS_SKIP_E2E_SEED_RESET !== "true") {
    await runCommand(pnpmCommand(), [
      process.env.PSMS_E2E_DB_MODE === "isolated"
        ? "test:e2e:db:reset"
        : "test:e2e:seed",
    ]);
  }

  await assertApiHealth();

  const browser = await chromium.launch();

  try {
    await loginAndSaveStorageState(
      browser,
      ACCOUNTS.admin,
      E2E_STORAGE_STATES.admin
    );
    await loginAndSaveStorageState(
      browser,
      ACCOUNTS.staff,
      E2E_STORAGE_STATES.staff
    );
  } finally {
    await browser.close();
  }
}
