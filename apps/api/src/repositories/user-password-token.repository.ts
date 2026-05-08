import type { CredentialTokenPurpose } from "@psms/shared";

import type { DbClient } from "./types";

export type UserPasswordTokenWithUser = Awaited<
  ReturnType<typeof findUserPasswordTokenByHash>
>;

export function createUserPasswordToken(
  db: DbClient,
  input: {
    userId: string;
    purpose: CredentialTokenPurpose;
    tokenHash: string;
    activeKey: string | null;
    expiresAt: Date;
    createdById: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  return db.userPasswordToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      activeKey: input.activeKey,
      expiresAt: input.expiresAt,
      createdById: input.createdById,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    select: {
      id: true,
      userId: true,
      purpose: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export function activateUserPasswordTokenById(
  db: DbClient,
  input: {
    tokenId: string;
    activeKey: string;
    activatedAt: Date;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      id: input.tokenId,
      activeKey: null,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: input.activatedAt },
    },
    data: {
      activeKey: input.activeKey,
    },
  });
}

export function revokeActiveUserPasswordTokensByActiveKey(
  db: DbClient,
  input: {
    activeKey: string;
    revokedAt: Date;
    revokedById: string | null;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      activeKey: input.activeKey,
      usedAt: null,
      revokedAt: null,
    },
    data: {
      activeKey: null,
      revokedAt: input.revokedAt,
      revokedById: input.revokedById,
    },
  });
}

export function findValidActiveUserPasswordTokenByActiveKey(
  db: DbClient,
  input: {
    activeKey: string;
    now: Date;
  }
) {
  return db.userPasswordToken.findFirst({
    where: {
      activeKey: input.activeKey,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: input.now },
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });
}

export function findPendingUserPasswordTokensForUser(
  db: DbClient,
  input: {
    userId: string;
    activeKeys: string[];
    now: Date;
  }
) {
  if (input.activeKeys.length === 0) {
    return Promise.resolve([]);
  }

  return db.userPasswordToken.findMany({
    where: {
      userId: input.userId,
      activeKey: {
        in: input.activeKeys,
      },
      usedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: input.now,
      },
    },
    select: {
      id: true,
      purpose: true,
      expiresAt: true,
      createdAt: true,
      createdBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

export function findUserPasswordTokenIssueAuditRows(
  db: DbClient,
  input: {
    userId: string;
    tokenIds: string[];
  }
) {
  if (input.tokenIds.length === 0) {
    return Promise.resolve([]);
  }

  return db.auditLog.findMany({
    where: {
      entityType: "User",
      entityId: input.userId,
      action: {
        in: [
          "ADMIN_STAFF_ACTIVATION_ISSUED",
          "ADMIN_STAFF_PASSWORD_RESET_ISSUED",
        ],
      },
    },
    select: {
      afterJson: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.max(20, input.tokenIds.length * 4),
  });
}

export function revokeUserPasswordTokenById(
  db: DbClient,
  input: {
    tokenId: string;
    revokedAt: Date;
    revokedById: string | null;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      id: input.tokenId,
      usedAt: null,
      revokedAt: null,
    },
    data: {
      activeKey: null,
      revokedAt: input.revokedAt,
      revokedById: input.revokedById,
    },
  });
}

export function restoreRevokedUserPasswordTokenActiveKeyById(
  db: DbClient,
  input: {
    tokenId: string;
    activeKey: string;
    restoredAt: Date;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      id: input.tokenId,
      activeKey: null,
      usedAt: null,
      revokedAt: { not: null },
      expiresAt: { gt: input.restoredAt },
    },
    data: {
      activeKey: input.activeKey,
      revokedAt: null,
      revokedById: null,
    },
  });
}

export function revokeAllActiveUserPasswordTokensForUser(
  db: DbClient,
  input: {
    userId: string;
    revokedAt: Date;
    revokedById: string | null;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      userId: input.userId,
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
    },
    data: {
      activeKey: null,
      revokedAt: input.revokedAt,
      revokedById: input.revokedById,
    },
  });
}

export function findUserPasswordTokenByHash(
  db: DbClient,
  input: {
    tokenHash: string;
  }
) {
  return db.userPasswordToken.findUnique({
    where: {
      tokenHash: input.tokenHash,
    },
    select: {
      id: true,
      userId: true,
      purpose: true,
      tokenHash: true,
      activeKey: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          storeId: true,
          store: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });
}

export function markUserPasswordTokenUsed(
  db: DbClient,
  input: {
    tokenId: string;
    tokenHash: string;
    purpose: CredentialTokenPurpose;
    usedAt: Date;
  }
) {
  return db.userPasswordToken.updateMany({
    where: {
      id: input.tokenId,
      tokenHash: input.tokenHash,
      purpose: input.purpose,
      activeKey: { not: null },
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: input.usedAt },
    },
    data: {
      activeKey: null,
      usedAt: input.usedAt,
    },
  });
}
