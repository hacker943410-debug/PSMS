import type { PrismaClient } from "@psms/db";

import { createAuditLog } from "../../repositories/audit-log.repository";
import {
  findCredentialCompensationLimboTokens,
  revokeCredentialCompensationLimboTokens,
  type CredentialCompensationLimboToken,
} from "../../repositories/user-password-token.repository";

export const CREDENTIAL_COMPENSATION_CLEANUP_AUDIT_ACTION =
  "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP";

export const CREDENTIAL_COMPENSATION_CLEANUP_REASON =
  "COMPENSATION_FAILURE_LIMBO_TOKEN";

const DEFAULT_GRACE_MINUTES = 10;
const MIN_CONFIRM_GRACE_MINUTES = 10;
const SAFE_TEXT_MAX_LENGTH = 120;
const OPERATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@ -]{1,79}$/;
const TICKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/;
const FORBIDDEN_EVIDENCE_PATTERN =
  /(v1:hmac-sha256|bearer\s+|authorization|cookie|set-cookie|password|tokenhash|rawtoken|raw token|https?:\/\/)/i;

export type CredentialCompensationCleanupCandidate = Pick<
  CredentialCompensationLimboToken,
  "id" | "userId" | "purpose" | "expiresAt" | "createdById" | "createdAt"
> & {
  hadActiveKey: boolean;
  hadUsedAt: boolean;
  hadRevokedAt: boolean;
};

export type CredentialCompensationCleanupResult = {
  mode: "dry-run" | "confirmed";
  cutoffAt: string;
  detectionWindowMinutes: number;
  candidates: CredentialCompensationCleanupCandidate[];
  cleanedTokenIds: string[];
  auditLogIds: string[];
};

export type CredentialCompensationCleanupInput = {
  confirm?: boolean;
  tokenIds?: string[];
  expectedCandidateCount?: number;
  now?: Date;
  detectionWindowMinutes?: number;
  actorUserId?: string | null;
  operator?: string | null;
  ticketId?: string | null;
  reason?: string | null;
};

