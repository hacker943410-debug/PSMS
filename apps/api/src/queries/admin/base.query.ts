import { prisma } from "@psms/db";
import type {
  AdminBaseDetail,
  AdminBaseDetailQuery,
  AdminBaseListRow,
  AdminBaseListQuery,
  AdminBaseTab,
  AdminBasePageData,
} from "@psms/shared/admin";

import {
  countAdminBaseRows,
  findAdminBaseCarrierOptions,
  findAdminBaseRowById,
  findAdminBaseRows,
  type AdminBaseRawRow,
} from "../../repositories/admin-base.repository";
import { toDateOnly } from "./format";

function toBaseRow(tab: AdminBaseTab, row: AdminBaseRawRow): AdminBaseListRow {
  return {
    tab,
    id: row.id,
    ...(row.code !== undefined ? { code: row.code } : {}),
    name: row.name,
    ...(row.phone !== undefined ? { phone: row.phone } : {}),
    ...(row.address !== undefined ? { address: row.address } : {}),
    status: row.status,
    ...(row.carrierId !== undefined ? { carrierId: row.carrierId } : {}),
    ...(row.carrier !== undefined
      ? { carrierName: row.carrier?.name ?? null }
      : {}),
    ...(row.contactName !== undefined ? { contactName: row.contactName } : {}),
    ...(row.contractStatus !== undefined
      ? { contractStatus: row.contractStatus }
      : {}),
    ...(row.hex !== undefined ? { hex: row.hex } : {}),
    ...(row.modelNo !== undefined ? { modelNo: row.modelNo } : {}),
    ...(row.manufacturer !== undefined
      ? { manufacturer: row.manufacturer }
      : {}),
    ...(row.releaseDate !== undefined
      ? { releaseDate: toDateOnly(row.releaseDate) }
      : {}),
    ...(row.supports5g !== undefined ? { supports5g: row.supports5g } : {}),
    ...(row.imageUrl !== undefined ? { imageUrl: row.imageUrl } : {}),
    ...(row.monthlyFee !== undefined ? { monthlyFee: row.monthlyFee } : {}),
    ...(row.description !== undefined ? { description: row.description } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAdminBasePageData(
  query: AdminBaseListQuery
): Promise<AdminBasePageData> {
  const [rows, total, carriers, detailRow] = await Promise.all([
    findAdminBaseRows(prisma, query),
    countAdminBaseRows(prisma, query),
    findAdminBaseCarrierOptions(prisma),
    query.detail ? findAdminBaseRowById(prisma, query.tab, query.detail) : null,
  ]);
  const detail = detailRow ? toBaseRow(query.tab, detailRow) : undefined;

  return {
    tab: query.tab,
    rows: rows.map((row) => toBaseRow(query.tab, row)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    ...(detail ? { detail } : {}),
    filterOptions: {
      carriers,
    },
  };
}

export async function getAdminBaseDetail(query: AdminBaseDetailQuery) {
  const row = await findAdminBaseRowById(prisma, query.tab, query.id);

  return row ? toBaseRow(query.tab, row) : null;
}
