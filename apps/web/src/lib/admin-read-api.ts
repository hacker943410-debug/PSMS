import "server-only";

import { cookies } from "next/headers";
import type { ActionResult } from "@psms/shared";
import { isDevAuthBypassEnabled } from "@psms/shared/dev-auth-bypass";
import { SESSION_COOKIE_NAME } from "@psms/shared/session-token";

import type {
  BaseSettingsUrlState,
  PoliciesUrlState,
  StaffsUrlState,
} from "./admin-foundation-url";
import {
  toAdminBaseListQuery,
  toAdminPolicyListQuery,
  toAdminQueryString,
  toAdminStaffListQuery,
} from "./admin-read-query";

export type AdminActiveStatus = "ACTIVE" | "INACTIVE";

export type AdminStaffListRow = {
  id: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  storeName: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  status: AdminActiveStatus;
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
    stores: Array<{ id: string; name: string; status: AdminActiveStatus }>;
  };
  detail?: AdminStaffDetail;
};

export type AdminBaseListRow = {
  tab:
    | "stores"
    | "carriers"
    | "salesAgencies"
    | "colors"
    | "deviceModels"
    | "ratePlans"
    | "addOnServices";
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  status: AdminActiveStatus;
  carrierId?: string | null;
  carrierName?: string | null;
  contactName?: string | null;
  contractStatus?: string | null;
  hex?: string | null;
  modelNo?: string | null;
  manufacturer?: string | null;
  releaseDate?: string | null;
  supports5g?: boolean;
  imageUrl?: string | null;
  monthlyFee?: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBaseDetail = AdminBaseListRow;

export type AdminBasePageData = {
  tab: AdminBaseListRow["tab"];
  rows: AdminBaseListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  detail?: AdminBaseDetail;
  filterOptions: {
    carriers?: Array<{ id: string; code: string; name: string }>;
  };
};

export type AdminPolicyStatus = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";

export type AdminPolicyListRow = {
  id: string;
  policyType: "saleProfit" | "staffCommission" | "discount" | "activationRule";
  name: string;
  carrierId: string | null;
  carrierName: string | null;
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY" | null;
  status: AdminPolicyStatus;
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
  policyType: AdminPolicyListRow["policyType"];
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

function getApiBaseUrl() {
  return process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
}

function getApiUrl(
  path: string,
  query: Record<string, string | number | undefined>
) {
  const queryString = toAdminQueryString(query);

  return `${getApiBaseUrl()}${path}${queryString ? `?${queryString}` : ""}`;
}

function createCookieHeader(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

async function getSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

async function readJsonResult<T>(response: Response): Promise<ActionResult<T>> {
  return (await response.json()) as ActionResult<T>;
}

async function readAdminApi<T>(
  path: string,
  query: Record<string, string | number | undefined>
): Promise<ActionResult<T>> {
  const sessionToken = await getSessionToken();
  const isAuthBypassed = isDevAuthBypassEnabled();

  if (!sessionToken && !isAuthBypassed) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "로그인이 필요합니다.",
    };
  }

  try {
    const headers: HeadersInit = sessionToken
      ? { cookie: createCookieHeader(sessionToken) }
      : {};

    const response = await fetch(getApiUrl(path, query), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    return await readJsonResult<T>(response);
  } catch {
    return {
      ok: false,
      code: "API_UNAVAILABLE",
      message: "API 서버에 연결할 수 없습니다.",
    };
  }
}

export function createEmptyAdminBasePageData(
  state: BaseSettingsUrlState
): AdminBasePageData {
  return {
    tab: "deviceModels",
    rows: [],
    total: 0,
    page: state.page,
    pageSize: state.pageSize,
    filterOptions: {},
  };
}

export async function getAdminStaffsPageData(
  state: StaffsUrlState
): Promise<ActionResult<AdminStaffPageData>> {
  return readAdminApi<AdminStaffPageData>(
    "/admin/staffs/page-data",
    toAdminStaffListQuery(state)
  );
}

export async function getAdminBaseSettingsPageData(
  state: BaseSettingsUrlState
): Promise<ActionResult<AdminBasePageData> | null> {
  const query = toAdminBaseListQuery(state);

  if (!query) {
    return null;
  }

  return readAdminApi<AdminBasePageData>("/admin/base/page-data", query);
}

export async function getAdminPoliciesPageData(
  state: PoliciesUrlState
): Promise<ActionResult<AdminPolicyPageData>> {
  return readAdminApi<AdminPolicyPageData>(
    "/admin/policies/page-data",
    toAdminPolicyListQuery(state)
  );
}
