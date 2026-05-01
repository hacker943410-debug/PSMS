import "server-only";

import type { ActionResult, SessionContext } from "@psms/shared";
import { SESSION_COOKIE_NAME } from "@psms/shared/session-token";

interface LoginResponseData {
  sessionToken: string;
  expiresAt: string;
  redirectTo: string;
}

interface SessionResponseData {
  session: SessionContext;
}

function getApiBaseUrl() {
  return process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
}

function getApiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

function createCookieHeader(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

async function readJsonResult<T>(response: Response): Promise<ActionResult<T>> {
  const result = (await response.json()) as ActionResult<T>;

  return result;
}

export async function loginViaApi(input: {
  loginId: string;
  password: string;
}): Promise<ActionResult<LoginResponseData>> {
  try {
    const response = await fetch(getApiUrl("/auth/login"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    return readJsonResult<LoginResponseData>(response);
  } catch {
    return {
      ok: false,
      code: "API_UNAVAILABLE",
      message: "API 서버에 연결할 수 없습니다.",
    };
  }
}

export async function getSessionViaApi(sessionToken: string) {
  try {
    const response = await fetch(getApiUrl("/auth/session"), {
      method: "GET",
      headers: {
        cookie: createCookieHeader(sessionToken),
      },
      cache: "no-store",
    });

    const result = await readJsonResult<SessionResponseData>(response);

    return result.ok ? (result.data?.session ?? null) : null;
  } catch {
    return null;
  }
}

export async function logoutViaApi(sessionToken: string) {
  try {
    const response = await fetch(getApiUrl("/auth/logout"), {
      method: "POST",
      headers: {
        cookie: createCookieHeader(sessionToken),
      },
      cache: "no-store",
    });

    return readJsonResult(response);
  } catch {
    return {
      ok: false,
      code: "API_UNAVAILABLE",
      message: "API 서버에 연결할 수 없습니다.",
    };
  }
}
