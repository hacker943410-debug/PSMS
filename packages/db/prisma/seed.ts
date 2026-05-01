import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, isPasswordHash } from "@psms/shared/password";

import { PrismaClient } from "../src/generated/prisma/client";

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(dirname(currentFile), "../../..");

config({ path: resolve(workspaceRoot, ".env") });
config({ path: resolve(workspaceRoot, ".env.example") });

const MIN_PASSWORD_LENGTH = 12;
const LOGIN_ID_PATTERN = /^[a-z0-9]{4,32}$/;
const LEGACY_ADMIN_LOGIN_ID = "admin.seed@psms.local";
const LEGACY_STAFF_LOGIN_ID = "staff.seed@psms.local";

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

type SmokeAuthSeedOptions = {
  allowedDatabaseUrls?: string[];
  databaseUrl?: string;
};

function getSeedConfig() {
  return {
    storeCode: process.env.PSMS_SEED_STORE_CODE?.trim() || "SMOKE_MAIN",
    storeName: process.env.PSMS_SEED_STORE_NAME?.trim() || "PSMS Smoke Main",
    adminLoginId: normalizeLoginId(
      process.env.PSMS_SEED_ADMIN_LOGIN_ID ?? "admin1001"
    ),
    adminName: process.env.PSMS_SEED_ADMIN_NAME?.trim() || "Seed Admin",
    adminPassword: process.env.PSMS_SEED_ADMIN_PASSWORD ?? "",
    staffLoginId: normalizeLoginId(
      process.env.PSMS_SEED_STAFF_LOGIN_ID ?? "staff1001"
    ),
    staffName: process.env.PSMS_SEED_STAFF_NAME?.trim() || "Seed Staff",
    staffPassword: process.env.PSMS_SEED_STAFF_PASSWORD ?? "",
    resetPasswords: process.env.SEED_RESET_PASSWORDS === "true",
    resetPasswordLoginIds: new Set(
      (process.env.SEED_RESET_PASSWORD_LOGIN_IDS ?? "")
        .split(",")
        .map((loginId) => normalizeLoginId(loginId))
        .filter(Boolean)
    ),
  };
}

type SeedConfig = ReturnType<typeof getSeedConfig>;

function assertNotProduction() {
  const runtimeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();

  if (
    runtimeEnv === "production" ||
    vercelEnv === "production" ||
    appEnv === "production"
  ) {
    throw new Error("Smoke/auth seed is disabled in production environments.");
  }
}

function assertDatabaseUrl(
  databaseUrl: string | undefined,
  allowedDatabaseUrls = ["file:./dev.db"]
): asserts databaseUrl is string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before running seed.");
  }

  if (!allowedDatabaseUrls.includes(databaseUrl)) {
    throw new Error(
      `Smoke/auth seed only allows: ${allowedDatabaseUrls.join(", ")}.`
    );
  }
}

