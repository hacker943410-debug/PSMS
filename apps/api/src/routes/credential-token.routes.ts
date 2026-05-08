import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  credentialCompleteInputSchema,
  credentialTokenVerifyInputSchema,
  toFieldErrors,
  type ActionResult,
  type CredentialTokenPurpose,
} from "@psms/shared";

import {
  checkCredentialTokenRateLimit,
  recordFailedCredentialTokenAttempt,
  releaseCredentialTokenRateLimitReservation,
} from "../auth/credential-token-rate-limit";
import type { AuthRequestMetadata } from "../services/auth.service";
import {
  completeCredentialToken,
  verifyCredentialToken,
} from "../services/credential-token.service";

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(request: FastifyRequest) {
  const socketIp = request.raw.socket.remoteAddress?.trim();

  return socketIp || request.ip || null;
}

function getRequestMetadata(request: FastifyRequest): AuthRequestMetadata {
  return {
    ipAddress: getClientIp(request),
    userAgent: getHeaderValue(request.headers["user-agent"]) ?? null,
  };
}

function validationFailure(fieldErrors: Record<string, string>): ActionResult {
  return {
    ok: false,
    code: "VALIDATION_FAILED",
    message: "입력값을 확인해 주세요.",
    fieldErrors,
  };
}

function rateLimitFailure(retryAfterSeconds: number): ActionResult {
  return {
    ok: false,
    code: "RATE_LIMITED",
    message: "요청 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
  };
}

function applyCredentialRateLimit(
  rawToken: string,
  metadata: AuthRequestMetadata,
  reply: FastifyReply
) {
  const decision = checkCredentialTokenRateLimit(rawToken, metadata.ipAddress);

  if (decision.allowed) {
    return null;
  }

  reply.code(429).header("Retry-After", String(decision.retryAfterSeconds));

  return rateLimitFailure(decision.retryAfterSeconds);
}

async function handleVerify(
  request: FastifyRequest,
  reply: FastifyReply,
  purpose: CredentialTokenPurpose
) {
  reply.header("Cache-Control", "no-store");

  const parsed = credentialTokenVerifyInputSchema.safeParse(request.body);

  if (!parsed.success) {
    reply.code(400);

    return validationFailure(toFieldErrors(parsed.error));
  }

  const metadata = getRequestMetadata(request);
  const rateLimitResult = applyCredentialRateLimit(
    parsed.data.token,
    metadata,
    reply
  );

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const result = await verifyCredentialToken(parsed.data, purpose);

  reply.code(result.statusCode);

  if (!result.result.ok) {
    recordFailedCredentialTokenAttempt(parsed.data.token, metadata.ipAddress);
  } else {
    releaseCredentialTokenRateLimitReservation(
      parsed.data.token,
      metadata.ipAddress
    );
  }

  return result.result;
}

async function handleComplete(
  request: FastifyRequest,
  reply: FastifyReply,
  purpose: CredentialTokenPurpose
) {
  reply.header("Cache-Control", "no-store");

  const parsed = credentialCompleteInputSchema.safeParse(request.body);

  if (!parsed.success) {
    reply.code(400);

    return validationFailure(toFieldErrors(parsed.error));
  }

  const metadata = getRequestMetadata(request);
  const rateLimitResult = applyCredentialRateLimit(
    parsed.data.token,
    metadata,
    reply
  );

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const result = await completeCredentialToken(parsed.data, purpose, metadata);

  reply.code(result.statusCode);

  if (!result.result.ok) {
    recordFailedCredentialTokenAttempt(parsed.data.token, metadata.ipAddress);
  } else {
    releaseCredentialTokenRateLimitReservation(
      parsed.data.token,
      metadata.ipAddress
    );
  }

  return result.result;
}

export async function registerCredentialTokenRoutes(app: FastifyInstance) {
  app.post("/auth/staff-activation/verify", (request, reply) =>
    handleVerify(request, reply, "STAFF_ACTIVATION")
  );

  app.post("/auth/staff-activation/complete", (request, reply) =>
    handleComplete(request, reply, "STAFF_ACTIVATION")
  );

  app.post("/auth/password-reset/verify", (request, reply) =>
    handleVerify(request, reply, "PASSWORD_RESET")
  );

  app.post("/auth/password-reset/complete", (request, reply) =>
    handleComplete(request, reply, "PASSWORD_RESET")
  );
}
