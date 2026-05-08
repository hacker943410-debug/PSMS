import { Prisma, prisma } from "@psms/db";
import {
  adminStaffCredentialIssueResultSchema,
  adminStaffCredentialRevokeResultSchema,
  assertPasswordTokenSecretConfigured,
  buildCredentialTokenActiveKey,
  createCredentialTokenExpiresAt,
  generateCredentialToken,
  hashCredentialToken,
  type ActionResult,
  type AdminStaffCredentialIssueInput,
  type AdminStaffCredentialIssueResult,
  type AdminStaffCredentialRevokeInput,
  type AdminStaffCredentialRevokeResult,
  type CredentialTokenPurpose,
  type SessionContext,
} from "@psms/shared";

import { createAuditLog } from "../../repositories/audit-log.repository";
import {
  findAdminStaffStatusSnapshot,
  findAdminStaffStoreById,
  type AdminStaffStatusSnapshot,
} from "../../repositories/admin-staff.repository";
import {
  activateUserPasswordTokenById,
  createUserPasswordToken,
  findValidActiveUserPasswordTokenByActiveKey,
  revokeActiveUserPasswordTokensByActiveKey,
  revokeUserPasswordTokenById,
  restoreRevokedUserPasswordTokenActiveKeyById,
} from "../../repositories/user-password-token.repository";
import type { AuthRequestMetadata } from "../auth.service";
import {
  deliverCredentialToken,
  getCredentialDeliveryConfig,
  type CredentialDeliveryResult,
} from "../credential-token-delivery.service";

type AdminStaffCredentialMutationResult<T> = {
  statusCode: number;
  result: ActionResult<T>;
};

type PendingCredentialDelivery = {
  mode: "EMAIL_QUEUED" | "SMS_QUEUED" | "OUT_OF_BAND_APPROVED";
  rawToken: string;
  purpose: CredentialTokenPurpose;
  tokenId: string;
  activeKey: string;
  target: AdminStaffStatusSnapshot;
  expiresAt: Date;
  previousToken: {
    id: string;
    expiresAt: Date;
  } | null;
};

type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
type CredentialDeliverySuccess = Extract<
  CredentialDeliveryResult,
  { ok: true }
>;
type CredentialDeliveryFailure = Extract<
  CredentialDeliveryResult,
  { ok: false }
>;

type IssueCredentialTransactionResult =
  AdminStaffCredentialMutationResult<AdminStaffCredentialIssueResult> & {
    delivery?: PendingCredentialDelivery;
  };

const CREDENTIAL_TOKEN_PRISMA_CONFLICT_CODES = ["P2002", "P2034"] as const;

function failure<T>(
  statusCode: number,
  code: string,
  message: string
): AdminStaffCredentialMutationResult<T> {
  return {
    statusCode,
    result: {
      ok: false,
      code,
      message,
    },
  };
}

export function isCredentialTokenPrismaConflictError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CREDENTIAL_TOKEN_PRISMA_CONFLICT_CODES.includes(
      error.code as (typeof CREDENTIAL_TOKEN_PRISMA_CONFLICT_CODES)[number]
    )
  );
}

export function credentialTokenConflictRollbackCode(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return "TRANSACTION_CONFLICT_AFTER_DELIVERY";
  }

  return "ACTIVE_KEY_CONFLICT_AFTER_DELIVERY";
}

