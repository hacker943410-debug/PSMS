import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const PASSWORD_TOKEN_SECRET_ENV = "PASSWORD_TOKEN_SECRET";
export const PASSWORD_TOKEN_BYTES = 32;
export const PASSWORD_TOKEN_TTL_SECONDS = 30 * 60;
export const PASSWORD_TOKEN_HASH_PREFIX = "v1:hmac-sha256";
export const MIN_PASSWORD_TOKEN_SECRET_BYTES = 32;

export const credentialTokenPurposeValues = [
  "STAFF_ACTIVATION",
  "PASSWORD_RESET",
] as const;

export const credentialDeliveryModeValues = [
  "EMAIL_QUEUED",
  "SMS_QUEUED",
  "OUT_OF_BAND_APPROVED",
] as const;

export const CREDENTIAL_PASSWORD_MIN_LENGTH = 12;
export const CREDENTIAL_PASSWORD_MAX_LENGTH = 128;

const PASSWORD_TOKEN_SECRET_PLACEHOLDER = "replace-with-local-token-secret";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_HASH_PATTERN = /^v1:hmac-sha256:[A-Za-z0-9_-]{43}$/;
const weakPasswordFragments = [
  "password",
  "qwerty",
  "admin",
  "staff",
  "psms",
  "123456",
] as const;

export type CredentialTokenPurpose =
  (typeof credentialTokenPurposeValues)[number];
export type CredentialDeliveryMode =
  (typeof credentialDeliveryModeValues)[number];

export type CredentialPasswordPolicyContext = {
  loginId?: string | null;
  name?: string | null;
};

export type CredentialPasswordPolicyIssueCode =
  | "PASSWORD_REQUIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_MIXED_CLASSES_REQUIRED"
  | "PASSWORD_WEAK_COMMON_VALUE"
  | "PASSWORD_CONTAINS_LOGIN_ID"
  | "PASSWORD_CONTAINS_NAME";

export type CredentialPasswordPolicyIssue = {
  code: CredentialPasswordPolicyIssueCode;
  message: string;
};

function normalizeSecret(secret: string | undefined) {
  return secret?.trim() ?? "";
}

function getPasswordTokenSecret() {
  const secret = normalizeSecret(process.env[PASSWORD_TOKEN_SECRET_ENV]);

  if (
    !secret ||
    secret === PASSWORD_TOKEN_SECRET_PLACEHOLDER ||
    secret.startsWith("replace-with")
  ) {
    throw new Error(
      `${PASSWORD_TOKEN_SECRET_ENV} must be set before using credential tokens.`
    );
  }

  if (Buffer.byteLength(secret, "utf8") < MIN_PASSWORD_TOKEN_SECRET_BYTES) {
    throw new Error(
      `${PASSWORD_TOKEN_SECRET_ENV} must be at least ${MIN_PASSWORD_TOKEN_SECRET_BYTES} bytes.`
    );
  }

  return secret;
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function passwordClassCount(password: string) {
  return [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function assertPasswordTokenSecretConfigured() {
  getPasswordTokenSecret();
}

export function generateCredentialToken() {
  return randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");
}

export function hashCredentialToken(
  rawToken: string,
  purpose: CredentialTokenPurpose
) {
  const digest = createHmac("sha256", getPasswordTokenSecret())
    .update(purpose, "utf8")
    .update("\0", "utf8")
    .update(rawToken, "utf8")
    .digest("base64url");

  return `${PASSWORD_TOKEN_HASH_PREFIX}:${digest}`;
}

export function verifyCredentialTokenHash(
  rawToken: string,
  purpose: CredentialTokenPurpose,
  tokenHash: string
) {
  if (!isCredentialTokenHash(tokenHash)) {
    return false;
  }

  return timingSafeStringEqual(
    hashCredentialToken(rawToken, purpose),
    tokenHash
  );
}

export function isCredentialTokenHash(value: string) {
  return TOKEN_HASH_PATTERN.test(value);
}

export function createCredentialTokenExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_TOKEN_TTL_SECONDS * 1000);
}

export function buildCredentialTokenActiveKey(
  userId: string,
  purpose: CredentialTokenPurpose
) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error("Credential token activeKey requires userId.");
  }

  return `${normalizedUserId}:${purpose}`;
}

