import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

import { hashPassword } from "../../packages/shared/src/password";
import {
  buildCredentialTokenActiveKey,
  generateCredentialToken,
  hashCredentialToken,
  type CredentialTokenPurpose,
} from "../../packages/shared/src/credential-token";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../packages/shared/src/session-token";
import { resetCredentialTokenRateLimitForTest } from "../../apps/api/src/auth/credential-token-rate-limit";
import { resetAdminCredentialMutationRateLimitForTest } from "../../apps/api/src/auth/admin-credential-rate-limit";

interface ActionResult<T = unknown> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}

interface LoginResponseData {
  sessionToken: string;
  expiresAt: string;
  redirectTo: string;
}

interface CredentialIssueResponseData {
  userId: string;
  purpose: CredentialTokenPurpose;
  expiresAt: string;
  delivery: {
    mode: "EMAIL_QUEUED" | "SMS_QUEUED" | "OUT_OF_BAND_APPROVED";
  };
  revokedTokenCount: number;
}

interface CredentialRevokeResponseData {
  userId: string;
  purpose: CredentialTokenPurpose;
  revokedTokenCount: number;
}

interface CredentialPreviewData {
  purpose: CredentialTokenPurpose;
  loginId: string;
  name: string;
  expiresAt: string;
  passwordPolicy: {
    minLength: number;
    maxLength: number;
  };
}

interface CredentialCompleteResponseData {
  redirectTo: "/login";
  activated: boolean;
  revokedSessionCount: number;
}

type PrismaClient = typeof import("../../packages/db/src/client").prisma;

type FixtureContext = {
  adminUserId: string;
  staffUserId: string;
  activeStoreId: string;
};

type DeliveryRecord = {
  deliveryAttempt: string;
  deliveryId: string;
  mode: "OUT_OF_BAND_APPROVED";
  token: string;
  purpose: CredentialTokenPurpose;
  user: {
    id: string;
    loginId: string;
    name: string;
    role: "ADMIN" | "STAFF";
    storeId: string | null;
  };
  expiresAt: string;
};

type DeliveryWebhook = {
  authorizationHeaders: Map<string, string[]>;
  deliverySideEffects: Map<string, (deliveryId: string) => Promise<void>>;
  deliveryAttempts: Map<string, string[]>;
  deliveryIds: Map<string, string[]>;
  processedDeliveryIds: Map<string, number>;
  requestCounts: Map<string, number>;
  server: Server;
  url: string;
};

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const sourceDbPath = path.resolve(workspaceRoot, "packages/db/dev.db");
const tempRunDir = path.resolve(
  workspaceRoot,
  ".tmp/api-credential-token-inject-smoke",
  String(process.pid)
);
const tempDbPath = path.resolve(tempRunDir, "dev.db");
const tempRateLimitPath = path.resolve(tempRunDir, "login-rate-limit.json");
const tempCredentialRateLimitPath = path.resolve(
  tempRunDir,
  "credential-token-rate-limit.json"
);
const tempAdminCredentialRateLimitPath = path.resolve(
  tempRunDir,
  "admin-credential-rate-limit.json"
);

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

function nextLoginId(prefix: string) {
  fixtureSequence += 1;

  return `${prefix}${process.pid}${fixtureSequence}`.toLowerCase();
}

function asRecord(value: unknown) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));

  return value as Record<string, unknown>;
}

async function readJson<T>(payload: string): Promise<ActionResult<T>> {
  return JSON.parse(payload) as ActionResult<T>;
}

function assertNoForbiddenCredentialFields(value: unknown) {
  const forbiddenKeys = new Set([
    "activationurl",
    "confirmpassword",
    "password",
    "passwordhash",
    "rawtoken",
    "reseturl",
    "sessiontoken",
    "sessiontokenhash",
    "temporarypassword",
    "token",
    "tokenhash",
  ]);

  function visit(entry: unknown) {
    if (Array.isArray(entry)) {
      for (const item of entry) {
        visit(item);
      }

      return;
    }

    if (!entry || typeof entry !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(entry)) {
      assert.equal(
        forbiddenKeys.has(key.toLowerCase()),
        false,
        `forbidden credential field leaked: ${key}`
      );
      visit(child);
    }
  }

  visit(value);
}

function assertNoSecretStrings(value: unknown, secrets: string[]) {
  const payload = JSON.stringify(value);

  for (const secret of secrets) {
    assert.equal(payload.includes(secret), false);
  }
}

function startDeliveryWebhook(deliveries: DeliveryRecord[]) {
  const authorizationHeaders = new Map<string, string[]>();
  const deliverySideEffects = new Map<
    string,
    (deliveryId: string) => Promise<void>
  >();
  const deliveryAttempts = new Map<string, string[]>();
  const deliveryIds = new Map<string, string[]>();
  const processedDeliveryIds = new Map<string, number>();
  const requestCounts = new Map<string, number>();
  const server = createServer((request, response) => {
    const requestUrl = request.url ?? "";

    if (
      request.method !== "POST" ||
      ![
        "/deliver",
        "/idempotent-transient-deliver",
        "/transient-deliver",
      ].includes(requestUrl)
    ) {
      response.writeHead(404).end();
      return;
    }

    const requestCount = (requestCounts.get(requestUrl) ?? 0) + 1;

    requestCounts.set(requestUrl, requestCount);
    authorizationHeaders.set(requestUrl, [
      ...(authorizationHeaders.get(requestUrl) ?? []),
      String(request.headers.authorization ?? ""),
    ]);
    deliveryIds.set(requestUrl, [
      ...(deliveryIds.get(requestUrl) ?? []),
      String(request.headers["x-psms-delivery-id"] ?? ""),
    ]);
    deliveryAttempts.set(requestUrl, [
      ...(deliveryAttempts.get(requestUrl) ?? []),
      String(request.headers["x-psms-delivery-attempt"] ?? ""),
    ]);

    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", async () => {
      const deliveryId = String(request.headers["x-psms-delivery-id"] ?? "");

      try {
        if (
          requestUrl === "/idempotent-transient-deliver" &&
          deliveryId &&
          processedDeliveryIds.has(deliveryId)
        ) {
          response.writeHead(204).end();
          return;
        }

        if (requestUrl === "/transient-deliver" && requestCount === 1) {
          response.writeHead(500).end();
          return;
        }

        if (deliveryId) {
          processedDeliveryIds.set(
            deliveryId,
            (processedDeliveryIds.get(deliveryId) ?? 0) + 1
          );
        }

        const sideEffect = deliverySideEffects.get(requestUrl);

        if (deliveryId && sideEffect) {
          await sideEffect(deliveryId);
        }

        deliveries.push({
          ...(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Omit<
            DeliveryRecord,
            "deliveryAttempt" | "deliveryId"
          >),
          deliveryAttempt: String(
            request.headers["x-psms-delivery-attempt"] ?? ""
          ),
          deliveryId: String(request.headers["x-psms-delivery-id"] ?? ""),
        } satisfies DeliveryRecord);

        if (
          requestUrl === "/idempotent-transient-deliver" &&
          requestCount === 1
        ) {
          response.writeHead(500).end();
          return;
        }

        response.writeHead(204).end();
      } catch {
        response.writeHead(500).end();
      }
    });
  });

  return new Promise<DeliveryWebhook>((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      assert.ok(address && typeof address === "object");
      resolvePromise({
        authorizationHeaders,
        deliverySideEffects,
        deliveryAttempts,
        deliveryIds,
        processedDeliveryIds,
        requestCounts,
        server,
        url: `http://127.0.0.1:${address.port}/deliver`,
      });
    });
  });
}

async function closeServer(server: Server) {
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise();
    });
  });
}

