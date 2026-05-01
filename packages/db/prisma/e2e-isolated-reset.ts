import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../src/generated/prisma/client";
import { runSmokeAuthSeed } from "./seed";

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(currentFile), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const e2eRoot = resolve(workspaceRoot, ".tmp/e2e");
const defaultDbPath = resolve(e2eRoot, "psms-e2e.db");
const devDbPath = resolve(packageRoot, "dev.db");

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

function getTargetDbPath() {
  const target = resolve(process.env.PSMS_E2E_DB_PATH ?? defaultDbPath);

  if (!isInside(e2eRoot, target)) {
    throw new Error("PSMS_E2E_DB_PATH must stay inside .tmp/e2e.");
  }

  if (path.basename(target).toLowerCase() === "dev.db") {
    throw new Error("E2E isolated DB must not be named dev.db.");
  }

  if (target === devDbPath) {
    throw new Error("E2E isolated DB must not target packages/db/dev.db.");
  }

  return target;
}

async function hashFileIfExists(filePath: string) {
  if (!existsSync(filePath)) {
    return null;
  }

  const data = await readFile(filePath);

  return createHash("sha256").update(data).digest("hex");
}

async function removeSqliteFiles(dbPath: string) {
  for (const filePath of [
    dbPath,
    `${dbPath}-journal`,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
  ]) {
    await rm(filePath, { force: true });
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

async function migrateStatus(databaseUrl: string) {
  await runCommand(
    pnpmCommand(),
    ["exec", "prisma", "migrate", "status", "--config", "prisma.config.ts"],
    {
      ...process.env,
      APP_ENV: "test",
      DATABASE_URL: databaseUrl,
    }
  );
}

async function verifyDatabase(databaseUrl: string) {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
  });

  try {
    const [quickCheck] =
      await prisma.$queryRawUnsafe<Array<{ quick_check: string }>>(
        "PRAGMA quick_check"
      );
    const foreignKeyRows = await prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >("PRAGMA foreign_key_check");
    const migrationRows = await prisma.$queryRawUnsafe<
      Array<{ count: bigint }>
    >(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE rolled_back_at IS NULL"
    );
    const businessTableRows = await prisma.$queryRawUnsafe<
      Array<{ count: bigint }>
    >(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'"
    );
    const indexRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
    );
    const requiredUniqueIndexRows = await prisma.$queryRawUnsafe<
      Array<{ name: string }>
    >(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
        'InventoryItem_serialNumber_key',
        'Sale_inventoryItemId_key',
        'Receivable_saleId_key',
        'Session_sessionTokenHash_key'
      )`
    );
    const [stores, users, sessions, activeSessions, auditLogs] =
      await Promise.all([
        prisma.store.count(),
        prisma.user.count(),
        prisma.session.count(),
        prisma.session.count({ where: { revokedAt: null } }),
        prisma.auditLog.count(),
      ]);

    if (quickCheck?.quick_check !== "ok") {
      throw new Error("E2E isolated DB quick_check failed.");
    }

    if (foreignKeyRows.length > 0) {
      throw new Error("E2E isolated DB foreign_key_check failed.");
    }

    if (stores !== 1 || users !== 2 || sessions !== 0 || activeSessions !== 0) {
      throw new Error("E2E isolated DB seed counts are not deterministic.");
    }

    if (
      Number(businessTableRows[0]?.count ?? 0) !== 22 ||
      Number(indexRows[0]?.count ?? 0) !== 55 ||
      requiredUniqueIndexRows.length !== 4
    ) {
      throw new Error("E2E isolated DB catalog verification failed.");
    }

    return {
      quickCheck: quickCheck.quick_check,
      foreignKeyViolations: foreignKeyRows.length,
      migrationRows: Number(migrationRows[0]?.count ?? 0),
      businessTables: Number(businessTableRows[0]?.count ?? 0),
      indexes: Number(indexRows[0]?.count ?? 0),
      requiredUniqueIndexes: requiredUniqueIndexRows
        .map((row) => row.name)
        .sort(),
      stores,
      users,
      sessions,
      activeSessions,
      auditLogs,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function setDefaultEnv(key: string, value: string) {
  if (!process.env[key]?.trim()) {
    process.env[key] = value;
  }
}

async function main() {
  const targetDbPath = getTargetDbPath();
  const databaseUrl = toSqliteFileUrl(targetDbPath);
  const devDbHashBefore = await hashFileIfExists(devDbPath);

  await mkdir(e2eRoot, { recursive: true });
  await removeSqliteFiles(targetDbPath);
  await writeFile(targetDbPath, "");
  await migrateDeploy(databaseUrl);
  await migrateStatus(databaseUrl);

  process.env.APP_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  setDefaultEnv("PSMS_SEED_ADMIN_LOGIN_ID", "admin1001");
  setDefaultEnv("PSMS_SEED_STAFF_LOGIN_ID", "staff1001");
  setDefaultEnv("PSMS_SEED_ADMIN_PASSWORD", "LocalAdmin123!");
  setDefaultEnv("PSMS_SEED_STAFF_PASSWORD", "LocalStaff123!");
  process.env.SEED_RESET_PASSWORDS = "true";
  process.env.SEED_RESET_PASSWORD_LOGIN_IDS = [
    process.env.PSMS_SEED_ADMIN_LOGIN_ID,
    process.env.PSMS_SEED_STAFF_LOGIN_ID,
  ].join(",");

  const seed = await runSmokeAuthSeed({
    allowedDatabaseUrls: [databaseUrl],
    databaseUrl,
  });
  const verification = await verifyDatabase(databaseUrl);
  const devDbHashAfter = await hashFileIfExists(devDbPath);

  if (devDbHashBefore !== devDbHashAfter) {
    throw new Error("packages/db/dev.db changed during isolated E2E reset.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: "playwright-e2e-isolated-db-reset",
        databaseUrl,
        targetDbPath,
        devDbUnchanged: true,
        seed,
        verification,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
