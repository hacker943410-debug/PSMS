"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { ActionResult } from "@psms/shared";
import {
  adminCreateStaffInputSchema,
  adminChangeStaffStatusInputSchema,
  adminUpdateStaffInputSchema,
  toFieldErrors,
  type AdminStaffCreateResult,
  type AdminStaffChangeStatusResult,
  type AdminStaffUpdateResult,
} from "@psms/shared";
import { postAdminApi } from "@/lib/admin-write-api";

export type StaffMutationActionState = {
  ok: boolean;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

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

function toSafeFailure(result: ActionResult): StaffMutationActionState {
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
    DUPLICATE_LOGIN_ID: "이미 사용 중인 아이디입니다.",
    STALE_RECORD:
      "다른 변경 사항이 먼저 반영되었습니다. 새로고침 후 다시 시도해 주세요.",
    NO_CHANGE: "변경된 내용이 없습니다.",
    STAFF_STORE_REQUIRED: "직원 역할에는 소속 매장이 필요합니다.",
    LAST_ADMIN_FORBIDDEN: "마지막 관리자 계정은 변경할 수 없습니다.",
    SELF_STATUS_CHANGE_FORBIDDEN:
      "본인 계정의 권한 또는 상태는 직접 변경할 수 없습니다.",
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

function toSuccessState(message: string): StaffMutationActionState {
  return {
    ok: true,
    message,
  };
}

export async function createStaffAction(
  _state: StaffMutationActionState,
  formData: FormData
): Promise<StaffMutationActionState> {
  const originCheck = await assertSameOriginAction();

  if (!originCheck.ok) {
    return toSafeFailure(originCheck);
  }

  const parsed = adminCreateStaffInputSchema.safeParse({
    name: readString(formData, "name"),
    loginId: readString(formData, "loginId"),
    role: readString(formData, "role"),
    storeId: readString(formData, "storeId"),
    phone: readString(formData, "phone"),
    status: readString(formData, "status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await postAdminApi<AdminStaffCreateResult>(
    "/admin/staffs/create",
    parsed.data
  );

  if (!result.ok) {
    return toSafeFailure(result);
  }

  revalidatePath("/staffs");

  return toSuccessState("비활성 직원 계정을 등록했습니다.");
}

export async function updateStaffAction(
  _state: StaffMutationActionState,
  formData: FormData
): Promise<StaffMutationActionState> {
  const originCheck = await assertSameOriginAction();

  if (!originCheck.ok) {
    return toSafeFailure(originCheck);
  }

  const parsed = adminUpdateStaffInputSchema.safeParse({
    userId: readString(formData, "userId"),
    name: readString(formData, "name"),
    role: readString(formData, "role"),
    storeId: readString(formData, "storeId"),
    phone: readString(formData, "phone"),
    expectedUpdatedAt: readString(formData, "expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await postAdminApi<AdminStaffUpdateResult>(
    "/admin/staffs/update",
    parsed.data
  );

  if (!result.ok) {
    return toSafeFailure(result);
  }

  revalidatePath("/staffs");

  return toSuccessState("직원 정보를 저장했습니다.");
}

export async function changeStaffStatusAction(
  _state: StaffMutationActionState,
  formData: FormData
): Promise<StaffMutationActionState> {
  const originCheck = await assertSameOriginAction();

  if (!originCheck.ok) {
    return toSafeFailure(originCheck);
  }

  const parsed = adminChangeStaffStatusInputSchema.safeParse({
    userId: readString(formData, "userId"),
    status: readString(formData, "status"),
    reason: readString(formData, "reason"),
    expectedUpdatedAt: readString(formData, "expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await postAdminApi<AdminStaffChangeStatusResult>(
    "/admin/staffs/change-status",
    parsed.data
  );

  if (!result.ok) {
    return toSafeFailure(result);
  }

  revalidatePath("/staffs");

  const nextStatus =
    result.data?.status === "INACTIVE" ? "비활성 처리" : "활성 처리";

  return toSuccessState(`${nextStatus}가 완료되었습니다.`);
}
