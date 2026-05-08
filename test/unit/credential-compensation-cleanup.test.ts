import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { runCredentialCompensationCleanup } from "../../apps/api/src/services/admin/credential-compensation-cleanup.service";
import { UserPasswordTokenPurpose } from "../../packages/db/src/generated/prisma/enums";

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(dirname(currentFile), "../..");
const packageRoot = resolve(workspaceRoot, "packages/db");
const cleanupDbRoot = resolve(workspaceRoot, ".tmp/credential-cleanup");

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function toSqliteFileUrl(filePath: string) {
  return `file:${filePath.replaceAll(path.sep, "/")}`;
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);

  return (
    Boolean(relative) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

async function removeSqliteFiles(dbPath: string) {
  for (const filePath of [
    dbPath,
    `${dbPath}-journal`,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
  ]) {
    const resolved = resolve(filePath);

    if (!isInside(cleanupDbRoot, resolved)) {
      throw new Error("Refusing to remove a cleanup test DB outside .tmp.");
    }

    await rm(resolved, { force: true });
  }
}

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
) {
  await new Promise<void>((resolvePromise, reject) => {
    const isWindows = process.platform === "win32";
    const child = spawn(
      isWindows ? (process.env.ComSpec ?? "cmd.exe") : command,
      isWindows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args,
      {
        cwd: packageRoot,
        env,
        stdio: "inherit",
      }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function runWorkspaceCommand(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolvePromise, reject) => {
      const isWindows = process.platform === "win32";
      const child = spawn(
        isWindows ? (process.env.ComSpec ?? "cmd.exe") : pnpmCommand(),
        isWindows
          ? ["/d", "/s", "/c", `${pnpmCommand()} ${args.join(" ")}`]
          : args,
        {
          cwd: workspaceRoot,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        resolvePromise({ code, stdout, stderr });
      });
    }
  );
}

async function migrateDeploy(databaseUrl: string) {
  await runCommand(
    pnpmCommand(),
    ["exec", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"],
    {
      ...process.env,
      APP_ENV: "test",
      DATABASE_URL: databaseUrl,
    }
  );
}

async function createTestPrisma(testName: string) {
  await mkdir(cleanupDbRoot, { recursive: true });

  const dbPath = resolve(cleanupDbRoot, `${testName}.db`);
  await removeSqliteFiles(dbPath);
  await writeFile(dbPath, "");

  const databaseUrl = toSqliteFileUrl(dbPath);
  await migrateDeploy(databaseUrl);

  process.env.DATABASE_URL = databaseUrl;

  const { createPrismaClient } = await import("../../packages/db/src/client");

  return createPrismaClient(databaseUrl);
}

function assertNoSecretFields(value: unknown) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes("tokenHash"), false);
  assert.equal(serialized.includes("v1:hmac-sha256"), false);
  assert.equal(serialized.includes("raw"), false);
  assert.equal(serialized.includes("ipAddress"), false);
  assert.equal(serialized.includes("userAgent"), false);
  assert.equal(serialized.includes("updatedAt"), false);
  assert.equal(serialized.includes("revokedById"), false);
}

describe("credential compensation cleanup command operation", () => {
  it("dry-runs only limbo tokens without selecting token hashes", async () => {
    const prisma = await createTestPrisma("dry-run");
    const now = new Date("2026-05-08T01:00:00.000Z");
    const old = new Date("2026-05-08T00:40:00.000Z");
    const recent = new Date("2026-05-08T00:55:00.000Z");
    const expiresAt = new Date("2026-05-08T02:00:00.000Z");

    try {
      const admin = await prisma.user.create({
        data: {
          id: "cleanup_dry_run_admin",
          name: "Cleanup Admin",
          email: "cleanup_dry_run_admin",
          passwordHash: "test-only-password-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      const limbo = await prisma.userPasswordToken.create({
        data: {
          userId: admin.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:dry-run-limbo",
          activeKey: null,
          expiresAt,
          createdById: admin.id,
          createdAt: old,
        },
      });

      await prisma.userPasswordToken.createMany({
        data: [
          {
            userId: admin.id,
            purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
            tokenHash: "v1:hmac-sha256:dry-run-in-flight",
            activeKey: null,
            expiresAt,
            createdById: admin.id,
            createdAt: recent,
          },
          {
            userId: admin.id,
            purpose: UserPasswordTokenPurpose.PASSWORD_RESET,
            tokenHash: "v1:hmac-sha256:dry-run-used",
            activeKey: null,
            expiresAt,
            usedAt: old,
            createdById: admin.id,
            createdAt: old,
          },
          {
            userId: admin.id,
            purpose: UserPasswordTokenPurpose.PASSWORD_RESET,
            tokenHash: "v1:hmac-sha256:dry-run-revoked",
            activeKey: null,
            expiresAt,
            revokedAt: old,
            revokedById: admin.id,
            createdById: admin.id,
            createdAt: old,
          },
          {
            userId: admin.id,
            purpose: UserPasswordTokenPurpose.PASSWORD_RESET,
            tokenHash: "v1:hmac-sha256:dry-run-active",
            activeKey: `${admin.id}:PASSWORD_RESET`,
            expiresAt,
            createdById: admin.id,
            createdAt: old,
          },
        ],
      });

      const result = await runCredentialCompensationCleanup(prisma, {
        now,
        detectionWindowMinutes: 10,
      });

      assert.equal(result.mode, "dry-run");
      assert.deepEqual(
        result.candidates.map((candidate) => candidate.id),
        [limbo.id]
      );
      assert.deepEqual(Object.keys(result.candidates[0]).sort(), [
        "createdAt",
        "createdById",
        "expiresAt",
        "hadActiveKey",
        "hadRevokedAt",
        "hadUsedAt",
        "id",
        "purpose",
        "userId",
      ]);
      assert.equal(result.cleanedTokenIds.length, 0);
      assert.equal(result.auditLogIds.length, 0);
      assertNoSecretFields(result);

      const limboAfter = await prisma.userPasswordToken.findUniqueOrThrow({
        where: { id: limbo.id },
      });

      assert.equal(limboAfter.revokedAt, null);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("confirmed cleanup revokes exact limbo targets and writes audit rows in one transaction", async () => {
    const prisma = await createTestPrisma("confirmed");
    const now = new Date("2026-05-08T01:00:00.000Z");
    const old = new Date("2026-05-08T00:40:00.000Z");
    const expiresAt = new Date("2026-05-08T02:00:00.000Z");

    try {
      const admin = await prisma.user.create({
        data: {
          id: "cleanup_confirmed_admin",
          name: "Cleanup Admin",
          email: "cleanup_confirmed_admin",
          passwordHash: "test-only-password-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      const limbo = await prisma.userPasswordToken.create({
        data: {
          userId: admin.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:confirmed-limbo",
          activeKey: null,
          expiresAt,
          createdById: admin.id,
          createdAt: old,
        },
      });
      const active = await prisma.userPasswordToken.create({
        data: {
          userId: admin.id,
          purpose: UserPasswordTokenPurpose.PASSWORD_RESET,
          tokenHash: "v1:hmac-sha256:confirmed-active",
          activeKey: `${admin.id}:PASSWORD_RESET`,
          expiresAt,
          createdById: admin.id,
          createdAt: old,
        },
      });

      const result = await runCredentialCompensationCleanup(prisma, {
        confirm: true,
        tokenIds: [limbo.id],
        expectedCandidateCount: 1,
        now,
        detectionWindowMinutes: 10,
        actorUserId: admin.id,
        operator: "release-operator",
        ticketId: "INC-20260508-001",
      });

      assert.equal(result.mode, "confirmed");
      assert.deepEqual(result.cleanedTokenIds, [limbo.id]);
      assert.equal(result.auditLogIds.length, 1);
      assertNoSecretFields(result);

      const limboAfter = await prisma.userPasswordToken.findUniqueOrThrow({
        where: { id: limbo.id },
      });
      const activeAfter = await prisma.userPasswordToken.findUniqueOrThrow({
        where: { id: active.id },
      });
      const audit = await prisma.auditLog.findUniqueOrThrow({
        where: { id: result.auditLogIds[0] },
      });

      assert.deepEqual(limboAfter.revokedAt, now);
      assert.equal(limboAfter.revokedById, admin.id);
      assert.equal(activeAfter.revokedAt, null);
      assert.equal(activeAfter.activeKey, active.activeKey);
      assert.equal(audit.action, "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP");
      assert.equal(audit.entityType, "User");
      assert.equal(audit.entityId, admin.id);
      assert.equal(audit.actorUserId, admin.id);
      assertNoSecretFields(audit.beforeJson);
      assertNoSecretFields(audit.afterJson);
      assert.deepEqual(audit.afterJson, {
        tokenId: limbo.id,
        userId: admin.id,
        purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
        cleanupReason: "COMPENSATION_FAILURE_LIMBO_TOKEN",
        detectionWindowMinutes: 10,
        hadActiveKey: false,
        hadUsedAt: false,
        hadRevokedAt: false,
        operator: "release-operator",
        ticketId: "INC-20260508-001",
        revokedAt: now.toISOString(),
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("rolls back without audit when a confirmed token id no longer matches the limbo predicate", async () => {
    const prisma = await createTestPrisma("target-mismatch");
    const now = new Date("2026-05-08T01:00:00.000Z");
    const old = new Date("2026-05-08T00:40:00.000Z");
    const expiresAt = new Date("2026-05-08T02:00:00.000Z");

    try {
      const admin = await prisma.user.create({
        data: {
          id: "cleanup_mismatch_admin",
          name: "Cleanup Admin",
          email: "cleanup_mismatch_admin",
          passwordHash: "test-only-password-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      const used = await prisma.userPasswordToken.create({
        data: {
          userId: admin.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:mismatch-used",
          activeKey: null,
          expiresAt,
          usedAt: old,
          createdById: admin.id,
          createdAt: old,
        },
      });

      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: [used.id],
          expectedCandidateCount: 1,
          now,
          actorUserId: admin.id,
          operator: "release-operator",
          ticketId: "INC-20260508-002",
        }),
        /target mismatch/
      );

      const usedAfter = await prisma.userPasswordToken.findUniqueOrThrow({
        where: { id: used.id },
      });

      assert.equal(usedAfter.revokedAt, null);
      assert.equal(await prisma.auditLog.count(), 0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("rolls back token revoke when audit insertion fails", async () => {
    const prisma = await createTestPrisma("audit-failure");
    const now = new Date("2026-05-08T01:00:00.000Z");
    const old = new Date("2026-05-08T00:40:00.000Z");
    const expiresAt = new Date("2026-05-08T02:00:00.000Z");

    try {
      const admin = await prisma.user.create({
        data: {
          id: "cleanup_audit_failure_admin",
          name: "Cleanup Admin",
          email: "cleanup_audit_failure_admin",
          passwordHash: "test-only-password-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      const limbo = await prisma.userPasswordToken.create({
        data: {
          userId: admin.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:audit-failure-limbo",
          activeKey: null,
          expiresAt,
          createdById: admin.id,
          createdAt: old,
        },
      });

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER credential_cleanup_audit_abort
        BEFORE INSERT ON AuditLog
        WHEN NEW.action = 'ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP'
        BEGIN
          SELECT RAISE(ABORT, 'cleanup audit insert blocked');
        END;
      `);

      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: [limbo.id],
          expectedCandidateCount: 1,
          now,
          actorUserId: admin.id,
          operator: "release-operator",
          ticketId: "INC-20260508-003",
        }),
        /cleanup audit insert blocked|Foreign key constraint/
      );

      const limboAfter = await prisma.userPasswordToken.findUniqueOrThrow({
        where: { id: limbo.id },
      });

      assert.equal(limboAfter.revokedAt, null);
      assert.equal(limboAfter.revokedById, null);
      assert.equal(await prisma.auditLog.count(), 0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("requires token ids and operator for confirmed cleanup", async () => {
    const prisma = await createTestPrisma("confirm-input");

    try {
      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          operator: "release-operator",
          ticketId: "INC-20260508-004",
          expectedCandidateCount: 1,
        }),
        /requires at least one --token-id/
      );
      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: ["token-1"],
          expectedCandidateCount: 1,
          actorUserId: "admin-1",
        }),
        /requires --operator/
      );
      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: ["token-1"],
          expectedCandidateCount: 1,
          actorUserId: "admin-1",
          operator: "release-operator",
        }),
        /requires --ticket-id/
      );
      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: ["token-1"],
          expectedCandidateCount: 1,
          actorUserId: "admin-1",
          operator: "Bearer secret",
          ticketId: "INC-20260508-004",
        }),
        /forbidden credential material/
      );
      await assert.rejects(
        runCredentialCompensationCleanup(prisma, {
          confirm: true,
          tokenIds: ["token-1"],
          expectedCandidateCount: 1,
          actorUserId: "admin-1",
          operator: "release-operator",
          ticketId: "INC-20260508-004",
          detectionWindowMinutes: 9,
        }),
        /detectionWindowMinutes >= 10/
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it("redacts non-SQLite database URLs from CLI evidence output", async () => {
    const result = await runWorkspaceCommand([
      "--silent",
      "ops:credential-compensation-cleanup",
      "--database-url",
      "postgresql://user:super-secret@db.example.test:5432/psms?sslmode=require",
    ]);

    assert.notEqual(result.code, 0);
    assert.equal(result.stdout.includes("super-secret"), false);
    assert.equal(result.stderr.includes("super-secret"), false);
    assert.match(result.stderr, /postgresql rehearsal is BLOCK/);
  });
});
