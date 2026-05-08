import { prisma } from "@psms/db";
import {
  assertPasswordTokenSecretConfigured,
  buildCredentialTokenActiveKey,
  CREDENTIAL_PASSWORD_MAX_LENGTH,
  CREDENTIAL_PASSWORD_MIN_LENGTH,
  createCredentialCompleteInputSchema,
  credentialCompleteResultSchema,
  credentialTokenPreviewSchema,
  hashCredentialToken,
  hashPassword,
  toFieldErrors,
  type ActionResult,
  type CredentialCompleteInput,
  type CredentialCompleteResult,
  type CredentialTokenPreview,
  type CredentialTokenPurpose,
  type CredentialTokenVerifyInput,
} from "@psms/shared";

import { createAuditLog } from "../repositories/audit-log.repository";
import { revokeActiveSessionsForUser } from "../repositories/session.repository";
import {
  findUserPasswordTokenByHash,
  markUserPasswordTokenUsed,
  type UserPasswordTokenWithUser,
} from "../repositories/user-password-token.repository";
import { updateCredentialUserPassword } from "../repositories/user.repository";
import type { AuthRequestMetadata } from "./auth.service";

type CredentialTokenServiceResult<T> = {
  statusCode: number;
  result: ActionResult<T>;
};

function failure<T>(
  statusCode: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>
): CredentialTokenServiceResult<T> {
  return {
    statusCode,
    result: {
      ok: false,
      code,
      message,
      fieldErrors,
    },
  };
}

function invalidTokenFailure<T>() {
  return failure<T>(
    400,
    "INVALID_CREDENTIAL_TOKEN",
    "요청 토큰이 올바르지 않거나 만료되었습니다."
  );
}

function credentialUnavailableFailure<T>() {
  return failure<T>(
    503,
    "CREDENTIAL_TOKEN_UNAVAILABLE",
    "계정 접근 요청을 처리할 수 없습니다."
  );
}

function tryHashCredentialToken(
  rawToken: string,
  purpose: CredentialTokenPurpose
) {
  try {
    assertPasswordTokenSecretConfigured();

    return hashCredentialToken(rawToken, purpose);
  } catch {
    return null;
  }
}

function isPurposeTargetStateValid(
  token: NonNullable<UserPasswordTokenWithUser>,
  purpose: CredentialTokenPurpose
) {
  if (token.purpose !== purpose) {
    return false;
  }

  if (purpose === "STAFF_ACTIVATION") {
    return token.user.status === "INACTIVE";
  }

  return token.user.status === "ACTIVE";
}

function isUserStoreEligible(token: NonNullable<UserPasswordTokenWithUser>) {
  if (token.user.role !== "STAFF") {
    return true;
  }

  return Boolean(token.user.storeId && token.user.store?.status === "ACTIVE");
}

function isTokenActiveForPurpose(
  token: UserPasswordTokenWithUser,
  purpose: CredentialTokenPurpose,
  now: Date
): token is NonNullable<UserPasswordTokenWithUser> {
  if (!token) {
    return false;
  }

  if (
    !token.activeKey ||
    token.usedAt ||
    token.revokedAt ||
    token.expiresAt <= now
  ) {
    return false;
  }

  if (
    token.activeKey !== buildCredentialTokenActiveKey(token.userId, purpose)
  ) {
    return false;
  }

  return (
    isPurposeTargetStateValid(token, purpose) && isUserStoreEligible(token)
  );
}

function toPreview(
  token: NonNullable<UserPasswordTokenWithUser>,
  purpose: CredentialTokenPurpose
): CredentialTokenPreview {
  return credentialTokenPreviewSchema.parse({
    purpose,
    loginId: token.user.email,
    name: token.user.name,
    expiresAt: token.expiresAt.toISOString(),
    passwordPolicy: {
      minLength: CREDENTIAL_PASSWORD_MIN_LENGTH,
      maxLength: CREDENTIAL_PASSWORD_MAX_LENGTH,
    },
  });
}

