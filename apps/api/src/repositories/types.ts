import type { Prisma, PrismaClient } from "@psms/db";

export type DbClient = PrismaClient | Prisma.TransactionClient;
