import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { runSmokeAuthSeed } from "./seed";

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

const seedLoginIds = [
  normalizeLoginId(process.env.PSMS_SEED_ADMIN_LOGIN_ID ?? "admin1001"),
  normalizeLoginId(process.env.PSMS_SEED_STAFF_LOGIN_ID ?? "staff1001"),
];

async function main() {
  const seed = await runSmokeAuthSeed();
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL!,
    }),
  });

  try {
    const seedUsers = await prisma.user.findMany({
      where: {
        email: {
          in: seedLoginIds,
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    const sessionDeleteResult = await prisma.session.deleteMany({
      where: {
        userId: {
          in: seedUsers.map((user) => user.id),
        },
      },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          scope: "playwright-e2e-reset",
          seed,
          seedUsers,
          deletedSeedSessions: sessionDeleteResult.count,
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
