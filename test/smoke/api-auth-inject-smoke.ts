import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

import { resetLoginRateLimitForTest } from "../../apps/api/src/auth/login-rate-limit";
import { SESSION_COOKIE_NAME } from "../../packages/shared/src/session-token";

interface ActionResult<T = unknown> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
  redirectTo?: string;
}

interface LoginResponseData {
  sessionToken: string;
  expiresAt: string;
  redirectTo: string;
}

interface SessionResponseData {
  session: {
    loginId: string;
    role: "ADMIN" | "STAFF";
    status: "ACTIVE" | "INACTIVE";
  };
}

type PrismaClient = typeof import("../../packages/db/src/client").prisma;

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-auth-inject-smoke",
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

async function readJson<T>(payload: string): Promise<ActionResult<T>> {
  return JSON.parse(payload) as ActionResult<T>;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
    process.env.AUTH_SECRET = "local-api-inject-auth-secret-32-bytes-psms";
  }

  const { createApiApp } = await import("../../apps/api/src/app");
  const { prisma } = await import("../../packages/db/src/client");
  const app = await createApiApp();

  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    const healthJson = JSON.parse(health.payload) as {
      ok: boolean;
      service: string;
      port: number;
    };

    assert.equal(health.statusCode, 200);
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.service, "psms-api");
    assert.equal(healthJson.port, 4273);

    const invalidLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { loginId: "bad-id!", password: "x" },
    });
    const invalidLoginJson = await readJson(invalidLogin.payload);

    assert.equal(invalidLogin.statusCode, 400);
    assert.equal(invalidLoginJson.ok, false);
    assert.equal(invalidLoginJson.code, "VALIDATION_FAILED");

    const missingSession = await app.inject({
      method: "GET",
      url: "/auth/session",
    });
    const missingSessionJson = await readJson(missingSession.payload);

    assert.equal(missingSession.statusCode, 401);
    assert.equal(missingSessionJson.ok, false);
    assert.equal(missingSessionJson.code, "AUTH_REQUIRED");

    await assertMalformedSessionCookie(app);
    await assertMalformedLogoutCookie(app);
    await assertLoginRateLimit(app, prisma);

    const adminToken = await login(app, accounts.admin);
    const staffToken = await login(app, accounts.staff);

    await assertSession(app, accounts.admin, adminToken);
    await assertSession(app, accounts.staff, staffToken);
    await logout(app, adminToken);
    await logout(app, staffToken);
    await assertRevoked(app, adminToken);
    await assertRevoked(app, staffToken);

    console.log("api auth inject smoke passed");
  } finally {
    await app.close();
    await prisma.$disconnect();
    await rm(tempRunDir, { force: true, recursive: true });
  }
}

async function login(
  app: FastifyInstance,
  account: (typeof accounts)[keyof typeof accounts],
  headers?: Record<string, string>
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers,
    payload: {
      loginId: account.loginId,
      password: account.password,
    },
  });
  const json = await readJson<LoginResponseData>(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.redirectTo, "/");
  assert.equal(json.data?.redirectTo, "/");
  assert.ok(json.data?.sessionToken);

  return json.data.sessionToken;
}

async function assertLoginRateLimit(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const limitedIp = "198.51.100.90";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "x-forwarded-for": limitedIp,
      },
      payload: {
        loginId: accounts.admin.loginId,
        password: "WrongPassword123!",
      },
    });
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 403);
    assert.equal(json.ok, false);
    assert.equal(json.code, "FORBIDDEN");
    assert.equal(getHeaderValue(response.headers["retry-after"]), undefined);
    assert.equal(json.data, undefined);
  }

  const blocked = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: {
      "x-forwarded-for": limitedIp,
    },
    payload: {
      loginId: accounts.admin.loginId,
      password: "WrongPassword123!",
    },
  });
  const blockedJson = await readJson(blocked.payload);

  const retryAfter = getHeaderValue(blocked.headers["retry-after"]);

  assert.equal(blocked.statusCode, 429);
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "RATE_LIMITED");
  assert.match(blockedJson.message ?? "", /로그인 시도가 많습니다/);
  assert.match(retryAfter ?? "", /^[1-9]\d*$/);
  assert.ok(Number(retryAfter) <= 15 * 60);
  assert.equal(getHeaderValue(blocked.headers["cache-control"]), "no-store");
  assert.equal(
    (blockedJson as Record<string, unknown>).retryAfterSeconds,
    undefined
  );
  assert.equal(
    (blockedJson as Record<string, unknown>).sessionToken,
    undefined
  );
  assert.equal((blockedJson as Record<string, unknown>).expiresAt, undefined);
  assert.equal((blockedJson as Record<string, unknown>).redirectTo, undefined);
  assert.equal((blockedJson as Record<string, unknown>).session, undefined);
  assert.equal((blockedJson as Record<string, unknown>).user, undefined);
  assert.equal(getHeaderValue(blocked.headers["set-cookie"]), undefined);
  assert.equal(blockedJson.data, undefined);

  const clearIp = "198.51.100.91";
  const failedBeforeSuccess = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: {
      "x-forwarded-for": clearIp,
    },
    payload: {
      loginId: accounts.staff.loginId,
      password: "WrongPassword123!",
    },
  });
  const failedBeforeSuccessJson = await readJson(failedBeforeSuccess.payload);

  assert.equal(failedBeforeSuccess.statusCode, 403);
  assert.equal(failedBeforeSuccessJson.ok, false);
  assert.equal(failedBeforeSuccessJson.code, "FORBIDDEN");

  const staffToken = await login(app, accounts.staff, {
    "x-forwarded-for": clearIp,
  });

  await logout(app, staffToken);

  const failedAfterSuccess = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: {
      "x-forwarded-for": clearIp,
    },
    payload: {
      loginId: accounts.staff.loginId,
      password: "WrongPassword123!",
    },
  });
  const failedAfterSuccessJson = await readJson(failedAfterSuccess.payload);

  assert.equal(failedAfterSuccess.statusCode, 403);
  assert.equal(failedAfterSuccessJson.ok, false);
  assert.equal(failedAfterSuccessJson.code, "FORBIDDEN");
  assert.doesNotMatch(
    failedAfterSuccessJson.message ?? "",
    /로그인 시도가 많습니다/
  );

  await assertCorruptLoginRateLimitBlocksBeforeSession(app, prisma);
}

