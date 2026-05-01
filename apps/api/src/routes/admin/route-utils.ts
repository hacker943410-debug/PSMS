import type { FastifyReply, FastifyRequest } from "fastify";
import type { ActionResult } from "@psms/shared";
import { toFieldErrors } from "@psms/shared";

import { requireAdminSession } from "../../auth/admin-session.guard";

type QuerySchema<T> = {
  safeParse: (
    query: unknown
  ) =>
    | { success: true; data: T }
    | { success: false; error: Parameters<typeof toFieldErrors>[0] };
};

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

export function parseAdminQuery<T>(
  schema: T,
  query: unknown,
  reply: FastifyReply
): T extends QuerySchema<infer Output> ? Output | ActionResult : never {
  const querySchema = schema as QuerySchema<unknown>;
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    reply.code(400);

    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error),
    } as T extends QuerySchema<infer Output> ? Output | ActionResult : never;
  }

  return parsed.data as T extends QuerySchema<infer Output>
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
