import { copyFile, mkdir, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

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

type FixtureContext = {
  adminUserId: string;
  storeId: string;
  policyId: string;
};

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-admin-read-inject-smoke",
  String(process.pid)
);
const tempDbPath = path.resolve(tempRunDir, "dev.db");

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

async function main() {
  await mkdir(tempRunDir, { recursive: true });
  await copyFile(sourceDbPath, tempDbPath);

  process.env.NODE_ENV = "test";
  process.env.API_PORT = "4273";
  process.env.DATABASE_URL = toSqliteFileUrl(tempDbPath);

  const currentAuthSecret = process.env.AUTH_SECRET?.trim();

  if (!currentAuthSecret || currentAuthSecret.startsWith("replace-with")) {
    process.env.AUTH_SECRET = "local-api-admin-read-secret-32-bytes-psms";
  }

  const { createApiApp } = await import("../../apps/api/src/app");
  const { prisma } = await import("../../packages/db/src/client");
  const app = await createApiApp();

  try {
    const fixtures = await seedFixtures(prisma);
    const adminToken = await login(app, accounts.admin);
    const staffToken = await login(app, accounts.staff);
    const allowedRoutes = [
      "/admin/staffs/page-data",
      `/admin/staffs/detail?userId=${fixtures.adminUserId}`,
      "/admin/base/page-data?tab=stores",
      `/admin/base/detail?tab=stores&id=${fixtures.storeId}`,
      "/admin/policies/page-data?policyType=saleProfit",
      `/admin/policies/detail?policyType=saleProfit&policyId=${fixtures.policyId}`,
    ];

    await assertGuardRunsBeforeValidation(app);
    await assertStaffForbidden(app, staffToken, allowedRoutes);
    await assertAdminSuccess(app, adminToken, allowedRoutes);
    await assertValidationFailures(app, adminToken);
    await assertNotFoundDetails(app, adminToken);

    console.log("api admin read inject smoke passed");
  } finally {
    await app.close();
    await prisma.$disconnect();
    await rm(tempRunDir, { force: true, recursive: true });
  }
}

async function seedFixtures(prisma: {
  user: {
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  store: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  carrier: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
  saleProfitPolicy: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
}): Promise<FixtureContext> {
  const adminUser = await prisma.user.findUnique({
    where: { email: accounts.admin.loginId },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error("Seed admin user is missing.");
  }

  const store =
    (await prisma.store.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.store.create({
      data: {
        code: "QA-STORE",
        name: "QA Store",
        status: "ACTIVE",
      },
      select: { id: true },
    }));

  const carrier = await prisma.carrier.upsert({
    where: { code: "QA-CARRIER" },
    update: {
      name: "QA Carrier",
      status: "ACTIVE",
    },
    create: {
      code: "QA-CARRIER",
      name: "QA Carrier",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const policy = await prisma.saleProfitPolicy.upsert({
    where: { id: "qa-sale-profit-policy" },
    update: {
      name: "QA Sale Profit",
      carrierId: carrier.id,
      subscriptionType: "NEW",
      status: "ACTIVE",
      version: "v1",
      effectiveFrom: new Date("2026-05-01T00:00:00.000Z"),
      effectiveTo: null,
      priority: 10,
      ruleJson: { kind: "fixed", amount: 1000 },
      updatedById: adminUser.id,
    },
    create: {
      id: "qa-sale-profit-policy",
      name: "QA Sale Profit",
      carrierId: carrier.id,
      subscriptionType: "NEW",
      status: "ACTIVE",
      version: "v1",
      effectiveFrom: new Date("2026-05-01T00:00:00.000Z"),
      effectiveTo: null,
      priority: 10,
      ruleJson: { kind: "fixed", amount: 1000 },
      createdById: adminUser.id,
      updatedById: adminUser.id,
    },
    select: { id: true },
  });

  return {
    adminUserId: adminUser.id,
    storeId: store.id,
    policyId: policy.id,
  };
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

async function assertGuardRunsBeforeValidation(app: FastifyInstance) {
  const response = await app.inject({
    method: "GET",
    url: "/admin/base/page-data?tab=backup",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertStaffForbidden(
  app: FastifyInstance,
  staffToken: string,
  urls: string[]
) {
  for (const url of urls) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { cookie: sessionCookie(staffToken) },
    });
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 403, url);
    assert.equal(json.ok, false, url);
    assert.equal(json.code, "FORBIDDEN", url);
    assert.equal(hasSecretField(json), false, url);
  }
}

async function assertAdminSuccess(
  app: FastifyInstance,
  adminToken: string,
  urls: string[]
) {
  for (const url of urls) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { cookie: sessionCookie(adminToken) },
    });
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 200, url);
    assert.equal(json.ok, true, url);
    assert.ok(json.data, url);
    assert.equal(hasSecretField(json), false, url);
  }
}

async function assertValidationFailures(
  app: FastifyInstance,
  adminToken: string
) {
  const urls = [
    "/admin/staffs/page-data?role=staff",
    "/admin/staffs/detail",
    "/admin/base/page-data?tab=backup",
    "/admin/base/detail?tab=stores",
    "/admin/policies/page-data?from=2026-06-01&to=2026-05-01",
    "/admin/policies/detail?policyType=saleProfit",
  ];

  for (const url of urls) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { cookie: sessionCookie(adminToken) },
    });
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 400, url);
    assert.equal(json.ok, false, url);
    assert.equal(json.code, "VALIDATION_FAILED", url);
    assert.equal(hasSecretField(json), false, url);
  }
}

async function assertNotFoundDetails(app: FastifyInstance, adminToken: string) {
  const urls = [
    "/admin/staffs/detail?userId=missing-user-id",
    "/admin/base/detail?tab=stores&id=missing-store-id",
    "/admin/policies/detail?policyType=saleProfit&policyId=missing-policy-id",
  ];

  for (const url of urls) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { cookie: sessionCookie(adminToken) },
    });
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 404, url);
    assert.equal(json.ok, false, url);
    assert.equal(json.code, "NOT_FOUND", url);
    assert.equal(hasSecretField(json), false, url);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
