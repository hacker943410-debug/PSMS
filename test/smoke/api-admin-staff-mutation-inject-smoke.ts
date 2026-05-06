import { copyFile, mkdir, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

import {
  hashPassword,
  isPasswordHash,
} from "../../packages/shared/src/password";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../packages/shared/src/session-token";

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

interface SessionResponseData {
  session: {
    loginId: string;
    role: "ADMIN" | "STAFF";
    status: "ACTIVE" | "INACTIVE";
  };
}

interface ChangeStatusResponseData {
  userId: string;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
  revokedSessionCount: number;
}

interface UpdateStaffResponseData {
  userId: string;
  name: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  updatedAt: string;
  changedFields: Array<"name" | "role" | "storeId" | "phone">;
  revokedSessionCount: number;
}

interface CreateStaffResponseData {
  userId: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  status: "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

type PrismaClient = typeof import("../../packages/db/src/client").prisma;

type FixtureContext = {
  adminUserId: string;
  staffUserId: string;
  targetStaffId: string;
  targetStaffLoginId: string;
  targetStaffPassword: string;
  activeStoreId: string;
  secondaryActiveStoreId: string;
  inactiveStoreId: string;
};

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-admin-staff-mutation-inject-smoke",
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

let fixtureSequence = 0;

function toSqliteFileUrl(filePath: string) {
  return `file:${filePath.replaceAll(path.sep, "/")}`;
}

function sessionCookie(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

function hasSecretField(value: unknown): boolean {
  const secretTextPattern =
    /initialpassword|issuetemporarypassword|password|passwordhash|placeholdersecret|rawpassword|resettoken|sessiontoken|sessiontokenhash|shouldsendinitialpassword|temporarypassword|비밀번호|패스워드|암호|secret|token/i;

  if (Array.isArray(value)) {
    return value.some(hasSecretField);
  }

  if (typeof value === "string") {
    return secretTextPattern.test(value);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, entryValue]) => {
    const normalizedKey = key.toLowerCase();
    const secretKeys = new Set([
      "initialpassword",
      "issuetemporarypassword",
      "password",
      "passwordhash",
      "placeholdersecret",
      "rawpassword",
      "resettoken",
      "sessiontoken",
      "sessiontokenhash",
      "shouldsendinitialpassword",
      "temporarypassword",
    ]);

    if (secretKeys.has(normalizedKey)) {
      return true;
    }

    if (normalizedKey === "passworddelivery" && entryValue !== "NONE") {
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

  const currentAuthSecret = process.env.AUTH_SECRET?.trim();

  if (!currentAuthSecret || currentAuthSecret.startsWith("replace-with")) {
    process.env.AUTH_SECRET = "local-api-admin-staff-mutation-secret-psms";
  }

  const { createApiApp } = await import("../../apps/api/src/app");
  const { prisma } = await import("../../packages/db/src/client");
  const app = await createApiApp();

  try {
    const fixtures = await seedFixtures(prisma);
    const adminToken = await login(app, accounts.admin);
    const staffToken = await login(app, accounts.staff);
    const targetStaffToken = await login(app, {
      loginId: fixtures.targetStaffLoginId,
      password: fixtures.targetStaffPassword,
      role: "STAFF",
    });

    await assertGuardRunsBeforeValidation(app);
    await assertStaffForbidden(app, staffToken, fixtures, prisma);
    await assertUpdateGuardRunsBeforeValidation(app, prisma);
    await assertUpdateStaffForbidden(app, staffToken, fixtures, prisma);
    await assertCreateGuardRunsBeforeValidation(app, prisma);
    await assertCreateStaffForbidden(app, staffToken, fixtures, prisma);
    await assertCreateValidationFailures(app, adminToken, fixtures);
    await assertCreateStaffSuccess(app, adminToken, fixtures, prisma);
    await assertCreateAdminSuccess(app, adminToken, prisma);
    await assertCreateDuplicateLoginId(app, adminToken, fixtures, prisma);
    await assertCreateStoreRules(app, adminToken, fixtures);
    await assertUpdateValidationFailures(app, adminToken, fixtures);
    await assertUpdateMissingUser(app, adminToken);
    await assertUpdateNoChange(app, adminToken, fixtures, prisma);
    await assertUpdateStaleRecord(app, adminToken, fixtures, prisma);
    await assertSelfRoleDowngradeForbidden(app, adminToken, fixtures);
    await assertStaffStoreRequired(app, adminToken, fixtures, prisma);
    await assertUpdateNamePhoneKeepsSession(app, adminToken, fixtures, prisma);
    await assertUpdateRoleStoreRevokesSession(
      app,
      adminToken,
      fixtures,
      prisma
    );
    await assertAdminValidationFailure(app, adminToken, fixtures);
    await assertMissingUser(app, adminToken);
    await assertSelfDisableForbidden(app, adminToken, fixtures);
    await assertSameStatusForbidden(app, adminToken, fixtures);
    await assertStaleRecord(app, adminToken, fixtures);
    await assertSuccessRevokesTargetSession(
      app,
      adminToken,
      targetStaffToken,
      fixtures,
      prisma
    );
    await assertLastAdminRoleDowngradeForbiddenViaDevBypass(app, prisma);
    await assertLastAdminForbiddenViaDevBypass(app, prisma);

    console.log("api admin staff mutation inject smoke passed");
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
  const staffUser = await prisma.user.findUnique({
    where: { email: accounts.staff.loginId },
    select: { id: true },
  });

  if (!adminUser || !staffUser) {
    throw new Error("Seed admin or staff user is missing.");
  }

  const store =
    (await prisma.store.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.store.create({
      data: {
        code: "QA-STAFF-MUTATION-STORE",
        name: "QA Staff Mutation Store",
        status: "ACTIVE",
      },
      select: { id: true },
    }));
  const secondaryActiveStore = await prisma.store.create({
    data: {
      code: "QA-STAFF-MUTATION-STORE-2",
      name: "QA Staff Mutation Store 2",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const inactiveStore = await prisma.store.create({
    data: {
      code: "QA-STAFF-MUTATION-INACTIVE",
      name: "QA Staff Mutation Inactive Store",
      status: "INACTIVE",
    },
    select: { id: true },
  });

  const targetStaffPassword = "MutationStaff123!";
  const targetStaffLoginId = `mutationstaff${process.pid}`;
  const targetStaff = await prisma.user.create({
    data: {
      name: "Mutation Target Staff",
      email: targetStaffLoginId,
      passwordHash: await hashPassword(targetStaffPassword),
      role: "STAFF",
      status: "ACTIVE",
      phone: "010-0000-0000",
      storeId: store.id,
    },
    select: { id: true },
  });

  return {
    adminUserId: adminUser.id,
    staffUserId: staffUser.id,
    targetStaffId: targetStaff.id,
    targetStaffLoginId,
    targetStaffPassword,
    activeStoreId: store.id,
    secondaryActiveStoreId: secondaryActiveStore.id,
    inactiveStoreId: inactiveStore.id,
  };
}

function nextLoginId(prefix: string) {
  fixtureSequence += 1;

  return `${prefix}${process.pid}${fixtureSequence}`.toLowerCase();
}

async function createUserFixture(
  prisma: PrismaClient,
  input: {
    role?: "ADMIN" | "STAFF";
    status?: "ACTIVE" | "INACTIVE";
    storeId?: string | null;
    name?: string;
    phone?: string | null;
    loginPrefix?: string;
  }
) {
  const password = "MutationStaff123!";
  const loginId = nextLoginId(input.loginPrefix ?? "mutuser");
  const user = await prisma.user.create({
    data: {
      name: input.name ?? "Mutation User",
      email: loginId,
      passwordHash: await hashPassword(password),
      role: input.role ?? "STAFF",
      status: input.status ?? "ACTIVE",
      phone: input.phone,
      storeId: input.storeId,
    },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  return {
    id: user.id,
    updatedAt: user.updatedAt,
    loginId,
    password,
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

async function postChangeStatus(
  app: FastifyInstance,
  sessionToken: string | null,
  payload: unknown
) {
  return app.inject({
    method: "POST",
    url: "/admin/staffs/change-status",
    headers: sessionToken ? { cookie: sessionCookie(sessionToken) } : undefined,
    payload,
  });
}

async function postUpdateStaff(
  app: FastifyInstance,
  sessionToken: string | null,
  payload: unknown
) {
  return app.inject({
    method: "POST",
    url: "/admin/staffs/update",
    headers: sessionToken ? { cookie: sessionCookie(sessionToken) } : undefined,
    payload,
  });
}

async function postCreateStaff(
  app: FastifyInstance,
  sessionToken: string | null,
  payload: unknown
) {
  return app.inject({
    method: "POST",
    url: "/admin/staffs/create",
    headers: sessionToken ? { cookie: sessionCookie(sessionToken) } : undefined,
    payload,
  });
}

async function assertGuardRunsBeforeValidation(app: FastifyInstance) {
  const response = await postChangeStatus(app, null, {
    userId: "",
    status: "BROKEN",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(hasSecretField(json), false);
}

async function assertUpdateGuardRunsBeforeValidation(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const auditCountBefore = await prisma.auditLog.count({
    where: { action: "ADMIN_MUTATION_FORBIDDEN" },
  });
  const response = await postUpdateStaff(app, null, {
    userId: "",
    role: "BROKEN",
  });
  const json = await readJson(response.payload);
  const auditCountAfter = await prisma.auditLog.count({
    where: { action: "ADMIN_MUTATION_FORBIDDEN" },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(auditCountAfter, auditCountBefore);
  assert.equal(hasSecretField(json), false);
}

async function assertStaffForbidden(
  app: FastifyInstance,
  staffToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const response = await postChangeStatus(app, staffToken, {
    userId: fixtures.targetStaffId,
    status: "INACTIVE",
    reason: "staff forbidden smoke",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
  assert.equal(hasSecretField(json), false);

  const target = await prisma.user.findUnique({
    where: { id: fixtures.targetStaffId },
    select: { status: true },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(target?.status, "ACTIVE");
  assert.ok(audit);
  assert.equal(hasSecretField(audit), false);
  assert.equal(asRecord(audit.afterJson).route, "/admin/staffs/change-status");
}

async function assertCreateGuardRunsBeforeValidation(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const auditCountBefore = await prisma.auditLog.count({
    where: { action: "ADMIN_MUTATION_FORBIDDEN" },
  });
  const response = await postCreateStaff(app, null, {
    name: "",
    loginId: "bad login id",
    role: "BROKEN",
    password: "ShouldNotBeAccepted123!",
  });
  const json = await readJson(response.payload);
  const auditCountAfter = await prisma.auditLog.count({
    where: { action: "ADMIN_MUTATION_FORBIDDEN" },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(auditCountAfter, auditCountBefore);
  assert.equal(hasSecretField(json), false);
}

async function assertUpdateStaffForbidden(
  app: FastifyInstance,
  staffToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    storeId: fixtures.activeStoreId,
    name: "Forbidden Update Target",
    phone: "010-1111-1111",
    loginPrefix: "forbid",
  });
  const response = await postUpdateStaff(app, staffToken, {
    userId: target.id,
    name: "Forbidden Updated",
  });
  const json = await readJson(response.payload);
  const targetAfter = await prisma.user.findUnique({
    where: { id: target.id },
    select: { name: true },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
  assert.equal(targetAfter?.name, "Forbidden Update Target");
  assert.ok(audit);
  assert.equal(asRecord(audit.afterJson).route, "/admin/staffs/update");
  assert.equal(hasSecretField(json), false);
  assert.equal(hasSecretField(audit), false);
}

async function assertCreateStaffForbidden(
  app: FastifyInstance,
  staffToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const loginId = nextLoginId("cfbd");
  const auditCountBefore = await prisma.auditLog.count({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
  });
  const response = await postCreateStaff(app, staffToken, {
    name: "Forbidden Created Staff",
    loginId,
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const json = await readJson(response.payload);
  const createdCount = await prisma.user.count({
    where: { email: loginId },
  });
  const auditCountAfter = await prisma.auditLog.count({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
  assert.equal(createdCount, 0);
  assert.equal(auditCountAfter, auditCountBefore + 1);
  assert.ok(audit);
  assert.equal(asRecord(audit.afterJson).route, "/admin/staffs/create");
  assert.equal(
    asRecord(audit.afterJson).attemptedAction,
    "ADMIN_STAFF_CREATED"
  );
  assert.equal(hasSecretField(json), false);
  assert.equal(hasSecretField(audit), false);
}

async function assertCreateValidationFailures(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const invalidName = await postCreateStaff(app, adminToken, {
    name: "x",
    loginId: nextLoginId("cvn"),
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const invalidNameJson = await readJson(invalidName.payload);

  assert.equal(invalidName.statusCode, 400);
  assert.equal(invalidNameJson.ok, false);
  assert.equal(invalidNameJson.code, "VALIDATION_FAILED");
  assert.ok(invalidNameJson.fieldErrors?.name);
  assert.equal(hasSecretField(invalidNameJson), false);

  const invalidLoginId = await postCreateStaff(app, adminToken, {
    name: "Invalid Login",
    loginId: "bad-login",
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const invalidLoginIdJson = await readJson(invalidLoginId.payload);

  assert.equal(invalidLoginId.statusCode, 400);
  assert.equal(invalidLoginIdJson.ok, false);
  assert.equal(invalidLoginIdJson.code, "VALIDATION_FAILED");
  assert.ok(invalidLoginIdJson.fieldErrors?.loginId);
  assert.equal(hasSecretField(invalidLoginIdJson), false);

  const invalidRole = await postCreateStaff(app, adminToken, {
    name: "Invalid Role",
    loginId: nextLoginId("cvr"),
    role: "OWNER",
    storeId: fixtures.activeStoreId,
  });
  const invalidRoleJson = await readJson(invalidRole.payload);

  assert.equal(invalidRole.statusCode, 400);
  assert.equal(invalidRoleJson.ok, false);
  assert.equal(invalidRoleJson.code, "VALIDATION_FAILED");
  assert.equal(hasSecretField(invalidRoleJson), false);

  const activeStatus = await postCreateStaff(app, adminToken, {
    name: "Invalid Status",
    loginId: nextLoginId("cvs"),
    role: "STAFF",
    storeId: fixtures.activeStoreId,
    status: "ACTIVE",
  });
  const activeStatusJson = await readJson(activeStatus.payload);

  assert.equal(activeStatus.statusCode, 400);
  assert.equal(activeStatusJson.ok, false);
  assert.equal(activeStatusJson.code, "VALIDATION_FAILED");
  assert.equal(hasSecretField(activeStatusJson), false);

  const secretKeys = await postCreateStaff(app, adminToken, {
    name: "Secret Key Attempt",
    loginId: nextLoginId("cvk"),
    role: "STAFF",
    storeId: fixtures.activeStoreId,
    initialPassword: "DoNotAccept123!",
    issueTemporaryPassword: true,
    password: "DoNotAccept123!",
    passwordHash: "DoNotAcceptHash",
    resetToken: "DoNotAcceptReset",
    sessionToken: "DoNotAcceptSession",
    sessionTokenHash: "DoNotAcceptSessionHash",
    shouldSendInitialPassword: true,
    temporaryPassword: "DoNotAcceptTemp123!",
  });
  const secretKeysJson = await readJson(secretKeys.payload);

  assert.equal(secretKeys.statusCode, 400);
  assert.equal(secretKeysJson.ok, false);
  assert.equal(secretKeysJson.code, "VALIDATION_FAILED");
  assert.equal(hasSecretField(secretKeysJson), false);
}

async function assertCreateStaffSuccess(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const rawLoginId = nextLoginId("crst").toUpperCase();
  const expectedLoginId = rawLoginId.toLowerCase();
  const response = await postCreateStaff(app, adminToken, {
    name: " Created Staff Smoke ",
    loginId: rawLoginId,
    role: "STAFF",
    storeId: fixtures.secondaryActiveStoreId,
    phone: " 010-2222-3333 ",
  });
  const json = await readJson<CreateStaffResponseData>(response.payload);

  assert.equal(response.statusCode, 201);
  assert.equal(json.ok, true);
  assert.equal(json.data?.name, "Created Staff Smoke");
  assert.equal(json.data?.loginId, expectedLoginId);
  assert.equal(json.data?.role, "STAFF");
  assert.equal(json.data?.storeId, fixtures.secondaryActiveStoreId);
  assert.equal(json.data?.phone, "010-2222-3333");
  assert.equal(json.data?.status, "INACTIVE");
  assert.ok(json.data?.createdAt);
  assert.ok(json.data?.updatedAt);
  assert.equal(hasSecretField(json), false);

  const created = await prisma.user.findUnique({
    where: { email: expectedLoginId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      storeId: true,
      phone: true,
    },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_CREATED",
      entityType: "User",
      entityId: json.data?.userId,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(created);
  assert.equal(created.id, json.data?.userId);
  assert.equal(created.email, expectedLoginId);
  assert.equal(created.role, "STAFF");
  assert.equal(created.status, "INACTIVE");
  assert.equal(created.storeId, fixtures.secondaryActiveStoreId);
  assert.equal(created.phone, "010-2222-3333");
  assert.equal(isPasswordHash(created.passwordHash), true);
  assert.ok(audit);
  assert.equal(hasSecretField(audit), false);

  const afterJson = asRecord(audit.afterJson);

  assert.equal(afterJson.userId, created.id);
  assert.equal(afterJson.loginId, expectedLoginId);
  assert.equal(afterJson.status, "INACTIVE");
  assert.equal(afterJson.passwordDelivery, "NONE");
  assert.equal(afterJson.activationRequired, true);

  await assertLoginForbidden(app, expectedLoginId);
}

async function assertCreateAdminSuccess(
  app: FastifyInstance,
  adminToken: string,
  prisma: PrismaClient
) {
  const loginId = nextLoginId("crad");
  const response = await postCreateStaff(app, adminToken, {
    name: "Created Admin Smoke",
    loginId,
    role: "ADMIN",
  });
  const json = await readJson<CreateStaffResponseData>(response.payload);

  assert.equal(response.statusCode, 201);
  assert.equal(json.ok, true);
  assert.equal(json.data?.loginId, loginId);
  assert.equal(json.data?.role, "ADMIN");
  assert.equal(json.data?.storeId, null);
  assert.equal(json.data?.status, "INACTIVE");
  assert.equal(hasSecretField(json), false);

  const created = await prisma.user.findUnique({
    where: { email: loginId },
    select: {
      passwordHash: true,
      role: true,
      status: true,
      storeId: true,
    },
  });

  assert.ok(created);
  assert.equal(created.role, "ADMIN");
  assert.equal(created.status, "INACTIVE");
  assert.equal(created.storeId, null);
  assert.equal(isPasswordHash(created.passwordHash), true);
}

async function assertCreateDuplicateLoginId(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const loginId = nextLoginId("cdup");
  const first = await postCreateStaff(app, adminToken, {
    name: "Duplicate Source",
    loginId,
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const firstJson = await readJson<CreateStaffResponseData>(first.payload);

  assert.equal(first.statusCode, 201);
  assert.equal(firstJson.ok, true);

  const second = await postCreateStaff(app, adminToken, {
    name: "Duplicate Target",
    loginId: loginId.toUpperCase(),
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const secondJson = await readJson(second.payload);
  const createdCount = await prisma.user.count({
    where: { email: loginId },
  });

  assert.equal(second.statusCode, 409);
  assert.equal(secondJson.ok, false);
  assert.equal(secondJson.code, "DUPLICATE_LOGIN_ID");
  assert.equal(createdCount, 1);
  assert.equal(hasSecretField(secondJson), false);
}

async function assertCreateStoreRules(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const missingStaffStore = await postCreateStaff(app, adminToken, {
    name: "Missing Staff Store",
    loginId: nextLoginId("cms"),
    role: "STAFF",
  });
  const missingStaffStoreJson = await readJson(missingStaffStore.payload);

  assert.equal(missingStaffStore.statusCode, 409);
  assert.equal(missingStaffStoreJson.ok, false);
  assert.equal(missingStaffStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(missingStaffStoreJson), false);

  const inactiveStaffStore = await postCreateStaff(app, adminToken, {
    name: "Inactive Staff Store",
    loginId: nextLoginId("cis"),
    role: "STAFF",
    storeId: fixtures.inactiveStoreId,
  });
  const inactiveStaffStoreJson = await readJson(inactiveStaffStore.payload);

  assert.equal(inactiveStaffStore.statusCode, 409);
  assert.equal(inactiveStaffStoreJson.ok, false);
  assert.equal(inactiveStaffStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(inactiveStaffStoreJson), false);

  const missingStore = await postCreateStaff(app, adminToken, {
    name: "Not Found Store",
    loginId: nextLoginId("cnf"),
    role: "STAFF",
    storeId: "missing-store-id",
  });
  const missingStoreJson = await readJson(missingStore.payload);

  assert.equal(missingStore.statusCode, 409);
  assert.equal(missingStoreJson.ok, false);
  assert.equal(missingStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(missingStoreJson), false);

  const inactiveAdminStore = await postCreateStaff(app, adminToken, {
    name: "Inactive Admin Store",
    loginId: nextLoginId("cia"),
    role: "ADMIN",
    storeId: fixtures.inactiveStoreId,
  });
  const inactiveAdminStoreJson = await readJson(inactiveAdminStore.payload);

  assert.equal(inactiveAdminStore.statusCode, 409);
  assert.equal(inactiveAdminStoreJson.ok, false);
  assert.equal(inactiveAdminStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(inactiveAdminStoreJson), false);
}

async function assertUpdateValidationFailures(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const invalidName = await postUpdateStaff(app, adminToken, {
    userId: fixtures.targetStaffId,
    name: "x",
  });
  const invalidNameJson = await readJson(invalidName.payload);

  assert.equal(invalidName.statusCode, 400);
  assert.equal(invalidNameJson.ok, false);
  assert.equal(invalidNameJson.code, "VALIDATION_FAILED");
  assert.ok(invalidNameJson.fieldErrors?.name);
  assert.equal(hasSecretField(invalidNameJson), false);

  const unknownStatus = await postUpdateStaff(app, adminToken, {
    userId: fixtures.targetStaffId,
    status: "INACTIVE",
  });
  const unknownStatusJson = await readJson(unknownStatus.payload);

  assert.equal(unknownStatus.statusCode, 400);
  assert.equal(unknownStatusJson.ok, false);
  assert.equal(unknownStatusJson.code, "VALIDATION_FAILED");
  assert.equal(hasSecretField(unknownStatusJson), false);

  const emptyPatch = await postUpdateStaff(app, adminToken, {
    userId: fixtures.targetStaffId,
  });
  const emptyPatchJson = await readJson(emptyPatch.payload);

  assert.equal(emptyPatch.statusCode, 400);
  assert.equal(emptyPatchJson.ok, false);
  assert.equal(emptyPatchJson.code, "VALIDATION_FAILED");
  assert.ok(emptyPatchJson.fieldErrors?.form);
  assert.equal(hasSecretField(emptyPatchJson), false);
}

async function assertUpdateMissingUser(
  app: FastifyInstance,
  adminToken: string
) {
  const response = await postUpdateStaff(app, adminToken, {
    userId: "missing-user-id",
    name: "Missing User Update",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 404);
  assert.equal(json.ok, false);
  assert.equal(json.code, "NOT_FOUND");
  assert.equal(hasSecretField(json), false);
}

async function assertUpdateNoChange(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    storeId: fixtures.activeStoreId,
    name: "No Change Target",
    phone: "010-2222-2222",
    loginPrefix: "nochange",
  });
  const response = await postUpdateStaff(app, adminToken, {
    userId: target.id,
    name: "No Change Target",
    phone: "010-2222-2222",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "NO_CHANGE");
  assert.equal(hasSecretField(json), false);
}

async function assertUpdateStaleRecord(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    storeId: fixtures.activeStoreId,
    name: "Stale Update Target",
    loginPrefix: "stale",
  });
  const response = await postUpdateStaff(app, adminToken, {
    userId: target.id,
    name: "Stale Updated",
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "STALE_RECORD");
  assert.equal(hasSecretField(json), false);
}

async function assertSelfRoleDowngradeForbidden(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const response = await postUpdateStaff(app, adminToken, {
    userId: fixtures.adminUserId,
    role: "STAFF",
    storeId: fixtures.activeStoreId,
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "SELF_STATUS_CHANGE_FORBIDDEN");
  assert.equal(hasSecretField(json), false);
}

async function assertStaffStoreRequired(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const withoutStoreTarget = await createUserFixture(prisma, {
    role: "ADMIN",
    storeId: null,
    name: "Store Required Target",
    loginPrefix: "storemiss",
  });
  const withoutStore = await postUpdateStaff(app, adminToken, {
    userId: withoutStoreTarget.id,
    role: "STAFF",
  });
  const withoutStoreJson = await readJson(withoutStore.payload);

  assert.equal(withoutStore.statusCode, 409);
  assert.equal(withoutStoreJson.ok, false);
  assert.equal(withoutStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(withoutStoreJson), false);

  const inactiveStoreTarget = await createUserFixture(prisma, {
    role: "ADMIN",
    storeId: null,
    name: "Inactive Store Target",
    loginPrefix: "storeinactive",
  });
  const inactiveStore = await postUpdateStaff(app, adminToken, {
    userId: inactiveStoreTarget.id,
    role: "STAFF",
    storeId: fixtures.inactiveStoreId,
  });
  const inactiveStoreJson = await readJson(inactiveStore.payload);

  assert.equal(inactiveStore.statusCode, 409);
  assert.equal(inactiveStoreJson.ok, false);
  assert.equal(inactiveStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(inactiveStoreJson), false);

  const missingStoreTarget = await createUserFixture(prisma, {
    role: "ADMIN",
    storeId: null,
    name: "Missing Store Target",
    loginPrefix: "storemissing",
  });
  const missingStore = await postUpdateStaff(app, adminToken, {
    userId: missingStoreTarget.id,
    role: "STAFF",
    storeId: "missing-store-id",
  });
  const missingStoreJson = await readJson(missingStore.payload);

  assert.equal(missingStore.statusCode, 409);
  assert.equal(missingStoreJson.ok, false);
  assert.equal(missingStoreJson.code, "STAFF_STORE_REQUIRED");
  assert.equal(hasSecretField(missingStoreJson), false);
}

async function assertUpdateNamePhoneKeepsSession(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    storeId: fixtures.activeStoreId,
    name: "Name Phone Target",
    phone: "010-3333-3333",
    loginPrefix: "namephone",
  });
  const targetToken = await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  const targetBefore = await prisma.user.findUnique({
    where: { id: target.id },
    select: { updatedAt: true },
  });

  assert.ok(targetBefore);

  const response = await postUpdateStaff(app, adminToken, {
    userId: target.id,
    name: "Name Phone Updated",
    phone: "010-4444-4444",
    expectedUpdatedAt: targetBefore.updatedAt.toISOString(),
  });
  const json = await readJson<UpdateStaffResponseData>(response.payload);
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_UPDATED",
      entityType: "User",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.userId, target.id);
  assert.equal(json.data?.name, "Name Phone Updated");
  assert.deepEqual(json.data?.changedFields, ["name", "phone"]);
  assert.equal(json.data?.revokedSessionCount, 0);
  assert.equal(hasSecretField(json), false);
  assert.ok(audit);
  assert.deepEqual(asRecord(audit.afterJson).changedFields, ["name", "phone"]);
  assert.equal(hasSecretField(audit), false);

  await assertSession(app, targetToken, target.loginId);
}

async function assertUpdateRoleStoreRevokesSession(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    storeId: fixtures.activeStoreId,
    name: "Role Store Target",
    loginPrefix: "rolestore",
  });
  const targetToken = await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  const targetBefore = await prisma.user.findUnique({
    where: { id: target.id },
    select: { updatedAt: true },
  });

  assert.ok(targetBefore);

  const response = await postUpdateStaff(app, adminToken, {
    userId: target.id,
    role: "ADMIN",
    storeId: null,
    expectedUpdatedAt: targetBefore.updatedAt.toISOString(),
  });
  const json = await readJson<UpdateStaffResponseData>(response.payload);
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_UPDATED",
      entityType: "User",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });
  const revokedSession = await prisma.session.findUnique({
    where: { sessionTokenHash: hashSessionToken(targetToken) },
    select: { revokedAt: true },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.role, "ADMIN");
  assert.equal(json.data?.storeId, null);
  assert.deepEqual(json.data?.changedFields, ["role", "storeId"]);
  assert.ok((json.data?.revokedSessionCount ?? 0) >= 1);
  assert.ok(revokedSession?.revokedAt);
  assert.equal(hasSecretField(json), false);
  assert.ok(audit);
  assert.deepEqual(asRecord(audit.afterJson).changedFields, [
    "role",
    "storeId",
  ]);
  assert.ok(Number(asRecord(audit.afterJson).revokedSessionCount) >= 1);
  assert.equal(hasSecretField(audit), false);

  await assertAuthRequired(app, targetToken);
}

async function assertAdminValidationFailure(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const response = await postChangeStatus(app, adminToken, {
    userId: fixtures.targetStaffId,
    status: "INACTIVE",
    reason: "x",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 400);
  assert.equal(json.ok, false);
  assert.equal(json.code, "VALIDATION_FAILED");
  assert.ok(json.fieldErrors?.reason);
  assert.equal(hasSecretField(json), false);
}

async function assertMissingUser(app: FastifyInstance, adminToken: string) {
  const response = await postChangeStatus(app, adminToken, {
    userId: "missing-user-id",
    status: "INACTIVE",
    reason: "missing user smoke",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 404);
  assert.equal(json.ok, false);
  assert.equal(json.code, "NOT_FOUND");
  assert.equal(hasSecretField(json), false);
}

async function assertSelfDisableForbidden(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const response = await postChangeStatus(app, adminToken, {
    userId: fixtures.adminUserId,
    status: "INACTIVE",
    reason: "self disable smoke",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "SELF_STATUS_CHANGE_FORBIDDEN");
  assert.equal(hasSecretField(json), false);
}

async function assertSameStatusForbidden(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const response = await postChangeStatus(app, adminToken, {
    userId: fixtures.targetStaffId,
    status: "ACTIVE",
    reason: "same status smoke",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "INVALID_STATUS_TRANSITION");
  assert.equal(hasSecretField(json), false);
}

async function assertStaleRecord(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext
) {
  const response = await postChangeStatus(app, adminToken, {
    userId: fixtures.targetStaffId,
    status: "INACTIVE",
    reason: "stale status smoke",
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "STALE_RECORD");
  assert.equal(hasSecretField(json), false);
}

async function assertSuccessRevokesTargetSession(
  app: FastifyInstance,
  adminToken: string,
  targetStaffToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const targetBefore = await prisma.user.findUnique({
    where: { id: fixtures.targetStaffId },
    select: { updatedAt: true },
  });

  assert.ok(targetBefore);

  const response = await postChangeStatus(app, adminToken, {
    userId: fixtures.targetStaffId,
    status: "INACTIVE",
    reason: "successful deactivate smoke",
    expectedUpdatedAt: targetBefore.updatedAt.toISOString(),
  });
  const json = await readJson<ChangeStatusResponseData>(response.payload);

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.userId, fixtures.targetStaffId);
  assert.equal(json.data?.status, "INACTIVE");
  assert.ok(json.data?.updatedAt);
  assert.ok((json.data?.revokedSessionCount ?? 0) >= 1);
  assert.equal(hasSecretField(json), false);

  const targetAfter = await prisma.user.findUnique({
    where: { id: fixtures.targetStaffId },
    select: { status: true },
  });
  const revokedSession = await prisma.session.findUnique({
    where: { sessionTokenHash: hashSessionToken(targetStaffToken) },
    select: { revokedAt: true },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      actorUserId: fixtures.adminUserId,
      action: "ADMIN_STAFF_STATUS_CHANGED",
      entityType: "User",
      entityId: fixtures.targetStaffId,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(targetAfter?.status, "INACTIVE");
  assert.ok(revokedSession?.revokedAt);
  assert.ok(audit);
  assert.equal(audit.reason, "successful deactivate smoke");
  assert.equal(hasSecretField(audit), false);

  const beforeJson = asRecord(audit.beforeJson);
  const afterJson = asRecord(audit.afterJson);

  assert.equal(beforeJson.status, "ACTIVE");
  assert.equal(afterJson.status, "INACTIVE");
  assert.equal(afterJson.previousStatus, "ACTIVE");
  assert.equal(afterJson.newStatus, "INACTIVE");
  assert.ok(Number(afterJson.revokedSessionCount) >= 1);

  await assertAuthRequired(app, targetStaffToken);
  await assertSession(app, adminToken, accounts.admin.loginId);
}

async function assertLastAdminForbiddenViaDevBypass(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevAuthBypass = process.env.PSMS_DEV_AUTH_BYPASS;
  const targetAdmin = await prisma.user.create({
    data: {
      name: "Only Active Admin",
      email: `lastadmin${process.pid}`,
      passwordHash: await hashPassword("LastAdmin123!"),
      role: "ADMIN",
      status: "ACTIVE",
      storeId: null,
    },
    select: { id: true },
  });

  await prisma.user.updateMany({
    where: {
      id: { not: targetAdmin.id },
      role: "ADMIN",
      status: "ACTIVE",
    },
    data: { status: "INACTIVE" },
  });

  try {
    process.env.NODE_ENV = "development";
    process.env.PSMS_DEV_AUTH_BYPASS = "true";

    const response = await app.inject({
      method: "POST",
      url: "/admin/staffs/change-status",
      payload: {
        userId: targetAdmin.id,
        status: "INACTIVE",
        reason: "last admin smoke",
      },
    });
    const json = await readJson(response.payload);
    const targetAfter = await prisma.user.findUnique({
      where: { id: targetAdmin.id },
      select: { status: true },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(json.ok, false);
    assert.equal(json.code, "LAST_ADMIN_FORBIDDEN");
    assert.equal(targetAfter?.status, "ACTIVE");
    assert.equal(hasSecretField(json), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;

    if (originalDevAuthBypass === undefined) {
      delete process.env.PSMS_DEV_AUTH_BYPASS;
    } else {
      process.env.PSMS_DEV_AUTH_BYPASS = originalDevAuthBypass;
    }
  }
}

async function assertLastAdminRoleDowngradeForbiddenViaDevBypass(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevAuthBypass = process.env.PSMS_DEV_AUTH_BYPASS;
  const store =
    (await prisma.store.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.store.create({
      data: {
        code: "QA-LAST-ADMIN-DOWNGRADE",
        name: "QA Last Admin Downgrade",
        status: "ACTIVE",
      },
      select: { id: true },
    }));
  const targetAdmin = await prisma.user.create({
    data: {
      name: "Only Active Admin Downgrade",
      email: `lastadmindown${process.pid}`,
      passwordHash: await hashPassword("LastAdmin123!"),
      role: "ADMIN",
      status: "ACTIVE",
      storeId: null,
    },
    select: { id: true },
  });

  await prisma.user.updateMany({
    where: {
      id: { not: targetAdmin.id },
      role: "ADMIN",
      status: "ACTIVE",
    },
    data: { status: "INACTIVE" },
  });

  try {
    process.env.NODE_ENV = "development";
    process.env.PSMS_DEV_AUTH_BYPASS = "true";

    const response = await app.inject({
      method: "POST",
      url: "/admin/staffs/update",
      payload: {
        userId: targetAdmin.id,
        role: "STAFF",
        storeId: store.id,
      },
    });
    const json = await readJson(response.payload);
    const targetAfter = await prisma.user.findUnique({
      where: { id: targetAdmin.id },
      select: { role: true },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(json.ok, false);
    assert.equal(json.code, "LAST_ADMIN_FORBIDDEN");
    assert.equal(targetAfter?.role, "ADMIN");
    assert.equal(hasSecretField(json), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;

    if (originalDevAuthBypass === undefined) {
      delete process.env.PSMS_DEV_AUTH_BYPASS;
    } else {
      process.env.PSMS_DEV_AUTH_BYPASS = originalDevAuthBypass;
    }
  }
}

async function assertSession(
  app: FastifyInstance,
  sessionToken: string,
  loginId: string
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
  assert.equal(json.data?.session.loginId, loginId);
}

async function assertAuthRequired(app: FastifyInstance, sessionToken: string) {
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
  assert.equal(hasSecretField(json), false);
}

async function assertLoginForbidden(app: FastifyInstance, loginId: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      loginId,
      password: "CreatedStaff123!",
    },
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
