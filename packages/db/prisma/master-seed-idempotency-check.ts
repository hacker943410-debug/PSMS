import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  MASTER_SEED_EXPECTED_COUNTS,
  MASTER_SEED_LOGIN_IDS,
  runMasterSeed,
} from "./master-seed";

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(currentFile), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const seedGateRoot = resolve(workspaceRoot, ".tmp/seed-gate");
const defaultDbPath = resolve(seedGateRoot, "master-seed-idempotency.db");
const devDbPath = resolve(packageRoot, "dev.db");

type CountSnapshot = Record<keyof typeof MASTER_SEED_EXPECTED_COUNTS, number>;

type MasterSeedSnapshot = {
  stores: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  carriers: Array<Record<string, unknown>>;
  salesAgencies: Array<Record<string, unknown>>;
  colors: Array<Record<string, unknown>>;
  deviceModels: Array<Record<string, unknown>>;
  ratePlans: Array<Record<string, unknown>>;
  addOnServices: Array<Record<string, unknown>>;
  saleProfitPolicies: Array<Record<string, unknown>>;
  staffCommissionPolicies: Array<Record<string, unknown>>;
  discountPolicies: Array<Record<string, unknown>>;
  carrierActivationRules: Array<Record<string, unknown>>;
  counts: CountSnapshot;
  quickCheck: string;
  foreignKeyViolations: number;
  migrationRows: number;
};

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
  const target = resolve(
    process.env.PSMS_MASTER_SEED_GATE_DB_PATH ?? defaultDbPath
  );

  if (!isInside(seedGateRoot, target)) {
    throw new Error(
      "PSMS_MASTER_SEED_GATE_DB_PATH must stay inside .tmp/seed-gate."
    );
  }

  if (path.basename(target).toLowerCase() === "dev.db") {
    throw new Error("Master seed gate DB must not be named dev.db.");
  }

  if (target === devDbPath) {
    throw new Error("Master seed gate must not target packages/db/dev.db.");
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
    if (!isInside(seedGateRoot, resolve(filePath))) {
      throw new Error(
        "Refusing to remove a SQLite file outside .tmp/seed-gate."
      );
    }

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

function stripTimestamps<T extends Record<string, unknown>>(row: T) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...stableRow } = row;

  return stableRow;
}