async function main() {
  await mkdir(tempRunDir, { recursive: true });
  await copyFile(sourceDbPath, tempDbPath);
  const deliveries: DeliveryRecord[] = [];
  const deliveryWebhook = await startDeliveryWebhook(deliveries);

  process.env.NODE_ENV = "test";
  process.env.API_PORT = "4273";
  process.env.DATABASE_URL = toSqliteFileUrl(tempDbPath);
  process.env.PSMS_LOGIN_RATE_LIMIT_FILE = tempRateLimitPath;
  process.env.PSMS_CREDENTIAL_RATE_LIMIT_FILE = tempCredentialRateLimitPath;
  process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE =
    tempAdminCredentialRateLimitPath;
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = deliveryWebhook.url;
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET =
    "local-api-delivery-webhook-secret-32-bytes-psms";
  process.env.PASSWORD_TOKEN_SECRET =
    "local-api-credential-token-secret-32-bytes-psms";

  const currentAuthSecret = process.env.AUTH_SECRET?.trim();

  if (!currentAuthSecret || currentAuthSecret.startsWith("replace-with")) {
    process.env.AUTH_SECRET = "local-api-credential-auth-secret-32-bytes-psms";
  }

  const { createApiApp } = await import("../../apps/api/src/app");
  const { prisma } = await import("../../packages/db/src/client");
  const app = await createApiApp();

  try {
    const fixtures = await seedFixtures(prisma);
    const adminToken = await login(app, accounts.admin);
    const staffToken = await login(app, accounts.staff);

    await assertGuardRunsBeforeValidation(app, prisma);
    await assertStaffForbidden(app, staffToken, fixtures, prisma);
    await assertDeliveryUnavailable(app, adminToken, fixtures, prisma);
    await assertDeliveryFailureRevokesCommittedToken(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries,
      deliveryWebhook.url
    );
    await assertDeliveryTransientFailureThenSuccess(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries,
      deliveryWebhook
    );
    await assertDeliveryIdempotentDuplicateDoesNotRepeatSideEffect(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries,
      deliveryWebhook
    );
    await assertPostDeliveryActivationConflictRevokesDeliveredToken(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries,
      deliveryWebhook.url
    );
    await assertIssueSuccessAndReissue(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries
    );
    await assertActivationComplete(app, fixtures, prisma);
    await assertPasswordResetCompleteRevokesSession(app, fixtures, prisma);
    await assertConcurrentCompleteConsumesTokenOnce(app, fixtures, prisma);
    await assertExpiredActiveKeyDoesNotBlockReissue(
      app,
      adminToken,
      fixtures,
      prisma
    );
    await assertAdminRevokeExpiredActiveKeyCleanup(
      app,
      adminToken,
      fixtures,
      prisma
    );
    await assertAdminRevokeBlocksCompletion(app, adminToken, fixtures, prisma);
    await assertDeactivationRevokesCredentialTokens(
      app,
      adminToken,
      fixtures,
      prisma
    );
    await assertAdminCredentialMutationRateLimit(
      app,
      adminToken,
      fixtures,
      prisma,
      deliveries
    );
    await assertCredentialTokenRateLimit(app, fixtures, prisma);

    console.log("api credential token inject smoke passed");
  } finally {
    await app.close();
    await prisma.$disconnect();
    await closeServer(deliveryWebhook.server);
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
  const store =
    (await prisma.store.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.store.create({
      data: {
        code: "QA-CREDENTIAL-TOKEN-STORE",
        name: "QA Credential Token Store",
        status: "ACTIVE",
      },
      select: { id: true },
    }));

  if (!adminUser || !staffUser) {
    throw new Error("Seed admin or staff user is missing.");
  }

  return {
    adminUserId: adminUser.id,
    staffUserId: staffUser.id,
    activeStoreId: store.id,
  };
}

async function createUserFixture(
  prisma: PrismaClient,
  input: {
    role?: "ADMIN" | "STAFF";
    status?: "ACTIVE" | "INACTIVE";
    storeId?: string | null;
    name?: string;
    password?: string;
    loginPrefix?: string;
  }
) {
  const password = input.password ?? "CredentialUser123!";
  const loginId = nextLoginId(input.loginPrefix ?? "creduser");
  const user = await prisma.user.create({
    data: {
      name: input.name ?? "Credential Target",
      email: loginId,
      passwordHash: await hashPassword(password),
      role: input.role ?? "STAFF",
      status: input.status ?? "ACTIVE",
      storeId: input.storeId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      updatedAt: true,
    },
  });

  return {
    id: user.id,
    loginId: user.email,
    name: user.name,
    password,
    updatedAt: user.updatedAt,
  };
}

async function createCredentialTokenFixture(
  prisma: PrismaClient,
  input: {
    userId: string;
    purpose: CredentialTokenPurpose;
    expiresAt?: Date;
  }
) {
  const rawToken = generateCredentialToken();
  const tokenHash = hashCredentialToken(rawToken, input.purpose);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);
  const token = await prisma.userPasswordToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash,
      activeKey: buildCredentialTokenActiveKey(input.userId, input.purpose),
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "api-credential-token-inject-smoke",
    },
    select: {
      id: true,
      tokenHash: true,
    },
  });

  return {
    rawToken,
    tokenHash,
    id: token.id,
  };
}

async function login(
  app: FastifyInstance,
  account: {
    loginId: string;
    password: string;
    role: "ADMIN" | "STAFF";
  }
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

async function assertLoginRejected(
  app: FastifyInstance,
  input: {
    loginId: string;
    password: string;
  }
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: input,
  });
  const json = await readJson(response.payload);

  assert.equal(response.statusCode, 403);
  assert.equal(json.ok, false);
  assert.equal(json.code, "FORBIDDEN");
  assertNoSecretStrings(json, [input.password]);
}

async function post(
  app: FastifyInstance,
  url: string,
  sessionToken: string | null,
  payload: unknown,
  headers?: Record<string, string>
) {
  return app.inject({
    method: "POST",
    url,
    headers: {
      ...(headers ?? {}),
      ...(sessionToken ? { cookie: sessionCookie(sessionToken) } : {}),
    },
    payload,
  });
}

async function assertGuardRunsBeforeValidation(
  app: FastifyInstance,
  prisma: PrismaClient
) {
  const countBefore = await prisma.userPasswordToken.count();
  const response = await post(app, "/admin/staffs/activation/issue", null, {
    userId: "",
    rawToken: "ShouldNeverBeAccepted",
  });
  const json = await readJson(response.payload);
  const countAfter = await prisma.userPasswordToken.count();

  assert.equal(response.statusCode, 401);
  assert.equal(json.ok, false);
  assert.equal(json.code, "AUTH_REQUIRED");
  assert.equal(countAfter, countBefore);
  assertNoForbiddenCredentialFields(json);
}

async function assertStaffForbidden(
  app: FastifyInstance,
  staffToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "forbidcred",
  });
  const countBefore = await prisma.userPasswordToken.count();
  const auditCountBefore = await prisma.auditLog.count({
    where: {
      actorUserId: fixtures.staffUserId,
      action: "ADMIN_MUTATION_FORBIDDEN",
    },
  });
  const response = await post(
    app,
    "/admin/staffs/activation/issue",
    staffToken,
    {
      userId: target.id,
    }
  );
  const json = await readJson(response.payload);
  const countAfter = await prisma.userPasswordToken.count();
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
  assert.equal(countAfter, countBefore);
  assert.equal(auditCountAfter, auditCountBefore + 1);
  assert.ok(audit);
  assert.equal(
    asRecord(audit.afterJson).route,
    "/admin/staffs/activation/issue"
  );
  assertNoForbiddenCredentialFields(json);
  assertNoForbiddenCredentialFields(audit);
}

async function assertDeliveryUnavailable(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const previousDeliveryMode = process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  const previousWebhookUrl = process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "deliveryoff",
  });
  const countBefore = await prisma.userPasswordToken.count({
    where: { userId: target.id },
  });

  delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;

  try {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
      }
    );
    const json = await readJson(response.payload);
    const countAfter = await prisma.userPasswordToken.count({
      where: { userId: target.id },
    });

    assert.equal(response.statusCode, 503);
    assert.equal(json.ok, false);
    assert.equal(json.code, "DELIVERY_UNAVAILABLE");
    assert.equal(countAfter, countBefore);
    assertNoForbiddenCredentialFields(json);
  } finally {
    if (previousDeliveryMode === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE = previousDeliveryMode;
    }

    if (previousWebhookUrl === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = previousWebhookUrl;
    }
  }
}