function isSameTimestamp(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function purposeActionPrefix(purpose: CredentialTokenPurpose) {
  return purpose === "STAFF_ACTIVATION"
    ? "ADMIN_STAFF_ACTIVATION"
    : "ADMIN_STAFF_PASSWORD_RESET";
}

export async function auditAdminCredentialRateLimited(
  actorSession: SessionContext,
  metadata: AuthRequestMetadata,
  input: {
    route: string;
    targetUserId: string;
    purpose: CredentialTokenPurpose;
    mutation: "issue" | "revoke";
    retryAfterSeconds: number;
  }
) {
  await createAuditLog(prisma, {
    actorUserId: actorSession.userId,
    action: `${purposeActionPrefix(input.purpose)}_RATE_LIMITED`,
    entityType: "User",
    entityId: input.targetUserId,
    afterJson: {
      route: input.route,
      targetUserId: input.targetUserId,
      purpose: input.purpose,
      mutation: input.mutation,
      retryAfterSeconds: input.retryAfterSeconds,
    },
    reason: "RATE_LIMITED",
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

function assertCredentialTokenSecretReady() {
  try {
    assertPasswordTokenSecretConfigured();

    return true;
  } catch {
    return false;
  }
}

async function validateTargetForIssue(
  tx: PrismaTransaction,
  target: AdminStaffStatusSnapshot,
  purpose: CredentialTokenPurpose
) {
  if (purpose === "STAFF_ACTIVATION" && target.status !== "INACTIVE") {
    return failure<AdminStaffCredentialIssueResult>(
      409,
      "INVALID_ACCOUNT_STATE",
      "활성화 요청은 비활성 계정에만 발급할 수 있습니다."
    );
  }

  if (purpose === "PASSWORD_RESET" && target.status !== "ACTIVE") {
    return failure<AdminStaffCredentialIssueResult>(
      409,
      "INVALID_ACCOUNT_STATE",
      "비밀번호 재설정 요청은 활성 계정에만 발급할 수 있습니다."
    );
  }

  if (target.role !== "STAFF") {
    return failure<AdminStaffCredentialIssueResult>(
      409,
      "INVALID_ACCOUNT_STATE",
      "관리자 계정의 접근 요청은 직원 관리 화면에서 처리할 수 없습니다."
    );
  }

  if (!target.storeId) {
    return failure<AdminStaffCredentialIssueResult>(
      409,
      "STAFF_STORE_REQUIRED",
      "일반 직원은 활성 매장 배정이 필요합니다."
    );
  }

  const store = await findAdminStaffStoreById(tx, target.storeId);

  if (!store || store.status !== "ACTIVE") {
    return failure<AdminStaffCredentialIssueResult>(
      409,
      "STAFF_STORE_REQUIRED",
      "일반 직원은 활성 매장 배정이 필요합니다."
    );
  }

  return null;
}

function validateExpectedUpdatedAt(
  expectedUpdatedAt: string | undefined,
  target: AdminStaffStatusSnapshot
) {
  if (!expectedUpdatedAt) {
    return null;
  }

  if (!isSameTimestamp(new Date(expectedUpdatedAt), target.updatedAt)) {
    return failure<never>(
      409,
      "STALE_RECORD",
      "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."
    );
  }

  return null;
}

function toAuditSnapshot(target: AdminStaffStatusSnapshot) {
  return {
    userId: target.id,
    loginId: target.email,
    name: target.name,
    role: target.role,
    status: target.status,
    storeId: target.storeId,
    updatedAt: target.updatedAt.toISOString(),
  };
}

async function recordCredentialDeliveryFailure(input: {
  actorSession: SessionContext;
  delivery: PendingCredentialDelivery;
  deliveryResult: CredentialDeliveryFailure;
  input: AdminStaffCredentialIssueInput;
  metadata: AuthRequestMetadata;
  purpose: CredentialTokenPurpose;
  reason: string;
}) {
  const failedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const revoked = await revokeUserPasswordTokenById(tx, {
      tokenId: input.delivery.tokenId,
      revokedAt: failedAt,
      revokedById: input.actorSession.userId,
    });
    const retainedPrevious =
      input.delivery.previousToken &&
      input.delivery.previousToken.expiresAt > failedAt
        ? 1
        : 0;

    await createAuditLog(tx, {
      actorUserId: input.actorSession.userId,
      action: `${purposeActionPrefix(input.purpose)}_DELIVERY_FAILED`,
      entityType: "User",
      entityId: input.delivery.target.id,
      afterJson: {
        ...toAuditSnapshot(input.delivery.target),
        tokenId: input.delivery.tokenId,
        purpose: input.purpose,
        deliveryMode: input.delivery.mode,
        deliveryAttemptCount: input.deliveryResult.attemptCount,
        deliveryFailureCode: input.deliveryResult.failureCode,
        deliveryHttpStatus: input.deliveryResult.finalStatusCode,
        revokedTokenCount: revoked.count,
        retainedPreviousTokenCount: retainedPrevious,
        reason: input.input.reason ?? null,
      },
      reason: input.input.reason ?? input.reason,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
    });
  });
}

async function recordCredentialDeliveryRollback(
  tx: PrismaTransaction,
  input: {
    actorSession: SessionContext;
    delivery: PendingCredentialDelivery;
    deliveryResult: CredentialDeliverySuccess;
    issueInput: AdminStaffCredentialIssueInput;
    metadata: AuthRequestMetadata;
    purpose: CredentialTokenPurpose;
    reason: string;
    rollbackCode: string;
    restoredPreviousTokenCount?: number;
    target: AdminStaffStatusSnapshot;
  }
) {
  await createAuditLog(tx, {
    actorUserId: input.actorSession.userId,
    action: `${purposeActionPrefix(input.purpose)}_DELIVERY_ROLLED_BACK`,
    entityType: "User",
    entityId: input.target.id,
    afterJson: {
      ...toAuditSnapshot(input.target),
      tokenId: input.delivery.tokenId,
      purpose: input.purpose,
      deliveryMode: input.delivery.mode,
      deliveryAttemptCount: input.deliveryResult.attemptCount,
      deliveryHttpStatus: input.deliveryResult.finalStatusCode,
      rollbackCode: input.rollbackCode,
      restoredPreviousTokenCount: input.restoredPreviousTokenCount ?? 0,
      reason: input.issueInput.reason ?? null,
    },
    reason: input.issueInput.reason ?? input.reason,
    ipAddress: input.metadata.ipAddress,
    userAgent: input.metadata.userAgent,
  });
}

async function compensateCredentialDeliveryActivationConflict(input: {
  actorSession: SessionContext;
  delivery: PendingCredentialDelivery;
  deliveryResult: CredentialDeliverySuccess;
  issueInput: AdminStaffCredentialIssueInput;
  metadata: AuthRequestMetadata;
  purpose: CredentialTokenPurpose;
  rollbackCode: string;
}) {
  await prisma.$transaction(async (tx) => {
    const revokedAt = new Date();
    const currentTarget =
      (await findAdminStaffStatusSnapshot(tx, input.delivery.target.id)) ??
      input.delivery.target;
    const revoked = await revokeUserPasswordTokenById(tx, {
      tokenId: input.delivery.tokenId,
      revokedAt,
      revokedById: input.actorSession.userId,
    });

    await createAuditLog(tx, {
      actorUserId: input.actorSession.userId,
      action: `${purposeActionPrefix(input.purpose)}_DELIVERY_ROLLED_BACK`,
      entityType: "User",
      entityId: input.delivery.target.id,
      afterJson: {
        ...toAuditSnapshot(currentTarget),
        tokenId: input.delivery.tokenId,
        purpose: input.purpose,
        deliveryMode: input.delivery.mode,
        deliveryAttemptCount: input.deliveryResult.attemptCount,
        deliveryHttpStatus: input.deliveryResult.finalStatusCode,
        rollbackCode: input.rollbackCode,
        revokedTokenCount: revoked.count,
        reason: input.issueInput.reason ?? null,
      },
      reason: input.issueInput.reason ?? input.rollbackCode,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
    });
  });
}

export async function issueAdminStaffCredentialToken(
  input: AdminStaffCredentialIssueInput,
  purpose: CredentialTokenPurpose,
  actorSession: SessionContext,
  metadata: AuthRequestMetadata
): Promise<
  AdminStaffCredentialMutationResult<AdminStaffCredentialIssueResult>
> {
  const deliveryConfig = getCredentialDeliveryConfig();

  if (!deliveryConfig.ok) {
    return failure(
      503,
      "DELIVERY_UNAVAILABLE",
      "계정 접근 요청을 전달할 승인된 채널이 없습니다."
    );
  }

  if (!assertCredentialTokenSecretReady()) {
    return failure(
      503,
      "CREDENTIAL_TOKEN_UNAVAILABLE",
      "계정 접근 요청을 처리할 수 없습니다."
    );
  }

  const rawToken = generateCredentialToken();
  const tokenHash = hashCredentialToken(rawToken, purpose);
  const now = new Date();
  const expiresAt = createCredentialTokenExpiresAt(now);

  let transactionResult: IssueCredentialTransactionResult;

  try {
    transactionResult = await prisma.$transaction(async (tx) => {
      const target = await findAdminStaffStatusSnapshot(tx, input.userId);

      if (!target) {
        return failure(404, "NOT_FOUND", "대상을 찾을 수 없습니다.");
      }

      if (target.id === actorSession.userId) {
        return failure(
          409,
          "SELF_PASSWORD_RESET_FORBIDDEN",
          "직원 관리 화면에서는 자기 자신의 계정 접근 요청을 발급할 수 없습니다."
        );
      }

      const staleFailure = validateExpectedUpdatedAt(
        input.expectedUpdatedAt,
        target
      );

      if (staleFailure) {
        return staleFailure;
      }

      const targetFailure = await validateTargetForIssue(tx, target, purpose);

      if (targetFailure) {
        return targetFailure;
      }

      const activeKey = buildCredentialTokenActiveKey(target.id, purpose);
      const previousToken = await findValidActiveUserPasswordTokenByActiveKey(
        tx,
        {
          activeKey,
          now,
        }
      );
      const created = await createUserPasswordToken(tx, {
        userId: target.id,
        purpose,
        tokenHash,
        activeKey: null,
        expiresAt,
        createdById: actorSession.userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      const data = adminStaffCredentialIssueResultSchema.parse({
        userId: target.id,
        purpose,
        expiresAt: expiresAt.toISOString(),
        delivery: {
          mode: deliveryConfig.mode,
        },
        revokedTokenCount: 0,
      });

      return {
        statusCode: 201,
        result: {
          ok: true,
          data,
        },
        delivery: {
          mode: deliveryConfig.mode,
          rawToken,
          purpose,
          tokenId: created.id,
          activeKey,
          target,
          expiresAt,
          previousToken,
        },
      };
    });
  } catch (error) {
    if (isCredentialTokenPrismaConflictError(error)) {
      return failure(
        409,
        "CREDENTIAL_TOKEN_CONFLICT",
        "계정 접근 요청이 동시에 처리되었습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    throw error;
  }

  if (!transactionResult.result.ok || !transactionResult.delivery) {
    return transactionResult;
  }

  const delivery = transactionResult.delivery;
  const deliveryResult = await deliverCredentialToken({
    deliveryId: delivery.tokenId,
    mode: delivery.mode,
    rawToken: delivery.rawToken,
    purpose: delivery.purpose,
    user: {
      id: delivery.target.id,
      loginId: delivery.target.email,
      name: delivery.target.name,
      role: delivery.target.role,
      storeId: delivery.target.storeId,
    },
    expiresAt: delivery.expiresAt,
  });

  if (!deliveryResult.ok) {
    await recordCredentialDeliveryFailure({
      actorSession,
      delivery,
      deliveryResult,
      input,
      metadata,
      purpose,
      reason: "CREDENTIAL_DELIVERY_FAILED",
    });

    return failure(
      503,
      "DELIVERY_UNAVAILABLE",
      "계정 접근 요청을 전달하지 못했습니다."
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const target = await findAdminStaffStatusSnapshot(tx, input.userId);

      if (!target) {
        const revokedAt = new Date();

        await revokeUserPasswordTokenById(tx, {
          tokenId: delivery.tokenId,
          revokedAt,
          revokedById: actorSession.userId,
        });
        await recordCredentialDeliveryRollback(tx, {
          actorSession,
          delivery,
          deliveryResult,
          issueInput: input,
          metadata,
          purpose,
          reason: "TARGET_NOT_FOUND_AFTER_DELIVERY",
          rollbackCode: "TARGET_NOT_FOUND_AFTER_DELIVERY",
          target: delivery.target,
        });

        return failure(404, "NOT_FOUND", "대상을 찾을 수 없습니다.");
      }

      const staleFailure = validateExpectedUpdatedAt(
        input.expectedUpdatedAt,
        target
      );

      if (staleFailure) {
        const revokedAt = new Date();

        await revokeUserPasswordTokenById(tx, {
          tokenId: delivery.tokenId,
          revokedAt,
          revokedById: actorSession.userId,
        });
        await recordCredentialDeliveryRollback(tx, {
          actorSession,
          delivery,
          deliveryResult,
          issueInput: input,
          metadata,
          purpose,
          reason: "STALE_RECORD_AFTER_DELIVERY",
          rollbackCode: "STALE_RECORD_AFTER_DELIVERY",
          target,
        });

        return staleFailure;
      }

      const targetFailure = await validateTargetForIssue(tx, target, purpose);

      if (targetFailure) {
        const revokedAt = new Date();

        await revokeUserPasswordTokenById(tx, {
          tokenId: delivery.tokenId,
          revokedAt,
          revokedById: actorSession.userId,
        });
        await recordCredentialDeliveryRollback(tx, {
          actorSession,
          delivery,
          deliveryResult,
          issueInput: input,
          metadata,
          purpose,
          reason: "INVALID_ACCOUNT_STATE_AFTER_DELIVERY",
          rollbackCode: "INVALID_ACCOUNT_STATE_AFTER_DELIVERY",
          target,
        });

        return targetFailure;
      }

      const activatedAt = new Date();
      const revokedPrevious = await revokeActiveUserPasswordTokensByActiveKey(
        tx,
        {
          activeKey: delivery.activeKey,
          revokedAt: activatedAt,
          revokedById: actorSession.userId,
        }
      );
      const activated = await activateUserPasswordTokenById(tx, {
        tokenId: delivery.tokenId,
        activeKey: delivery.activeKey,
        activatedAt,
      });

      if (activated.count !== 1) {
        await revokeUserPasswordTokenById(tx, {
          tokenId: delivery.tokenId,
          revokedAt: activatedAt,
          revokedById: actorSession.userId,
        });
        const restoredPrevious =
          delivery.previousToken &&
          delivery.previousToken.expiresAt > activatedAt
            ? await restoreRevokedUserPasswordTokenActiveKeyById(tx, {
                tokenId: delivery.previousToken.id,
                activeKey: delivery.activeKey,
                restoredAt: activatedAt,
              })
            : { count: 0 };

        await recordCredentialDeliveryRollback(tx, {
          actorSession,
          delivery,
          deliveryResult,
          issueInput: input,
          metadata,
          purpose,
          reason: "ACTIVE_KEY_ACTIVATION_MISSED_AFTER_DELIVERY",
          rollbackCode: "ACTIVE_KEY_ACTIVATION_MISSED_AFTER_DELIVERY",
          restoredPreviousTokenCount: restoredPrevious.count,
          target,
        });

        return failure(
          409,
          "CREDENTIAL_TOKEN_CONFLICT",
          "계정 접근 요청이 동시에 처리되었습니다. 새로고침 후 다시 시도해 주세요."
        );
      }

      const action = `${purposeActionPrefix(purpose)}_ISSUED`;

      await createAuditLog(tx, {
        actorUserId: actorSession.userId,
        action,
        entityType: "User",
        entityId: target.id,
        afterJson: {
          ...toAuditSnapshot(target),
          tokenId: delivery.tokenId,
          purpose,
          expiresAt: delivery.expiresAt.toISOString(),
          deliveryMode: delivery.mode,
          deliveryAttemptCount: deliveryResult.attemptCount,
          deliveryHttpStatus: deliveryResult.finalStatusCode,
          revokedPreviousCount: revokedPrevious.count,
          revokedPreviousTokenIds:
            revokedPrevious.count > 0 && delivery.previousToken
              ? [delivery.previousToken.id]
              : [],
          reason: input.reason ?? null,
        },
        reason: input.reason ?? action,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      const data = adminStaffCredentialIssueResultSchema.parse({
        userId: target.id,
        purpose,
        expiresAt: delivery.expiresAt.toISOString(),
        delivery: {
          mode: delivery.mode,
        },
        revokedTokenCount: revokedPrevious.count,
      });

      return {
        statusCode: 201,
        result: {
          ok: true,
          data,
        },
      };
    });
  } catch (error) {
    if (isCredentialTokenPrismaConflictError(error)) {
      await compensateCredentialDeliveryActivationConflict({
        actorSession,
        delivery,
        deliveryResult,
        issueInput: input,
        metadata,
        purpose,
        rollbackCode: credentialTokenConflictRollbackCode(error),
      });

      return failure(
        409,
        "CREDENTIAL_TOKEN_CONFLICT",
        "계정 접근 요청이 동시에 처리되었습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    throw error;
  }
}

export async function revokeAdminStaffCredentialToken(
  input: AdminStaffCredentialRevokeInput,
  purpose: CredentialTokenPurpose,
  actorSession: SessionContext,
  metadata: AuthRequestMetadata
): Promise<
  AdminStaffCredentialMutationResult<AdminStaffCredentialRevokeResult>
> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const target = await findAdminStaffStatusSnapshot(tx, input.userId);

    if (!target) {
      return failure(404, "NOT_FOUND", "대상을 찾을 수 없습니다.");
    }

    if (target.id === actorSession.userId) {
      return failure(
        409,
        "SELF_PASSWORD_RESET_FORBIDDEN",
        "직원 관리 화면에서는 자기 자신의 계정 접근 요청을 회수할 수 없습니다."
      );
    }

    const staleFailure = validateExpectedUpdatedAt(
      input.expectedUpdatedAt,
      target
    );

    if (staleFailure) {
      return staleFailure;
    }

    if (target.role !== "STAFF") {
      return failure<AdminStaffCredentialRevokeResult>(
        409,
        "INVALID_ACCOUNT_STATE",
        "관리자 계정의 접근 요청은 직원 관리 화면에서 처리할 수 없습니다."
      );
    }

    const revoked = await revokeActiveUserPasswordTokensByActiveKey(tx, {
      activeKey: buildCredentialTokenActiveKey(target.id, purpose),
      revokedAt: now,
      revokedById: actorSession.userId,
    });
    const action = `${purposeActionPrefix(purpose)}_REVOKED`;

    await createAuditLog(tx, {
      actorUserId: actorSession.userId,
      action,
      entityType: "User",
      entityId: target.id,
      afterJson: {
        ...toAuditSnapshot(target),
        purpose,
        revokedTokenCount: revoked.count,
        reason: input.reason ?? null,
      },
      reason: input.reason ?? action,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const data = adminStaffCredentialRevokeResultSchema.parse({
      userId: target.id,
      purpose,
      revokedTokenCount: revoked.count,
    });

    return {
      statusCode: 200,
      result: {
        ok: true,
        data,
      },
    };
  });
}
