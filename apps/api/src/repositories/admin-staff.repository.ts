import type { Prisma } from "@psms/db";

import type { AdminStaffListQuery } from "@psms/shared";
import type { DbClient } from "./types";

export type AdminStaffRawRow =
  Awaited<ReturnType<typeof findAdminStaffById>> extends infer T | null
    ? T
    : never;

function buildStaffWhere(query: AdminStaffListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.role !== "all") {
    where.role = query.role;
  }

  if (query.status !== "all") {
    where.status = query.status;
  }

  if (query.storeId !== "all") {
    where.storeId = query.storeId;
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q } },
      { email: { contains: query.q } },
      { phone: { contains: query.q } },
    ];
  }

  return where;
}

export function countAdminStaffRows(db: DbClient, query: AdminStaffListQuery) {
  return db.user.count({
    where: buildStaffWhere(query),
  });
}

export function findAdminStaffRows(db: DbClient, query: AdminStaffListQuery) {
  return db.user.findMany({
    where: buildStaffWhere(query),
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      storeId: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      store: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
}

export function findAdminStaffById(db: DbClient, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      storeId: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      store: {
        select: {
          name: true,
        },
      },
    },
  });
}

export function findAdminStoreFilterOptions(db: DbClient) {
  return db.store.findMany({
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function findLatestStaffAuditSummary(db: DbClient, userId: string) {
  return db.auditLog.findFirst({
    where: {
      entityType: "User",
      entityId: userId,
    },
    select: {
      createdAt: true,
      actor: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
