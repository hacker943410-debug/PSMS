export type PageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export type OverlayMode = "create" | "edit" | "delete";
export type PageSize = 10 | 20 | 50;

export type StaffRoleFilter = "ADMIN" | "STAFF" | "all";
export type StaffStatusFilter = "ACTIVE" | "INACTIVE" | "all";

export interface StaffsUrlState {
  role: StaffRoleFilter;
  storeId: string;
  status: StaffStatusFilter;
  q?: string;
  page: number;
  pageSize: PageSize;
  detail?: string;
  mode?: OverlayMode;
}

export type BaseSettingsTab =
  | "stores"
  | "carriers"
  | "salesAgencies"
  | "colors"
  | "deviceModels"
  | "ratePlans"
  | "addOnServices"
  | "backup"
  | "restore";

export interface BaseSettingsUrlState {
  tab: BaseSettingsTab;
  status: StaffStatusFilter;
  q?: string;
  page: number;
  pageSize: PageSize;
  detail?: string;
  mode?: OverlayMode;
}

export type PoliciesTab =
  | "saleProfit"
  | "staffCommission"
  | "discount"
  | "activationRule";
export type PolicySalesTypeFilter = "NEW" | "CHANGE" | "all";
export type PolicyStatusFilter =
  | "ACTIVE"
  | "INACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "all";
export type PolicyConfirmIntent = "activate";

export interface PoliciesUrlState {
  tab: PoliciesTab;
  carrierId: string;
  salesType: PolicySalesTypeFilter;
  status: PolicyStatusFilter;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: PageSize;
  detail?: string;
  mode?: OverlayMode;
  confirm?: PolicyConfirmIntent;
}

const PAGE_SIZE_VALUES = new Set<PageSize>([10, 20, 50]);
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE: PageSize = 10;

const overlayModeMap = {
  create: "create",
  edit: "edit",
  delete: "delete",
} as const satisfies Record<OverlayMode, OverlayMode>;

const staffRoleMap = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  admin: "ADMIN",
  staff: "STAFF",
  all: "all",
} as const satisfies Record<string, StaffRoleFilter>;

const activeStatusMap = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  active: "ACTIVE",
  inactive: "INACTIVE",
  all: "all",
} as const satisfies Record<string, StaffStatusFilter>;

const baseTabMap = {
  stores: "stores",
  carriers: "carriers",
  salesAgencies: "salesAgencies",
  colors: "colors",
  deviceModels: "deviceModels",
  ratePlans: "ratePlans",
  addOnServices: "addOnServices",
  backup: "backup",
  restore: "restore",
} as const satisfies Record<string, BaseSettingsTab>;

const policiesTabMap = {
  saleProfit: "saleProfit",
  staffCommission: "staffCommission",
  discount: "discount",
  activationRule: "activationRule",
  "carrier-support": "saleProfit",
  "staff-commission": "staffCommission",
  "terminal-discount": "discount",
  "activation-rules": "activationRule",
} as const satisfies Record<string, PoliciesTab>;

const policySalesTypeMap = {
  NEW: "NEW",
  CHANGE: "CHANGE",
  new: "NEW",
  change: "CHANGE",
  all: "all",
} as const satisfies Record<string, PolicySalesTypeFilter>;

const policyStatusMap = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SCHEDULED: "SCHEDULED",
  EXPIRED: "EXPIRED",
  active: "ACTIVE",
  inactive: "INACTIVE",
  scheduled: "SCHEDULED",
  reserved: "SCHEDULED",
  expired: "EXPIRED",
  all: "all",
} as const satisfies Record<string, PolicyStatusFilter>;

