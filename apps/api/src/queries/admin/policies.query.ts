import { prisma } from "@psms/db";
import type {
  AdminPolicyDetailQuery,
  AdminPolicyListQuery,
  AdminPolicyType,
} from "@psms/shared";

import {
  countAdminPolicyRows,
  findAdminPolicyById,
  findAdminPolicyCarrierOptions,
  findAdminPolicyRows,
  type AdminPolicyRawRow,
} from "../../repositories/admin-policy.repository";
import { toIso } from "./format";

export type AdminPolicyListRow = {
  id: string;
  policyType: AdminPolicyType;
  name: string;
  carrierId: string | null;
  carrierName: string | null;
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY" | null;
  status: "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  updatedAt: string;
};

export type AdminPolicyDetail = AdminPolicyListRow & {
  ruleJson: unknown;
  auditSummary: {
    createdById: string | null;
    updatedById: string | null;
    lastActivatedAt: string | null;
  };
  conflicts?: Array<{
    policyId: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
};

export type AdminPolicyPageData = {
  policyType: AdminPolicyType;
  rows: AdminPolicyListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  filterOptions: {
    carriers: Array<{ id: string; code: string; name: string }>;
    subscriptionTypes: Array<"NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY">;
  };
  detail?: AdminPolicyDetail;
};

function toPolicyListRow(
  policyType: AdminPolicyType,
  row: AdminPolicyRawRow
): AdminPolicyListRow {
  return {
    id: row.id,
    policyType,
    name: row.name,
    carrierId: row.carrierId,
    carrierName: row.carrier?.name ?? null,
    ...(row.subscriptionType !== undefined
      ? { subscriptionType: row.subscriptionType }
      : {}),
    status: row.status,
    version: row.version,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: toIso(row.effectiveTo),
    priority: row.priority,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPolicyDetail(
  policyType: AdminPolicyType,
  row: AdminPolicyRawRow
): AdminPolicyDetail {
  return {
    ...toPolicyListRow(policyType, row),
    ruleJson: row.ruleJson,
    auditSummary: {
      createdById: row.createdById,
      updatedById: row.updatedById,
      lastActivatedAt: null,
    },
  };
}

export async function getAdminPolicyPageData(
  query: AdminPolicyListQuery
): Promise<AdminPolicyPageData> {
  const [rows, total, carriers, detailRow] = await Promise.all([
    findAdminPolicyRows(prisma, query),
    countAdminPolicyRows(prisma, query),
    findAdminPolicyCarrierOptions(prisma),
    query.detail
      ? findAdminPolicyById(prisma, query.policyType, query.detail)
      : null,
  ]);
  const detail = detailRow
    ? toPolicyDetail(query.policyType, detailRow)
    : undefined;

  return {
    policyType: query.policyType,
    rows: rows.map((row) => toPolicyListRow(query.policyType, row)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    filterOptions: {
      carriers,
      subscriptionTypes: ["NEW", "CHANGE_DEVICE", "NUMBER_PORTABILITY"],
    },
    ...(detail ? { detail } : {}),
  };
}

export async function getAdminPolicyDetail(query: AdminPolicyDetailQuery) {
  const row = await findAdminPolicyById(
    prisma,
    query.policyType,
    query.policyId
  );

  return row ? toPolicyDetail(query.policyType, row) : null;
}