async function assertDeliveryFailureRevokesCommittedToken(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[],
  deliveryUrl: string
) {
  const previousDeliveryMode = process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  const previousWebhookUrl = process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
  const deliveryCountBefore = deliveries.length;
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "deliveryfail",
  });
  const countBefore = await prisma.userPasswordToken.count({
    where: { userId: target.id },
  });

  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = deliveryUrl.replace(
    "/deliver",
    "/fail-deliver"
  );

  try {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
        reason: "delivery failure revoke smoke",
      }
    );
    const json = await readJson(response.payload);
    const tokens = await prisma.userPasswordToken.findMany({
      where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
      orderBy: { createdAt: "desc" },
    });
    const activeTokenCount = await prisma.userPasswordToken.count({
      where: {
        userId: target.id,
        purpose: "STAFF_ACTIVATION",
        activeKey: { not: null },
        usedAt: null,
        revokedAt: null,
      },
    });
    const failureAudit = await prisma.auditLog.findFirst({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_DELIVERY_FAILED",
        entityId: target.id,
      },
      orderBy: { createdAt: "desc" },
    });

    assert.equal(response.statusCode, 503);
    assert.equal(json.ok, false);
    assert.equal(json.code, "DELIVERY_UNAVAILABLE");
    assert.equal(tokens.length, countBefore + 1);
    assert.equal(activeTokenCount, 0);
    assert.equal(tokens[0].activeKey, null);
    assert.ok(tokens[0].revokedAt);
    assert.equal(deliveries.length, deliveryCountBefore);
    assert.ok(failureAudit);
    assert.equal(asRecord(failureAudit.afterJson).tokenId, tokens[0].id);
    assert.equal(
      asRecord(failureAudit.afterJson).deliveryMode,
      "OUT_OF_BAND_APPROVED"
    );
    assert.equal(asRecord(failureAudit.afterJson).deliveryAttemptCount, 1);
    assert.equal(
      asRecord(failureAudit.afterJson).deliveryFailureCode,
      "WEBHOOK_HTTP_ERROR"
    );
    assert.equal(asRecord(failureAudit.afterJson).deliveryHttpStatus, 404);
    assertNoForbiddenCredentialFields(json);
    assertNoForbiddenCredentialFields(failureAudit);

    process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = deliveryUrl;

    const reissueTarget = await createUserFixture(prisma, {
      status: "INACTIVE",
      storeId: fixtures.activeStoreId,
      loginPrefix: "deliveryreissuefail",
    });
    const successfulIssue = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: reissueTarget.id,
        reason: "delivery failure reissue baseline",
      }
    );
    const successfulIssueJson = await readJson<CredentialIssueResponseData>(
      successfulIssue.payload
    );
    const previousToken = await prisma.userPasswordToken.findFirst({
      where: { userId: reissueTarget.id, purpose: "STAFF_ACTIVATION" },
      orderBy: { createdAt: "desc" },
    });

    assert.equal(successfulIssue.statusCode, 201);
    assert.equal(successfulIssueJson.ok, true);
    assert.ok(previousToken);
    assert.ok(previousToken.activeKey);

    const deliveryCountBeforeFailedReissue = deliveries.length;

    process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = deliveryUrl.replace(
      "/deliver",
      "/fail-deliver"
    );

    const failedReissue = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: reissueTarget.id,
        reason: "delivery failure reissue restore smoke",
      }
    );
    const failedReissueJson = await readJson(failedReissue.payload);
    const previousTokenAfter = await prisma.userPasswordToken.findUnique({
      where: { id: previousToken.id },
    });
    const failedReissueToken = await prisma.userPasswordToken.findFirst({
      where: {
        userId: reissueTarget.id,
        purpose: "STAFF_ACTIVATION",
        id: { not: previousToken.id },
      },
      orderBy: { createdAt: "desc" },
    });
    const activeAfterFailedReissue = await prisma.userPasswordToken.count({
      where: {
        userId: reissueTarget.id,
        purpose: "STAFF_ACTIVATION",
        activeKey: { not: null },
        usedAt: null,
        revokedAt: null,
      },
    });
    const reissueFailureAudit = await prisma.auditLog.findFirst({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_DELIVERY_FAILED",
        entityId: reissueTarget.id,
      },
      orderBy: { createdAt: "desc" },
    });

    assert.equal(failedReissue.statusCode, 503);
    assert.equal(failedReissueJson.ok, false);
    assert.equal(failedReissueJson.code, "DELIVERY_UNAVAILABLE");
    assert.equal(deliveries.length, deliveryCountBeforeFailedReissue);
    assert.equal(activeAfterFailedReissue, 1);
    assert.equal(
      previousTokenAfter?.activeKey,
      buildCredentialTokenActiveKey(reissueTarget.id, "STAFF_ACTIVATION")
    );
    assert.equal(previousTokenAfter?.revokedAt, null);
    assert.equal(failedReissueToken?.activeKey, null);
    assert.ok(failedReissueToken?.revokedAt);
    assert.ok(reissueFailureAudit);
    assert.equal(
      asRecord(reissueFailureAudit.afterJson).retainedPreviousTokenCount,
      1
    );
    assert.equal(
      asRecord(reissueFailureAudit.afterJson).deliveryAttemptCount,
      1
    );
    assert.equal(
      asRecord(reissueFailureAudit.afterJson).deliveryFailureCode,
      "WEBHOOK_HTTP_ERROR"
    );
    assert.equal(
      asRecord(reissueFailureAudit.afterJson).deliveryHttpStatus,
      404
    );
    assertNoForbiddenCredentialFields(failedReissueJson);
    assertNoForbiddenCredentialFields(reissueFailureAudit);
  } finally {
    if (previousDeliveryMode === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE = previousDeliveryMode;
    }

    if (previousWebhookUrl === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = previousWebhookUrl;
    }
  }
}

async function assertDeliveryTransientFailureThenSuccess(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[],
  deliveryWebhook: DeliveryWebhook
) {
  const previousDeliveryMode = process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  const previousWebhookUrl = process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
  const previousMaxAttempts =
    process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS;
  const deliveryCountBefore = deliveries.length;
  const requestCountBefore =
    deliveryWebhook.requestCounts.get("/transient-deliver") ?? 0;
  const deliverySecret =
    process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET ?? "";
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "deliverytransient",
  });

  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS = "2";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL =
    deliveryWebhook.url.replace("/deliver", "/transient-deliver");

  try {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
        reason: "delivery transient retry smoke",
      }
    );
    const json = await readJson<CredentialIssueResponseData>(response.payload);
    const activeTokenCount = await prisma.userPasswordToken.count({
      where: {
        userId: target.id,
        purpose: "STAFF_ACTIVATION",
        activeKey: { not: null },
        usedAt: null,
        revokedAt: null,
      },
    });
    const failureAuditCount = await prisma.auditLog.count({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_DELIVERY_FAILED",
        entityId: target.id,
      },
    });
    const issuedAudit = await prisma.auditLog.findFirst({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_ISSUED",
        entityId: target.id,
      },
      orderBy: { createdAt: "desc" },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(json.ok, true);
    assert.equal(json.data?.purpose, "STAFF_ACTIVATION");
    assert.equal(activeTokenCount, 1);
    assert.equal(deliveries.length, deliveryCountBefore + 1);
    assert.equal(
      deliveryWebhook.requestCounts.get("/transient-deliver"),
      requestCountBefore + 2
    );
    const recentDeliveryIds = (
      deliveryWebhook.deliveryIds.get("/transient-deliver") ?? []
    ).slice(requestCountBefore);
    const recentDeliveryAttempts = (
      deliveryWebhook.deliveryAttempts.get("/transient-deliver") ?? []
    ).slice(requestCountBefore);
    const recentAuthorizationHeaders = (
      deliveryWebhook.authorizationHeaders.get("/transient-deliver") ?? []
    ).slice(requestCountBefore);
    const deliveredToken = deliveries.at(-1)?.token;
    const deliveredId = deliveries.at(-1)?.deliveryId;

    assert.equal(recentDeliveryIds.length, 2);
    assert.deepEqual(recentDeliveryAttempts, ["1", "2"]);
    assert.deepEqual(recentAuthorizationHeaders, [
      `Bearer ${deliverySecret}`,
      `Bearer ${deliverySecret}`,
    ]);
    assert.ok(deliveredToken);
    assert.ok(deliveredId);
    assert.equal(recentDeliveryIds[0], deliveredId);
    assert.equal(recentDeliveryIds[1], deliveredId);
    assert.notEqual(deliveredId, deliveredToken);
    assert.equal(deliveries.at(-1)?.deliveryAttempt, "2");
    assert.equal(failureAuditCount, 0);
    assert.ok(issuedAudit);
    assert.equal(asRecord(issuedAudit.afterJson).deliveryAttemptCount, 2);
    assert.equal(asRecord(issuedAudit.afterJson).deliveryHttpStatus, 204);
    assertNoSecretStrings({ recentDeliveryAttempts, recentDeliveryIds }, [
      deliveredToken,
    ]);
    assertNoSecretStrings({ recentDeliveryAttempts, recentDeliveryIds }, [
      deliverySecret,
    ]);
    assertNoSecretStrings(json, [deliveredToken]);
    assertNoSecretStrings(issuedAudit, [deliveredToken]);
    assertNoSecretStrings(json, [deliverySecret]);
    assertNoSecretStrings(issuedAudit, [deliverySecret]);
    assertNoForbiddenCredentialFields(json);
    assertNoForbiddenCredentialFields(issuedAudit);
  } finally {
    if (previousDeliveryMode === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE = previousDeliveryMode;
    }

    if (previousWebhookUrl === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = previousWebhookUrl;
    }

    if (previousMaxAttempts === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS =
        previousMaxAttempts;
    }
  }
}

