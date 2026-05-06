import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ActionResult, SessionContext } from "@psms/shared";
import {
  DEV_AUTH_BYPASS_SESSION,
  hashSessionToken,
  isDevAuthBypassEnabled,
  loginInputSchema,
  SESSION_COOKIE_NAME,
  toFieldErrors,
} from "@psms/shared";

import {
  getSessionByTokenHash,
  loginWithCredentials,
  logoutByTokenHash,
  type AuthRequestMetadata,
} from "../services/auth.service";

interface LoginResponseData {
  sessionToken: string;
  expiresAt: string;
  redirectTo: string;
}

interface SessionResponseData {
  session: SessionContext;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(request: FastifyRequest) {
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    getHeaderValue(request.headers["x-real-ip"]) ||
    getHeaderValue(request.headers["cf-connecting-ip"]) ||
    request.ip ||
    null
  );
}

function getRequestMetadata(request: FastifyRequest): AuthRequestMetadata {
  return {
    ipAddress: getClientIp(request),
    userAgent: getHeaderValue(request.headers["user-agent"]) ?? null,
  };
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

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{
    Body: unknown;
    Reply: ActionResult<LoginResponseData>;
  }>("/auth/login", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = loginInputSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);

      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "입력값을 확인해 주세요.",
        fieldErrors: toFieldErrors(parsed.error),
      };
    }

    const result = await loginWithCredentials(
      parsed.data,
      getRequestMetadata(request)
    );

    if (!result.ok) {
      if (result.code === "RATE_LIMITED") {
        reply.code(429).header("Retry-After", String(result.retryAfterSeconds));
      } else {
        reply.code(403);
      }

      return {
        ok: false,
        code: result.code,
        message: result.message,
      };
    }

    return {
      ok: true,
      data: {
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt.toISOString(),
        redirectTo: result.redirectTo,
      },
      redirectTo: result.redirectTo,
    };
  });

  app.get<{
    Reply: ActionResult<SessionResponseData>;
  }>("/auth/session", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    if (isDevAuthBypassEnabled()) {
      return {
        ok: true,
        data: { session: DEV_AUTH_BYPASS_SESSION },
      };
    }

    const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME);

    if (!sessionToken) {
      reply.code(401);

      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      };
    }

    const session = await getSessionByTokenHash(hashSessionToken(sessionToken));

    if (!session) {
      reply.code(401);

      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      };
    }

    return {
      ok: true,
      data: { session },
    };
  });

  app.post<{
    Reply: ActionResult;
  }>("/auth/logout", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const sessionToken = getCookieValue(request, SESSION_COOKIE_NAME);

    if (sessionToken) {
      await logoutByTokenHash(
        hashSessionToken(sessionToken),
        getRequestMetadata(request)
      );
    }

    return {
      ok: true,
      message: "로그아웃했습니다.",
    };
  });
}
