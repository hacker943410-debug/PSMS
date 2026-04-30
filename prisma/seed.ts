import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, isPasswordHash } from "../src/lib/auth/password";

const MIN_PASSWORD_LENGTH = 12;

const seedConfig = {
  storeCode: process.env.PSMS_SEED_STORE_CODE?.trim() || "SMOKE_MAIN",
  storeName: process.env.PSMS_SEED_STORE_NAME?.trim() || "PSMS Smoke Main",
  adminEmail:
    process.env.PSMS_SEED_ADMIN_EMAIL?.trim() || "admin.seed@psms.local",
  adminName: process.env.PSMS_SEED_ADMIN_NAME?.trim() || "Seed Admin",
  adminPassword: process.env.PSMS_SEED_ADMIN_PASSWORD ?? "",
  staffEmail:
    process.env.PSMS_SEED_STAFF_EMAIL?.trim() || "staff.seed@psms.local",
  staffName: process.env.PSMS_SEED_STAFF_NAME?.trim() || "Seed Staff",
  staffPassword: process.env.PSMS_SEED_STAFF_PASSWORD ?? "",
  resetPasswords: process.env.SEED_RESET_PASSWORDS === "true",
  resetPasswordEmails: new Set(
    (process.env.SEED_RESET_PASSWORD_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
  ),
};

const databaseUrl = process.env.DATABASE_URL;

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

function assertDatabaseUrl() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before running seed.");
  }

  if (databaseUrl !== "file:./dev.db") {
    throw new Error("Smoke/auth seed only allows local SQLite file:./dev.db.");
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

function assertSeedEmail(label: string, email: string) {
  if (!email.endsWith("@psms.local")) {
    throw new Error(`${label} must use the local-only @psms.local domain.`);
  }
}

function assertStoreCode(storeCode: string) {
  if (!storeCode.startsWith("SMOKE_")) {
    throw new Error("PSMS_SEED_STORE_CODE must start with SMOKE_.");
  }
}

function canResetPassword(email: string) {
  return seedConfig.resetPasswords && seedConfig.resetPasswordEmails.has(email);
}

function assertResetConfig() {
  if (!seedConfig.resetPasswords) {
    return;
  }

  if (seedConfig.resetPasswordEmails.size === 0) {
    throw new Error(
      "SEED_RESET_PASSWORD_EMAILS is required when SEED_RESET_PASSWORDS=true."
    );
  }

  for (const email of seedConfig.resetPasswordEmails) {
    assertSeedEmail("SEED_RESET_PASSWORD_EMAILS", email);

    if (email !== seedConfig.adminEmail && email !== seedConfig.staffEmail) {
      throw new Error(
        "SEED_RESET_PASSWORD_EMAILS must target seed users only."
      );
    }
  }
}

async function getPasswordHashForSeedUser(
  email: string,
  existingHash: string | null | undefined,
  password: string
) {
  if (existingHash && !canResetPassword(email)) {
    if (!isPasswordHash(existingHash)) {
      throw new Error("Existing seed user passwordHash has an unknown format.");
    }

    return existingHash;
  }

  return hashPassword(password);
}

async function main() {
  assertNotProduction();
  assertDatabaseUrl();
  assertStoreCode(seedConfig.storeCode);
  assertSeedEmail("PSMS_SEED_ADMIN_EMAIL", seedConfig.adminEmail);
  assertSeedEmail("PSMS_SEED_STAFF_EMAIL", seedConfig.staffEmail);
  assertSeedPassword("PSMS_SEED_ADMIN_PASSWORD", seedConfig.adminPassword);
  assertSeedPassword("PSMS_SEED_STAFF_PASSWORD", seedConfig.staffPassword);
  assertResetConfig();

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl!,
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

      const existingAdmin = await tx.user.findUnique({
        where: {
          email: seedConfig.adminEmail,
        },
      });
      const existingStaff = await tx.user.findUnique({
        where: {
          email: seedConfig.staffEmail,
        },
      });

      const adminPasswordHash = await getPasswordHashForSeedUser(
        seedConfig.adminEmail,
        existingAdmin?.passwordHash,
        seedConfig.adminPassword
      );
      const staffPasswordHash = await getPasswordHashForSeedUser(
        seedConfig.staffEmail,
        existingStaff?.passwordHash,
        seedConfig.staffPassword
      );

      const admin = await tx.user.upsert({
        where: {
          email: seedConfig.adminEmail,
        },
        create: {
          name: seedConfig.adminName,
          email: seedConfig.adminEmail,
          passwordHash: adminPasswordHash,
          role: "ADMIN",
          status: "ACTIVE",
        },
        update: {
          name: seedConfig.adminName,
          role: "ADMIN",
          status: "ACTIVE",
          passwordHash: adminPasswordHash,
        },
      });

      const staff = await tx.user.upsert({
        where: {
          email: seedConfig.staffEmail,
        },
        create: {
          name: seedConfig.staffName,
          email: seedConfig.staffEmail,
          passwordHash: staffPasswordHash,
          role: "STAFF",
          status: "ACTIVE",
          storeId: store.id,
        },
        update: {
          name: seedConfig.staffName,
          role: "STAFF",
          status: "ACTIVE",
          storeId: store.id,
          passwordHash: staffPasswordHash,
        },
      });

      return {
        store: {
          code: store.code,
          status: store.status,
        },
        users: [
          {
            email: admin.email,
            role: admin.role,
            status: admin.status,
            hasStore: Boolean(admin.storeId),
          },
          {
            email: staff.email,
            role: staff.role,
            status: staff.status,
            hasStore: Boolean(staff.storeId),
          },
        ],
        resetPasswords: seedConfig.resetPasswords,
        resetPasswordEmails: [...seedConfig.resetPasswordEmails],
      };
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          scope: "smoke-auth-seed",
          ...result,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
