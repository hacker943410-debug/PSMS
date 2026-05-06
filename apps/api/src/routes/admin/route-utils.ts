import type { FastifyReply, FastifyRequest } from "fastify";
import type { ActionResult, SessionContext } from "@psms/shared";
import { toFieldErrors } from "@psms/shared";

import { requireAdminSession } from "../../auth/admin-session.guard";
import type { AuthRequestMetadata } from "../../services/auth.service";

type SafeParseSchema<T> = {
  safeParse: (
    value: unknown
  ) =>
    | { success: true; data: T }
    | { success: false; error: Parameters<typeof toFieldErrors>[0] };
};

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

export async function requireAdminForRoute(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const guard = await requireAdminSession(request);

  if (!guard.ok) {
    reply.code(guard.statusCode);

    return guard.result;
  }

  return null;
}

export async function requireAdminSessionForRoute(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SessionContext | ActionResult> {
  const guard = await requireAdminSession(request);

  if (!guard.ok) {
    reply.code(guard.statusCode);

    return guard.result;
  }

  return guard.session;
}

function validationFailure(reply: FastifyReply): ActionResult {
  reply.code(400);

  return {
    ok: false,
    code: "VALIDATION_FAILED",
    message: "입력값을 확인해 주세요.",
  };
}

export function parseAdminQuery<T>(
  schema: T,
  query: unknown,
  reply: FastifyReply
): T extends SafeParseSchema<infer Output> ? Output | ActionResult : never {
  const querySchema = schema as SafeParseSchema<unknown>;
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return {
      ...validationFailure(reply),
      fieldErrors: toFieldErrors(parsed.error),
    } as T extends SafeParseSchema<infer Output>
      ? Output | ActionResult
      : never;
  }

  return parsed.data as T extends SafeParseSchema<infer Output>
    ? Output | ActionResult
    : never;
}

export function parseAdminBody<T>(
  schema: T,
  body: unknown,
  reply: FastifyReply
): T extends SafeParseSchema<infer Output> ? Output | ActionResult : never {
  const bodySchema = schema as SafeParseSchema<unknown>;
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return {
      ...validationFailure(reply),
      fieldErrors: toFieldErrors(parsed.error),
    } as T extends SafeParseSchema<infer Output>
      ? Output | ActionResult
      : never;
  }

  return parsed.data as T extends SafeParseSchema<infer Output>
    ? Output | ActionResult
    : never;
}

export function notFound(reply: FastifyReply): ActionResult {
  reply.code(404);

  return {
    ok: false,
    code: "NOT_FOUND",
    message: "대상을 찾을 수 없습니다.",
  };
}

export function conflict(
  reply: FastifyReply,
  code: string,
  message: string
): ActionResult {
  reply.code(409);

  return {
    ok: false,
    code,
    message,
  };
}

export function getAdminRequestMetadata(
  request: FastifyRequest
): AuthRequestMetadata {
  return {
    ipAddress: getClientIp(request),
    userAgent: getHeaderValue(request.headers["user-agent"]) ?? null,
  };
}