export function getCredentialPasswordPolicyIssues(
  password: string,
  context: CredentialPasswordPolicyContext = {}
): CredentialPasswordPolicyIssue[] {
  const issues: CredentialPasswordPolicyIssue[] = [];

  if (password.length === 0) {
    issues.push({
      code: "PASSWORD_REQUIRED",
      message: "비밀번호를 입력해 주세요.",
    });

    return issues;
  }

  if (password.length < CREDENTIAL_PASSWORD_MIN_LENGTH) {
    issues.push({
      code: "PASSWORD_TOO_SHORT",
      message: `비밀번호는 ${CREDENTIAL_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
    });
  }

  if (password.length > CREDENTIAL_PASSWORD_MAX_LENGTH) {
    issues.push({
      code: "PASSWORD_TOO_LONG",
      message: `비밀번호는 ${CREDENTIAL_PASSWORD_MAX_LENGTH}자 이하여야 합니다.`,
    });
  }

  if (passwordClassCount(password) < 3) {
    issues.push({
      code: "PASSWORD_MIXED_CLASSES_REQUIRED",
      message:
        "비밀번호는 영문 대/소문자, 숫자, 특수문자 중 3종류 이상을 포함해야 합니다.",
    });
  }

  const normalizedPassword = normalizeComparable(password);

  if (
    weakPasswordFragments.some((fragment) =>
      normalizedPassword.includes(fragment)
    )
  ) {
    issues.push({
      code: "PASSWORD_WEAK_COMMON_VALUE",
      message: "추측하기 쉬운 비밀번호는 사용할 수 없습니다.",
    });
  }

  const normalizedLoginId = normalizeComparable(context.loginId);

  if (
    normalizedLoginId.length >= 4 &&
    normalizedPassword.includes(normalizedLoginId)
  ) {
    issues.push({
      code: "PASSWORD_CONTAINS_LOGIN_ID",
      message: "아이디가 포함된 비밀번호는 사용할 수 없습니다.",
    });
  }

  const normalizedName = normalizeComparable(context.name);

  if (
    normalizedName.length >= 2 &&
    normalizedPassword.includes(normalizedName)
  ) {
    issues.push({
      code: "PASSWORD_CONTAINS_NAME",
      message: "이름이 포함된 비밀번호는 사용할 수 없습니다.",
    });
  }

  return issues;
}

export function isCredentialPasswordPolicyCompliant(
  password: string,
  context: CredentialPasswordPolicyContext = {}
) {
  return getCredentialPasswordPolicyIssues(password, context).length === 0;
}

const credentialTokenPurposeSchema = z.enum(credentialTokenPurposeValues);
const credentialDeliveryModeSchema = z.enum(credentialDeliveryModeValues);

const normalizedTextSchema = (maxLength: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim().replace(/\s+/g, " ");

      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().min(1, message).max(maxLength, message)
  );

const optionalNormalizedTextSchema = (maxLength: number) =>
  z
    .preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim().replace(/\s+/g, " ");

      return normalized.length > 0 ? normalized : undefined;
    }, z.string().min(1).max(maxLength))
    .optional();

const expectedUpdatedAtSchema = z
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

const rawCredentialTokenSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string()
    .min(32, "요청 토큰이 올바르지 않습니다.")
    .max(256, "요청 토큰이 올바르지 않습니다.")
    .regex(BASE64URL_PATTERN, "요청 토큰이 올바르지 않습니다.")
);

function createCredentialPasswordSchema(
  policyContext: CredentialPasswordPolicyContext = {}
) {
  return z.string().superRefine((password, context) => {
    for (const issue of getCredentialPasswordPolicyIssues(
      password,
      policyContext
    )) {
      context.addIssue({
        code: "custom",
        message: issue.message,
      });
    }
  });
}

export const adminStaffCredentialIssueInputSchema = z
  .object({
    userId: normalizedTextSchema(100, "대상을 선택해 주세요."),
    expectedUpdatedAt: expectedUpdatedAtSchema,
    reason: optionalNormalizedTextSchema(200),
  })
  .strict();

export const adminStaffCredentialRevokeInputSchema = z
  .object({
    userId: normalizedTextSchema(100, "대상을 선택해 주세요."),
    expectedUpdatedAt: expectedUpdatedAtSchema,
    reason: optionalNormalizedTextSchema(200),
  })
  .strict();

export const credentialTokenVerifyInputSchema = z
  .object({
    token: rawCredentialTokenSchema,
  })
  .strict();

export const credentialCompleteInputSchema = z
  .object({
    token: rawCredentialTokenSchema,
    password: createCredentialPasswordSchema(),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export function createCredentialCompleteInputSchema(
  policyContext: CredentialPasswordPolicyContext
) {
  return z
    .object({
      token: rawCredentialTokenSchema,
      password: createCredentialPasswordSchema(policyContext),
      confirmPassword: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
    })
    .strict()
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "비밀번호가 일치하지 않습니다.",
    });
}

export const adminStaffCredentialIssueResultSchema = z
  .object({
    userId: z.string(),
    purpose: credentialTokenPurposeSchema,
    expiresAt: z.string(),
    delivery: z
      .object({
        mode: credentialDeliveryModeSchema,
      })
      .strict(),
    revokedTokenCount: z.number().int().min(0),
  })
  .strict();

export const adminStaffCredentialRevokeResultSchema = z
  .object({
    userId: z.string(),
    purpose: credentialTokenPurposeSchema,
    revokedTokenCount: z.number().int().min(0),
  })
  .strict();

export const credentialTokenPreviewSchema = z
  .object({
    purpose: credentialTokenPurposeSchema,
    loginId: z.string(),
    name: z.string(),
    expiresAt: z.string(),
    passwordPolicy: z
      .object({
        minLength: z.literal(CREDENTIAL_PASSWORD_MIN_LENGTH),
        maxLength: z.literal(CREDENTIAL_PASSWORD_MAX_LENGTH),
      })
      .strict(),
  })
  .strict();

export const credentialCompleteResultSchema = z
  .object({
    redirectTo: z.literal("/login"),
    activated: z.boolean(),
    revokedSessionCount: z.number().int().min(0),
  })
  .strict();

export type AdminStaffCredentialIssueInput = z.infer<
  typeof adminStaffCredentialIssueInputSchema
>;
export type AdminStaffCredentialRevokeInput = z.infer<
  typeof adminStaffCredentialRevokeInputSchema
>;
export type CredentialTokenVerifyInput = z.infer<
  typeof credentialTokenVerifyInputSchema
>;
export type CredentialCompleteInput = z.infer<
  typeof credentialCompleteInputSchema
>;
export type AdminStaffCredentialIssueResult = z.infer<
  typeof adminStaffCredentialIssueResultSchema
>;
export type AdminStaffCredentialRevokeResult = z.infer<
  typeof adminStaffCredentialRevokeResultSchema
>;
export type CredentialTokenPreview = z.infer<
  typeof credentialTokenPreviewSchema
>;
export type CredentialCompleteResult = z.infer<
  typeof credentialCompleteResultSchema
>;
