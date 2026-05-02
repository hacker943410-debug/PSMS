import type { FastifyRequest } from "fastify";
import type { ActionResult, SessionContext } from "@psms/shared";
import {
  DEV_AUTH_BYPASS_SESSION,
  hashSessionToken,
  isDevAuthBypassEnabled,
  SESSION_COOKIE_NAME,
} from "@psms/shared";

import { getSessionByTokenHash } from "../services/auth.service";

export type AdminSessionGuardSuccess = {
  ok: true;
  session: SessionContext;
};

export type AdminSessionGuardFailure = {
  ok: false;
  statusCode: 401 | 403;
  result: ActionResult;
};

export type AdminSessionGuardResult =
  | AdminSessionGuardSuccess
  | AdminSessionGuardFailure;

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCookieValue(request: FastifyRequest, name: string) {
  const cookieHeader = getHeaderValue(request.headers.cookie);

  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [cookieName, ...rawValue] = entry.trim().split("=");

    if (cookieName !== name) {
      continue;
    }

    if (rawValue.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue.join("=")) || null;
    } catch {
      return null;
    }
  }

  return null;
}

function authRequired(): AdminSessionGuardFailure {
  return {
    ok: false,
    statusCode: 401,
    result: {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "로그인이 필요합니다.",
    },
  };
}

function forbidden(): AdminSessionGuardFailure {
  return {
    ok: false,
    statusCode: 403,
    result: {
      ok: false,
      code: "FORBIDDEN",
      message: "관리자 권한이 필요합니다.",
    },
  };
}

export async function requireAdminSession(
  request: FastifyRequest
): Promise<AdminSessionGuardResult> {
  if (isDevAuthBypassEnabled()) {
    return {
      ok: true,
      session: DEV_AUTH_BYPASS_SESSION,
    };
  }

  const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return authRequired();
  }

  const session = await getSessionByTokenHash(hashSessionToken(sessionToken));

  if (!session) {
    return authRequired();
  }

  if (session.role !== "ADMIN") {
    return forbidden();
  }

  return {
    ok: true,
    session,
  };
}
