import { copyFile, mkdir, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

import {
  buildCredentialTokenActiveKey,
  generateCredentialToken,
  hashCredentialToken,
} from "../../packages/shared/src/credential-token";
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
  pendingActiveStaffId: string;
  pendingInactiveStaffId: string;
  expiredInactiveStaffId: string;
  storeId: string;
  policyId: string;
};

type PrismaClient = typeof import("../../packages/db/src/client").prisma;

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-admin-read-inject-smoke",
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
    const normalizedKey = key.toLowerCase();
    const secretKeys = new Set([
      "activekey",
      "password",
      "passwordhash",
      "rawpassword",
      "rawtoken",
      "sessiontoken",
      "sessiontokenhash",
      "tokenhash",
    ]);

    if (secretKeys.has(normalizedKey)) {
      return true;
    }

    return hasSecretField(entryValue);
  });
}

function asRecord(value: unknown) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));

  return value as Record<string, unknown>;
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
  process.env.PSMS_LOGIN_RATE_LIMIT_FILE = tempRateLimitPath;

  const currentAuthSecret = process.env.AUTH_SECRET?.trim();

  if (!currentAuthSecret || currentAuthSecret.startsWith("replace-with")) {
    process.env.AUTH_SECRET = "local-api-admin-read-secret-32-bytes-psms";
  }

  const currentPasswordTokenSecret = process.env.PASSWORD_TOKEN_SECRET?.trim();

  if (
    !currentPasswordTokenSecret ||
    currentPasswordTokenSecret.startsWith("replace-with")
  ) {
    process.env.PASSWORD_TOKEN_SECRET =
      "local-api-admin-read-password-token-secret-32-bytes";
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
      `/admin/staffs/detail?userId=${fixtures.pendingInactiveStaffId}`,
      `/admin/staffs/detail?userId=${fixtures.pendingActiveStaffId}`,
      "/admin/base/page-data?tab=stores",
      `/admin/base/detail?tab=stores&id=${fixtures.storeId}`,
      "/admin/policies/page-data?policyType=saleProfit",
      `/admin/policies/detail?policyType=saleProfit&policyId=${fixtures.policyId}`,
    ];

    await assertGuardRunsBeforeValidation(app);
    await assertStaffForbidden(app, staffToken, allowedRoutes);
    await assertAdminSuccess(app, adminToken, allowedRoutes);
    await assertStaffCredentialReadModel(app, adminToken, fixtures);
    await assertValidationFailures(app, adminToken);
    await assertNotFoundDetails(app, adminToken);

    console.log("api admin read inject smoke passed");
  } finally {
    await app.close();
    await prisma.$disconnect();
    await rm(tempRunDir, { force: true, recursive: true });
  }
}

async function seedFixtures(prisma: PrismaClient): Promise<FixtureContext> {
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
  const pendingInactiveStaff = await createStaffFixture(prisma, {
    loginId: `readpendinginactive${process.pid}`,
    name: "Read Pending Inactive Staff",
    status: "INACTIVE",
    storeId: store.id,
  });
  const pendingActiveStaff = await createStaffFixture(prisma, {
    loginId: `readpendingactive${process.pid}`,
    name: "Read Pending Active Staff",
    status: "ACTIVE",
    storeId: store.id,
  });
  const expiredInactiveStaff = await createStaffFixture(prisma, {
    loginId: `readexpiredinactive${process.pid}`,
    name: "Read Expired Inactive Staff",
    status: "INACTIVE",
    storeId: store.id,
  });

  await createPendingCredentialRequest(prisma, {
    actorUserId: adminUser.id,
    targetUserId: pendingInactiveStaff.id,
    purpose: "STAFF_ACTIVATION",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    action: "ADMIN_STAFF_ACTIVATION_ISSUED",
  });
  await createPendingCredentialRequest(prisma, {
    actorUserId: adminUser.id,
    targetUserId: pendingActiveStaff.id,
    purpose: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    action: "ADMIN_STAFF_PASSWORD_RESET_ISSUED",
  });
  await createPendingCredentialRequest(prisma, {
    actorUserId: adminUser.id,
    targetUserId: expiredInactiveStaff.id,
    purpose: "STAFF_ACTIVATION",
    expiresAt: new Date(Date.now() - 30 * 60 * 1000),
    action: "ADMIN_STAFF_ACTIVATION_ISSUED",
  });

  return {
    adminUserId: adminUser.id,
    pendingActiveStaffId: pendingActiveStaff.id,
    pendingInactiveStaffId: pendingInactiveStaff.id,
    expiredInactiveStaffId: expiredInactiveStaff.id,
    storeId: store.id,
    policyId: policy.id,
  };
}