async function assertDeliveryIdempotentDuplicateDoesNotRepeatSideEffect(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[],
  deliveryWebhook: DeliveryWebhook
) {
  const previousDeliveryMode = process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  const previousWebhookUrl = process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
  const previousMaxAttempts =
    process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS;
  const deliveryCountBefore = deliveries.length;
  const requestPath = "/idempotent-transient-deliver";
  const requestCountBefore =
    deliveryWebhook.requestCounts.get(requestPath) ?? 0;
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "deliverydedupe",
  });

  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS = "2";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL =
    deliveryWebhook.url.replace("/deliver", requestPath);

  try {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
        reason: "delivery idempotent receiver smoke",
      }
    );
    const json = await readJson<CredentialIssueResponseData>(response.payload);
    const recentDeliveryIds = (
      deliveryWebhook.deliveryIds.get(requestPath) ?? []
    ).slice(requestCountBefore);
    const recentDeliveryAttempts = (
      deliveryWebhook.deliveryAttempts.get(requestPath) ?? []
    ).slice(requestCountBefore);
    const delivered = deliveries.at(-1);

    assert.equal(response.statusCode, 201);
    assert.equal(json.ok, true);
    assert.equal(deliveries.length, deliveryCountBefore + 1);
    assert.equal(
      deliveryWebhook.requestCounts.get(requestPath),
      requestCountBefore + 2
    );
    assert.ok(delivered);
    assert.deepEqual(recentDeliveryIds, [
      delivered.deliveryId,
      delivered.deliveryId,
    ]);
    assert.deepEqual(recentDeliveryAttempts, ["1", "2"]);
    assert.equal(
      deliveryWebhook.processedDeliveryIds.get(delivered.deliveryId),
      1
    );
    assert.notEqual(delivered.deliveryId, delivered.token);
    assertNoSecretStrings(
      {
        processedDeliveryIds: [...deliveryWebhook.processedDeliveryIds.keys()],
        recentDeliveryAttempts,
        recentDeliveryIds,
      },
      [delivered.token]
    );
    assertNoForbiddenCredentialFields(json);
  } finally {
    if (previousDeliveryMode === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE = previousDeliveryMode;
    }

    if (previousWebhookUrl === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = previousWebhookUrl;
    }

    if (previousMaxAttempts === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS =
        previousMaxAttempts;
    }
  }
}

