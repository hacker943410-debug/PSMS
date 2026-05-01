import type { DbClient } from "./types";

export function createSession(
  db: DbClient,
  input: {
    userId: string;
    sessionTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  return db.session.create({
    data: input,
    select: {
      id: true,
      sessionTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      userId: true,
    },
  });
}

export function findSessionByTokenHash(db: DbClient, sessionTokenHash: string) {
  return db.session.findUnique({
    where: { sessionTokenHash },
    select: {
      id: true,
      sessionTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          storeId: true,
        },
      },
    },
  });
}

export function revokeSessionByTokenHash(
  db: DbClient,
  sessionTokenHash: string,
  revokedAt: Date
) {
  return db.session.updateMany({
    where: {
      sessionTokenHash,
      revokedAt: null,
    },
    data: { revokedAt },
  });
}

export function revokeActiveSessionsForUser(
  db: DbClient,
  userId: string,
  revokedAt: Date
) {
  return db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: revokedAt },
    },
    data: { revokedAt },
  });
}
