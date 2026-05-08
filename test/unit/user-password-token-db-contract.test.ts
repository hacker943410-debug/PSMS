import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { Prisma } from "../../packages/db/src/generated/prisma/client";
import { UserPasswordTokenPurpose } from "../../packages/db/src/generated/prisma/enums";

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(dirname(currentFile), "../..");
const packageRoot = resolve(workspaceRoot, "packages/db");
const tokenDbRoot = resolve(workspaceRoot, ".tmp/db-contract");
const tokenDbPath = resolve(tokenDbRoot, "user-password-token-contract.db");

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

    if (!isInside(tokenDbRoot, resolved)) {
      throw new Error("Refusing to remove a DB contract file outside .tmp.");
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

function expectPrismaError(code: string) {
  return (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code;
}

describe("UserPasswordToken DB contract", () => {
  it("keeps seed baseline token-free and enforces tokenHash/activeKey uniqueness", async () => {
    await mkdir(tokenDbRoot, { recursive: true });
    await removeSqliteFiles(tokenDbPath);
    await writeFile(tokenDbPath, "");

    const databaseUrl = toSqliteFileUrl(tokenDbPath);

    await migrateDeploy(databaseUrl);

    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = await import("../../packages/db/src/client");

    try {
      assert.equal(await prisma.userPasswordToken.count(), 0);

      const user = await prisma.user.create({
        data: {
          id: "user_password_token_subject",
          name: "Token Subject",
          email: "tokensubject",
          passwordHash: "test-only-password-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      const activeKey = `${user.id}:${UserPasswordTokenPurpose.STAFF_ACTIVATION}`;

      const firstToken = await prisma.userPasswordToken.create({
        data: {
          userId: user.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:hash-1",
          activeKey,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          createdById: user.id,
          ipAddress: "127.0.0.1",
          userAgent: "db-contract-test",
        },
      });

      await assert.rejects(
        prisma.userPasswordToken.create({
          data: {
            userId: user.id,
            purpose: UserPasswordTokenPurpose.PASSWORD_RESET,
            tokenHash: firstToken.tokenHash,
            activeKey: `${user.id}:${UserPasswordTokenPurpose.PASSWORD_RESET}`,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        }),
        expectPrismaError("P2002")
      );

      await assert.rejects(
        prisma.userPasswordToken.create({
          data: {
            userId: user.id,
            purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
            tokenHash: "v1:hmac-sha256:hash-2",
            activeKey,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        }),
        expectPrismaError("P2002")
      );

      await prisma.userPasswordToken.update({
        where: { id: firstToken.id },
        data: {
          activeKey: null,
          revokedAt: new Date(),
          revokedById: user.id,
        },
      });

      await prisma.userPasswordToken.create({
        data: {
          userId: user.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          tokenHash: "v1:hmac-sha256:hash-3",
          activeKey,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          createdById: user.id,
        },
      });

      const activeTokenCount = await prisma.userPasswordToken.count({
        where: {
          userId: user.id,
          purpose: UserPasswordTokenPurpose.STAFF_ACTIVATION,
          activeKey: { not: null },
          usedAt: null,
          revokedAt: null,
        },
      });

      assert.equal(activeTokenCount, 1);
      assert.equal(await prisma.userPasswordToken.count(), 2);
    } finally {
      await prisma.$disconnect();
    }
  });
});
