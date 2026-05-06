import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, isPasswordHash } from "@psms/shared/password";

import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(dirname(currentFile), "../../..");

config({ path: resolve(workspaceRoot, ".env") });
config({ path: resolve(workspaceRoot, ".env.example") });

const MIN_PASSWORD_LENGTH = 12;
const LOGIN_ID_PATTERN = /^[a-z0-9]{4,32}$/;
const MASTER_SEED_PASSWORD_ENV = "PSMS_MASTER_SEED_PASSWORD";

type MasterSeedOptions = {
  allowedDatabaseUrls?: string[];
  databaseUrl?: string;
};

type MasterTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type CommonStatus = "ACTIVE" | "INACTIVE";
type PolicyStatus = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";
type SubscriptionType = "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY";

type StoreFixture = {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  status: CommonStatus;
};

type UserFixture = {
  id: string;
  loginId: string;
  name: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  storeCode?: string;
  phone: string;
};

type CarrierFixture = {
  id: string;
  code: string;
  name: string;
  status: CommonStatus;
};

type SalesAgencyFixture = {
  id: string;
  name: string;
  carrierCode: string;
  contactName: string;
  phone: string;
  contractStatus: string;
  status: CommonStatus;
};

type ColorFixture = {
  id: string;
  name: string;
  code: string;
  hex: string;
  status: CommonStatus;
};

type DeviceModelFixture = {
  id: string;
  name: string;
  modelNo: string;
  manufacturer: string;
  releaseDate: Date;
  supports5g: boolean;
  imageUrl: string;
  status: CommonStatus;
};

type RatePlanFixture = {
  id: string;
  carrierCode: string;
  name: string;
  monthlyFee: number;
  description: string;
  status: CommonStatus;
};

type AddOnServiceFixture = {
  id: string;
  carrierCode: string;
  name: string;
  monthlyFee: number;
  description: string;
  status: CommonStatus;
};

type PolicyFixtureBase = {
  id: string;
  name: string;
  carrierCode?: string;
  status: PolicyStatus;
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  priority: number;
  ruleJson: Prisma.InputJsonValue;
};

type SaleProfitPolicyFixture = PolicyFixtureBase & {
  subscriptionType: SubscriptionType;
};

type DiscountPolicyFixture = PolicyFixtureBase & {
  deviceModelId?: string;
};

export const MASTER_SEED_IDS = {
  stores: [
    "seed_master_store_gangnam",
    "seed_master_store_bundang",
    "seed_master_store_incheon",
  ],
  users: [
    "seed_master_user_admin",
    "seed_master_user_staff_1",
    "seed_master_user_staff_2",
    "seed_master_user_staff_3",
    "seed_master_user_staff_4",
    "seed_master_user_staff_5",
  ],
  carriers: [
    "seed_master_carrier_skt",
    "seed_master_carrier_kt",
    "seed_master_carrier_lgu",
    "seed_master_carrier_mvno",
  ],
} as const;

export const MASTER_SEED_LOGIN_IDS = [
  "masteradmin",
  "masterstaff1",
  "masterstaff2",
  "masterstaff3",
  "masterstaff4",
  "masterstaff5",
] as const;

export const MASTER_SEED_EXPECTED_COUNTS = {
  stores: 3,
  users: 6,
  sessions: 0,
  activeSessions: 0,
  auditLogs: 0,
  carriers: 4,
  salesAgencies: 8,
  deviceModels: 10,
  inventoryColorOptions: 6,
  ratePlans: 8,
  addOnServices: 8,
  inventoryItems: 0,
  customers: 0,
  sales: 0,
  saleAddOns: 0,
  receivables: 0,
  payments: 0,
  manualSchedules: 0,
  customerMemos: 0,
  saleProfitPolicies: 3,
  staffCommissionPolicies: 3,
  discountPolicies: 3,
  carrierActivationRules: 3,
} as const;

const masterStores: StoreFixture[] = [
  {
    id: "seed_master_store_gangnam",
    code: "MASTER_GANGNAM",
    name: "강남 플래그십",
    phone: "02-555-0101",
    address: "서울 강남구 테헤란로 100",
    status: "ACTIVE",
  },
  {
    id: "seed_master_store_bundang",
    code: "MASTER_BUNDANG",
    name: "분당 센터점",
    phone: "031-701-0102",
    address: "경기 성남시 분당구 정자일로 24",
    status: "ACTIVE",
  },
  {
    id: "seed_master_store_incheon",
    code: "MASTER_INCHEON",
    name: "인천 휴면점",
    phone: "032-220-0103",
    address: "인천 남동구 예술로 50",
    status: "INACTIVE",
  },
];

