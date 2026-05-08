"use server";

import { cookies, headers } from "next/headers";

import type {
  ActionResult,
  CredentialCompleteResult,
  CredentialTokenPurpose,
} from "@psms/shared";
import { credentialCompleteInputSchema, toFieldErrors } from "@psms/shared";
import {
  createExpiredSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@psms/shared/session-token";
import {
  createCredentialTokenCompletionCookieOptions,
  createExpiredCredentialTokenCompletionCookieOptions,
  createExpiredCredentialTokenCookieOptions,
  getCredentialTokenCompletionCookieConfig,
  getCredentialTokenCookieConfig,
  normalizeCredentialUrlToken,
} from "@/lib/credential-token-cookie";
import { createCredentialTokenCompletionMarker } from "@/lib/credential-token-completion";
import { completeCredentialTokenViaApi } from "@/lib/credential-token-api";

export type CredentialTokenActionState = {
  ok: boolean;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
};

type CredentialTokenCompleteSuccess = Extract<
  ActionResult<CredentialCompleteResult>,
  { ok: true }
>;

const credentialTokenPurposes = [
  "STAFF_ACTIVATION",
  "PASSWORD_RESET",
] as const satisfies CredentialTokenPurpose[];

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

function toSafeFailure(result: ActionResult): CredentialTokenActionState {
  if (result.ok) {
    return {
      ok: true,
      message: result.message ?? "요청이 처리되었습니다.",
    };
  }

  const code = result.code ?? "UNKNOWN_ERROR";
  const safeMessages: Record<string, string> = {
    FORBIDDEN: "요청 출처를 확인할 수 없습니다.",
    VALIDATION_FAILED: "입력값을 확인해 주세요.",
    INVALID_CREDENTIAL_TOKEN: "요청 링크가 만료되었거나 이미 사용되었습니다.",
    CREDENTIAL_TOKEN_UNAVAILABLE: "계정 접근 요청을 처리할 수 없습니다.",
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

function toSuccessState(
  result: CredentialTokenCompleteSuccess
): CredentialTokenActionState {
  return {
    ok: true,
    message: "비밀번호 설정이 완료되었습니다.",
    redirectTo: result.data?.redirectTo ?? result.redirectTo ?? "/login",
  };
}

async function getStoredCredentialToken(purpose: CredentialTokenPurpose) {
  const cookieStore = await cookies();
  const { cookieName } = getCredentialTokenCookieConfig(purpose);

  return normalizeCredentialUrlToken(cookieStore.get(cookieName)?.value);
}

async function clearCredentialTokenCookies(
  completedPurpose: CredentialTokenPurpose
) {
  const cookieStore = await cookies();

  for (const tokenPurpose of credentialTokenPurposes) {
    const { cookieName: tokenCookieName } =
      getCredentialTokenCookieConfig(tokenPurpose);
    const { cookieName: completionCookieName } =
      getCredentialTokenCompletionCookieConfig(tokenPurpose);

    cookieStore.set(
      tokenCookieName,
      "",
      createExpiredCredentialTokenCookieOptions(tokenPurpose)
    );
    cookieStore.set(
      completionCookieName,
      "",
      createExpiredCredentialTokenCompletionCookieOptions(tokenPurpose)
    );
  }

  const { cookieName: completedCookieName } =
    getCredentialTokenCompletionCookieConfig(completedPurpose);

  cookieStore.set(
    completedCookieName,
    createCredentialTokenCompletionMarker(completedPurpose),
    createCredentialTokenCompletionCookieOptions(completedPurpose)
  );
  cookieStore.set(SESSION_COOKIE_NAME, "", createExpiredSessionCookieOptions());
}

async function completeCredentialTokenAction(
  purpose: CredentialTokenPurpose,
  _state: CredentialTokenActionState,
  formData: FormData
): Promise<CredentialTokenActionState> {
  const originCheck = await assertSameOriginAction();

  if (!originCheck.ok) {
    return toSafeFailure(originCheck);
  }

  const token = await getStoredCredentialToken(purpose);

  const parsed = credentialCompleteInputSchema.safeParse({
    token: token ?? "",
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await completeCredentialTokenViaApi(purpose, parsed.data);

  if (result.ok === false) {
    return toSafeFailure(result);
  }

  await clearCredentialTokenCookies(purpose);

  return toSuccessState(result);
}

export async function completeStaffActivationAction(
  state: CredentialTokenActionState,
  formData: FormData
) {
  return completeCredentialTokenAction("STAFF_ACTIVATION", state, formData);
}

export async function completePasswordResetAction(
  state: CredentialTokenActionState,
  formData: FormData
) {
  return completeCredentialTokenAction("PASSWORD_RESET", state, formData);
}
