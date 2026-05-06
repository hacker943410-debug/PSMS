import "server-only";

import { cookies } from "next/headers";
import type { ActionResult } from "@psms/shared";
import type {
  AdminBasePageData,
  AdminPolicyPageData,
  AdminStaffPageData,
} from "@psms/shared/admin";
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

export type {
  AdminBaseDetail,
  AdminBaseListRow,
  AdminBasePageData,
  AdminPolicyDetail,
  AdminPolicyListRow,
  AdminPolicyPageData,
  AdminPolicyRowStatus,
  AdminPolicySubscriptionType,
  AdminRecordStatus,
  AdminStaffDetail,
  AdminStaffListRow,
  AdminStaffPageData,
} from "@psms/shared/admin";

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
