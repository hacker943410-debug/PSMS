import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../src/generated/prisma/client";
import { runSmokeAuthSeed } from "./seed";

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(currentFile), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const seedGateRoot = resolve(workspaceRoot, ".tmp/seed-gate");
const defaultDbPath = resolve(seedGateRoot, "smoke-auth-idempotency.db");
const devDbPath = resolve(packageRoot, "dev.db");

const defaultSeedConfig = {
  storeCode: "SMOKE_MAIN",
  storeName: "PSMS Smoke Main",
  adminLoginId: "admin1001",
  staffLoginId: "staff1001",
  adminPassword: "LocalAdmin123!",
  staffPassword: "LocalStaff123!",
};

type CountSnapshot = {
  stores: number;
  users: number;
  sessions: number;
  activeSessions: number;
  auditLogs: number;
  carriers: number;
  salesAgencies: number;
  deviceModels: number;
  inventoryColorOptions: number;
  ratePlans: number;
  addOnServices: number;
  inventoryItems: number;
  customers: number;
  sales: number;
  saleAddOns: number;
  receivables: number;
  payments: number;
  manualSchedules: number;
  customerMemos: number;
  saleProfitPolicies: number;
  staffCommissionPolicies: number;
  discountPolicies: number;
  carrierActivationRules: number;
};

