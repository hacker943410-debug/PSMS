import { z } from "zod";

import {
  adminActiveStatusValues,
  adminOptionalIdSchema,
  adminPageSchema,
  adminPageSizeSchema,
  adminQueryTextSchema,
  adminRequiredIdSchema,
  normalizeAllableText,
} from "./common.validation";

const adminStaffRoleValues = ["ADMIN", "STAFF"] as const;

export const adminStaffListQuerySchema = z.object({
  role: z.enum([...adminStaffRoleValues, "all"]).default("all"),
  storeId: normalizeAllableText(100),
  status: z.enum(adminActiveStatusValues).default("all"),
  q: adminQueryTextSchema,
  page: adminPageSchema,
  pageSize: adminPageSizeSchema,
  detail: adminOptionalIdSchema,
});

export const adminStaffDetailQuerySchema = z.object({
  userId: adminRequiredIdSchema,
});

const adminStaffStatusMutationValues = ["ACTIVE", "INACTIVE"] as const;

function normalizeOptionalMutationText(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNullableMutationText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : null;
}

const adminStaffStatusReasonSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  z
    .string()
    .min(2, "변경 사유를 입력해 주세요.")
    .max(200, "변경 사유는 200자 이하로 입력해 주세요.")
);

const adminExpectedUpdatedAtSchema = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string()
      .min(1, "수정 기준 시간을 입력해 주세요.")
      .max(64, "수정 기준 시간이 너무 깁니다.")
      .refine(
        (value) => Number.isFinite(Date.parse(value)),
        "수정 기준 시간이 올바르지 않습니다."
      )
  )
  .optional();

export const adminChangeStaffStatusInputSchema = z
  .object({
    userId: adminRequiredIdSchema,
    status: z.enum(adminStaffStatusMutationValues),
    reason: adminStaffStatusReasonSchema,
    expectedUpdatedAt: adminExpectedUpdatedAtSchema,
  })
  .strict();

const adminStaffUpdateNameSchema = z
  .preprocess(
    normalizeOptionalMutationText,
    z
      .string()
      .min(2, "이름은 2자 이상이어야 합니다.")
      .max(60, "이름은 60자 이하여야 합니다.")
  )
  .optional();

const adminStaffUpdateStoreIdSchema = z
  .preprocess(
    normalizeNullableMutationText,
    z.string().min(1, "매장을 선택해 주세요.").max(100).nullable()
  )
  .optional();

const adminStaffUpdatePhoneSchema = z
  .preprocess(
    normalizeNullableMutationText,
    z.string().max(30, "연락처는 30자 이하여야 합니다.").nullable()
  )
  .optional();

const adminStaffCreateNameSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  z
    .string()
    .min(2, "이름은 2자 이상이어야 합니다.")
    .max(60, "이름은 60자 이하여야 합니다.")
);

const adminStaffCreateLoginIdSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .max(32, "아이디는 32자 이하여야 합니다.")
    .regex(/^[a-z0-9]+$/, "아이디는 영문 소문자와 숫자만 사용할 수 있습니다.")
);

export const adminUpdateStaffInputSchema = z
  .object({
    userId: adminRequiredIdSchema,
    name: adminStaffUpdateNameSchema,
    role: z.enum(adminStaffRoleValues).optional(),
    storeId: adminStaffUpdateStoreIdSchema,
    phone: adminStaffUpdatePhoneSchema,
    expectedUpdatedAt: adminExpectedUpdatedAtSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.role !== undefined ||
      value.storeId !== undefined ||
      value.phone !== undefined,
    {
      path: ["form"],
      message: "변경할 내용을 입력해 주세요.",
    }
  );

export const adminCreateStaffInputSchema = z
  .object({
    name: adminStaffCreateNameSchema,
    loginId: adminStaffCreateLoginIdSchema,
    role: z.enum(adminStaffRoleValues),
    storeId: adminStaffUpdateStoreIdSchema,
    phone: adminStaffUpdatePhoneSchema,
    status: z.literal("INACTIVE").optional(),
  })
  .strict();

export type AdminStaffListQuery = z.infer<typeof adminStaffListQuerySchema>;
export type AdminStaffDetailQuery = z.infer<typeof adminStaffDetailQuerySchema>;
export type AdminChangeStaffStatusInput = z.infer<
  typeof adminChangeStaffStatusInputSchema
>;
export type AdminUpdateStaffInput = z.infer<typeof adminUpdateStaffInputSchema>;
export type AdminCreateStaffInput = z.infer<typeof adminCreateStaffInputSchema>;