async function assertPostDeliveryActivationConflictRevokesDeliveredToken(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[],
  deliveryUrl: string
) {
  const previousDeliveryMode = process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
  const previousWebhookUrl = process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
  const deliveryCountBefore = deliveries.length;
  const triggerName = "psms_test_active_key_conflict_after_delivery";
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "postdeliveryconflict",
  });

  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = deliveryUrl;

  const baselineIssue = await post(
    app,
    "/admin/staffs/activation/issue",
    adminToken,
    {
      userId: target.id,
      reason: "post-delivery activation conflict baseline",
    }
  );
  const baselineIssueJson = await readJson<CredentialIssueResponseData>(
    baselineIssue.payload
  );
  const previousToken = await prisma.userPasswordToken.findFirst({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
    orderBy: { createdAt: "desc" },
  });
  const issueAuditCountBeforeConflict = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_ISSUED",
      entityId: target.id,
    },
  });

  assert.equal(baselineIssue.statusCode, 201);
  assert.equal(baselineIssueJson.ok, true);
  assert.ok(previousToken);
  assert.ok(previousToken.activeKey);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName}`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER ${triggerName}
    BEFORE UPDATE OF activeKey ON UserPasswordToken
    WHEN OLD.activeKey IS NULL
      AND NEW.activeKey IS NOT NULL
      AND NEW.userId = '${target.id.replaceAll("'", "''")}'
    BEGIN
      INSERT INTO UserPasswordToken (
        id,
        userId,
        purpose,
        tokenHash,
        activeKey,
        expiresAt,
        createdAt,
        updatedAt
      )
      VALUES (
        'conflict_' || hex(randomblob(8)),
        NEW.userId,
        NEW.purpose,
        'v1:hmac-sha256:conflict-' || hex(randomblob(16)),
        NEW.activeKey,
        NEW.expiresAt,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    END;
  `);

  try {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
        reason: "post-delivery activation conflict smoke",
      }
    );
    const json = await readJson(response.payload);
    const delivered = deliveries.at(-1);
    const deliveredToken = await prisma.userPasswordToken.findUnique({
      where: { id: delivered?.deliveryId ?? "" },
    });
    const previousTokenAfter = await prisma.userPasswordToken.findUnique({
      where: { id: previousToken.id },
    });
    const activeTokenCount = await prisma.userPasswordToken.count({
      where: {
        userId: target.id,
        purpose: "STAFF_ACTIVATION",
        activeKey: { not: null },
        usedAt: null,
        revokedAt: null,
      },
    });
    const rollbackAudit = await prisma.auditLog.findFirst({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_DELIVERY_ROLLED_BACK",
        entityId: target.id,
      },
      orderBy: { createdAt: "desc" },
    });
    const issueAuditCountAfterConflict = await prisma.auditLog.count({
      where: {
        action: "ADMIN_STAFF_ACTIVATION_ISSUED",
        entityId: target.id,
      },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(json.ok, false);
    assert.equal(json.code, "CREDENTIAL_TOKEN_CONFLICT");
    assert.equal(deliveries.length, deliveryCountBefore + 2);
    assert.ok(delivered);
    assert.ok(deliveredToken);
    assert.equal(deliveredToken.activeKey, null);
    assert.ok(deliveredToken.revokedAt);
    assert.equal(deliveredToken.revokedById, fixtures.adminUserId);
    assert.equal(previousTokenAfter?.activeKey, previousToken.activeKey);
    assert.equal(previousTokenAfter?.revokedAt, null);
    assert.equal(activeTokenCount, 1);
    assert.equal(issueAuditCountAfterConflict, issueAuditCountBeforeConflict);
    assert.ok(rollbackAudit);
    assert.equal(
      asRecord(rollbackAudit.afterJson).tokenId,
      delivered.deliveryId
    );
    assert.equal(
      asRecord(rollbackAudit.afterJson).rollbackCode,
      "ACTIVE_KEY_CONFLICT_AFTER_DELIVERY"
    );
    assert.equal(asRecord(rollbackAudit.afterJson).revokedTokenCount, 1);
    assert.equal(asRecord(rollbackAudit.afterJson).deliveryAttemptCount, 1);
    assert.equal(asRecord(rollbackAudit.afterJson).deliveryHttpStatus, 204);
    assertNoSecretStrings(json, [delivered.token]);
    assertNoSecretStrings(rollbackAudit, [delivered.token]);
    assertNoForbiddenCredentialFields(json);
    assertNoForbiddenCredentialFields(rollbackAudit);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName}`);

    if (previousDeliveryMode === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_MODE;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_MODE = previousDeliveryMode;
    }

    if (previousWebhookUrl === undefined) {
      delete process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL;
    } else {
      process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL = previousWebhookUrl;
    }
  }
}

async function assertIssueSuccessAndReissue(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[]
) {
  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";

  const deliveryCountBefore = deliveries.length;
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "issuecred",
  });

  const first = await post(app, "/admin/staffs/activation/issue", adminToken, {
    userId: target.id,
    reason: "issue credential smoke",
  });
  const firstJson = await readJson<CredentialIssueResponseData>(first.payload);
  const firstToken = await prisma.userPasswordToken.findFirst({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(first.statusCode, 201);
  assert.equal(firstJson.ok, true);
  assert.equal(firstJson.data?.purpose, "STAFF_ACTIVATION");
  assert.equal(firstJson.data?.delivery.mode, "OUT_OF_BAND_APPROVED");
  assert.equal(firstJson.data?.revokedTokenCount, 0);
  assert.ok(firstToken?.activeKey);
  assert.equal(deliveries.length, deliveryCountBefore + 1);
  assert.equal(deliveries.at(-1)?.purpose, "STAFF_ACTIVATION");
  assert.equal(deliveries.at(-1)?.user.id, target.id);
  assert.ok(deliveries.at(-1)?.token);
  assertNoForbiddenCredentialFields(firstJson);
  assertNoSecretStrings(firstJson, [deliveries.at(-1)?.token ?? ""]);

  const second = await post(app, "/admin/staffs/activation/issue", adminToken, {
    userId: target.id,
    reason: "reissue credential smoke",
  });
  const secondJson = await readJson<CredentialIssueResponseData>(
    second.payload
  );
  const activeTokenCount = await prisma.userPasswordToken.count({
    where: {
      userId: target.id,
      purpose: "STAFF_ACTIVATION",
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
    },
  });
  const firstTokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: firstToken.id },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_ISSUED",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(second.statusCode, 201);
  assert.equal(secondJson.ok, true);
  assert.equal(secondJson.data?.revokedTokenCount, 1);
  assert.equal(deliveries.length, deliveryCountBefore + 2);
  assert.equal(deliveries.at(-1)?.purpose, "STAFF_ACTIVATION");
  assert.equal(activeTokenCount, 1);
  assert.equal(firstTokenAfter?.activeKey, null);
  assert.ok(firstTokenAfter?.revokedAt);
  assert.equal(firstTokenAfter?.revokedById, fixtures.adminUserId);
  assert.ok(audit);
  assert.equal(
    asRecord(audit.afterJson).tokenId,
    deliveries.at(-1)?.deliveryId
  );
  assert.equal(asRecord(audit.afterJson).revokedPreviousCount, 1);
  assert.deepEqual(asRecord(audit.afterJson).revokedPreviousTokenIds, [
    firstToken.id,
  ]);
  assert.equal(asRecord(audit.afterJson).deliveryAttemptCount, 1);
  assert.equal(asRecord(audit.afterJson).deliveryHttpStatus, 204);
  assertNoSecretStrings(secondJson, [deliveries.at(-1)?.token ?? ""]);
  assertNoSecretStrings(audit, [deliveries.at(-1)?.token ?? ""]);
  assertNoForbiddenCredentialFields(secondJson);
  assertNoForbiddenCredentialFields(audit);
}

async function assertActivationComplete(
  app: FastifyInstance,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "activatecred",
  });
  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "STAFF_ACTIVATION",
  });
  const newPassword = "FreshAccess#2026";
  const forbiddenLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      loginId: target.loginId,
      password: target.password,
    },
  });
  const forbiddenLoginJson = await readJson(forbiddenLogin.payload);

  assert.equal(forbiddenLogin.statusCode, 403);
  assert.equal(forbiddenLoginJson.ok, false);

  const verify = await post(app, "/auth/staff-activation/verify", null, {
    token: credential.rawToken,
  });
  const verifyJson = await readJson<CredentialPreviewData>(verify.payload);

  assert.equal(verify.statusCode, 200);
  assert.equal(verifyJson.ok, true);
  assert.equal(verifyJson.data?.loginId, target.loginId);
  assert.equal(verifyJson.data?.purpose, "STAFF_ACTIVATION");
  assertNoSecretStrings(verifyJson, [
    credential.rawToken,
    credential.tokenHash,
    newPassword,
  ]);
  assertNoForbiddenCredentialFields(verifyJson);

  const complete = await post(app, "/auth/staff-activation/complete", null, {
    token: credential.rawToken,
    password: newPassword,
    confirmPassword: newPassword,
  });
  const completeJson = await readJson<CredentialCompleteResponseData>(
    complete.payload
  );
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
  });
  const targetAfter = await prisma.user.findUnique({
    where: { id: target.id },
    select: { status: true },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "STAFF_ACTIVATION_COMPLETED",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(complete.statusCode, 200);
  assert.equal(completeJson.ok, true);
  assert.equal(completeJson.data?.activated, true);
  assert.equal(completeJson.data?.redirectTo, "/login");
  assert.equal(completeJson.redirectTo, "/login");
  assert.equal(tokenAfter?.activeKey, null);
  assert.ok(tokenAfter?.usedAt);
  assert.equal(targetAfter?.status, "ACTIVE");
  assert.ok(audit);
  assertNoSecretStrings(completeJson, [
    credential.rawToken,
    credential.tokenHash,
    newPassword,
  ]);
  assertNoSecretStrings(audit, [
    credential.rawToken,
    credential.tokenHash,
    newPassword,
  ]);
  assertNoForbiddenCredentialFields(completeJson);
  assertNoForbiddenCredentialFields(audit);

  await login(app, {
    loginId: target.loginId,
    password: newPassword,
    role: "STAFF",
  });

  const replay = await post(app, "/auth/staff-activation/complete", null, {
    token: credential.rawToken,
    password: "ReplayAccess#2026",
    confirmPassword: "ReplayAccess#2026",
  });
  const replayJson = await readJson(replay.payload);

  assert.equal(replay.statusCode, 400);
  assert.equal(replayJson.ok, false);
  assert.equal(replayJson.code, "INVALID_CREDENTIAL_TOKEN");
  assertNoSecretStrings(replayJson, [
    credential.rawToken,
    credential.tokenHash,
  ]);
}

async function assertPasswordResetCompleteRevokesSession(
  app: FastifyInstance,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "resetcred",
    password: "ResetOriginal123!",
  });
  const targetToken = await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const newPassword = "ResetAccess#2026";

  const complete = await post(app, "/auth/password-reset/complete", null, {
    token: credential.rawToken,
    password: newPassword,
    confirmPassword: newPassword,
  });
  const completeJson = await readJson<CredentialCompleteResponseData>(
    complete.payload
  );
  const revokedSession = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(targetToken),
    },
    select: { revokedAt: true },
  });
  const sessionAfter = await app.inject({
    method: "GET",
    url: "/auth/session",
    headers: {
      cookie: sessionCookie(targetToken),
    },
  });
  const sessionAfterJson = await readJson(sessionAfter.payload);

  assert.equal(complete.statusCode, 200);
  assert.equal(completeJson.ok, true);
  assert.equal(completeJson.data?.activated, false);
  assert.ok((completeJson.data?.revokedSessionCount ?? 0) >= 1);
  assert.ok(revokedSession?.revokedAt);
  assert.equal(sessionAfter.statusCode, 401);
  assert.equal(sessionAfterJson.ok, false);
  assert.equal(sessionAfterJson.code, "AUTH_REQUIRED");
  assertNoSecretStrings(completeJson, [
    credential.rawToken,
    credential.tokenHash,
    newPassword,
  ]);

  await login(app, {
    loginId: target.loginId,
    password: newPassword,
    role: "STAFF",
  });
}

async function assertConcurrentCompleteConsumesTokenOnce(
  app: FastifyInstance,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "racecred",
    password: "RaceOriginal123!",
  });
  const targetSessionToken = await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const attempts = [
    {
      password: "RaceAccessOne#2026",
      payload: {
        token: credential.rawToken,
        password: "RaceAccessOne#2026",
        confirmPassword: "RaceAccessOne#2026",
      },
    },
    {
      password: "RaceAccessTwo#2026",
      payload: {
        token: credential.rawToken,
        password: "RaceAccessTwo#2026",
        confirmPassword: "RaceAccessTwo#2026",
      },
    },
  ];
  const responses = await Promise.all(
    attempts.map(async (attempt) => {
      const response = await post(
        app,
        "/auth/password-reset/complete",
        null,
        attempt.payload
      );
      const json = await readJson<CredentialCompleteResponseData>(
        response.payload
      );

      return {
        password: attempt.password,
        response,
        json,
      };
    })
  );
  const successes = responses.filter(
    (entry) => entry.response.statusCode === 200 && entry.json.ok
  );
  const failures = responses.filter(
    (entry) =>
      entry.response.statusCode === 400 &&
      !entry.json.ok &&
      entry.json.code === "INVALID_CREDENTIAL_TOKEN"
  );
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
  });
  const auditCount = await prisma.auditLog.count({
    where: {
      action: "STAFF_PASSWORD_RESET_COMPLETED",
      entityId: target.id,
    },
  });
  const revokedSession = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(targetSessionToken),
    },
    select: { revokedAt: true },
  });
  const sessionAfter = await app.inject({
    method: "GET",
    url: "/auth/session",
    headers: {
      cookie: sessionCookie(targetSessionToken),
    },
  });
  const sessionAfterJson = await readJson(sessionAfter.payload);

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(successes[0].json.data?.activated, false);
  assert.ok((successes[0].json.data?.revokedSessionCount ?? 0) >= 1);
  assert.equal(tokenAfter?.activeKey, null);
  assert.ok(tokenAfter?.usedAt);
  assert.equal(auditCount, 1);
  assert.ok(revokedSession?.revokedAt);
  assert.equal(sessionAfter.statusCode, 401);
  assert.equal(sessionAfterJson.ok, false);
  assert.equal(sessionAfterJson.code, "AUTH_REQUIRED");

  await login(app, {
    loginId: target.loginId,
    password: successes[0].password,
    role: "STAFF",
  });
  await assertLoginRejected(app, {
    loginId: target.loginId,
    password: target.password,
  });
  await assertLoginRejected(app, {
    loginId: target.loginId,
    password: failures[0].password,
  });

  for (const entry of responses) {
    assertNoSecretStrings(entry.json, [
      credential.rawToken,
      credential.tokenHash,
      entry.password,
    ]);
    assertNoForbiddenCredentialFields(entry.json);
  }
}

async function assertExpiredActiveKeyDoesNotBlockReissue(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";

  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "expiredcred",
  });
  const expiredCredential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() - 60_000),
  });

  const verify = await post(app, "/auth/password-reset/verify", null, {
    token: expiredCredential.rawToken,
  });
  const verifyJson = await readJson(verify.payload);

  assert.equal(verify.statusCode, 400);
  assert.equal(verifyJson.ok, false);
  assert.equal(verifyJson.code, "INVALID_CREDENTIAL_TOKEN");

  const issue = await post(
    app,
    "/admin/staffs/password-reset/issue",
    adminToken,
    {
      userId: target.id,
      reason: "expired active key reissue smoke",
    }
  );
  const issueJson = await readJson<CredentialIssueResponseData>(issue.payload);
  const activeTokenCount = await prisma.userPasswordToken.count({
    where: {
      userId: target.id,
      purpose: "PASSWORD_RESET",
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
    },
  });
  const expiredAfter = await prisma.userPasswordToken.findUnique({
    where: { id: expiredCredential.id },
  });

  assert.equal(issue.statusCode, 201);
  assert.equal(issueJson.ok, true);
  assert.equal(issueJson.data?.revokedTokenCount, 1);
  assert.equal(activeTokenCount, 1);
  assert.equal(expiredAfter?.activeKey, null);
  assert.ok(expiredAfter?.revokedAt);
  assertNoSecretStrings(issueJson, [
    expiredCredential.rawToken,
    expiredCredential.tokenHash,
  ]);
}

async function assertAdminRevokeExpiredActiveKeyCleanup(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "expiredrevoke",
  });
  const expiredCredential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() - 60_000),
  });

  const verify = await post(app, "/auth/password-reset/verify", null, {
    token: expiredCredential.rawToken,
  });
  const verifyJson = await readJson(verify.payload);
  const revoke = await post(
    app,
    "/admin/staffs/password-reset/revoke",
    adminToken,
    {
      userId: target.id,
      reason: "expired active key revoke smoke",
    }
  );
  const revokeJson = await readJson<CredentialRevokeResponseData>(
    revoke.payload
  );
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: expiredCredential.id },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_REVOKED",
      entityId: target.id,
      reason: "expired active key revoke smoke",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(verify.statusCode, 400);
  assert.equal(verifyJson.ok, false);
  assert.equal(verifyJson.code, "INVALID_CREDENTIAL_TOKEN");
  assert.equal(revoke.statusCode, 200);
  assert.equal(revokeJson.ok, true);
  assert.equal(revokeJson.data?.userId, target.id);
  assert.equal(revokeJson.data?.purpose, "PASSWORD_RESET");
  assert.equal(revokeJson.data?.revokedTokenCount, 1);
  assert.equal(tokenAfter?.activeKey, null);
  assert.ok(tokenAfter?.revokedAt);
  assert.ok(audit);
  assert.equal(asRecord(audit.afterJson).revokedTokenCount, 1);
  assertNoSecretStrings(verifyJson, [
    expiredCredential.rawToken,
    expiredCredential.tokenHash,
  ]);
  assertNoSecretStrings(revokeJson, [
    expiredCredential.rawToken,
    expiredCredential.tokenHash,
  ]);
  assertNoSecretStrings(audit, [
    expiredCredential.rawToken,
    expiredCredential.tokenHash,
  ]);
  assertNoForbiddenCredentialFields(verifyJson);
  assertNoForbiddenCredentialFields(revokeJson);
  assertNoForbiddenCredentialFields(audit);
}

async function assertAdminRevokeBlocksCompletion(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "revokecred",
  });
  const historicalRevokedCredential = await createCredentialTokenFixture(
    prisma,
    {
      userId: target.id,
      purpose: "PASSWORD_RESET",
    }
  );
  const historicalRevokedAt = new Date(Date.now() - 10 * 60 * 1000);

  await prisma.userPasswordToken.update({
    where: { id: historicalRevokedCredential.id },
    data: {
      activeKey: null,
      revokedAt: historicalRevokedAt,
      revokedById: fixtures.adminUserId,
    },
  });

  const historicalUsedCredential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const historicalUsedAt = new Date(Date.now() - 5 * 60 * 1000);

  await prisma.userPasswordToken.update({
    where: { id: historicalUsedCredential.id },
    data: {
      activeKey: null,
      usedAt: historicalUsedAt,
    },
  });

  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const activationCredential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "STAFF_ACTIVATION",
  });

  const revoke = await post(
    app,
    "/admin/staffs/password-reset/revoke",
    adminToken,
    {
      userId: target.id,
      reason: "revoke credential smoke",
    }
  );
  const revokeJson = await readJson<CredentialRevokeResponseData>(
    revoke.payload
  );
  const complete = await post(app, "/auth/password-reset/complete", null, {
    token: credential.rawToken,
    password: "RevokedAccess#2026",
    confirmPassword: "RevokedAccess#2026",
  });
  const completeJson = await readJson(complete.payload);
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
  });
  const historicalRevokedAfter = await prisma.userPasswordToken.findUnique({
    where: { id: historicalRevokedCredential.id },
  });
  const historicalUsedAfter = await prisma.userPasswordToken.findUnique({
    where: { id: historicalUsedCredential.id },
  });
  const activationAfter = await prisma.userPasswordToken.findUnique({
    where: { id: activationCredential.id },
  });
  const revokeAudit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_REVOKED",
      entityId: target.id,
      reason: "revoke credential smoke",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(revoke.statusCode, 200);
  assert.equal(revokeJson.ok, true);
  assert.equal(revokeJson.data?.userId, target.id);
  assert.equal(revokeJson.data?.purpose, "PASSWORD_RESET");
  assert.equal(revokeJson.data?.revokedTokenCount, 1);
  assert.equal(tokenAfter?.activeKey, null);
  assert.ok(tokenAfter?.revokedAt);
  assert.equal(
    historicalRevokedAfter?.revokedAt?.toISOString(),
    historicalRevokedAt.toISOString()
  );
  assert.equal(
    historicalUsedAfter?.usedAt?.toISOString(),
    historicalUsedAt.toISOString()
  );
  assert.equal(
    activationAfter?.activeKey,
    buildCredentialTokenActiveKey(target.id, "STAFF_ACTIVATION")
  );
  assert.equal(activationAfter?.revokedAt, null);
  assert.ok(revokeAudit);
  assert.equal(asRecord(revokeAudit.afterJson).revokedTokenCount, 1);
  assert.equal(complete.statusCode, 400);
  assert.equal(completeJson.ok, false);
  assert.equal(completeJson.code, "INVALID_CREDENTIAL_TOKEN");
  const firstRevokedAt = tokenAfter?.revokedAt;

  assert.ok(firstRevokedAt);

  const secondRevoke = await post(
    app,
    "/admin/staffs/password-reset/revoke",
    adminToken,
    {
      userId: target.id,
      reason: "revoke credential noop smoke",
    }
  );
  const secondRevokeJson = await readJson<CredentialRevokeResponseData>(
    secondRevoke.payload
  );
  const tokenAfterSecond = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
  });
  const secondRevokeAudit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_REVOKED",
      entityId: target.id,
      reason: "revoke credential noop smoke",
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(secondRevoke.statusCode, 200);
  assert.equal(secondRevokeJson.ok, true);
  assert.equal(secondRevokeJson.data?.userId, target.id);
  assert.equal(secondRevokeJson.data?.purpose, "PASSWORD_RESET");
  assert.equal(secondRevokeJson.data?.revokedTokenCount, 0);
  assert.equal(tokenAfterSecond?.activeKey, null);
  assert.equal(
    tokenAfterSecond?.revokedAt?.toISOString(),
    firstRevokedAt.toISOString()
  );
  assert.ok(secondRevokeAudit);
  assert.equal(asRecord(secondRevokeAudit.afterJson).revokedTokenCount, 0);
  assertNoSecretStrings(revokeJson, [
    credential.rawToken,
    credential.tokenHash,
    historicalRevokedCredential.rawToken,
    historicalRevokedCredential.tokenHash,
    historicalUsedCredential.rawToken,
    historicalUsedCredential.tokenHash,
    activationCredential.rawToken,
    activationCredential.tokenHash,
  ]);
  assertNoSecretStrings(revokeAudit, [
    credential.rawToken,
    credential.tokenHash,
    historicalRevokedCredential.rawToken,
    historicalRevokedCredential.tokenHash,
    historicalUsedCredential.rawToken,
    historicalUsedCredential.tokenHash,
    activationCredential.rawToken,
    activationCredential.tokenHash,
  ]);
  assertNoSecretStrings(secondRevokeJson, [
    credential.rawToken,
    credential.tokenHash,
    historicalRevokedCredential.rawToken,
    historicalRevokedCredential.tokenHash,
    historicalUsedCredential.rawToken,
    historicalUsedCredential.tokenHash,
    activationCredential.rawToken,
    activationCredential.tokenHash,
  ]);
  assertNoSecretStrings(secondRevokeAudit, [
    credential.rawToken,
    credential.tokenHash,
    historicalRevokedCredential.rawToken,
    historicalRevokedCredential.tokenHash,
    historicalUsedCredential.rawToken,
    historicalUsedCredential.tokenHash,
    activationCredential.rawToken,
    activationCredential.tokenHash,
  ]);
  assertNoSecretStrings(completeJson, [
    credential.rawToken,
    credential.tokenHash,
    historicalRevokedCredential.rawToken,
    historicalRevokedCredential.tokenHash,
    historicalUsedCredential.rawToken,
    historicalUsedCredential.tokenHash,
    activationCredential.rawToken,
    activationCredential.tokenHash,
  ]);
  assertNoForbiddenCredentialFields(revokeJson);
  assertNoForbiddenCredentialFields(revokeAudit);
  assertNoForbiddenCredentialFields(secondRevokeJson);
  assertNoForbiddenCredentialFields(secondRevokeAudit);
}

async function assertDeactivationRevokesCredentialTokens(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "deactcred",
  });
  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const response = await post(app, "/admin/staffs/change-status", adminToken, {
    userId: target.id,
    status: "INACTIVE",
    reason: "deactivate credential token smoke",
  });
  const json = await readJson(response.payload);
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
  });
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_STATUS_CHANGED",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(json.ok, true);
  assert.equal(tokenAfter?.activeKey, null);
  assert.ok(tokenAfter?.revokedAt);
  assert.ok(audit);
  assert.ok(Number(asRecord(audit.afterJson).revokedCredentialTokenCount) >= 1);
  assertNoSecretStrings(json, [credential.rawToken, credential.tokenHash]);
  assertNoSecretStrings(audit, [credential.rawToken, credential.tokenHash]);
}

async function assertAdminCredentialMutationRateLimit(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[]
) {
  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";

  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "adminlimit",
  });
  const invalidBody = await post(
    app,
    "/admin/staffs/activation/issue",
    adminToken,
    {
      userId: "",
    }
  );
  const invalidBodyJson = await readJson(invalidBody.payload);
  const issueAuditBefore = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_ISSUED",
      entityId: target.id,
    },
  });
  const rateLimitAuditBefore = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
  });

  assert.equal(invalidBody.statusCode, 400);
  assert.equal(invalidBodyJson.ok, false);
  assert.equal(invalidBodyJson.code, "VALIDATION_FAILED");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await post(
      app,
      "/admin/staffs/activation/issue",
      adminToken,
      {
        userId: target.id,
        reason: `admin credential rate limit smoke ${attempt + 1}`,
      },
      { "x-forwarded-for": `198.51.100.${attempt + 11}` }
    );
    const json = await readJson<CredentialIssueResponseData>(response.payload);

    assert.equal(response.statusCode, 201);
    assert.equal(json.ok, true);
    assert.equal(json.data?.purpose, "STAFF_ACTIVATION");
    assertNoForbiddenCredentialFields(json);
    assertNoSecretStrings(json, [deliveries.at(-1)?.token ?? ""]);
  }

  const tokenCountAfterAllowed = await prisma.userPasswordToken.count({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
  });
  const activeTokenCountAfterAllowed = await prisma.userPasswordToken.count({
    where: {
      userId: target.id,
      purpose: "STAFF_ACTIVATION",
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
    },
  });
  const deliveryCountAfterAllowed = deliveries.length;
  const issueAuditAfterAllowed = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_ISSUED",
      entityId: target.id,
    },
  });
  const blocked = await post(
    app,
    "/admin/staffs/activation/issue",
    adminToken,
    {
      userId: target.id,
      reason: "admin credential rate limit blocked smoke",
    },
    { "x-forwarded-for": "203.0.113.222" }
  );
  const blockedJson = await readJson(blocked.payload);
  const tokenCountAfterBlocked = await prisma.userPasswordToken.count({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
  });
  const issueAuditAfterBlocked = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_ISSUED",
      entityId: target.id,
    },
  });
  const rateLimitAuditAfter = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
  });
  const rateLimitAudit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(tokenCountAfterAllowed, 4);
  assert.equal(activeTokenCountAfterAllowed, 1);
  assert.equal(issueAuditAfterAllowed, issueAuditBefore + 4);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "RATE_LIMITED");
  assert.match(String(blocked.headers["retry-after"] ?? ""), /^[1-9]\d*$/);
  assert.equal(tokenCountAfterBlocked, tokenCountAfterAllowed);
  assert.equal(deliveries.length, deliveryCountAfterAllowed);
  assert.equal(issueAuditAfterBlocked, issueAuditAfterAllowed);
  assert.equal(rateLimitAuditAfter, rateLimitAuditBefore + 1);
  assert.ok(rateLimitAudit);
  assert.equal(asRecord(rateLimitAudit.afterJson).targetUserId, target.id);
  assert.equal(asRecord(rateLimitAudit.afterJson).mutation, "issue");
  assertNoForbiddenCredentialFields(blockedJson);
  assertNoForbiddenCredentialFields(rateLimitAudit);

  const revokeTarget = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "adminrevokelimit",
  });
  const revokeCredential = await createCredentialTokenFixture(prisma, {
    userId: revokeTarget.id,
    purpose: "PASSWORD_RESET",
  });
  const revokeRateLimitAuditBefore = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_RATE_LIMITED",
      entityId: revokeTarget.id,
    },
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await post(
      app,
      "/admin/staffs/password-reset/revoke",
      adminToken,
      {
        userId: revokeTarget.id,
        reason: `admin credential revoke rate limit smoke ${attempt + 1}`,
      },
      { "x-forwarded-for": `198.51.100.${attempt + 41}` }
    );
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 200);
    assert.equal(json.ok, true);
    assertNoSecretStrings(json, [
      revokeCredential.rawToken,
      revokeCredential.tokenHash,
    ]);
    assertNoForbiddenCredentialFields(json);
  }

  const revokeBlocked = await post(
    app,
    "/admin/staffs/password-reset/revoke",
    adminToken,
    {
      userId: revokeTarget.id,
      reason: "admin credential revoke rate limit blocked smoke",
    },
    { "x-forwarded-for": "203.0.113.241" }
  );
  const revokeBlockedJson = await readJson(revokeBlocked.payload);
  const revokeRateLimitAuditAfter = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_RATE_LIMITED",
      entityId: revokeTarget.id,
    },
  });
  const revokeRateLimitAudit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_PASSWORD_RESET_RATE_LIMITED",
      entityId: revokeTarget.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(revokeBlocked.statusCode, 429);
  assert.equal(revokeBlockedJson.ok, false);
  assert.equal(revokeBlockedJson.code, "RATE_LIMITED");
  assert.match(
    String(revokeBlocked.headers["retry-after"] ?? ""),
    /^[1-9]\d*$/
  );
  assert.equal(revokeRateLimitAuditAfter, revokeRateLimitAuditBefore + 1);
  assert.ok(revokeRateLimitAudit);
  assert.equal(asRecord(revokeRateLimitAudit.afterJson).mutation, "revoke");
  assertNoSecretStrings(revokeBlockedJson, [
    revokeCredential.rawToken,
    revokeCredential.tokenHash,
  ]);
  assertNoForbiddenCredentialFields(revokeBlockedJson);
  assertNoForbiddenCredentialFields(revokeRateLimitAudit);

  await assertCorruptAdminCredentialRateLimitBlocksBeforeService(
    app,
    adminToken,
    fixtures,
    prisma,
    deliveries
  );
}

async function assertCorruptAdminCredentialRateLimitBlocksBeforeService(
  app: FastifyInstance,
  adminToken: string,
  fixtures: FixtureContext,
  prisma: PrismaClient,
  deliveries: DeliveryRecord[]
) {
  resetAdminCredentialMutationRateLimitForTest();
  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";

  const target = await createUserFixture(prisma, {
    status: "INACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "adminlimitcorrupt",
  });
  const tokenCountBefore = await prisma.userPasswordToken.count({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
  });
  const deliveryCountBefore = deliveries.length;
  const rateLimitAuditBefore = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
  });

  await writeFile(tempAdminCredentialRateLimitPath, "{", "utf8");

  const blocked = await post(
    app,
    "/admin/staffs/activation/issue",
    adminToken,
    {
      userId: target.id,
      reason: "corrupt admin credential rate limit smoke",
    },
    { "x-forwarded-for": "203.0.113.242" }
  );
  const blockedJson = await readJson(blocked.payload);
  const tokenCountAfter = await prisma.userPasswordToken.count({
    where: { userId: target.id, purpose: "STAFF_ACTIVATION" },
  });
  const rateLimitAuditAfter = await prisma.auditLog.count({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
  });
  const rateLimitAudit = await prisma.auditLog.findFirst({
    where: {
      action: "ADMIN_STAFF_ACTIVATION_RATE_LIMITED",
      entityId: target.id,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.equal(blocked.statusCode, 429);
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "RATE_LIMITED");
  assert.match(String(blocked.headers["retry-after"] ?? ""), /^[1-9]\d*$/);
  assert.equal(tokenCountAfter, tokenCountBefore);
  assert.equal(deliveries.length, deliveryCountBefore);
  assert.equal(rateLimitAuditAfter, rateLimitAuditBefore + 1);
  assert.ok(rateLimitAudit);
  assert.equal(asRecord(rateLimitAudit.afterJson).targetUserId, target.id);
  assert.equal(asRecord(rateLimitAudit.afterJson).mutation, "issue");
  assertNoSecretStrings(blockedJson, [target.id]);
  assertNoForbiddenCredentialFields(blockedJson);
  assertNoForbiddenCredentialFields(rateLimitAudit);

  resetAdminCredentialMutationRateLimitForTest();
}

async function assertValidTokenRateLimitBlocksCompleteBeforeService(
  app: FastifyInstance,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  const target = await createUserFixture(prisma, {
    status: "ACTIVE",
    storeId: fixtures.activeStoreId,
    loginPrefix: "preservicelimit",
    password: "PreServiceOriginal123!",
  });
  const targetSessionToken = await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  const credential = await createCredentialTokenFixture(prisma, {
    userId: target.id,
    purpose: "PASSWORD_RESET",
  });
  const tokenBefore = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
    select: {
      activeKey: true,
      revokedAt: true,
      usedAt: true,
    },
  });
  const userBefore = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      passwordHash: true,
      status: true,
      updatedAt: true,
    },
  });
  const sessionBefore = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(targetSessionToken),
    },
    select: { revokedAt: true },
  });
  const auditCountBefore = await prisma.auditLog.count({
    where: {
      action: "STAFF_PASSWORD_RESET_COMPLETED",
      entityId: target.id,
    },
  });

  assert.ok(tokenBefore);
  assert.ok(tokenBefore.activeKey);
  assert.equal(tokenBefore.usedAt, null);
  assert.equal(tokenBefore.revokedAt, null);
  assert.ok(userBefore);
  assert.ok(sessionBefore);
  assert.equal(sessionBefore.revokedAt, null);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const invalidToken = generateCredentialToken();
    const response = await post(
      app,
      "/auth/password-reset/verify",
      null,
      { token: invalidToken },
      { "x-forwarded-for": `198.51.100.${attempt + 80}` }
    );
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 400);
    assert.equal(json.ok, false);
    assert.equal(json.code, "INVALID_CREDENTIAL_TOKEN");
    assertNoSecretStrings(json, [invalidToken]);
    assertNoForbiddenCredentialFields(json);
  }

  const blockedPassword = "PreServiceBlocked#2026";
  const blocked = await post(
    app,
    "/auth/password-reset/complete",
    null,
    {
      token: credential.rawToken,
      password: blockedPassword,
      confirmPassword: blockedPassword,
    },
    { "x-forwarded-for": "203.0.113.252" }
  );
  const blockedJson = await readJson(blocked.payload);
  const tokenAfter = await prisma.userPasswordToken.findUnique({
    where: { id: credential.id },
    select: {
      activeKey: true,
      revokedAt: true,
      usedAt: true,
    },
  });
  const userAfter = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      passwordHash: true,
      status: true,
      updatedAt: true,
    },
  });
  const sessionAfter = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(targetSessionToken),
    },
    select: { revokedAt: true },
  });
  const auditCountAfter = await prisma.auditLog.count({
    where: {
      action: "STAFF_PASSWORD_RESET_COMPLETED",
      entityId: target.id,
    },
  });

  assert.equal(blocked.statusCode, 429);
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "RATE_LIMITED");
  assert.match(String(blocked.headers["retry-after"] ?? ""), /^[1-9]\d*$/);
  assert.equal(tokenAfter?.activeKey, tokenBefore.activeKey);
  assert.equal(tokenAfter?.usedAt, null);
  assert.equal(tokenAfter?.revokedAt, null);
  assert.equal(userAfter?.passwordHash, userBefore.passwordHash);
  assert.equal(userAfter?.status, userBefore.status);
  assert.equal(userAfter?.updatedAt.getTime(), userBefore.updatedAt.getTime());
  assert.equal(sessionAfter?.revokedAt, null);
  assert.equal(auditCountAfter, auditCountBefore);
  assertNoSecretStrings(blockedJson, [
    credential.rawToken,
    credential.tokenHash,
    blockedPassword,
  ]);
  assertNoForbiddenCredentialFields(blockedJson);

  await login(app, {
    loginId: target.loginId,
    password: target.password,
    role: "STAFF",
  });
  await assertLoginRejected(app, {
    loginId: target.loginId,
    password: blockedPassword,
  });
}

async function assertCredentialTokenRateLimit(
  app: FastifyInstance,
  fixtures: FixtureContext,
  prisma: PrismaClient
) {
  resetCredentialTokenRateLimitForTest();
  await assertValidTokenRateLimitBlocksCompleteBeforeService(
    app,
    fixtures,
    prisma
  );
  resetCredentialTokenRateLimitForTest();

  const rawToken = generateCredentialToken();
  const limitedIp = "198.51.100.250";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await post(
      app,
      "/auth/password-reset/verify",
      null,
      { token: rawToken },
      { "x-forwarded-for": limitedIp }
    );
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 400);
    assert.equal(json.ok, false);
    assert.equal(json.code, "INVALID_CREDENTIAL_TOKEN");
  }

  const blocked = await post(
    app,
    "/auth/password-reset/verify",
    null,
    { token: rawToken },
    { "x-forwarded-for": limitedIp }
  );
  const blockedJson = await readJson(blocked.payload);

  assert.equal(blocked.statusCode, 429);
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "RATE_LIMITED");
  assert.match(String(blocked.headers["retry-after"] ?? ""), /^[1-9]\d*$/);
  assertNoSecretStrings(blockedJson, [rawToken]);
  assertNoForbiddenCredentialFields(blockedJson);

  resetCredentialTokenRateLimitForTest();

  const rotatedHeaderToken = generateCredentialToken();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await post(
      app,
      "/auth/password-reset/verify",
      null,
      { token: rotatedHeaderToken },
      { "x-forwarded-for": `198.51.100.${attempt + 1}` }
    );
    const json = await readJson(response.payload);

    assert.equal(response.statusCode, 400);
    assert.equal(json.ok, false);
    assert.equal(json.code, "INVALID_CREDENTIAL_TOKEN");
  }

  const rotatedBlocked = await post(
    app,
    "/auth/password-reset/verify",
    null,
    { token: rotatedHeaderToken },
    { "x-forwarded-for": "203.0.113.250" }
  );
  const rotatedBlockedJson = await readJson(rotatedBlocked.payload);

  assert.equal(rotatedBlocked.statusCode, 429);
  assert.equal(rotatedBlockedJson.ok, false);
  assert.equal(rotatedBlockedJson.code, "RATE_LIMITED");
  assert.match(
    String(rotatedBlocked.headers["retry-after"] ?? ""),
    /^[1-9]\d*$/
  );
  assertNoSecretStrings(rotatedBlockedJson, [rotatedHeaderToken]);
  assertNoForbiddenCredentialFields(rotatedBlockedJson);

  const completeBlockedPassword = "BlockedAccess#2026";
  const completeBlocked = await post(
    app,
    "/auth/password-reset/complete",
    null,
    {
      token: rotatedHeaderToken,
      password: completeBlockedPassword,
      confirmPassword: completeBlockedPassword,
    },
    { "x-forwarded-for": "203.0.113.251" }
  );
  const completeBlockedJson = await readJson(completeBlocked.payload);

  assert.equal(completeBlocked.statusCode, 429);
  assert.equal(completeBlockedJson.ok, false);
  assert.equal(completeBlockedJson.code, "RATE_LIMITED");
  assert.match(
    String(completeBlocked.headers["retry-after"] ?? ""),
    /^[1-9]\d*$/
  );
  assertNoSecretStrings(completeBlockedJson, [
    rotatedHeaderToken,
    completeBlockedPassword,
  ]);
  assertNoForbiddenCredentialFields(completeBlockedJson);

  resetCredentialTokenRateLimitForTest();

  const concurrentToken = generateCredentialToken();
  const concurrentResponses = await Promise.all(
    Array.from({ length: 20 }, async (_, index) => {
      const response = await post(
        app,
        "/auth/password-reset/verify",
        null,
        { token: concurrentToken },
        { "x-forwarded-for": `198.51.100.${index + 60}` }
      );
      const json = await readJson(response.payload);

      return { response, json };
    })
  );
  const invalidConcurrentResponses = concurrentResponses.filter(
    ({ response, json }) =>
      response.statusCode === 400 &&
      !json.ok &&
      json.code === "INVALID_CREDENTIAL_TOKEN"
  );
  const rateLimitedConcurrentResponses = concurrentResponses.filter(
    ({ response, json }) =>
      response.statusCode === 429 && !json.ok && json.code === "RATE_LIMITED"
  );

  assert.ok(invalidConcurrentResponses.length <= 10);
  assert.ok(rateLimitedConcurrentResponses.length >= 1);

  for (const { response, json } of rateLimitedConcurrentResponses) {
    assert.match(String(response.headers["retry-after"] ?? ""), /^[1-9]\d*$/);
    assertNoSecretStrings(json, [concurrentToken]);
    assertNoForbiddenCredentialFields(json);
  }

  for (const { json } of invalidConcurrentResponses) {
    assertNoSecretStrings(json, [concurrentToken]);
    assertNoForbiddenCredentialFields(json);
  }

  resetCredentialTokenRateLimitForTest();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
