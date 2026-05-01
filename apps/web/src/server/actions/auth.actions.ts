"use server";

import { cookies } from "next/headers";

import {
  createExpiredSessionCookieOptions,
  createSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@psms/shared/session-token";
import { loginInputSchema, toFieldErrors } from "@psms/shared/auth.validation";
import type { ActionResult } from "@psms/shared";
import { loginViaApi, logoutViaApi } from "@/lib/api-client";

export async function loginAction(input: {
  loginId: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await loginViaApi(parsed.data);

  if (!result.ok || !result.data) {
    return {
      ok: false,
      code: result.ok ? "AUTH_REQUIRED" : result.code,
      message: result.ok
        ? "로그인 응답을 확인하지 못했습니다."
        : result.message,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    result.data.sessionToken,
    createSessionCookieOptions(new Date(result.data.expiresAt))
  );

  return {
    ok: true,
    data: { redirectTo: result.data.redirectTo },
    redirectTo: result.data.redirectTo,
  };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await logoutViaApi(sessionToken);
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", createExpiredSessionCookieOptions());
}
