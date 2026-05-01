import type {
  AdminBaseListQuery,
  AdminBaseTab,
  AdminPolicyListQuery,
  AdminSubscriptionType,
  AdminStaffListQuery,
} from "@psms/shared";

import type {
  BaseSettingsTab,
  BaseSettingsUrlState,
  PoliciesUrlState,
  StaffsUrlState,
} from "./admin-foundation-url";

const apiBackedBaseTabs = new Set<BaseSettingsTab>([
  "stores",
  "carriers",
  "salesAgencies",
  "colors",
  "deviceModels",
  "ratePlans",
  "addOnServices",
]);

function readDetail(detail: string | undefined, mode: string | undefined) {
  return mode === "create" ? undefined : detail;
}

export function isApiBackedBaseSettingsTab(
  tab: BaseSettingsTab
): tab is AdminBaseTab {
  return apiBackedBaseTabs.has(tab);
}

export function toAdminStaffListQuery(
  state: StaffsUrlState
): AdminStaffListQuery {
  return {
    role: state.role,
    storeId: state.storeId,
    status: state.status,
    q: state.q,
    page: state.page,
    pageSize: state.pageSize,
    detail: readDetail(state.detail, state.mode),
  };
}

export function toAdminBaseListQuery(
  state: BaseSettingsUrlState
): AdminBaseListQuery | null {
  if (!isApiBackedBaseSettingsTab(state.tab)) {
    return null;
  }

  return {
    tab: state.tab,
    status: state.status,
    q: state.q,
    page: state.page,
    pageSize: state.pageSize,
    detail: readDetail(state.detail, state.mode),
  };
}

export function toAdminPolicyListQuery(
  state: PoliciesUrlState
): AdminPolicyListQuery {
  return {
    policyType: state.tab,
    carrierId: state.carrierId,
    subscriptionType: toAdminSubscriptionType(state.salesType),
    status: state.status,
    from: state.from,
    to: state.to,
    q: state.q,
    page: state.page,
    pageSize: state.pageSize,
    detail: readDetail(state.detail, state.mode),
  };
}

export function toAdminQueryString(
  query: Record<string, string | number | undefined>
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  return searchParams.toString();
}

function toAdminSubscriptionType(
  salesType: PoliciesUrlState["salesType"]
): AdminSubscriptionType {
  if (salesType === "CHANGE") {
    return "CHANGE_DEVICE";
  }

  return salesType;
}
