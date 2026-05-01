import type { DbClient } from "./types";

export function findUserForLoginByLoginId(db: DbClient, loginId: string) {
  return db.user.findUnique({
    where: { email: loginId },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      storeId: true,
    },
  });
}

export function findUserSessionProfileById(db: DbClient, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      storeId: true,
    },
  });
}

export function updateUserLastLoginAt(
  db: DbClient,
  userId: string,
  lastLoginAt: Date
) {
  return db.user.update({
    where: { id: userId },
    data: { lastLoginAt },
    select: { id: true },
  });
}