export async function runCredentialCompensationCleanup(
  db: PrismaClient,
  input: CredentialCompensationCleanupInput = {}
): Promise<CredentialCompensationCleanupResult> {
  const now = input.now ?? new Date();
  const detectionWindowMinutes =
    input.detectionWindowMinutes ?? DEFAULT_GRACE_MINUTES;
  const cutoffAt = computeCleanupCutoff(now, detectionWindowMinutes);
  const tokenIds = uniqueTokenIds(input.tokenIds ?? []);
  const confirm = input.confirm ?? false;

  assertDetectionWindow(detectionWindowMinutes, confirm);

  if (confirm) {
    assertConfirmInput(input, tokenIds);
  }

  if (!confirm) {
    const candidates = await findCredentialCompensationLimboTokens(db, {
      cutoffAt,
      tokenIds,
    });

    return {
      mode: "dry-run",
      cutoffAt: cutoffAt.toISOString(),
      detectionWindowMinutes,
      candidates: candidates.map(toCleanupCandidate),
      cleanedTokenIds: [],
      auditLogIds: [],
    };
  }

  return db.$transaction(async (tx) => {
    const actor = await tx.user.findFirst({
      where: {
        id: input.actorUserId ?? "",
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!actor) {
      throw new Error("Confirmed cleanup requires an active ADMIN actor.");
    }

    const candidates = await findCredentialCompensationLimboTokens(tx, {
      cutoffAt,
      tokenIds,
    });

    assertExactCleanupTargets(candidates, tokenIds);
    assertExpectedCandidateCount(candidates, input.expectedCandidateCount);

    const updateResult = await revokeCredentialCompensationLimboTokens(tx, {
      cutoffAt,
      tokenIds,
      revokedAt: now,
      revokedById: actor.id,
    });

    if (updateResult.count !== candidates.length) {
      throw new Error(
        `Credential compensation cleanup changed ${updateResult.count} rows; expected ${candidates.length}.`
      );
    }

    const auditLogIds: string[] = [];
    const operator = sanitizeOperator(input.operator);
    const ticketId = sanitizeTicketId(input.ticketId);
    const reason = sanitizeReason(input.reason);

    for (const candidate of candidates) {
      const audit = await createAuditLog(tx, {
        actorUserId: actor.id,
        action: CREDENTIAL_COMPENSATION_CLEANUP_AUDIT_ACTION,
        entityType: "User",
        entityId: candidate.userId,
        beforeJson: {
          tokenId: candidate.id,
          userId: candidate.userId,
          purpose: candidate.purpose,
          createdAt: candidate.createdAt.toISOString(),
          expiresAt: candidate.expiresAt.toISOString(),
          hadActiveKey: candidate.activeKey !== null,
          hadUsedAt: candidate.usedAt !== null,
          hadRevokedAt: candidate.revokedAt !== null,
        },
        afterJson: {
          tokenId: candidate.id,
          userId: candidate.userId,
          purpose: candidate.purpose,
          cleanupReason: CREDENTIAL_COMPENSATION_CLEANUP_REASON,
          detectionWindowMinutes,
          hadActiveKey: candidate.activeKey !== null,
          hadUsedAt: candidate.usedAt !== null,
          hadRevokedAt: candidate.revokedAt !== null,
          operator,
          ticketId,
          revokedAt: now.toISOString(),
        },
        reason: reason ?? CREDENTIAL_COMPENSATION_CLEANUP_REASON,
      });

      auditLogIds.push(audit.id);
    }

    return {
      mode: "confirmed",
      cutoffAt: cutoffAt.toISOString(),
      detectionWindowMinutes,
      candidates: candidates.map(toCleanupCandidate),
      cleanedTokenIds: candidates.map((candidate) => candidate.id),
      auditLogIds,
    };
  });
}

function assertDetectionWindow(
  detectionWindowMinutes: number,
  confirm: boolean
) {
  if (!Number.isInteger(detectionWindowMinutes) || detectionWindowMinutes < 1) {
    throw new Error("detectionWindowMinutes must be a positive integer.");
  }

  if (confirm && detectionWindowMinutes < MIN_CONFIRM_GRACE_MINUTES) {
    throw new Error(
      `Confirmed cleanup requires detectionWindowMinutes >= ${MIN_CONFIRM_GRACE_MINUTES}.`
    );
  }
}

function assertConfirmInput(
  input: CredentialCompensationCleanupInput,
  tokenIds: string[]
) {
  if (tokenIds.length === 0) {
    throw new Error("Confirmed cleanup requires at least one --token-id.");
  }

  if (
    input.expectedCandidateCount === undefined ||
    !Number.isInteger(input.expectedCandidateCount) ||
    input.expectedCandidateCount < 0
  ) {
    throw new Error("Confirmed cleanup requires --expected-count.");
  }

  if (!input.actorUserId?.trim()) {
    throw new Error("Confirmed cleanup requires --actor-user-id.");
  }

  sanitizeOperator(input.operator);
  sanitizeTicketId(input.ticketId);
  sanitizeReason(input.reason);
}

function computeCleanupCutoff(now: Date, detectionWindowMinutes: number) {
  return new Date(now.getTime() - detectionWindowMinutes * 60 * 1000);
}

function uniqueTokenIds(tokenIds: string[]) {
  return [...new Set(tokenIds.map((tokenId) => tokenId.trim()))].filter(
    Boolean
  );
}

function assertExactCleanupTargets(
  candidates: CredentialCompensationLimboToken[],
  tokenIds: string[]
) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const missing = tokenIds.filter((tokenId) => !candidateIds.has(tokenId));

  if (missing.length > 0) {
    throw new Error(
      `Credential compensation cleanup target mismatch: ${missing.join(", ")}.`
    );
  }
}

function assertExpectedCandidateCount(
  candidates: CredentialCompensationLimboToken[],
  expectedCandidateCount: number | undefined
) {
  if (expectedCandidateCount !== candidates.length) {
    throw new Error(
      `Credential compensation cleanup expected ${expectedCandidateCount} rows; found ${candidates.length}.`
    );
  }
}

function sanitizeOperator(value: string | null | undefined) {
  return sanitizeRequiredText(value, "operator", OPERATOR_PATTERN);
}

function sanitizeTicketId(value: string | null | undefined) {
  return sanitizeRequiredText(value, "ticketId", TICKET_PATTERN);
}

function sanitizeReason(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  return sanitizeText(value, "reason", SAFE_TEXT_MAX_LENGTH);
}

function sanitizeRequiredText(
  value: string | null | undefined,
  fieldName: string,
  pattern: RegExp
) {
  const sanitized = sanitizeText(value, fieldName, SAFE_TEXT_MAX_LENGTH);

  if (!pattern.test(sanitized)) {
    throw new Error(`Confirmed cleanup requires a safe ${fieldName}.`);
  }

  return sanitized;
}

function sanitizeText(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number
) {
  const sanitized = value?.trim() ?? "";

  if (!sanitized) {
    throw new Error(`Confirmed cleanup requires --${toKebabCase(fieldName)}.`);
  }

  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less.`);
  }

  if (FORBIDDEN_EVIDENCE_PATTERN.test(sanitized)) {
    throw new Error(`${fieldName} contains forbidden credential material.`);
  }

  return sanitized;
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function toCleanupCandidate(
  candidate: CredentialCompensationLimboToken
): CredentialCompensationCleanupCandidate {
  return {
    id: candidate.id,
    userId: candidate.userId,
    purpose: candidate.purpose,
    expiresAt: candidate.expiresAt,
    createdById: candidate.createdById,
    createdAt: candidate.createdAt,
    hadActiveKey: candidate.activeKey !== null,
    hadUsedAt: candidate.usedAt !== null,
    hadRevokedAt: candidate.revokedAt !== null,
  };
}
