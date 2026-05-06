import "server-only";

import { cookies } from "next/headers";
import type { ActionResult } from "@psms/shared";
import { isDevAuthBypassEnabled } from "@psms/shared/dev-auth-bypass";
import { SESSION_COOKIE_NAME } from "@psms/shared/session-token";

function getApiBaseUrl() {
  return process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
}

function createCookieHeader(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

async function getSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

async function readJsonResult<T>(response: Response): Promise<ActionResult<T>> {
  try {
    return (await response.json()) as ActionResult<T>;
  } catch {
    return {
      ok: false,
      code: "API_INVALID_RESPONSE",
      message: "API 응답을 확인할 수 없습니다.",
    };
  }
}

export async function postAdminApi<T>(
  path: string,
  body: unknown
): Promise<ActionResult<T>> {
  const sessionToken = await getSessionToken();
  const isAuthBypassed = isDevAuthBypassEnabled();

  if (!sessionToken && !isAuthBypassed) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "로그인이 필요합니다.",
    };
  }

  try {
    const headers: HeadersInit = {
      "content-type": "application/json",
      ...(sessionToken ? { cookie: createCookieHeader(sessionToken) } : {}),
    };

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return await readJsonResult<T>(response);
  } catch {
    return {
      ok: false,
      code: "API_UNAVAILABLE",
      message: "API 서버에 연결할 수 없습니다.",
    };
  }
}
