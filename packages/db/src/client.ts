import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "./generated/prisma/client";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "..");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before using Prisma Client.");
  }

  return databaseUrl;
}

export function createPrismaClient(databaseUrl = getDatabaseUrl()) {
  const connectionUrl = normalizeSqliteUrl(databaseUrl);
  const adapter = new PrismaBetterSqlite3({
    url: connectionUrl,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function normalizeSqliteUrl(databaseUrl: string) {
  const relativePrefix = "file:./";

  if (!databaseUrl.startsWith(relativePrefix)) {
    return databaseUrl;
  }

  const relativePath = databaseUrl.slice(relativePrefix.length);
  const absolutePath = path
    .resolve(packageRoot, relativePath)
    .replaceAll(path.sep, "/");

  return `file:${absolutePath}`;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