async function createStaffFixture(
  prisma: PrismaClient,
  input: {
    loginId: string;
    name: string;
    status: "ACTIVE" | "INACTIVE";
    storeId: string;
  }
) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.loginId,
      passwordHash: "read-staff-password-hash-not-used",
      role: "STAFF",
      status: input.status,
      storeId: input.storeId,
    },
    select: { id: true },
  });
}

async function createPendingCredentialRequest(
  prisma: PrismaClient,
  input: {
    actorUserId: string;
    targetUserId: string;
    purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET";
    expiresAt: Date;
    action:
      | "ADMIN_STAFF_ACTIVATION_ISSUED"
      | "ADMIN_STAFF_PASSWORD_RESET_ISSUED";
  }
) {
  const token = await prisma.userPasswordToken.create({
    data: {
      userId: input.targetUserId,
      purpose: input.purpose,
      tokenHash: hashCredentialToken(generateCredentialToken(), input.purpose),
      activeKey: buildCredentialTokenActiveKey(
        input.targetUserId,
        input.purpose
      ),
      expiresAt: input.expiresAt,
      createdById: input.actorUserId,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: "User",
      entityId: input.targetUserId,
      afterJson: {
        userId: input.targetUserId,
        tokenId: token.id,
        purpose: input.purpose,
        expiresAt: input.expiresAt.toISOString(),
        deliveryMode: "OUT_OF_BAND_APPROVED",
      },
      reason: "read model fixture",
    },
  });
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

async function getStaffDetail(
  app: FastifyInstance,
  adminToken: string,
  userId: string
) {
  const response = await app.inject({
    method: "GET",
    url: `/admin/staffs/detail?userId=${userId}`,
    headers: { cookie: sessionCookie(adminToken) },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.ok(json.data);
  assert.equal(hasSecretField(json), false);

  return asRecord(json.data);
}

async function assertStaffCredentialReadModel(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const activationDetail = await getStaffDetail(
    app,
    adminToken,
    fixtures.pendingInactiveStaffId
  );
  const activationRequests = asRecord(activationDetail.credentialRequests);
  const activation = asRecord(activationRequests.activation);

  assert.equal(typeof activationRequests.asOf, "string");
  assert.equal(activation.status, "PENDING");
  assert.equal(activation.deliveryMode, "OUT_OF_BAND_APPROVED");
  assert.equal(activation.canRevoke, true);
  assert.equal(typeof activation.issuedAt, "string");
  assert.equal(typeof activation.expiresAt, "string");
  assert.equal(typeof activation.issuedByName, "string");
  assert.equal(
    asRecord(activationRequests.passwordReset).status,
    "NONE",
    "inactive staff should not expose a reset pending state"
  );

  const resetDetail = await getStaffDetail(
    app,
    adminToken,
    fixtures.pendingActiveStaffId
  );
  const resetRequests = asRecord(resetDetail.credentialRequests);
  const reset = asRecord(resetRequests.passwordReset);

  assert.equal(reset.status, "PENDING");
  assert.equal(reset.deliveryMode, "OUT_OF_BAND_APPROVED");
  assert.equal(reset.canRevoke, true);
  assert.equal(
    asRecord(resetRequests.activation).status,
    "NONE",
    "active staff should not expose an activation pending state"
  );

  const expiredDetail = await getStaffDetail(
    app,
    adminToken,
    fixtures.expiredInactiveStaffId
  );
  const expiredRequests = asRecord(expiredDetail.credentialRequests);

  assert.equal(asRecord(expiredRequests.activation).status, "NONE");
  assert.equal(asRecord(expiredRequests.passwordReset).status, "NONE");
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
