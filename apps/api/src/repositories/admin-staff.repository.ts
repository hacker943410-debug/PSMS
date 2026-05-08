import type { Prisma } from "@psms/db";

import type { AdminRecordStatus, AdminStaffListQuery } from "@psms/shared";
import type { DbClient } from "./types";

export type AdminStaffProfileUpdateData = {
  name?: string;
  role?: "ADMIN" | "STAFF";
  storeId?: string | null;
  phone?: string | null;
};

export type AdminStaffCreateData = {
  name: string;
  loginId: string;
  passwordHash: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  status: "INACTIVE";
};

export type AdminStaffRawRow =
  Awaited<ReturnType<typeof findAdminStaffById>> extends infer T | null
    ? T
    : never;

export type AdminStaffStatusSnapshot =
  Awaited<ReturnType<typeof findAdminStaffStatusSnapshot>> extends
    | infer T
    | null
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
          status: true,
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
          status: true,
        },
      },
    },
  });
}

export function findAdminStaffStatusSnapshot(db: DbClient, userId: string) {
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
      updatedAt: true,
    },
  });
}

export function findAdminStaffByLoginId(db: DbClient, loginId: string) {
  return db.user.findUnique({
    where: { email: loginId },
    select: {
      id: true,
    },
  });
}

export function countOtherActiveAdmins(db: DbClient, userId: string) {
  return db.user.count({
    where: {
      id: { not: userId },
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
}

export function findAdminStaffStoreById(db: DbClient, storeId: string) {
  return db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });
}

export function createAdminStaff(db: DbClient, input: AdminStaffCreateData) {
  return db.user.create({
    data: {
      name: input.name,
      email: input.loginId,
      passwordHash: input.passwordHash,
      role: input.role,
      status: input.status,
      storeId: input.storeId,
      phone: input.phone,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      storeId: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function updateAdminStaffStatus(
  db: DbClient,
  input: {
    userId: string;
    status: AdminRecordStatus;
    expectedUpdatedAt: Date;
  }
) {
  return db.user.updateMany({
    where: {
      id: input.userId,
      updatedAt: input.expectedUpdatedAt,
    },
    data: {
      status: input.status,
    },
  });
}

export function updateAdminStaffProfile(
  db: DbClient,
  input: {
    userId: string;
    expectedUpdatedAt: Date;
    data: AdminStaffProfileUpdateData;
  }
) {
  return db.user.updateMany({
    where: {
      id: input.userId,
      updatedAt: input.expectedUpdatedAt,
    },
    data: input.data,
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