async function readSnapshot(databaseUrl: string): Promise<MasterSeedSnapshot> {
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
    const [
      stores,
      users,
      carriers,
      salesAgencies,
      colors,
      deviceModels,
      ratePlans,
      addOnServices,
      saleProfitPolicies,
      staffCommissionPolicies,
      discountPolicies,
      carrierActivationRules,
      storesCount,
      usersCount,
      sessions,
      activeSessions,
      auditLogs,
      carriersCount,
      salesAgenciesCount,
      deviceModelsCount,
      inventoryColorOptions,
      ratePlansCount,
      addOnServicesCount,
      inventoryItems,
      customers,
      sales,
      saleAddOns,
      receivables,
      payments,
      manualSchedules,
      customerMemos,
      saleProfitPoliciesCount,
      staffCommissionPoliciesCount,
      discountPoliciesCount,
      carrierActivationRulesCount,
    ] = await Promise.all([
      prisma.store.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        where: { email: { in: [...MASTER_SEED_LOGIN_IDS] } },
        orderBy: { email: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          storeId: true,
          phone: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.carrier.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.salesAgency.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          carrierId: true,
          contactName: true,
          phone: true,
          contractStatus: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.inventoryColorOption.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.deviceModel.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          modelNo: true,
          manufacturer: true,
          releaseDate: true,
          supports5g: true,
          imageUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.ratePlan.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          carrierId: true,
          name: true,
          monthlyFee: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.addOnService.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          carrierId: true,
          name: true,
          monthlyFee: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.saleProfitPolicy.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.staffCommissionPolicy.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.discountPolicy.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.carrierActivationRule.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.store.count(),
      prisma.user.count(),
      prisma.session.count(),
      prisma.session.count({ where: { revokedAt: null } }),
      prisma.auditLog.count(),
      prisma.carrier.count(),
      prisma.salesAgency.count(),
      prisma.deviceModel.count(),
      prisma.inventoryColorOption.count(),
      prisma.ratePlan.count(),
      prisma.addOnService.count(),
      prisma.inventoryItem.count(),
      prisma.customer.count(),
      prisma.sale.count(),
      prisma.saleAddOn.count(),
      prisma.receivable.count(),
      prisma.payment.count(),
      prisma.manualSchedule.count(),
      prisma.customerMemo.count(),
      prisma.saleProfitPolicy.count(),
      prisma.staffCommissionPolicy.count(),
      prisma.discountPolicy.count(),
      prisma.carrierActivationRule.count(),
    ]);

    return {
      stores: stores.map(stripTimestamps),
      users: users.map(stripTimestamps),
      carriers: carriers.map(stripTimestamps),
      salesAgencies: salesAgencies.map(stripTimestamps),
      colors: colors.map(stripTimestamps),
      deviceModels: deviceModels.map(stripTimestamps),
      ratePlans: ratePlans.map(stripTimestamps),
      addOnServices: addOnServices.map(stripTimestamps),
      saleProfitPolicies: saleProfitPolicies.map(stripTimestamps),
      staffCommissionPolicies: staffCommissionPolicies.map(stripTimestamps),
      discountPolicies: discountPolicies.map(stripTimestamps),
      carrierActivationRules: carrierActivationRules.map(stripTimestamps),
      counts: {
        stores: storesCount,
        users: usersCount,
        sessions,
        activeSessions,
        auditLogs,
        carriers: carriersCount,
        salesAgencies: salesAgenciesCount,
        deviceModels: deviceModelsCount,
        inventoryColorOptions,
        ratePlans: ratePlansCount,
        addOnServices: addOnServicesCount,
        inventoryItems,
        customers,
        sales,
        saleAddOns,
        receivables,
        payments,
        manualSchedules,
        customerMemos,
        saleProfitPolicies: saleProfitPoliciesCount,
        staffCommissionPolicies: staffCommissionPoliciesCount,
        discountPolicies: discountPoliciesCount,
        carrierActivationRules: carrierActivationRulesCount,
      },
      quickCheck: quickCheck?.quick_check ?? "",
      foreignKeyViolations: foreignKeyRows.length,
      migrationRows: Number(migrationRows[0]?.count ?? 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function assertMasterSeedSnapshot(snapshot: MasterSeedSnapshot, label: string) {
  if (snapshot.quickCheck !== "ok") {
    throw new Error(`${label} quick_check failed.`);
  }

  if (snapshot.foreignKeyViolations > 0) {
    throw new Error(`${label} foreign_key_check failed.`);
  }

  for (const [key, expected] of Object.entries(MASTER_SEED_EXPECTED_COUNTS)) {
    const actual = snapshot.counts[key as keyof CountSnapshot];

    if (actual !== expected) {
      throw new Error(
        `${label} expected ${key}=${expected}, received ${actual}.`
      );
    }
  }

  const staffRows = snapshot.users.filter((user) => user.role === "STAFF");
  const activeStaffRows = staffRows.filter((user) => user.status === "ACTIVE");

  if (staffRows.length !== 5 || activeStaffRows.length < 4) {
    throw new Error(`${label} master staff fixture is incomplete.`);
  }
}

function assertStableSnapshot(
  first: MasterSeedSnapshot,
  second: MasterSeedSnapshot
) {
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("Master seed is not idempotent across two runs.");
  }
}

function setSeedGateEnv(databaseUrl: string) {
  process.env.APP_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.PSMS_MASTER_SEED_PASSWORD = "LocalMaster123!";
}

function redactPasswords(snapshot: MasterSeedSnapshot) {
  return {
    ...snapshot,
    users: snapshot.users.map(({ passwordHash: _passwordHash, ...user }) => ({
      ...user,
      passwordHashStable: true,
    })),
  };
}

async function main() {
  const targetDbPath = getTargetDbPath();
  const databaseUrl = toSqliteFileUrl(targetDbPath);
  const devDbHashBefore = await hashFileIfExists(devDbPath);

  await mkdir(seedGateRoot, { recursive: true });
  await removeSqliteFiles(targetDbPath);
  await writeFile(targetDbPath, "");
  await migrateDeploy(databaseUrl);
  await migrateStatus(databaseUrl);

  setSeedGateEnv(databaseUrl);

  const firstSeed = await runMasterSeed({
    allowedDatabaseUrls: [databaseUrl],
    databaseUrl,
  });
  const firstSnapshot = await readSnapshot(databaseUrl);

  const secondSeed = await runMasterSeed({
    allowedDatabaseUrls: [databaseUrl],
    databaseUrl,
  });
  const secondSnapshot = await readSnapshot(databaseUrl);
  const devDbHashAfter = await hashFileIfExists(devDbPath);

  assertMasterSeedSnapshot(firstSnapshot, "First master seed run");
  assertMasterSeedSnapshot(secondSnapshot, "Second master seed run");
  assertStableSnapshot(firstSnapshot, secondSnapshot);

  if (devDbHashBefore !== devDbHashAfter) {
    throw new Error("packages/db/dev.db changed during master seed gate.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: "master-seed-idempotency",
        databaseUrl,
        targetDbPath,
        devDbUnchanged: true,
        firstSeed,
        secondSeed,
        verification: {
          stableRowsAndPasswordHashes: true,
          first: redactPasswords(firstSnapshot),
          second: redactPasswords(secondSnapshot),
        },
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
