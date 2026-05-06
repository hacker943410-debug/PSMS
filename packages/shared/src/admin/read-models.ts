import type { AdminBaseTab } from "./base.validation";
import type { AdminPageSize } from "./common.validation";
import type {
  AdminPolicyType,
  AdminSubscriptionType,
} from "./policies.validation";

export type AdminRecordStatus = "ACTIVE" | "INACTIVE";

export type AdminStaffListRow = {
  id: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  storeName: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  status: AdminRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminStaffDetail = AdminStaffListRow & {
  auditSummary: {
    lastStatusChangedAt: string | null;
    lastStatusChangedBy: string | null;
  };
};

export type AdminStaffChangeStatusResult = {
  userId: string;
  status: AdminRecordStatus;
  updatedAt: string;
  revokedSessionCount: number;
};

export type AdminStaffUpdateField = "name" | "role" | "storeId" | "phone";

export type AdminStaffUpdateResult = {
  userId: string;
  name: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  updatedAt: string;
  changedFields: AdminStaffUpdateField[];
  revokedSessionCount: number;
};

export type AdminStaffCreateResult = {
  userId: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  status: "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type AdminStaffPageData = {
  rows: AdminStaffListRow[];
  total: number;
  page: number;
  pageSize: AdminPageSize;
  filterOptions: {
    stores: Array<{ id: string; name: string; status: AdminRecordStatus }>;
  };
  detail?: AdminStaffDetail;
};

export type AdminBaseListRow = {
  tab: AdminBaseTab;
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  status: AdminRecordStatus;
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
  tab: AdminBaseTab;
  rows: AdminBaseListRow[];
  total: number;
  page: number;
  pageSize: AdminPageSize;
  detail?: AdminBaseDetail;
  filterOptions: {
    carriers?: Array<{ id: string; code: string; name: string }>;
  };
};

export type AdminPolicyRowStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SCHEDULED"
  | "EXPIRED";

export type AdminPolicySubscriptionType = Exclude<AdminSubscriptionType, "all">;

export type AdminPolicyListRow = {
  id: string;
  policyType: AdminPolicyType;
  name: string;
  carrierId: string | null;
  carrierName: string | null;
  subscriptionType?: AdminPolicySubscriptionType | null;
  status: AdminPolicyRowStatus;
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
  pageSize: AdminPageSize;
  filterOptions: {
    carriers: Array<{ id: string; code: string; name: string }>;
    subscriptionTypes: AdminPolicySubscriptionType[];
  };
  detail?: AdminPolicyDetail;
};
