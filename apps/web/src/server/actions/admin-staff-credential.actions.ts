"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type {
  ActionResult,
  AdminStaffCredentialIssueResult,
  AdminStaffCredentialRevokeResult,
  CredentialTokenPurpose,
} from "@psms/shared";
import {
  adminStaffCredentialIssueInputSchema,
  adminStaffCredentialRevokeInputSchema,
  toFieldErrors,
} from "@psms/shared";
import { postAdminApi } from "@/lib/admin-write-api";

export type StaffCredentialActionState = {
  ok: boolean;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  purpose?: CredentialTokenPurpose;
  expiresAt?: string;
  deliveryMode?: string;
  revokedPreviousTokenCount?: number;
};

type StaffCredentialMutation = "issue" | "revoke";

type StaffCredentialActionConfig = {
  purpose: CredentialTokenPurpose;
  mutation: StaffCredentialMutation;
  endpoint: string;
};

const initialPurposeLabels = {
  STAFF_ACTIVATION: "활성화",
  PASSWORD_RESET: "접근 재설정",
} as const satisfies Record<CredentialTokenPurpose, string>;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function normalizeHostForOrigin(host: string, protocol: string) {
  try {
    return new URL(`${protocol}//${host}`).host.toLowerCase();
  } catch {
    return host.trim().toLowerCase();
  }
}

function isSameOriginAllowed(origin: string, host: string) {
  try {
    const originUrl = new URL(origin);
    const requestHost = normalizeHostForOrigin(host, originUrl.protocol);

    return originUrl.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

async function assertSameOriginAction(): Promise<ActionResult> {
  const headerStore = await headers();
  const secFetchSite = headerStore.get("sec-fetch-site");
  const origin = headerStore.get("origin");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "요청 출처를 확인할 수 없습니다.",
    };
  }

  if (!origin) {
    return secFetchSite
      ? { ok: true }
      : {
          ok: false,
          code: "FORBIDDEN",
          message: "요청 출처를 확인할 수 없습니다.",
        };
  }

  if (!host) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "요청 출처를 확인할 수 없습니다.",
    };
  }

  if (!isSameOriginAllowed(origin, host)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "요청 출처를 확인할 수 없습니다.",
    };
  }

  return { ok: true };
}

function toSafeFailure(result: ActionResult): StaffCredentialActionState {
  if (result.ok) {
    return {
      ok: true,
      message: result.message ?? "요청이 처리되었습니다.",
    };
  }

  const code = result.code ?? "UNKNOWN_ERROR";
  const safeMessages: Record<string, string> = {
    AUTH_REQUIRED: "로그인이 필요합니다.",
    FORBIDDEN: "직원 관리 권한이 없습니다.",
    VALIDATION_FAILED: "입력값을 확인해 주세요.",
    NOT_FOUND: "직원 정보를 찾을 수 없습니다.",
    STALE_RECORD:
      "다른 변경 사항이 먼저 반영되었습니다. 새로고침 후 다시 시도해 주세요.",
    INVALID_ACCOUNT_STATE: "현재 계정 상태에서는 처리할 수 없습니다.",
    STAFF_STORE_REQUIRED: "직원 역할에는 활성 매장 배정이 필요합니다.",
    SELF_PASSWORD_RESET_FORBIDDEN:
      "본인 계정의 접근 요청은 직원 관리 화면에서 처리할 수 없습니다.",
    DELIVERY_UNAVAILABLE: "계정 접근 요청을 전달할 승인된 채널이 없습니다.",
    CREDENTIAL_TOKEN_UNAVAILABLE: "계정 접근 요청을 처리할 수 없습니다.",
    CREDENTIAL_TOKEN_CONFLICT:
      "계정 접근 요청이 동시에 처리되었습니다. 새로고침 후 다시 시도해 주세요.",
    RATE_LIMITED: "요청 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
    API_UNAVAILABLE: "API 서버에 연결할 수 없습니다.",
    API_INVALID_RESPONSE: "API 응답을 확인할 수 없습니다.",
    INTERNAL_SERVER_ERROR: "요청을 처리할 수 없습니다.",
  };

  return {
    ok: false,
    code,
    message: safeMessages[code] ?? "요청을 처리할 수 없습니다.",
    fieldErrors: result.fieldErrors,
  };
}

function readCredentialInput(formData: FormData) {
  return {
    userId: readString(formData, "userId"),
    expectedUpdatedAt: readString(formData, "expectedUpdatedAt"),
    reason: readString(formData, "reason"),
  };
}