function assertSeedPassword(label: string, password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${label} must be at least ${MIN_PASSWORD_LENGTH} chars.`);
  }

  const lowered = password.toLowerCase();

  if (lowered.includes("replace") || lowered.includes("password")) {
    throw new Error(`${label} must not use a placeholder-like value.`);
  }
}

function assertSeedLoginId(label: string, loginId: string) {
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new Error(
      `${label} must be 4-32 chars and use lowercase letters/numbers only.`
    );
  }
}

function assertStoreCode(storeCode: string) {
  if (!storeCode.startsWith("SMOKE_")) {
    throw new Error("PSMS_SEED_STORE_CODE must start with SMOKE_.");
  }
}

function canResetPassword(seedConfig: SeedConfig, loginId: string) {
  return (
    seedConfig.resetPasswords && seedConfig.resetPasswordLoginIds.has(loginId)
  );
}

function assertResetConfig(seedConfig: SeedConfig) {
  if (!seedConfig.resetPasswords) {
    return;
  }

  if (seedConfig.resetPasswordLoginIds.size === 0) {
    throw new Error(
      "SEED_RESET_PASSWORD_LOGIN_IDS is required when SEED_RESET_PASSWORDS=true."
    );
  }

  for (const loginId of seedConfig.resetPasswordLoginIds) {
    assertSeedLoginId("SEED_RESET_PASSWORD_LOGIN_IDS", loginId);

    if (
      loginId !== seedConfig.adminLoginId &&
      loginId !== seedConfig.staffLoginId
    ) {
      throw new Error(
        "SEED_RESET_PASSWORD_LOGIN_IDS must target seed users only."
      );
    }
  }
}

async function getPasswordHashForSeedUser(
  seedConfig: SeedConfig,
  loginId: string,
  existingHash: string | null | undefined,
  password: string
) {
  if (existingHash && !canResetPassword(seedConfig, loginId)) {
    if (!isPasswordHash(existingHash)) {
      throw new Error("Existing seed user passwordHash has an unknown format.");
    }

    return existingHash;
  }

  return hashPassword(password);
}

async function findSeedUser(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  loginId: string,
  legacyLoginId: string
) {
  const current = await tx.user.findUnique({
    where: { email: loginId },
  });

  if (current) {
    return current;
  }

  return tx.user.findUnique({
    where: { email: legacyLoginId },
  });
}

export async function runSmokeAuthSeed(options: SmokeAuthSeedOptions = {}) {
  const seedConfig = getSeedConfig();
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  assertNotProduction();
  assertDatabaseUrl(databaseUrl, options.allowedDatabaseUrls);
  assertStoreCode(seedConfig.storeCode);
  assertSeedLoginId("PSMS_SEED_ADMIN_LOGIN_ID", seedConfig.adminLoginId);
  assertSeedLoginId("PSMS_SEED_STAFF_LOGIN_ID", seedConfig.staffLoginId);
  assertSeedPassword("PSMS_SEED_ADMIN_PASSWORD", seedConfig.adminPassword);
  assertSeedPassword("PSMS_SEED_STAFF_PASSWORD", seedConfig.staffPassword);
  assertResetConfig(seedConfig);

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.upsert({
        where: {
          code: seedConfig.storeCode,
        },
        create: {
          code: seedConfig.storeCode,
          name: seedConfig.storeName,
          status: "ACTIVE",
        },
        update: {
          name: seedConfig.storeName,
          status: "ACTIVE",
        },
      });

      const existingAdmin = await findSeedUser(
        tx,
        seedConfig.adminLoginId,
        LEGACY_ADMIN_LOGIN_ID
      );
      const existingStaff = await findSeedUser(
        tx,
        seedConfig.staffLoginId,
        LEGACY_STAFF_LOGIN_ID
      );

      const adminPasswordHash = await getPasswordHashForSeedUser(
        seedConfig,
        seedConfig.adminLoginId,
        existingAdmin?.passwordHash,
        seedConfig.adminPassword
      );
      const staffPasswordHash = await getPasswordHashForSeedUser(
        seedConfig,
        seedConfig.staffLoginId,
        existingStaff?.passwordHash,
        seedConfig.staffPassword
      );

      const admin = existingAdmin
        ? await tx.user.update({
            where: {
              id: existingAdmin.id,
            },
            data: {
              name: seedConfig.adminName,
              email: seedConfig.adminLoginId,
              role: "ADMIN",
              status: "ACTIVE",
              passwordHash: adminPasswordHash,
            },
          })
        : await tx.user.create({
            data: {
              name: seedConfig.adminName,
              email: seedConfig.adminLoginId,
              passwordHash: adminPasswordHash,
              role: "ADMIN",
              status: "ACTIVE",
            },
          });

      const staff = existingStaff
        ? await tx.user.update({
            where: {
              id: existingStaff.id,
            },
            data: {
              name: seedConfig.staffName,
              email: seedConfig.staffLoginId,
              role: "STAFF",
              status: "ACTIVE",
              storeId: store.id,
              passwordHash: staffPasswordHash,
            },
          })
        : await tx.user.create({
            data: {
              name: seedConfig.staffName,
              email: seedConfig.staffLoginId,
              passwordHash: staffPasswordHash,
              role: "STAFF",
              status: "ACTIVE",
              storeId: store.id,
            },
          });

      return {
        store: {
          code: store.code,
          status: store.status,
        },
        users: [
          {
            loginId: admin.email,
            role: admin.role,
            status: admin.status,
            hasStore: Boolean(admin.storeId),
          },
          {
            loginId: staff.email,
            role: staff.role,
            status: staff.status,
            hasStore: Boolean(staff.storeId),
          },
        ],
        resetPasswords: seedConfig.resetPasswords,
        resetPasswordLoginIds: [...seedConfig.resetPasswordLoginIds],
      };
    });

    return {
      ok: true,
      scope: "smoke-auth-seed",
      ...result,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(JSON.stringify(await runSmokeAuthSeed(), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
