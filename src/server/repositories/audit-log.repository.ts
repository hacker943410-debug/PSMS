import type { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/server/repositories/types";

type AuditJson = Prisma.InputJsonValue;

export function createAuditLog(
  db: DbClient,
  input: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeJson?: AuditJson;
    afterJson?: AuditJson;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
) {
  return db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: { id: true },
  });
}
