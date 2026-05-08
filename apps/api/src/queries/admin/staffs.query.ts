import { prisma } from "@psms/db";
import type {
  AdminStaffDetail,
  AdminStaffDetailQuery,
  AdminStaffListQuery,
  AdminStaffListRow,
  AdminStaffCredentialRequestSummary,
  AdminStaffPageData,
} from "@psms/shared/admin";
import {
  buildCredentialTokenActiveKey,
  credentialDeliveryModeValues,
  type CredentialDeliveryMode,
} from "@psms/shared";

import {
  countAdminStaffRows,
  findAdminStaffById,
  findAdminStaffRows,
  findAdminStoreFilterOptions,
  findLatestStaffAuditSummary,
  type AdminStaffRawRow,
} from "../../repositories/admin-staff.repository";
import {
  findPendingUserPasswordTokensForUser,
  findUserPasswordTokenIssueAuditRows,
} from "../../repositories/user-password-token.repository";
import { toIso } from "./format";

const credentialDeliveryModeSet = new Set<string>(credentialDeliveryModeValues);

type PendingCredentialRow = Awaited<
  ReturnType<typeof findPendingUserPasswordTokensForUser>
>[number];

type CredentialIssueAuditRow = Awaited<
  ReturnType<typeof findUserPasswordTokenIssueAuditRows>
>[number];

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

function emptyCredentialRequest(): AdminStaffCredentialRequestSummary {
  return {
    status: "NONE",
    issuedAt: null,
    expiresAt: null,
    deliveryMode: null,
    issuedByName: null,
    canRevoke: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readDeliveryMode(value: unknown): CredentialDeliveryMode | null {
  return typeof value === "string" && credentialDeliveryModeSet.has(value)
    ? (value as CredentialDeliveryMode)
    : null;
}

function findAuditDeliveryMode(
  audits: CredentialIssueAuditRow[],
  tokenId: string
) {
  for (const audit of audits) {
    if (!isRecord(audit.afterJson)) {
      continue;
    }

    if (audit.afterJson.tokenId === tokenId) {
      return readDeliveryMode(audit.afterJson.deliveryMode);
    }
  }

  return null;
}

function canShowCredentialRequest(
  row: AdminStaffRawRow,
  purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET"
) {
  if (row.role !== "STAFF" || !row.storeId || row.store?.status !== "ACTIVE") {
    return false;
  }

  if (purpose === "STAFF_ACTIVATION") {
    return row.status === "INACTIVE";
  }

  return row.status === "ACTIVE";
}

function toCredentialRequestSummary(
  row: PendingCredentialRow | undefined,
  audits: CredentialIssueAuditRow[]
): AdminStaffCredentialRequestSummary {
  if (!row) {
    return emptyCredentialRequest();
  }

  return {
    status: "PENDING",
    issuedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    deliveryMode: findAuditDeliveryMode(audits, row.id),
    issuedByName: row.createdBy?.name ?? null,
    canRevoke: true,
  };
}

async function getCredentialRequestsForStaff(
  row: AdminStaffRawRow,
  now: Date
): Promise<AdminStaffDetail["credentialRequests"]> {
  const activeKeys = [
    canShowCredentialRequest(row, "STAFF_ACTIVATION")
      ? buildCredentialTokenActiveKey(row.id, "STAFF_ACTIVATION")
      : null,
    canShowCredentialRequest(row, "PASSWORD_RESET")
      ? buildCredentialTokenActiveKey(row.id, "PASSWORD_RESET")
      : null,
  ].filter((activeKey): activeKey is string => Boolean(activeKey));
  const pendingRows = await findPendingUserPasswordTokensForUser(prisma, {
    userId: row.id,
    activeKeys,
    now,
  });
  const issueAudits = await findUserPasswordTokenIssueAuditRows(prisma, {
    userId: row.id,
    tokenIds: pendingRows.map((pendingRow) => pendingRow.id),
  });

  return {
    asOf: now.toISOString(),
    activation: toCredentialRequestSummary(
      pendingRows.find(
        (pendingRow) => pendingRow.purpose === "STAFF_ACTIVATION"
      ),
      issueAudits
    ),
    passwordReset: toCredentialRequestSummary(
      pendingRows.find((pendingRow) => pendingRow.purpose === "PASSWORD_RESET"),
      issueAudits
    ),
  };
}

async function toStaffDetail(row: AdminStaffRawRow): Promise<AdminStaffDetail> {
  const now = new Date();
  const [auditSummary, credentialRequests] = await Promise.all([
    findLatestStaffAuditSummary(prisma, row.id),
    getCredentialRequestsForStaff(row, now),
  ]);

  return {
    ...toStaffListRow(row),
    auditSummary: {
      lastStatusChangedAt: toIso(auditSummary?.createdAt),
      lastStatusChangedBy: auditSummary?.actor?.name ?? null,
    },
    credentialRequests,
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
