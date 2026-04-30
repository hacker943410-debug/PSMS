"use server";

import { cookies, headers } from "next/headers";

import {
  createExpiredSessionCookieOptions,
  createSessionCookieOptions,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-token";
import {
  loginWithCredentials,
  logoutByTokenHash,
  type AuthRequestMetadata,
} from "@/server/services/auth.service";
import {
  loginInputSchema,
  toFieldErrors,
} from "@/server/validation/auth.validation";
import type { ActionResult } from "@/types/action-result";

function getClientIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    null
  );
}

async function getRequestMetadata(): Promise<AuthRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  };
}

export async function loginAction(input: {
  email: string;
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

  const result = await loginWithCredentials(
    parsed.data,
    await getRequestMetadata()
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    result.sessionToken,
    createSessionCookieOptions(result.expiresAt)
  );

  return {
    ok: true,
    data: { redirectTo: result.redirectTo },
    redirectTo: result.redirectTo,
  };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await logoutByTokenHash(
      hashSessionToken(sessionToken),
      await getRequestMetadata()
    );
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", createExpiredSessionCookieOptions());
}