const masterUsers: UserFixture[] = [
  {
    id: "seed_master_user_admin",
    loginId: "masteradmin",
    name: "마스터 관리자",
    role: "ADMIN",
    status: "ACTIVE",
    phone: "010-9000-0001",
  },
  {
    id: "seed_master_user_staff_1",
    loginId: "masterstaff1",
    name: "강남 상담원",
    role: "STAFF",
    status: "ACTIVE",
    storeCode: "MASTER_GANGNAM",
    phone: "010-9000-1001",
  },
  {
    id: "seed_master_user_staff_2",
    loginId: "masterstaff2",
    name: "강남 매니저",
    role: "STAFF",
    status: "ACTIVE",
    storeCode: "MASTER_GANGNAM",
    phone: "010-9000-1002",
  },
  {
    id: "seed_master_user_staff_3",
    loginId: "masterstaff3",
    name: "분당 상담원",
    role: "STAFF",
    status: "ACTIVE",
    storeCode: "MASTER_BUNDANG",
    phone: "010-9000-2001",
  },
  {
    id: "seed_master_user_staff_4",
    loginId: "masterstaff4",
    name: "분당 매니저",
    role: "STAFF",
    status: "ACTIVE",
    storeCode: "MASTER_BUNDANG",
    phone: "010-9000-2002",
  },
  {
    id: "seed_master_user_staff_5",
    loginId: "masterstaff5",
    name: "인천 휴면 직원",
    role: "STAFF",
    status: "INACTIVE",
    storeCode: "MASTER_INCHEON",
    phone: "010-9000-3001",
  },
];

const masterCarriers: CarrierFixture[] = [
  {
    id: "seed_master_carrier_skt",
    code: "MASTER_SKT",
    name: "SKT",
    status: "ACTIVE",
  },
  {
    id: "seed_master_carrier_kt",
    code: "MASTER_KT",
    name: "KT",
    status: "ACTIVE",
  },
  {
    id: "seed_master_carrier_lgu",
    code: "MASTER_LGU",
    name: "LG U+",
    status: "ACTIVE",
  },
  {
    id: "seed_master_carrier_mvno",
    code: "MASTER_MVNO",
    name: "알뜰폰",
    status: "ACTIVE",
  },
];

const masterSalesAgencies: SalesAgencyFixture[] = [
  {
    id: "seed_master_agency_skt_a",
    name: "SKT 수도권 1차점",
    carrierCode: "MASTER_SKT",
    contactName: "한지훈",
    phone: "02-6100-1101",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_skt_b",
    name: "SKT 특판 파트너",
    carrierCode: "MASTER_SKT",
    contactName: "김보라",
    phone: "02-6100-1102",
    contractStatus: "심사중",
    status: "INACTIVE",
  },
  {
    id: "seed_master_agency_kt_a",
    name: "KT 동부 총판",
    carrierCode: "MASTER_KT",
    contactName: "박준형",
    phone: "02-6200-2201",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_kt_b",
    name: "KT 법인 지원점",
    carrierCode: "MASTER_KT",
    contactName: "최유진",
    phone: "02-6200-2202",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_lgu_a",
    name: "LGU 서부 대리점",
    carrierCode: "MASTER_LGU",
    contactName: "이도윤",
    phone: "02-6300-3301",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_lgu_b",
    name: "LGU 프로모션 센터",
    carrierCode: "MASTER_LGU",
    contactName: "정세은",
    phone: "02-6300-3302",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_mvno_a",
    name: "MVNO 다이렉트",
    carrierCode: "MASTER_MVNO",
    contactName: "윤민재",
    phone: "02-6400-4401",
    contractStatus: "정상",
    status: "ACTIVE",
  },
  {
    id: "seed_master_agency_mvno_b",
    name: "MVNO 지역 파트너",
    carrierCode: "MASTER_MVNO",
    contactName: "오하린",
    phone: "02-6400-4402",
    contractStatus: "정상",
    status: "ACTIVE",
  },
];