function auditActionForPurpose(purpose: CredentialTokenPurpose) {
  return purpose === "STAFF_ACTIVATION"
    ? "STAFF_ACTIVATION_COMPLETED"
    : "STAFF_PASSWORD_RESET_COMPLETED";
}

export async function verifyCredentialToken(
  input: CredentialTokenVerifyInput,
  purpose: CredentialTokenPurpose
): Promise<CredentialTokenServiceResult<CredentialTokenPreview>> {
  const tokenHash = tryHashCredentialToken(input.token, purpose);

  if (!tokenHash) {
    return credentialUnavailableFailure();
  }

  const now = new Date();
  const token = await findUserPasswordTokenByHash(prisma, { tokenHash });

  if (!isTokenActiveForPurpose(token, purpose, now)) {
    return invalidTokenFailure();
  }

  return {
    statusCode: 200,
    result: {
      ok: true,
      data: toPreview(token, purpose),
    },
  };
}

export async function completeCredentialToken(
  input: CredentialCompleteInput,
  purpose: CredentialTokenPurpose,
  metadata: AuthRequestMetadata
): Promise<CredentialTokenServiceResult<CredentialCompleteResult>> {
  const tokenHash = tryHashCredentialToken(input.token, purpose);

  if (!tokenHash) {
    return credentialUnavailableFailure();
  }

  const now = new Date();
  const preflightToken = await findUserPasswordTokenByHash(prisma, {
    tokenHash,
  });

  if (!isTokenActiveForPurpose(preflightToken, purpose, now)) {
    return invalidTokenFailure();
  }

  const contextualInput = createCredentialCompleteInputSchema({
    loginId: preflightToken.user.email,
    name: preflightToken.user.name,
  }).safeParse(input);

  if (!contextualInput.success) {
    return failure(
      400,
      "VALIDATION_FAILED",
      "입력값을 확인해 주세요.",
      toFieldErrors(contextualInput.error)
    );
  }

  const passwordHash = await hashPassword(contextualInput.data.password);

  return prisma.$transaction(async (tx) => {
    const token = await findUserPasswordTokenByHash(tx, { tokenHash });

    if (!isTokenActiveForPurpose(token, purpose, now)) {
      return invalidTokenFailure();
    }

    const consumeResult = await markUserPasswordTokenUsed(tx, {
      tokenId: token.id,
      tokenHash,
      purpose,
      usedAt: now,
    });

    if (consumeResult.count !== 1) {
      return invalidTokenFailure();
    }

    const expectedStatus =
      purpose === "STAFF_ACTIVATION" ? "INACTIVE" : "ACTIVE";
    const nextStatus = purpose === "STAFF_ACTIVATION" ? "ACTIVE" : undefined;
    const passwordUpdate = await updateCredentialUserPassword(tx, {
      userId: token.userId,
      expectedStatus,
      nextStatus,
      passwordHash,
    });

    if (passwordUpdate.count !== 1) {
      return invalidTokenFailure();
    }

    const revokedSessions = await revokeActiveSessionsForUser(
      tx,
      token.userId,
      now
    );

    await createAuditLog(tx, {
      actorUserId: token.userId,
      action: auditActionForPurpose(purpose),
      entityType: "User",
      entityId: token.userId,
      afterJson: {
        userId: token.userId,
        loginId: token.user.email,
        role: token.user.role,
        statusBefore: token.user.status,
        statusAfter: nextStatus ?? token.user.status,
        storeId: token.user.storeId,
        purpose,
        tokenId: token.id,
        revokedSessionCount: revokedSessions.count,
      },
      reason: auditActionForPurpose(purpose),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const data = credentialCompleteResultSchema.parse({
      redirectTo: "/login",
      activated: purpose === "STAFF_ACTIVATION",
      revokedSessionCount: revokedSessions.count,
    });

    return {
      statusCode: 200,
      result: {
        ok: true,
        data,
        redirectTo: data.redirectTo,
      },
    };
  });
}
