import { prisma } from "@psms/db";
import type { AdminStaffDetailQuery, AdminStaffListQuery } from "@psms/shared";

import {
  countAdminStaffRows,
  findAdminStaffById,
  findAdminStaffRows,
  findAdminStoreFilterOptions,
  findLatestStaffAuditSummary,
  type AdminStaffRawRow,
} from "../../repositories/admin-staff.repository";
import { toIso } from "./format";

export type AdminStaffListRow = {
  id: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  storeName: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type AdminStaffDetail = AdminStaffListRow & {
  auditSummary: {
    lastStatusChangedAt: string | null;
    lastStatusChangedBy: string | null;
  };
};

export type AdminStaffPageData = {
  rows: AdminStaffListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  filterOptions: {
    stores: Array<{ id: string; name: string; status: "ACTIVE" | "INACTIVE" }>;
  };
  detail?: AdminStaffDetail;
};

function toStaffListRow(row: AdminStaffRawRow): AdminStaffListRow {
  return {
    id: row.id,
    name: row.name,
    loginId: row.email,
    role: row.role,
    storeId: row.storeId,
    storeName: row.store?.name ?? null,
    phone: row.phone,
    lastLoginAt: toIso(row.lastLoginAt),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toStaffDetail(row: AdminStaffRawRow): Promise<AdminStaffDetail> {
  const auditSummary = await findLatestStaffAuditSummary(prisma, row.id);

  return {
    ...toStaffListRow(row),
    auditSummary: {
      lastStatusChangedAt: toIso(auditSummary?.createdAt),
      lastStatusChangedBy: auditSummary?.actor?.name ?? null,
    },
  };
}

export async function getAdminStaffPageData(
  query: AdminStaffListQuery
): Promise<AdminStaffPageData> {
  const [rows, total, stores, detailRow] = await Promise.all([
    findAdminStaffRows(prisma, query),
    countAdminStaffRows(prisma, query),
    findAdminStoreFilterOptions(prisma),
    query.detail ? findAdminStaffById(prisma, query.detail) : null,
  ]);

  const detail = detailRow ? await toStaffDetail(detailRow) : undefined;

  return {
    rows: rows.map(toStaffListRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    filterOptions: {
      stores,
    },
    ...(detail ? { detail } : {}),
  };
}

export async function getAdminStaffDetail(query: AdminStaffDetailQuery) {
  const row = await findAdminStaffById(prisma, query.userId);

  return row ? toStaffDetail(row) : null;
}