function readFirst(input: SearchParamsInput, key: string) {
  if (input instanceof URLSearchParams) {
    return input.getAll(key)[0];
  }

  const value = input[key];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: string | undefined, maxLength = 120) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  const lowerValue = normalized.toLowerCase();

  if (lowerValue === "undefined" || lowerValue === "null") {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

function parseEnum<T extends string>(
  input: SearchParamsInput,
  key: string,
  values: Record<string, T>,
  fallback: T
): T;
function parseEnum<T extends string>(
  input: SearchParamsInput,
  key: string,
  values: Record<string, T>,
  fallback: undefined
): T | undefined;
function parseEnum<T extends string>(
  input: SearchParamsInput,
  key: string,
  values: Record<string, T>,
  fallback: T | undefined
) {
  const value = normalizeText(readFirst(input, key));

  if (!value) {
    return fallback;
  }

  return values[value] ?? fallback;
}

function parseAllableString(input: SearchParamsInput, key: string) {
  const value = normalizeText(readFirst(input, key), 80);

  if (!value || value.toLowerCase() === "all") {
    return "all";
  }

  return value;
}

function parseOptionalString(input: SearchParamsInput, key: string) {
  const value = normalizeText(readFirst(input, key), 100);

  if (!value || value.toLowerCase() === "all") {
    return undefined;
  }

  return value;
}

function parsePage(input: SearchParamsInput) {
  const value = normalizeText(readFirst(input, "page"), 20);

  if (!value || !/^\d+$/.test(value)) {
    return DEFAULT_PAGE;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePageSize(input: SearchParamsInput) {
  const value = normalizeText(readFirst(input, "pageSize"), 20);
  const pageSize = value ? Number(value) : DEFAULT_PAGE_SIZE;

  return PAGE_SIZE_VALUES.has(pageSize as PageSize)
    ? (pageSize as PageSize)
    : DEFAULT_PAGE_SIZE;
}

function parseIsoDate(input: SearchParamsInput, key: string) {
  const value = normalizeText(readFirst(input, key), 10);

  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const isValid =
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;

  return isValid ? value : undefined;
}

function normalizeOverlay(
  input: SearchParamsInput,
  detail: string | undefined
) {
  const mode = parseEnum(input, "mode", overlayModeMap, undefined);

  if (mode === "create") {
    return { mode, detail: undefined };
  }

  if ((mode === "edit" || mode === "delete") && detail) {
    return { mode, detail };
  }

  return { mode: undefined, detail };
}

function buildHref(
  pathname: "/staffs" | "/settings/base" | "/settings/policies",
  entries: ReadonlyArray<[string, string | number | undefined]>
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function parseStaffsSearchParams(
  input: SearchParamsInput
): StaffsUrlState {
  const overlay = normalizeOverlay(input, parseOptionalString(input, "detail"));

  return {
    role: parseEnum(input, "role", staffRoleMap, "all"),
    storeId: parseAllableString(input, "storeId"),
    status: parseEnum(input, "status", activeStatusMap, "all"),
    q: normalizeText(readFirst(input, "q")),
    page: parsePage(input),
    pageSize: parsePageSize(input),
    detail: overlay.detail,
    mode: overlay.mode,
  };
}

export function parseBaseSettingsSearchParams(
  input: SearchParamsInput
): BaseSettingsUrlState {
  const tab = parseEnum(input, "tab", baseTabMap, "deviceModels");
  const overlay = normalizeOverlay(
    input,
    tab === "backup" || tab === "restore"
      ? undefined
      : parseOptionalString(input, "detail")
  );

  return {
    tab,
    status:
      tab === "backup" || tab === "restore"
        ? "all"
        : parseEnum(input, "status", activeStatusMap, "all"),
    q:
      tab === "backup" || tab === "restore"
        ? undefined
        : normalizeText(readFirst(input, "q")),
    page: tab === "backup" || tab === "restore" ? 1 : parsePage(input),
    pageSize:
      tab === "backup" || tab === "restore"
        ? DEFAULT_PAGE_SIZE
        : parsePageSize(input),
    detail: overlay.detail,
    mode: overlay.mode,
  };
}

export function parsePoliciesSearchParams(
  input: SearchParamsInput
): PoliciesUrlState {
  const from = parseIsoDate(input, "from");
  const to = parseIsoDate(input, "to");
  const hasReversedRange = from !== undefined && to !== undefined && from > to;
  const overlay = normalizeOverlay(input, parseOptionalString(input, "detail"));
  const confirm = parseEnum(
    input,
    "confirm",
    { activate: "activate" },
    undefined
  );

  return {
    tab: parseEnum(input, "tab", policiesTabMap, "saleProfit"),
    carrierId: parseAllableString(input, "carrierId"),
    salesType: parseEnum(input, "salesType", policySalesTypeMap, "all"),
    status: parseEnum(input, "status", policyStatusMap, "all"),
    from: hasReversedRange ? undefined : from,
    to: hasReversedRange ? undefined : to,
    q: normalizeText(readFirst(input, "q")),
    page: parsePage(input),
    pageSize: parsePageSize(input),
    detail: overlay.detail,
    mode: overlay.mode,
    confirm: overlay.detail && !overlay.mode ? confirm : undefined,
  };
}

export function createStaffsHref(state: Partial<StaffsUrlState> = {}) {
  const detail = state.mode === "create" ? undefined : state.detail;
  const mode =
    state.mode === "create" || (detail && state.mode) ? state.mode : undefined;

  return buildHref("/staffs", [
    ["role", state.role && state.role !== "all" ? state.role : undefined],
    [
      "storeId",
      state.storeId && state.storeId !== "all" ? state.storeId : undefined,
    ],
    [
      "status",
      state.status && state.status !== "all" ? state.status : undefined,
    ],
    ["q", state.q],
    [
      "page",
      state.page && state.page !== DEFAULT_PAGE ? state.page : undefined,
    ],
    [
      "pageSize",
      state.pageSize && state.pageSize !== DEFAULT_PAGE_SIZE
        ? state.pageSize
        : undefined,
    ],
    ["detail", detail],
    ["mode", mode],
  ]);
}

export function createBaseSettingsHref(
  state: Partial<BaseSettingsUrlState> = {}
) {
  const tab = state.tab ?? "deviceModels";
  const ignoresListState = tab === "backup" || tab === "restore";
  const detail =
    ignoresListState || state.mode === "create" ? undefined : state.detail;
  const mode =
    ignoresListState || (!detail && state.mode !== "create")
      ? undefined
      : state.mode;

  return buildHref("/settings/base", [
    ["tab", tab !== "deviceModels" ? tab : undefined],
    [
      "status",
      !ignoresListState && state.status && state.status !== "all"
        ? state.status
        : undefined,
    ],
    ["q", ignoresListState ? undefined : state.q],
    [
      "page",
      !ignoresListState && state.page && state.page !== DEFAULT_PAGE
        ? state.page
        : undefined,
    ],
    [
      "pageSize",
      !ignoresListState &&
      state.pageSize &&
      state.pageSize !== DEFAULT_PAGE_SIZE
        ? state.pageSize
        : undefined,
    ],
    ["detail", detail],
    ["mode", mode],
  ]);
}

export function createPoliciesHref(state: Partial<PoliciesUrlState> = {}) {
  const tab = state.tab ?? "saleProfit";
  const detail = state.mode === "create" ? undefined : state.detail;
  const mode =
    state.mode === "create" || (detail && state.mode) ? state.mode : undefined;
  const confirm = detail && !mode ? state.confirm : undefined;

  return buildHref("/settings/policies", [
    ["tab", tab !== "saleProfit" ? tab : undefined],
    [
      "carrierId",
      state.carrierId && state.carrierId !== "all"
        ? state.carrierId
        : undefined,
    ],
    [
      "salesType",
      state.salesType && state.salesType !== "all"
        ? state.salesType
        : undefined,
    ],
    [
      "status",
      state.status && state.status !== "all" ? state.status : undefined,
    ],
    ["from", state.from],
    ["to", state.to],
    ["q", state.q],
    [
      "page",
      state.page && state.page !== DEFAULT_PAGE ? state.page : undefined,
    ],
    [
      "pageSize",
      state.pageSize && state.pageSize !== DEFAULT_PAGE_SIZE
        ? state.pageSize
        : undefined,
    ],
    ["detail", detail],
    ["mode", mode],
    ["confirm", confirm],
  ]);
}

export function createStaffsCloseHref(state: StaffsUrlState) {
  return createStaffsHref({
    ...state,
    detail: undefined,
    mode: undefined,
  });
}

export function createBaseSettingsCloseHref(state: BaseSettingsUrlState) {
  return createBaseSettingsHref({
    ...state,
    detail: undefined,
    mode: undefined,
  });
}

export function createPoliciesCloseHref(state: PoliciesUrlState) {
  return createPoliciesHref({
    ...state,
    detail: undefined,
    mode: undefined,
    confirm: undefined,
  });
}
