import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  adminStaffCredentialIssueInputSchema,
  adminStaffCredentialRevokeInputSchema,
  type AdminStaffCredentialIssueInput,
  type AdminStaffCredentialRevokeInput,
  type CredentialTokenPurpose,
} from "@psms/shared";

import { requireAdminSession } from "../../auth/admin-session.guard";
import {
  consumeAdminCredentialMutationRateLimit,
  type AdminCredentialMutationRateLimitInput,
} from "../../auth/admin-credential-rate-limit";
import {
  auditAdminCredentialRateLimited,
  issueAdminStaffCredentialToken,
  revokeAdminStaffCredentialToken,
} from "../../services/admin/staff-credentials.service";
import type { AuthRequestMetadata } from "../../services/auth.service";
import { auditAdminMutationForbidden } from "../../services/admin/staffs.service";
import { parseAdminBody } from "./route-utils";

const staffCredentialRoutes = {
  activationIssue: "/admin/staffs/activation/issue",
  activationRevoke: "/admin/staffs/activation/revoke",
  passwordResetIssue: "/admin/staffs/password-reset/issue",
  passwordResetRevoke: "/admin/staffs/password-reset/revoke",
} as const;

function getRawSocketIp(request: FastifyRequest) {
  return request.raw.socket.remoteAddress?.trim() || request.ip || null;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAdminCredentialRequestMetadata(
  request: FastifyRequest
): AuthRequestMetadata {
  return {
    ipAddress: getRawSocketIp(request),
    userAgent: getHeaderValue(request.headers["user-agent"]) ?? null,
  };
}

function rateLimitFailure(retryAfterSeconds: number) {
  return {
    ok: false,
    code: "RATE_LIMITED",
    message: "요청 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
  };
}

async function applyAdminCredentialRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  input: Omit<AdminCredentialMutationRateLimitInput, "ipAddress"> & {
    route: string;
    session: Parameters<typeof auditAdminCredentialRateLimited>[0];
    metadata: Parameters<typeof auditAdminCredentialRateLimited>[1];
  }
) {
  const rateLimitInput = {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    purpose: input.purpose,
    mutation: input.mutation,
    ipAddress: getRawSocketIp(request),
  };
  const decision = consumeAdminCredentialMutationRateLimit(rateLimitInput);

  if (!decision.allowed) {
    reply.code(429).header("Retry-After", String(decision.retryAfterSeconds));

    await auditAdminCredentialRateLimited(input.session, input.metadata, {
      route: input.route,
      targetUserId: input.targetUserId,
      purpose: input.purpose,
      mutation: input.mutation,
      retryAfterSeconds: decision.retryAfterSeconds,
    });

    return rateLimitFailure(decision.retryAfterSeconds);
  }

  return null;
}

async function requireAdminForCredentialMutation(
  request: FastifyRequest,
  reply: FastifyReply,
  input: {
    route: string;
    attemptedAction: string;
  }
) {
  const metadata = getAdminCredentialRequestMetadata(request);
  const guard = await requireAdminSession(request);

  if (!guard.ok) {
    reply.code(guard.statusCode);

    if (guard.statusCode === 403 && guard.session) {
      await auditAdminMutationForbidden(guard.session, metadata, {
        route: input.route,
        method: "POST",
        attemptedAction: input.attemptedAction,
        entityType: "User",
      });
    }

    return {
      ok: false as const,
      result: guard.result,
    };
  }

  return {
    ok: true as const,
    metadata,
    session: guard.session,
  };
}

async function handleIssue(
  request: FastifyRequest,
  reply: FastifyReply,
  input: {
    route: string;
    attemptedAction: string;
    purpose: CredentialTokenPurpose;
  }
) {
  const guard = await requireAdminForCredentialMutation(request, reply, input);

  if (!guard.ok) {
    return guard.result;
  }

  const parsed = parseAdminBody(
    adminStaffCredentialIssueInputSchema,
    request.body,
    reply
  );

  if ("ok" in parsed) {
    return parsed;
  }

  const rateLimitResult = await applyAdminCredentialRateLimit(request, reply, {
    actorUserId: guard.session.userId,
    targetUserId: (parsed as AdminStaffCredentialIssueInput).userId,
    purpose: input.purpose,
    mutation: "issue",
    route: input.route,
    session: guard.session,
    metadata: guard.metadata,
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const result = await issueAdminStaffCredentialToken(
    parsed,
    input.purpose,
    guard.session,
    guard.metadata
  );

  reply.code(result.statusCode);

  return result.result;
}

async function handleRevoke(
  request: FastifyRequest,
  reply: FastifyReply,
  input: {
    route: string;
    attemptedAction: string;
    purpose: CredentialTokenPurpose;
  }
) {
  const guard = await requireAdminForCredentialMutation(request, reply, input);

  if (!guard.ok) {
    return guard.result;
  }

  const parsed = parseAdminBody(
    adminStaffCredentialRevokeInputSchema,
    request.body,
    reply
  );

  if ("ok" in parsed) {
    return parsed;
  }

  const rateLimitResult = await applyAdminCredentialRateLimit(request, reply, {
    actorUserId: guard.session.userId,
    targetUserId: (parsed as AdminStaffCredentialRevokeInput).userId,
    purpose: input.purpose,
    mutation: "revoke",
    route: input.route,
    session: guard.session,
    metadata: guard.metadata,
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const result = await revokeAdminStaffCredentialToken(
    parsed,
    input.purpose,
    guard.session,
    guard.metadata
  );

  reply.code(result.statusCode);

  return result.result;
}

export async function registerAdminStaffCredentialRoutes(app: FastifyInstance) {
  app.post(staffCredentialRoutes.activationIssue, (request, reply) =>
    handleIssue(request, reply, {
      route: staffCredentialRoutes.activationIssue,
      attemptedAction: "ADMIN_STAFF_ACTIVATION_ISSUED",
      purpose: "STAFF_ACTIVATION",
    })
  );

  app.post(staffCredentialRoutes.activationRevoke, (request, reply) =>
    handleRevoke(request, reply, {
      route: staffCredentialRoutes.activationRevoke,
      attemptedAction: "ADMIN_STAFF_ACTIVATION_REVOKED",
      purpose: "STAFF_ACTIVATION",
    })
  );

  app.post(staffCredentialRoutes.passwordResetIssue, (request, reply) =>
    handleIssue(request, reply, {
      route: staffCredentialRoutes.passwordResetIssue,
      attemptedAction: "ADMIN_STAFF_PASSWORD_RESET_ISSUED",
      purpose: "PASSWORD_RESET",
    })
  );

  app.post(staffCredentialRoutes.passwordResetRevoke, (request, reply) =>
    handleRevoke(request, reply, {
      route: staffCredentialRoutes.passwordResetRevoke,
      attemptedAction: "ADMIN_STAFF_PASSWORD_RESET_REVOKED",
      purpose: "PASSWORD_RESET",
    })
  );
}
