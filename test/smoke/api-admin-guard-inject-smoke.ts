import { copyFile, mkdir, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

import { adminBaseListQuerySchema } from "../../packages/shared/src/admin.validation";
import { SESSION_COOKIE_NAME } from "../../packages/shared/src/session-token";

interface ActionResult<T = unknown> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string>;
}

interface LoginResponseData {
  sessionToken: string;
  expiresAt: string;
  redirectTo: string;
}

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-admin-guard-inject-smoke",
  String(process.pid)
);
const tempDbPath = path.resolve(tempRunDir, "dev.db");
const tempRateLimitPath = path.resolve(tempRunDir, "login-rate-limit.json");

const accounts = {
  admin: {
    loginId: process.env.PSMS_SEED_ADMIN_LOGIN_ID ?? "admin1001",
    password: process.env.PSMS_SEED_ADMIN_PASSWORD ?? "LocalAdmin123!",
    role: "ADMIN" as const,
  },
  staff: {
    loginId: process.env.PSMS_SEED_STAFF_LOGIN_ID ?? "staff1001",
    password: process.env.PSMS_SEED_STAFF_PASSWORD ?? "LocalStaff123!",
    role: "STAFF" as const,
  },
};

function toSqliteFileUrl(filePath: string) {
  return `file:${filePath.replaceAll(path.sep, "/")}`;
}

function sessionCookie(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

function hasSecretField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSecretField);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, entryValue]) => {
    if (
      key === "passwordHash" ||
      key === "sessionToken" ||
      key === "sessionTokenHash"
    ) {
      return true;
    }

    return hasSecretField(entryValue);
  });
}

async function readJson<T>(payload: string): Promise<ActionResult<T>> {
  return JSON.parse(payload) as ActionResult<T>;
}

async function registerGuardProbeRoute(app: FastifyInstance) {
  const { requireAdminSession } =
    await import("../../apps/api/src/auth/admin-session.guard");

  app.get("/__test/admin-guard", async (request, reply) => {
    const guard = await requireAdminSession(request);

    if (!guard.ok) {
      reply.code(guard.statusCode);

      return guard.result;
    }

    const parsed = adminBaseListQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      reply.code(400);

      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "입력값을 확인해 주세요.",
      };
    }

    return {
      ok: true,
      data: {
        session: {
          loginId: guard.session.loginId,
          role: guard.session.role,
          status: guard.session.status,
        },
        query: parsed.data,
      },
    };
  });
}

async function main() {
  await mkdir(tempRunDir, { recursive: true });
  await copyFile(sourceDbPath, tempDbPath);

  process.env.NODE_ENV = "test";
  process.env.API_PORT = "4273";
  process.env.DATABASE_URL = toSqliteFileUrl(tempDbPath);
  process.env.PSMS_LOGIN_RATE_LIMIT_FILE = tempRateLimitPath;

  const currentAuthSecret = process.env.AUTH_SECRET?.trim();

  if (!currentAuthSecret || currentAuthSecret.startsWith("replace-with")) {
    process.env.AUTH_SECRET = "local-api-admin-guard-secret-32-bytes-psms";
  }

  const { createApiApp } = await import("../../apps/api/src/app");
  const { prisma } = await import("../../packages/db/src/client");
  const { hashSessionToken } =
    await import("../../packages/shared/src/session-token");
  const app = await createApiApp();

  await registerGuardProbeRoute(app);

  try {
    await assertNoCookie(app);
    await assertMalformedCookie(app);
    await assertUnknownToken(app);

    const adminToken = await login(app, accounts.admin);
    const staffToken = await login(app, accounts.staff);

    await assertStaffForbidden(app, staffToken);
    await assertStaffWithoutStoreAuthRequired(app, staffToken, prisma);
    await assertAdminSuccess(app, adminToken);
    await assertInvalidQueryAfterAdminAuth(app, adminToken);
    await assertNoSecretFields(app, adminToken);
    await assertDuplicateCookieIsConservative(app, adminToken);

    const expiredToken = await login(app, accounts.admin);

    await prisma.session.updateMany({
      where: { sessionTokenHash: hashSessionToken(expiredToken) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await assertAuthRequired(app, expiredToken);

    const revokedToken = await login(app, accounts.admin);

    await logout(app, revokedToken);
    await assertAuthRequired(app, revokedToken);

    const inactiveAdminToken = await login(app, accounts.admin);

    await prisma.user.update({
      where: { email: accounts.admin.loginId },
      data: { status: "INACTIVE" },
      select: { id: true },
    });
    await assertAuthRequired(app, inactiveAdminToken);

    console.log("api admin guard inject smoke passed");
  } finally {
    await app.close();
    await prisma.$disconnect();
    await rm(tempRunDir, { force: true, recursive: true });
  }
}

async function login(
  app: FastifyInstance,
  account: (typeof accounts)[keyof typeof accounts]
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      loginId: account.loginId,
      password: account.password,
    },
  });
  const json = await readJson<LoginResponseData>(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.ok(json.data?.sessionToken);

  return json.data.sessionToken;
}

async function logout(app: FastifyInstance, sessionToken: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
}

async function assertNoCookie(app: FastifyInstance) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertMalformedCookie(app: FastifyInstance) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=%E0%A4%A`,
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertUnknownToken(app: FastifyInstance) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: sessionCookie("unknown-session-token"),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertStaffForbidden(
  app: FastifyInstance,
  sessionToken: string
) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
  assert.equal(hasSecretField(json), false);
}

async function assertStaffWithoutStoreAuthRequired(
  app: FastifyInstance,
  sessionToken: string,
  prisma: { user: { update: (args: unknown) => Promise<unknown> } }
) {
  await prisma.user.update({
    where: { email: accounts.staff.loginId },
    data: { storeId: null },
    select: { id: true },
  });

  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertAdminSuccess(app: FastifyInstance, sessionToken: string) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard?tab=stores&page=2&pageSize=20",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson<{
    session: { loginId: string; role: "ADMIN"; status: "ACTIVE" };
    query: { tab: string; page: number; pageSize: number };
  }>(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.session.loginId, accounts.admin.loginId);
  assert.equal(json.data?.session.role, "ADMIN");
  assert.equal(json.data?.session.status, "ACTIVE");
  assert.equal(json.data?.query.tab, "stores");
  assert.equal(json.data?.query.page, 2);
  assert.equal(json.data?.query.pageSize, 20);
  assert.equal(hasSecretField(json), false);
}

async function assertInvalidQueryAfterAdminAuth(
  app: FastifyInstance,
  sessionToken: string
) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard?tab=backup",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 400);
  assert.equal(json.ok, false);
  assert.equal(json.code, "VALIDATION_FAILED");
  assert.equal(hasSecretField(json), false);
}

async function assertNoSecretFields(
  app: FastifyInstance,
  sessionToken: string
) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(hasSecretField(json), false);
}

async function assertDuplicateCookieIsConservative(
  app: FastifyInstance,
  sessionToken: string
) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=unknown-session-token; ${sessionCookie(sessionToken)}`,
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertAuthRequired(app: FastifyInstance, sessionToken: string) {
  const response = await app.inject({
    method: "GET",
    url: "/__test/admin-guard",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