async function assertCorruptLoginRateLimitBlocksBeforeSession(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const corruptIp = "198.51.100.92";

  resetLoginRateLimitForTest();

  const sessionCountBefore = await prisma.session.count();
  const failedAuditCountBefore = await prisma.auditLog.count({
    where: { action: "AUTH_LOGIN_FAILED" },
  });

  try {
    await writeFile(tempRateLimitPath, "{", "utf8");

    const blocked = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "x-forwarded-for": corruptIp,
      },
      payload: {
        loginId: accounts.admin.loginId,
        password: accounts.admin.password,
      },
    });
    const blockedJson = await readJson(blocked.payload);
    const retryAfter = getHeaderValue(blocked.headers["retry-after"]);

    assert.equal(blocked.statusCode, 429);
    assert.equal(blockedJson.ok, false);
    assert.equal(blockedJson.code, "RATE_LIMITED");
    assert.match(blockedJson.message ?? "", /로그인 시도가 많습니다/);
    assert.match(retryAfter ?? "", /^[1-9]\d*$/);
    assert.ok(Number(retryAfter) <= 15 * 60);
    assert.equal(getHeaderValue(blocked.headers["cache-control"]), "no-store");
    assert.equal(getHeaderValue(blocked.headers["set-cookie"]), undefined);
    assert.equal(blockedJson.data, undefined);
    assert.equal(
      (blockedJson as Record<string, unknown>).sessionToken,
      undefined
    );
    assert.equal((blockedJson as Record<string, unknown>).expiresAt, undefined);
    assert.equal(
      (blockedJson as Record<string, unknown>).redirectTo,
      undefined
    );
    assert.equal(
      JSON.stringify(blockedJson).includes(accounts.admin.password),
      false
    );
    assert.equal(
      JSON.stringify(blockedJson).includes(accounts.admin.loginId),
      false
    );
    assert.equal(JSON.stringify(blockedJson).includes(corruptIp), false);
    assert.equal(await prisma.session.count(), sessionCountBefore);
    assert.equal(
      await prisma.auditLog.count({
        where: { action: "AUTH_LOGIN_FAILED" },
      }),
      failedAuditCountBefore + 1
    );
  } finally {
    resetLoginRateLimitForTest();
  }
}

async function assertSession(
  app: FastifyInstance,
  account: (typeof accounts)[keyof typeof accounts],
  sessionToken: string
) {
  const response = await app.inject({
    method: "GET",
    url: "/auth/session",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson<SessionResponseData>(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.session.loginId, account.loginId);
  assert.equal(json.data?.session.role, account.role);
  assert.equal(json.data?.session.status, "ACTIVE");
}

async function assertMalformedSessionCookie(app: FastifyInstance) {
  const response = await app.inject({
    method: "GET",
    url: "/auth/session",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=%E0%A4%A`,
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
}

async function assertMalformedLogoutCookie(app: FastifyInstance) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=%E0%A4%A`,
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
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

async function assertRevoked(app: FastifyInstance, sessionToken: string) {
  const response = await app.inject({
    method: "GET",
    url: "/auth/session",
    headers: {
      cookie: sessionCookie(sessionToken),
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
