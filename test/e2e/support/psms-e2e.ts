import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const WORKSPACE_ROOT = path.resolve(
  process.env.PSMS_WORKSPACE_ROOT ?? process.cwd()
);

function unquoteEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(line.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadRootEnv() {
  loadEnvFile(path.join(WORKSPACE_ROOT, ".env"));
  loadEnvFile(path.join(WORKSPACE_ROOT, ".env.example"));
}

loadRootEnv();

export const API_BASE_URL = process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
export const WEB_BASE_URL = process.env.PSMS_WEB_URL ?? "http://127.0.0.1:5273";

function envOrDefault(key: string, fallback: string) {
  const value = process.env[key]?.trim();

  return value || fallback;
}

export const ACCOUNTS = {
  admin: {
    loginId: envOrDefault("PSMS_SEED_ADMIN_LOGIN_ID", "admin1001"),
    password: envOrDefault("PSMS_SEED_ADMIN_PASSWORD", "LocalAdmin123!"),
  },
  staff: {
    loginId: envOrDefault("PSMS_SEED_STAFF_LOGIN_ID", "staff1001"),
    password: envOrDefault("PSMS_SEED_STAFF_PASSWORD", "LocalStaff123!"),
  },
} as const;

export const E2E_AUTH_DIR = path.join(WORKSPACE_ROOT, "test/.auth");
export const E2E_STORAGE_STATES = {
  admin: path.join(E2E_AUTH_DIR, "admin.json"),
  staff: path.join(E2E_AUTH_DIR, "staff.json"),
} as const;

export const GENERAL_WORKSPACE_ROUTES = [
  "/",
  "/sales",
  "/sales/new",
  "/receivables",
  "/customers",
  "/schedule",
  "/inventory",
  "/reports/summary",
] as const;

export const ADMIN_ONLY_ROUTES = [
  "/staffs",
  "/settings/base",
  "/settings/policies",
] as const;

export const ADMIN_ONLY_HREFS = ADMIN_ONLY_ROUTES;

export const STAFF_VISIBLE_HREFS = [
  "/sales",
  "/receivables",
  "/customers",
  "/schedule",
  "/inventory",
] as const;