const masterColors: ColorFixture[] = [
  {
    id: "seed_master_color_black",
    name: "Seed Black",
    code: "SEED_BLACK",
    hex: "#111827",
    status: "ACTIVE",
  },
  {
    id: "seed_master_color_white",
    name: "Seed White",
    code: "SEED_WHITE",
    hex: "#F9FAFB",
    status: "ACTIVE",
  },
  {
    id: "seed_master_color_blue",
    name: "Seed Blue",
    code: "SEED_BLUE",
    hex: "#2563EB",
    status: "ACTIVE",
  },
  {
    id: "seed_master_color_green",
    name: "Seed Green",
    code: "SEED_GREEN",
    hex: "#059669",
    status: "ACTIVE",
  },
  {
    id: "seed_master_color_pink",
    name: "Seed Pink",
    code: "SEED_PINK",
    hex: "#EC4899",
    status: "ACTIVE",
  },
  {
    id: "seed_master_color_gray",
    name: "Seed Gray",
    code: "SEED_GRAY",
    hex: "#6B7280",
    status: "INACTIVE",
  },
];

const masterDeviceModels: DeviceModelFixture[] = [
  {
    id: "seed_master_device_iphone15",
    name: "iPhone 15 128GB",
    modelNo: "MASTER-IP15-128",
    manufacturer: "Apple",
    releaseDate: new Date("2023-09-22T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/iphone-15.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_iphone15pro",
    name: "iPhone 15 Pro 256GB",
    modelNo: "MASTER-IP15P-256",
    manufacturer: "Apple",
    releaseDate: new Date("2023-09-22T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/iphone-15-pro.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_galaxy_s24",
    name: "Galaxy S24 256GB",
    modelNo: "MASTER-S24-256",
    manufacturer: "Samsung",
    releaseDate: new Date("2024-01-31T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/galaxy-s24.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_galaxy_s24_ultra",
    name: "Galaxy S24 Ultra 512GB",
    modelNo: "MASTER-S24U-512",
    manufacturer: "Samsung",
    releaseDate: new Date("2024-01-31T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/galaxy-s24-ultra.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_zflip5",
    name: "Galaxy Z Flip5",
    modelNo: "MASTER-ZFLIP5",
    manufacturer: "Samsung",
    releaseDate: new Date("2023-08-11T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/zflip5.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_pixel8",
    name: "Pixel 8",
    modelNo: "MASTER-PIXEL8",
    manufacturer: "Google",
    releaseDate: new Date("2023-10-12T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/pixel8.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_a35",
    name: "Galaxy A35",
    modelNo: "MASTER-A35",
    manufacturer: "Samsung",
    releaseDate: new Date("2024-03-15T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/galaxy-a35.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_xperia10",
    name: "Xperia 10 V",
    modelNo: "MASTER-XPERIA10V",
    manufacturer: "Sony",
    releaseDate: new Date("2023-06-08T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/xperia-10v.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_redmi_note",
    name: "Redmi Note 13",
    modelNo: "MASTER-REDMI-N13",
    manufacturer: "Xiaomi",
    releaseDate: new Date("2024-01-15T00:00:00.000Z"),
    supports5g: true,
    imageUrl: "/seed/devices/redmi-note13.png",
    status: "ACTIVE",
  },
  {
    id: "seed_master_device_legacy_lte",
    name: "Legacy LTE Demo",
    modelNo: "MASTER-LTE-DEMO",
    manufacturer: "Seed",
    releaseDate: new Date("2021-05-01T00:00:00.000Z"),
    supports5g: false,
    imageUrl: "/seed/devices/legacy-lte.png",
    status: "INACTIVE",
  },
];

const masterRatePlans: RatePlanFixture[] = [
  {
    id: "seed_master_rate_skt_5g_basic",
    carrierCode: "MASTER_SKT",
    name: "SKT 5G 베이직",
    monthlyFee: 49000,
    description: "5G 기본형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_skt_5g_premium",
    carrierCode: "MASTER_SKT",
    name: "SKT 5G 프리미엄",
    monthlyFee: 89000,
    description: "5G 고가형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_kt_basic",
    carrierCode: "MASTER_KT",
    name: "KT 베이직",
    monthlyFee: 47000,
    description: "KT 기본형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_kt_premium",
    carrierCode: "MASTER_KT",
    name: "KT 프리미엄",
    monthlyFee: 85000,
    description: "KT 고가형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_lgu_basic",
    carrierCode: "MASTER_LGU",
    name: "LGU 라이트",
    monthlyFee: 45000,
    description: "LGU 기본형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_lgu_premium",
    carrierCode: "MASTER_LGU",
    name: "LGU 프라임",
    monthlyFee: 88000,
    description: "LGU 고가형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_mvno_basic",
    carrierCode: "MASTER_MVNO",
    name: "MVNO 실속형",
    monthlyFee: 22000,
    description: "MVNO 실속형 읽기 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_rate_mvno_legacy",
    carrierCode: "MASTER_MVNO",
    name: "MVNO 종료 예정",
    monthlyFee: 18000,
    description: "비활성 요금제 읽기 fixture",
    status: "INACTIVE",
  },
];

const masterAddOnServices: AddOnServiceFixture[] = [
  {
    id: "seed_master_addon_skt_insurance",
    carrierCode: "MASTER_SKT",
    name: "SKT 파손 보험",
    monthlyFee: 5900,
    description: "단말 보험 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_skt_media",
    carrierCode: "MASTER_SKT",
    name: "SKT 미디어팩",
    monthlyFee: 9900,
    description: "미디어 부가서비스 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_kt_insurance",
    carrierCode: "MASTER_KT",
    name: "KT 안심 보험",
    monthlyFee: 5500,
    description: "단말 보험 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_kt_family",
    carrierCode: "MASTER_KT",
    name: "KT 패밀리 할인",
    monthlyFee: 0,
    description: "결합 할인 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_lgu_insurance",
    carrierCode: "MASTER_LGU",
    name: "LGU 휴대폰 보험",
    monthlyFee: 5800,
    description: "단말 보험 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_lgu_cloud",
    carrierCode: "MASTER_LGU",
    name: "LGU 클라우드",
    monthlyFee: 3300,
    description: "클라우드 부가서비스 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_mvno_call",
    carrierCode: "MASTER_MVNO",
    name: "MVNO 통화 부가팩",
    monthlyFee: 2200,
    description: "알뜰폰 부가서비스 fixture",
    status: "ACTIVE",
  },
  {
    id: "seed_master_addon_mvno_legacy",
    carrierCode: "MASTER_MVNO",
    name: "MVNO 종료 부가팩",
    monthlyFee: 1100,
    description: "비활성 부가서비스 fixture",
    status: "INACTIVE",
  },
];

const basePolicyRule = {
  seed: "master",
  mode: "read-only-fixture",
  activationBlocked: true,
} as const;

const masterSaleProfitPolicies: SaleProfitPolicyFixture[] = [
  {
    id: "seed_master_policy_profit_active",
    name: "판매 수익 정책 ACTIVE fixture",
    carrierCode: "MASTER_SKT",
    subscriptionType: "NEW",
    status: "ACTIVE",
    version: "seed-v1",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 10,
    ruleJson: { ...basePolicyRule, amount: 30000 },
  },
  {
    id: "seed_master_policy_profit_scheduled",
    name: "판매 수익 정책 SCHEDULED fixture",
    carrierCode: "MASTER_KT",
    subscriptionType: "NUMBER_PORTABILITY",
    status: "SCHEDULED",
    version: "seed-v2",
    effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 20,
    ruleJson: { ...basePolicyRule, amount: 45000 },
  },
  {
    id: "seed_master_policy_profit_expired",
    name: "판매 수익 정책 EXPIRED fixture",
    carrierCode: "MASTER_LGU",
    subscriptionType: "CHANGE_DEVICE",
    status: "EXPIRED",
    version: "seed-v0",
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2025-12-31T23:59:59.999Z"),
    priority: 30,
    ruleJson: { ...basePolicyRule, amount: 15000 },
  },
];

const masterStaffCommissionPolicies: PolicyFixtureBase[] = [
  {
    id: "seed_master_policy_commission_active",
    name: "직원 수수료 ACTIVE fixture",
    carrierCode: "MASTER_SKT",
    status: "ACTIVE",
    version: "seed-v1",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 10,
    ruleJson: { ...basePolicyRule, rate: 0.1 },
  },
  {
    id: "seed_master_policy_commission_scheduled",
    name: "직원 수수료 SCHEDULED fixture",
    carrierCode: "MASTER_KT",
    status: "SCHEDULED",
    version: "seed-v2",
    effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 20,
    ruleJson: { ...basePolicyRule, rate: 0.12 },
  },
  {
    id: "seed_master_policy_commission_expired",
    name: "직원 수수료 EXPIRED fixture",
    carrierCode: "MASTER_LGU",
    status: "EXPIRED",
    version: "seed-v0",
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2025-12-31T23:59:59.999Z"),
    priority: 30,
    ruleJson: { ...basePolicyRule, rate: 0.05 },
  },
];

const masterDiscountPolicies: DiscountPolicyFixture[] = [
  {
    id: "seed_master_policy_discount_active",
    name: "단말 할인 ACTIVE fixture",
    carrierCode: "MASTER_SKT",
    deviceModelId: "seed_master_device_iphone15",
    status: "ACTIVE",
    version: "seed-v1",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 10,
    ruleJson: { ...basePolicyRule, maxDiscountAmount: 120000 },
  },
  {
    id: "seed_master_policy_discount_scheduled",
    name: "단말 할인 SCHEDULED fixture",
    carrierCode: "MASTER_KT",
    deviceModelId: "seed_master_device_galaxy_s24",
    status: "SCHEDULED",
    version: "seed-v2",
    effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 20,
    ruleJson: { ...basePolicyRule, maxDiscountAmount: 160000 },
  },
  {
    id: "seed_master_policy_discount_expired",
    name: "단말 할인 EXPIRED fixture",
    carrierCode: "MASTER_LGU",
    deviceModelId: "seed_master_device_legacy_lte",
    status: "EXPIRED",
    version: "seed-v0",
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2025-12-31T23:59:59.999Z"),
    priority: 30,
    ruleJson: { ...basePolicyRule, maxDiscountAmount: 50000 },
  },
];

const masterCarrierActivationRules: PolicyFixtureBase[] = [
  {
    id: "seed_master_policy_activation_active",
    name: "개통 가능 규칙 ACTIVE fixture",
    carrierCode: "MASTER_SKT",
    status: "ACTIVE",
    version: "seed-v1",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 10,
    ruleJson: { ...basePolicyRule, allowActivation: true },
  },
  {
    id: "seed_master_policy_activation_scheduled",
    name: "개통 가능 규칙 SCHEDULED fixture",
    carrierCode: "MASTER_KT",
    status: "SCHEDULED",
    version: "seed-v2",
    effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
    effectiveTo: null,
    priority: 20,
    ruleJson: { ...basePolicyRule, allowActivation: true },
  },
  {
    id: "seed_master_policy_activation_expired",
    name: "개통 가능 규칙 EXPIRED fixture",
    carrierCode: "MASTER_LGU",
    status: "EXPIRED",
    version: "seed-v0",
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2025-12-31T23:59:59.999Z"),
    priority: 30,
    ruleJson: { ...basePolicyRule, allowActivation: false },
  },
];

function assertNotProduction() {
  const runtimeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();

  if (
    runtimeEnv === "production" ||
    vercelEnv === "production" ||
    appEnv === "production"
  ) {
    throw new Error("Master seed is disabled in production environments.");
  }
}

function assertDatabaseUrl(
  databaseUrl: string | undefined,
  allowedDatabaseUrls = ["file:./dev.db"]
): asserts databaseUrl is string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before running master seed.");
  }

  if (!allowedDatabaseUrls.includes(databaseUrl)) {
    throw new Error(
      `Master seed only allows: ${allowedDatabaseUrls.join(", ")}.`
    );
  }
}

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

function assertSeedLoginId(label: string, loginId: string) {
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new Error(
      `${label} must be 4-32 chars and use lowercase letters/numbers only.`
    );
  }
}

function assertMasterSeedPassword(
  password: string | undefined
): asserts password is string {
  if (!password) {
    throw new Error(`${MASTER_SEED_PASSWORD_ENV} is required for master seed.`);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${MASTER_SEED_PASSWORD_ENV} must be at least ${MIN_PASSWORD_LENGTH} chars.`
    );
  }

  const lowered = password.toLowerCase();

  if (lowered.includes("replace") || lowered.includes("password")) {
    throw new Error(
      `${MASTER_SEED_PASSWORD_ENV} must not use a placeholder-like value.`
    );
  }
}

function requireMapValue(map: Map<string, string>, key: string, label: string) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`${label} references unknown key: ${key}.`);
  }

  return value;
}

async function assertStoreFixtureKey(tx: MasterTx, fixture: StoreFixture) {
  const [byId, byCode] = await Promise.all([
    tx.store.findUnique({ where: { id: fixture.id } }),
    tx.store.findUnique({ where: { code: fixture.code } }),
  ]);

  if (byId && byId.code !== fixture.code) {
    throw new Error(`Store seed id collision: ${fixture.id}.`);
  }

  if (byCode && byCode.id !== fixture.id) {
    throw new Error(`Store seed code collision: ${fixture.code}.`);
  }
}

async function assertUserFixtureKey(tx: MasterTx, fixture: UserFixture) {
  const loginId = normalizeLoginId(fixture.loginId);
  const [byId, byLoginId] = await Promise.all([
    tx.user.findUnique({ where: { id: fixture.id } }),
    tx.user.findUnique({ where: { email: loginId } }),
  ]);

  if (byId && byId.email !== loginId) {
    throw new Error(`User seed id collision: ${fixture.id}.`);
  }

  if (byLoginId && byLoginId.id !== fixture.id) {
    throw new Error(`User seed login collision: ${loginId}.`);
  }
}

async function assertCarrierFixtureKey(tx: MasterTx, fixture: CarrierFixture) {
  const [byId, byCode] = await Promise.all([
    tx.carrier.findUnique({ where: { id: fixture.id } }),
    tx.carrier.findUnique({ where: { code: fixture.code } }),
  ]);

  if (byId && byId.code !== fixture.code) {
    throw new Error(`Carrier seed id collision: ${fixture.id}.`);
  }

  if (byCode && byCode.id !== fixture.id) {
    throw new Error(`Carrier seed code collision: ${fixture.code}.`);
  }
}

async function assertColorFixtureKey(tx: MasterTx, fixture: ColorFixture) {
  const [byId, byName] = await Promise.all([
    tx.inventoryColorOption.findUnique({ where: { id: fixture.id } }),
    tx.inventoryColorOption.findUnique({ where: { name: fixture.name } }),
  ]);

  if (byId && byId.name !== fixture.name) {
    throw new Error(`Color seed id collision: ${fixture.id}.`);
  }

  if (byName && byName.id !== fixture.id) {
    throw new Error(`Color seed name collision: ${fixture.name}.`);
  }
}

async function assertDeviceFixtureKey(
  tx: MasterTx,
  fixture: DeviceModelFixture
) {
  const [byId, byModelKey] = await Promise.all([
    tx.deviceModel.findUnique({ where: { id: fixture.id } }),
    tx.deviceModel.findUnique({
      where: {
        manufacturer_modelNo: {
          manufacturer: fixture.manufacturer,
          modelNo: fixture.modelNo,
        },
      },
    }),
  ]);

  if (
    byId &&
    (byId.manufacturer !== fixture.manufacturer ||
      byId.modelNo !== fixture.modelNo)
  ) {
    throw new Error(`Device model seed id collision: ${fixture.id}.`);
  }

  if (byModelKey && byModelKey.id !== fixture.id) {
    throw new Error(`Device model seed key collision: ${fixture.modelNo}.`);
  }
}

async function upsertStores(tx: MasterTx) {
  const storeIds = new Map<string, string>();

  for (const fixture of masterStores) {
    await assertStoreFixtureKey(tx, fixture);

    const store = await tx.store.upsert({
      where: { code: fixture.code },
      create: fixture,
      update: {
        name: fixture.name,
        phone: fixture.phone,
        address: fixture.address,
        status: fixture.status,
      },
    });

    storeIds.set(store.code, store.id);
  }

  return storeIds;
}

async function upsertUsers(
  tx: MasterTx,
  storeIds: Map<string, string>,
  seedPassword: string
) {
  for (const fixture of masterUsers) {
    const loginId = normalizeLoginId(fixture.loginId);
    assertSeedLoginId("master user loginId", loginId);
    await assertUserFixtureKey(tx, fixture);

    const existing = await tx.user.findUnique({
      where: { email: loginId },
    });

    if (existing?.passwordHash && !isPasswordHash(existing.passwordHash)) {
      throw new Error("Existing master seed user passwordHash is invalid.");
    }

    const storeId = fixture.storeCode
      ? requireMapValue(storeIds, fixture.storeCode, fixture.loginId)
      : null;

    await tx.user.upsert({
      where: { email: loginId },
      create: {
        id: fixture.id,
        name: fixture.name,
        email: loginId,
        passwordHash: await hashPassword(seedPassword),
        role: fixture.role,
        status: fixture.status,
        storeId,
        phone: fixture.phone,
      },
      update: {
        name: fixture.name,
        role: fixture.role,
        status: fixture.status,
        storeId,
        phone: fixture.phone,
      },
    });
  }
}

async function upsertCarriers(tx: MasterTx) {
  const carrierIds = new Map<string, string>();

  for (const fixture of masterCarriers) {
    await assertCarrierFixtureKey(tx, fixture);

    const carrier = await tx.carrier.upsert({
      where: { code: fixture.code },
      create: fixture,
      update: {
        name: fixture.name,
        status: fixture.status,
      },
    });

    carrierIds.set(carrier.code, carrier.id);
  }

  return carrierIds;
}

async function upsertSalesAgencies(
  tx: MasterTx,
  carrierIds: Map<string, string>
) {
  for (const fixture of masterSalesAgencies) {
    await tx.salesAgency.upsert({
      where: { id: fixture.id },
      create: {
        id: fixture.id,
        name: fixture.name,
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        contactName: fixture.contactName,
        phone: fixture.phone,
        contractStatus: fixture.contractStatus,
        status: fixture.status,
      },
      update: {
        name: fixture.name,
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        contactName: fixture.contactName,
        phone: fixture.phone,
        contractStatus: fixture.contractStatus,
        status: fixture.status,
      },
    });
  }
}

async function upsertColors(tx: MasterTx) {
  for (const fixture of masterColors) {
    await assertColorFixtureKey(tx, fixture);

    await tx.inventoryColorOption.upsert({
      where: { name: fixture.name },
      create: fixture,
      update: {
        code: fixture.code,
        hex: fixture.hex,
        status: fixture.status,
      },
    });
  }
}

async function upsertDeviceModels(tx: MasterTx) {
  for (const fixture of masterDeviceModels) {
    await assertDeviceFixtureKey(tx, fixture);

    await tx.deviceModel.upsert({
      where: {
        manufacturer_modelNo: {
          manufacturer: fixture.manufacturer,
          modelNo: fixture.modelNo,
        },
      },
      create: fixture,
      update: {
        name: fixture.name,
        releaseDate: fixture.releaseDate,
        supports5g: fixture.supports5g,
        imageUrl: fixture.imageUrl,
        status: fixture.status,
      },
    });
  }
}

async function upsertRatePlans(tx: MasterTx, carrierIds: Map<string, string>) {
  for (const fixture of masterRatePlans) {
    await tx.ratePlan.upsert({
      where: { id: fixture.id },
      create: {
        id: fixture.id,
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        name: fixture.name,
        monthlyFee: fixture.monthlyFee,
        description: fixture.description,
        status: fixture.status,
      },
      update: {
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        name: fixture.name,
        monthlyFee: fixture.monthlyFee,
        description: fixture.description,
        status: fixture.status,
      },
    });
  }
}

async function upsertAddOnServices(
  tx: MasterTx,
  carrierIds: Map<string, string>
) {
  for (const fixture of masterAddOnServices) {
    await tx.addOnService.upsert({
      where: { id: fixture.id },
      create: {
        id: fixture.id,
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        name: fixture.name,
        monthlyFee: fixture.monthlyFee,
        description: fixture.description,
        status: fixture.status,
      },
      update: {
        carrierId: requireMapValue(
          carrierIds,
          fixture.carrierCode,
          fixture.name
        ),
        name: fixture.name,
        monthlyFee: fixture.monthlyFee,
        description: fixture.description,
        status: fixture.status,
      },
    });
  }
}

function policyBaseCreate(
  fixture: PolicyFixtureBase,
  carrierIds: Map<string, string>,
  adminUserId: string
) {
  return {
    id: fixture.id,
    name: fixture.name,
    carrierId: fixture.carrierCode
      ? requireMapValue(carrierIds, fixture.carrierCode, fixture.name)
      : null,
    status: fixture.status,
    version: fixture.version,
    effectiveFrom: fixture.effectiveFrom,
    effectiveTo: fixture.effectiveTo,
    priority: fixture.priority,
    ruleJson: fixture.ruleJson,
    createdById: adminUserId,
    updatedById: adminUserId,
  };
}

async function upsertPolicies(
  tx: MasterTx,
  carrierIds: Map<string, string>,
  adminUserId: string
) {
  for (const fixture of masterSaleProfitPolicies) {
    await tx.saleProfitPolicy.upsert({
      where: { id: fixture.id },
      create: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        subscriptionType: fixture.subscriptionType,
      },
      update: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        subscriptionType: fixture.subscriptionType,
      },
    });
  }

  for (const fixture of masterStaffCommissionPolicies) {
    await tx.staffCommissionPolicy.upsert({
      where: { id: fixture.id },
      create: policyBaseCreate(fixture, carrierIds, adminUserId),
      update: policyBaseCreate(fixture, carrierIds, adminUserId),
    });
  }

  for (const fixture of masterDiscountPolicies) {
    await tx.discountPolicy.upsert({
      where: { id: fixture.id },
      create: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        deviceModelId: fixture.deviceModelId ?? null,
      },
      update: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        deviceModelId: fixture.deviceModelId ?? null,
      },
    });
  }

  for (const fixture of masterCarrierActivationRules) {
    const carrierId = fixture.carrierCode
      ? requireMapValue(carrierIds, fixture.carrierCode, fixture.name)
      : null;

    if (!carrierId) {
      throw new Error(`${fixture.name} requires carrierId.`);
    }

    await tx.carrierActivationRule.upsert({
      where: { id: fixture.id },
      create: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        carrierId,
      },
      update: {
        ...policyBaseCreate(fixture, carrierIds, adminUserId),
        carrierId,
      },
    });
  }
}

async function countMasterSeedRows(tx: MasterTx) {
  const [
    stores,
    users,
    carriers,
    salesAgencies,
    deviceModels,
    inventoryColorOptions,
    ratePlans,
    addOnServices,
    saleProfitPolicies,
    staffCommissionPolicies,
    discountPolicies,
    carrierActivationRules,
  ] = await Promise.all([
    tx.store.count({
      where: { code: { in: masterStores.map((row) => row.code) } },
    }),
    tx.user.count({
      where: { email: { in: masterUsers.map((row) => row.loginId) } },
    }),
    tx.carrier.count({
      where: { code: { in: masterCarriers.map((row) => row.code) } },
    }),
    tx.salesAgency.count({
      where: { id: { in: masterSalesAgencies.map((row) => row.id) } },
    }),
    tx.deviceModel.count({
      where: { id: { in: masterDeviceModels.map((row) => row.id) } },
    }),
    tx.inventoryColorOption.count({
      where: { id: { in: masterColors.map((row) => row.id) } },
    }),
    tx.ratePlan.count({
      where: { id: { in: masterRatePlans.map((row) => row.id) } },
    }),
    tx.addOnService.count({
      where: { id: { in: masterAddOnServices.map((row) => row.id) } },
    }),
    tx.saleProfitPolicy.count({
      where: { id: { in: masterSaleProfitPolicies.map((row) => row.id) } },
    }),
    tx.staffCommissionPolicy.count({
      where: {
        id: { in: masterStaffCommissionPolicies.map((row) => row.id) },
      },
    }),
    tx.discountPolicy.count({
      where: { id: { in: masterDiscountPolicies.map((row) => row.id) } },
    }),
    tx.carrierActivationRule.count({
      where: { id: { in: masterCarrierActivationRules.map((row) => row.id) } },
    }),
  ]);

  return {
    stores,
    users,
    carriers,
    salesAgencies,
    deviceModels,
    inventoryColorOptions,
    ratePlans,
    addOnServices,
    saleProfitPolicies,
    staffCommissionPolicies,
    discountPolicies,
    carrierActivationRules,
  };
}

export async function runMasterSeed(options: MasterSeedOptions = {}) {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const seedPassword = process.env[MASTER_SEED_PASSWORD_ENV];

  assertNotProduction();
  assertDatabaseUrl(databaseUrl, options.allowedDatabaseUrls);
  assertMasterSeedPassword(seedPassword);

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const storeIds = await upsertStores(tx);
      await upsertUsers(tx, storeIds, seedPassword);
      const carrierIds = await upsertCarriers(tx);
      await upsertSalesAgencies(tx, carrierIds);
      await upsertColors(tx);
      await upsertDeviceModels(tx);
      await upsertRatePlans(tx, carrierIds);
      await upsertAddOnServices(tx, carrierIds);
      await upsertPolicies(tx, carrierIds, "seed_master_user_admin");

      return countMasterSeedRows(tx);
    });

    return {
      ok: true,
      scope: "master-read-seed",
      seededCounts: result,
      passwordReset: false,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(JSON.stringify(await runMasterSeed(), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