type SeedSnapshot = {
  store: {
    id: string;
    code: string;
    name: string;
    status: string;
  } | null;
  users: Array<{
    id: string;
    loginId: string;
    role: string;
    status: string;
    storeId: string | null;
    passwordHash: string;
  }>;
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
  const target = resolve(process.env.PSMS_SEED_GATE_DB_PATH ?? defaultDbPath);

  if (!isInside(seedGateRoot, target)) {
    throw new Error("PSMS_SEED_GATE_DB_PATH must stay inside .tmp/seed-gate.");
  }

  if (path.basename(target).toLowerCase() === "dev.db") {
    throw new Error("Seed idempotency gate DB must not be named dev.db.");
  }

  if (target === devDbPath) {
    throw new Error(
      "Seed idempotency gate must not target packages/db/dev.db."
    );
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

async function readSnapshot(databaseUrl: string): Promise<SeedSnapshot> {
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
    const store = await prisma.store.findUnique({
      where: {
        code: defaultSeedConfig.storeCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [defaultSeedConfig.adminLoginId, defaultSeedConfig.staffLoginId],
        },
      },
      orderBy: {
        email: "asc",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        storeId: true,
        passwordHash: true,
      },
    });
    const [
      stores,
      usersCount,
      sessions,
      activeSessions,
      auditLogs,
      carriers,
      salesAgencies,
      deviceModels,
      inventoryColorOptions,
      ratePlans,
      addOnServices,
      inventoryItems,
      customers,
      sales,
      saleAddOns,
      receivables,
      payments,
      manualSchedules,
      customerMemos,
      saleProfitPolicies,
      staffCommissionPolicies,
      discountPolicies,
      carrierActivationRules,
    ] = await Promise.all([
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
      store,
      users: users.map((user) => ({
        id: user.id,
        loginId: user.email,
        role: user.role,
        status: user.status,
        storeId: user.storeId,
        passwordHash: user.passwordHash,
      })),
      counts: {
        stores,
        users: usersCount,
        sessions,
        activeSessions,
        auditLogs,
        carriers,
        salesAgencies,
        deviceModels,
        inventoryColorOptions,
        ratePlans,
        addOnServices,
        inventoryItems,
        customers,
        sales,
        saleAddOns,
        receivables,
        payments,
        manualSchedules,
        customerMemos,
        saleProfitPolicies,
        staffCommissionPolicies,
        discountPolicies,
        carrierActivationRules,
      },
      quickCheck: quickCheck?.quick_check ?? "",
      foreignKeyViolations: foreignKeyRows.length,
      migrationRows: Number(migrationRows[0]?.count ?? 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function assertSmokeSeedSnapshot(snapshot: SeedSnapshot, label: string) {
  if (snapshot.quickCheck !== "ok") {
    throw new Error(`${label} quick_check failed.`);
  }

  if (snapshot.foreignKeyViolations > 0) {
    throw new Error(`${label} foreign_key_check failed.`);
  }

  if (!snapshot.store) {
    throw new Error(`${label} smoke store was not created.`);
  }

  if (snapshot.store.status !== "ACTIVE") {
    throw new Error(`${label} smoke store must be ACTIVE.`);
  }

  if (snapshot.users.length !== 2) {
    throw new Error(`${label} must have exactly 2 smoke users.`);
  }

  const admin = snapshot.users.find(
    (user) => user.loginId === defaultSeedConfig.adminLoginId
  );
  const staff = snapshot.users.find(
    (user) => user.loginId === defaultSeedConfig.staffLoginId
  );

  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
    throw new Error(`${label} admin smoke user is invalid.`);
  }

  if (
    !staff ||
    staff.role !== "STAFF" ||
    staff.status !== "ACTIVE" ||
    staff.storeId !== snapshot.store.id
  ) {
    throw new Error(`${label} staff smoke user is invalid.`);
  }

  const expectedCounts: CountSnapshot = {
    stores: 1,
    users: 2,
    sessions: 0,
    activeSessions: 0,
    auditLogs: 0,
    carriers: 0,
    salesAgencies: 0,
    deviceModels: 0,
    inventoryColorOptions: 0,
    ratePlans: 0,
    addOnServices: 0,
    inventoryItems: 0,
    customers: 0,
    sales: 0,
    saleAddOns: 0,
    receivables: 0,
    payments: 0,
    manualSchedules: 0,
    customerMemos: 0,
    saleProfitPolicies: 0,
    staffCommissionPolicies: 0,
    discountPolicies: 0,
    carrierActivationRules: 0,
  };

  for (const [key, expected] of Object.entries(expectedCounts)) {
    const actual = snapshot.counts[key as keyof CountSnapshot];

    if (actual !== expected) {
      throw new Error(
        `${label} expected ${key}=${expected}, received ${actual}.`
      );
    }
  }
}

function stableIdentity(snapshot: SeedSnapshot) {
  return {
    store: snapshot.store
      ? {
          id: snapshot.store.id,
          code: snapshot.store.code,
          name: snapshot.store.name,
          status: snapshot.store.status,
        }
      : null,
    users: snapshot.users.map((user) => ({
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      status: user.status,
      storeId: user.storeId,
      passwordHash: user.passwordHash,
    })),
    counts: snapshot.counts,
  };
}

function assertStableSnapshot(first: SeedSnapshot, second: SeedSnapshot) {
  const firstIdentity = stableIdentity(first);
  const secondIdentity = stableIdentity(second);

  if (JSON.stringify(firstIdentity) !== JSON.stringify(secondIdentity)) {
    throw new Error("Smoke/auth seed is not idempotent across two runs.");
  }
}

function setSeedGateEnv(databaseUrl: string) {
  process.env.APP_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.PSMS_SEED_STORE_CODE = defaultSeedConfig.storeCode;
  process.env.PSMS_SEED_STORE_NAME = defaultSeedConfig.storeName;
  process.env.PSMS_SEED_ADMIN_LOGIN_ID = defaultSeedConfig.adminLoginId;
  process.env.PSMS_SEED_STAFF_LOGIN_ID = defaultSeedConfig.staffLoginId;
  process.env.PSMS_SEED_ADMIN_PASSWORD = defaultSeedConfig.adminPassword;
  process.env.PSMS_SEED_STAFF_PASSWORD = defaultSeedConfig.staffPassword;
  process.env.SEED_RESET_PASSWORDS = "false";
  process.env.SEED_RESET_PASSWORD_LOGIN_IDS = "";
}

function redactPasswords(snapshot: SeedSnapshot) {
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

  const firstSeed = await runSmokeAuthSeed({
    allowedDatabaseUrls: [databaseUrl],
    databaseUrl,
  });
  const firstSnapshot = await readSnapshot(databaseUrl);

  const secondSeed = await runSmokeAuthSeed({
    allowedDatabaseUrls: [databaseUrl],
    databaseUrl,
  });
  const secondSnapshot = await readSnapshot(databaseUrl);
  const devDbHashAfter = await hashFileIfExists(devDbPath);

  assertSmokeSeedSnapshot(firstSnapshot, "First seed run");
  assertSmokeSeedSnapshot(secondSnapshot, "Second seed run");
  assertStableSnapshot(firstSnapshot, secondSnapshot);

  if (devDbHashBefore !== devDbHashAfter) {
    throw new Error("packages/db/dev.db changed during seed idempotency gate.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: "smoke-auth-seed-idempotency",
        databaseUrl,
        targetDbPath,
        devDbUnchanged: true,
        firstSeed,
        secondSeed,
        verification: {
          stableIdsAndPasswordHashes: true,
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