function requireReason(input: { reason?: string }) {
  if (input.reason?.trim()) {
    return null;
  }

  return {
    ok: false,
    code: "VALIDATION_FAILED",
    message: "처리 사유를 입력해 주세요.",
    fieldErrors: {
      reason: "처리 사유를 입력해 주세요.",
    },
  } satisfies StaffCredentialActionState;
}

function formatExpiry(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

function toIssueSuccessState(
  purpose: CredentialTokenPurpose,
  result: Extract<ActionResult<AdminStaffCredentialIssueResult>, { ok: true }>
): StaffCredentialActionState {
  const data = result.data;
  const label = initialPurposeLabels[purpose];

  return {
    ok: true,
    purpose,
    expiresAt: data?.expiresAt,
    deliveryMode: data?.delivery.mode,
    revokedPreviousTokenCount: data?.revokedTokenCount,
    message: data?.expiresAt
      ? `${label} 요청을 승인된 채널로 전달했습니다. 만료 ${formatExpiry(
          data.expiresAt
        )}`
      : `${label} 요청을 승인된 채널로 전달했습니다.`,
  };
}

function toRevokeSuccessState(
  purpose: CredentialTokenPurpose,
  result: Extract<ActionResult<AdminStaffCredentialRevokeResult>, { ok: true }>
): StaffCredentialActionState {
  const revokedTokenCount = result.data?.revokedTokenCount ?? 0;
  const label = initialPurposeLabels[purpose];

  return {
    ok: true,
    purpose,
    message:
      revokedTokenCount > 0
        ? `${label} 요청 ${revokedTokenCount}건을 회수했습니다.`
        : `회수할 활성 ${label} 요청이 없습니다.`,
  };
}

async function mutateStaffCredential(
  config: StaffCredentialActionConfig,
  _state: StaffCredentialActionState,
  formData: FormData
): Promise<StaffCredentialActionState> {
  const originCheck = await assertSameOriginAction();

  if (!originCheck.ok) {
    return toSafeFailure(originCheck);
  }

  const rawInput = readCredentialInput(formData);
  const reasonFailure = requireReason(rawInput);

  if (reasonFailure) {
    return reasonFailure;
  }

  const schema =
    config.mutation === "issue"
      ? adminStaffCredentialIssueInputSchema
      : adminStaffCredentialRevokeInputSchema;
  const parsed = schema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result =
    config.mutation === "issue"
      ? await postAdminApi<AdminStaffCredentialIssueResult>(
          config.endpoint,
          parsed.data
        )
      : await postAdminApi<AdminStaffCredentialRevokeResult>(
          config.endpoint,
          parsed.data
        );

  if (!result.ok) {
    return toSafeFailure(result);
  }

  revalidatePath("/staffs");

  return config.mutation === "issue"
    ? toIssueSuccessState(
        config.purpose,
        result as Extract<
          ActionResult<AdminStaffCredentialIssueResult>,
          { ok: true }
        >
      )
    : toRevokeSuccessState(
        config.purpose,
        result as Extract<
          ActionResult<AdminStaffCredentialRevokeResult>,
          { ok: true }
        >
      );
}

export async function issueStaffActivationCredentialAction(
  state: StaffCredentialActionState,
  formData: FormData
) {
  return mutateStaffCredential(
    {
      purpose: "STAFF_ACTIVATION",
      mutation: "issue",
      endpoint: "/admin/staffs/activation/issue",
    },
    state,
    formData
  );
}

export async function revokeStaffActivationCredentialAction(
  state: StaffCredentialActionState,
  formData: FormData
) {
  return mutateStaffCredential(
    {
      purpose: "STAFF_ACTIVATION",
      mutation: "revoke",
      endpoint: "/admin/staffs/activation/revoke",
    },
    state,
    formData
  );
}

export async function issuePasswordResetCredentialAction(
  state: StaffCredentialActionState,
  formData: FormData
) {
  return mutateStaffCredential(
    {
      purpose: "PASSWORD_RESET",
      mutation: "issue",
      endpoint: "/admin/staffs/password-reset/issue",
    },
    state,
    formData
  );
}

export async function revokePasswordResetCredentialAction(
  state: StaffCredentialActionState,
  formData: FormData
) {
  return mutateStaffCredential(
    {
      purpose: "PASSWORD_RESET",
      mutation: "revoke",
      endpoint: "/admin/staffs/password-reset/revoke",
    },
    state,
    formData
  );
}
