import { z } from "zod";

import {
  adminOptionalIdSchema,
  adminPageSchema,
  adminPageSizeSchema,
  adminQueryTextSchema,
  adminRequiredIdSchema,
  normalizeAllableText,
} from "./common.validation";

export const adminPolicyStatusValues = [
  "ACTIVE",
  "INACTIVE",
  "SCHEDULED",
  "EXPIRED",
  "all",
] as const;
export const adminPolicyTypeValues = [
  "saleProfit",
  "staffCommission",
  "discount",
  "activationRule",
] as const;
export const adminSubscriptionTypeValues = [
  "NEW",
  "CHANGE_DEVICE",
  "NUMBER_PORTABILITY",
  "all",
] as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateText(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== "string") {
    return rawValue;
  }

  const normalized = rawValue.trim();

  return normalized ? normalized.slice(0, 10) : undefined;
}

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export const adminPolicyDateSchema = z
  .preprocess(normalizeDateText, z.string().optional())
  .optional()
  .refine((value) => value === undefined || isValidIsoDate(value), {
    message: "날짜는 YYYY-MM-DD 형식이어야 합니다.",
  });

export const adminPolicyListQuerySchema = z
  .object({
    policyType: z.enum(adminPolicyTypeValues).default("saleProfit"),
    carrierId: normalizeAllableText(100),
    subscriptionType: z.enum(adminSubscriptionTypeValues).default("all"),
    status: z.enum(adminPolicyStatusValues).default("all"),
    from: adminPolicyDateSchema,
    to: adminPolicyDateSchema,
    q: adminQueryTextSchema,
    page: adminPageSchema,
    pageSize: adminPageSizeSchema,
    detail: adminOptionalIdSchema,
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      query.from <= query.to,
    {
      message: "조회 시작일은 종료일보다 늦을 수 없습니다.",
      path: ["from"],
    }
  );

export const adminPolicyDetailQuerySchema = z.object({
  policyType: z.enum(adminPolicyTypeValues),
  policyId: adminRequiredIdSchema,
});

export type AdminPolicyStatus = (typeof adminPolicyStatusValues)[number];
export type AdminPolicyType = (typeof adminPolicyTypeValues)[number];
export type AdminSubscriptionType =
  (typeof adminSubscriptionTypeValues)[number];

export type AdminPolicyListQuery = z.infer<typeof adminPolicyListQuerySchema>;
export type AdminPolicyDetailQuery = z.infer<
  typeof adminPolicyDetailQuerySchema
>;
