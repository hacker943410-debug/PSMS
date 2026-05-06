import { Prisma, prisma } from "@psms/db";
import {
  hashPassword,
  type ActionResult,
  type AdminCreateStaffInput,
  type AdminChangeStaffStatusInput,
  type AdminRecordStatus,
  type AdminStaffChangeStatusResult,
  type AdminStaffCreateResult,
  type AdminStaffUpdateField,
  type AdminStaffUpdateResult,
  type AdminUpdateStaffInput,
  type SessionContext,
} from "@psms/shared";
import { randomBytes } from "node:crypto";

import { createAuditLog } from "../../repositories/audit-log.repository";
import {
  countOtherActiveAdmins,
  createAdminStaff,
  findAdminStaffByLoginId,
  findAdminStaffStoreById,
  findAdminStaffStatusSnapshot,
  updateAdminStaffProfile,
  updateAdminStaffStatus,
  type AdminStaffStatusSnapshot,
} from "../../repositories/admin-staff.repository";
import { revokeActiveSessionsForUser } from "../../repositories/session.repository";
import type { AuthRequestMetadata } from "../auth.service";

type AdminStaffMutationResult = {
  statusCode: number;
  result: ActionResult<
    | AdminStaffChangeStatusResult
    | AdminStaffCreateResult
    | AdminStaffUpdateResult
  >;
};

function failure(
  statusCode: number,
  code: string,
  message: string
): AdminStaffMutationResult {
  return {
    statusCode,
    result: {
      ok: false,
      code,
      message,
    },
  };
}

function toAuditStaffSnapshot(staff: AdminStaffStatusSnapshot) {
  return {
    userId: staff.id,
    name: staff.name,
    loginId: staff.email,
    role: staff.role,
    status: staff.status,
    storeId: staff.storeId,
    phone: staff.phone,
    updatedAt: staff.updatedAt.toISOString(),
  };
}

function toCreatedStaffAuditSnapshot(
  staff: Awaited<ReturnType<typeof createAdminStaff>>
) {
  return {
    userId: staff.id,
    loginId: staff.email,
    name: staff.name,
    role: staff.role,
    status: "INACTIVE" as const,
    storeId: staff.storeId,
    phone: staff.phone,
    passwordDelivery: "NONE" as const,
    activationRequired: true,
  };
}

function toCreateResult(
  staff: Awaited<ReturnType<typeof createAdminStaff>>
): AdminStaffCreateResult {
  if (staff.status !== "INACTIVE") {
    throw new Error("Created staff must be INACTIVE.");
  }

  return {
    userId: staff.id,
    name: staff.name,
    loginId: staff.email,
    role: staff.role,
    storeId: staff.storeId,
    phone: staff.phone,
    status: "INACTIVE",
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

function isPrismaKnownRequestError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function generatePlaceholderSecret() {
  return randomBytes(32).toString("base64url");
}

function isSameTimestamp(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function getChangedFields(
  input: AdminUpdateStaffInput,
  target: AdminStaffStatusSnapshot
): AdminStaffUpdateField[] {
  const changedFields: AdminStaffUpdateField[] = [];

  if (input.name !== undefined && input.name !== target.name) {
    changedFields.push("name");
  }

  if (input.role !== undefined && input.role !== target.role) {
    changedFields.push("role");
  }

  if (input.storeId !== undefined && input.storeId !== target.storeId) {
    changedFields.push("storeId");
  }

  if (input.phone !== undefined && input.phone !== target.phone) {
    changedFields.push("phone");
  }

  return changedFields;
}

function buildStaffProfileUpdateData(
  input: AdminUpdateStaffInput,
  changedFields: AdminStaffUpdateField[]
) {
  const data: {
    name?: string;
    role?: "ADMIN" | "STAFF";
    storeId?: string | null;
    phone?: string | null;
  } = {};

  if (changedFields.includes("name") && input.name !== undefined) {
    data.name = input.name;
  }

  if (changedFields.includes("role") && input.role !== undefined) {
    data.role = input.role;
  }

  if (changedFields.includes("storeId") && input.storeId !== undefined) {
    data.storeId = input.storeId;
  }

  if (changedFields.includes("phone") && input.phone !== undefined) {
    data.phone = input.phone;
  }

  return data;
}

function getEffectiveRole(
  input: AdminUpdateStaffInput,
  target: AdminStaffStatusSnapshot
) {
  return input.role ?? target.role;
}

function getEffectiveStoreId(
  input: AdminUpdateStaffInput,
  target: AdminStaffStatusSnapshot
) {
  return input.storeId !== undefined ? input.storeId : target.storeId;
}

export async function auditAdminMutationForbidden(
  session: SessionContext,
  metadata: AuthRequestMetadata,
  input: {
    route: string;
    method: string;
    attemptedAction: string;
    entityType: string;
  }
) {
  await createAuditLog(prisma, {
    actorUserId: session.userId,
    action: "ADMIN_MUTATION_FORBIDDEN",
    entityType: input.entityType,
    afterJson: {
      route: input.route,
      method: input.method,
      attemptedAction: input.attemptedAction,
      actorRole: session.role,
      actorStatus: session.status,
    },
    reason: "FORBIDDEN",
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

export async function updateAdminStaff(
  input: AdminUpdateStaffInput,
  actorSession: SessionContext,
  metadata: AuthRequestMetadata
): Promise<AdminStaffMutationResult> {
  const expectedUpdatedAt = input.expectedUpdatedAt
    ? new Date(input.expectedUpdatedAt)
    : null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const target = await findAdminStaffStatusSnapshot(tx, input.userId);

    if (!target) {
      return failure(404, "NOT_FOUND", "대상을 찾을 수 없습니다.");
    }

    const changedFields = getChangedFields(input, target);

    if (changedFields.length === 0) {
      return failure(409, "NO_CHANGE", "변경된 내용이 없습니다.");
    }

    if (
      target.id === actorSession.userId &&
      target.role === "ADMIN" &&
      input.role === "STAFF"
    ) {
      return failure(
        409,
        "SELF_STATUS_CHANGE_FORBIDDEN",
        "자기 자신의 관리자 권한은 낮출 수 없습니다."
      );
    }

    if (
      target.role === "ADMIN" &&
      target.status === "ACTIVE" &&
      input.role === "STAFF"
    ) {
      const otherActiveAdminCount = await countOtherActiveAdmins(tx, target.id);

      if (otherActiveAdminCount < 1) {
        return failure(
          409,
          "LAST_ADMIN_FORBIDDEN",
          "마지막 활성 관리자는 일반 직원으로 변경할 수 없습니다."
        );
      }
    }

    const effectiveRole = getEffectiveRole(input, target);
    const effectiveStoreId = getEffectiveStoreId(input, target);
    const assignedStore = effectiveStoreId
      ? await findAdminStaffStoreById(tx, effectiveStoreId)
      : null;

    if (effectiveRole === "STAFF") {
      if (!effectiveStoreId) {
        return failure(
          409,
          "STAFF_STORE_REQUIRED",
          "일반 직원은 활성 매장 배정이 필요합니다."
        );
      }

      if (!assignedStore || assignedStore.status !== "ACTIVE") {
        return failure(
          409,
          "STAFF_STORE_REQUIRED",
          "일반 직원은 활성 매장 배정이 필요합니다."
        );
      }
    }

    if (
      effectiveRole === "ADMIN" &&
      effectiveStoreId &&
      (!assignedStore || assignedStore.status !== "ACTIVE")
    ) {
      return failure(409, "STAFF_STORE_REQUIRED", "활성 매장을 선택해 주세요.");
    }

    if (
      expectedUpdatedAt &&
      !isSameTimestamp(expectedUpdatedAt, target.updatedAt)
    ) {
      return failure(
        409,
        "STALE_RECORD",
        "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    const updateResult = await updateAdminStaffProfile(tx, {
      userId: target.id,
      expectedUpdatedAt: target.updatedAt,
      data: buildStaffProfileUpdateData(input, changedFields),
    });

    if (updateResult.count !== 1) {
      return failure(
        409,
        "STALE_RECORD",
        "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    const shouldRevokeSessions =
      changedFields.includes("role") || changedFields.includes("storeId");
    const revokedSessions = shouldRevokeSessions
      ? await revokeActiveSessionsForUser(tx, target.id, now)
      : { count: 0 };
    const updated = await findAdminStaffStatusSnapshot(tx, target.id);

    if (!updated) {
      throw new Error("Updated staff row disappeared during transaction.");
    }

    await createAuditLog(tx, {
      actorUserId: actorSession.userId,
      action: "ADMIN_STAFF_UPDATED",
      entityType: "User",
      entityId: target.id,
      beforeJson: {
        ...toAuditStaffSnapshot(target),
        changedFields,
      },
      afterJson: {
        ...toAuditStaffSnapshot(updated),
        changedFields,
        revokedSessionCount: revokedSessions.count,
      },
      reason: "ADMIN_STAFF_UPDATED",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      statusCode: 200,
      result: {
        ok: true,
        data: {
          userId: updated.id,
          name: updated.name,
          role: updated.role,
          storeId: updated.storeId,
          phone: updated.phone,
          updatedAt: updated.updatedAt.toISOString(),
          changedFields,
          revokedSessionCount: revokedSessions.count,
        },
      },
    };
  });
}

export async function createAdminStaffUser(
  input: AdminCreateStaffInput,
  actorSession: SessionContext,
  metadata: AuthRequestMetadata
): Promise<AdminStaffMutationResult> {
  const normalizedStoreId = input.storeId ?? null;
  const normalizedPhone = input.phone ?? null;
  const passwordHash = await hashPassword(generatePlaceholderSecret());

  try {
    return await prisma.$transaction(async (tx) => {
      const duplicate = await findAdminStaffByLoginId(tx, input.loginId);

      if (duplicate) {
        return failure(
          409,
          "DUPLICATE_LOGIN_ID",
          "이미 사용 중인 아이디입니다."
        );
      }

      const assignedStore = normalizedStoreId
        ? await findAdminStaffStoreById(tx, normalizedStoreId)
        : null;

      if (input.role === "STAFF") {
        if (!normalizedStoreId) {
          return failure(
            409,
            "STAFF_STORE_REQUIRED",
            "일반 직원은 활성 매장 배정이 필요합니다."
          );
        }

        if (!assignedStore || assignedStore.status !== "ACTIVE") {
          return failure(
            409,
            "STAFF_STORE_REQUIRED",
            "일반 직원은 활성 매장 배정이 필요합니다."
          );
        }
      }

      if (
        input.role === "ADMIN" &&
        normalizedStoreId &&
        (!assignedStore || assignedStore.status !== "ACTIVE")
      ) {
        return failure(
          409,
          "STAFF_STORE_REQUIRED",
          "활성 매장을 선택해 주세요."
        );
      }

      const created = await createAdminStaff(tx, {
        name: input.name,
        loginId: input.loginId,
        passwordHash,
        role: input.role,
        storeId: normalizedStoreId,
        phone: normalizedPhone,
        status: "INACTIVE",
      });

      await createAuditLog(tx, {
        actorUserId: actorSession.userId,
        action: "ADMIN_STAFF_CREATED",
        entityType: "User",
        entityId: created.id,
        afterJson: toCreatedStaffAuditSnapshot(created),
        reason: "ADMIN_STAFF_CREATED",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return {
        statusCode: 201,
        result: {
          ok: true,
          data: toCreateResult(created),
        },
      };
    });
  } catch (error) {
    if (isPrismaKnownRequestError(error, "P2002")) {
      return failure(409, "DUPLICATE_LOGIN_ID", "이미 사용 중인 아이디입니다.");
    }

    if (isPrismaKnownRequestError(error, "P2003")) {
      return failure(409, "STAFF_STORE_REQUIRED", "활성 매장을 선택해 주세요.");
    }

    throw error;
  }
}

export async function changeAdminStaffStatus(
  input: AdminChangeStaffStatusInput,
  actorSession: SessionContext,
  metadata: AuthRequestMetadata
): Promise<AdminStaffMutationResult> {
  const expectedUpdatedAt = input.expectedUpdatedAt
    ? new Date(input.expectedUpdatedAt)
    : null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const target = await findAdminStaffStatusSnapshot(tx, input.userId);

    if (!target) {
      return failure(404, "NOT_FOUND", "대상을 찾을 수 없습니다.");
    }

    if (target.id === actorSession.userId && input.status === "INACTIVE") {
      return failure(
        409,
        "SELF_STATUS_CHANGE_FORBIDDEN",
        "자기 자신의 계정은 비활성화할 수 없습니다."
      );
    }

    if (target.status === input.status) {
      return failure(409, "INVALID_STATUS_TRANSITION", "이미 같은 상태입니다.");
    }

    if (
      target.role === "ADMIN" &&
      target.status === "ACTIVE" &&
      input.status === "INACTIVE"
    ) {
      const otherActiveAdminCount = await countOtherActiveAdmins(tx, target.id);

      if (otherActiveAdminCount < 1) {
        return failure(
          409,
          "LAST_ADMIN_FORBIDDEN",
          "마지막 활성 관리자는 비활성화할 수 없습니다."
        );
      }
    }

    if (
      expectedUpdatedAt &&
      !isSameTimestamp(expectedUpdatedAt, target.updatedAt)
    ) {
      return failure(
        409,
        "STALE_RECORD",
        "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    const updateResult = await updateAdminStaffStatus(tx, {
      userId: target.id,
      status: input.status as AdminRecordStatus,
      expectedUpdatedAt: target.updatedAt,
    });

    if (updateResult.count !== 1) {
      return failure(
        409,
        "STALE_RECORD",
        "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    const revokedSessions =
      input.status === "INACTIVE"
        ? await revokeActiveSessionsForUser(tx, target.id, now)
        : { count: 0 };
    const updated = await findAdminStaffStatusSnapshot(tx, target.id);

    if (!updated) {
      throw new Error("Updated staff row disappeared during transaction.");
    }

    await createAuditLog(tx, {
      actorUserId: actorSession.userId,
      action: "ADMIN_STAFF_STATUS_CHANGED",
      entityType: "User",
      entityId: target.id,
      beforeJson: {
        ...toAuditStaffSnapshot(target),
        reason: input.reason,
      },
      afterJson: {
        ...toAuditStaffSnapshot(updated),
        previousStatus: target.status,
        newStatus: updated.status,
        reason: input.reason,
        revokedSessionCount: revokedSessions.count,
      },
      reason: input.reason,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      statusCode: 200,
      result: {
        ok: true,
        data: {
          userId: updated.id,
          status: updated.status,
          updatedAt: updated.updatedAt.toISOString(),
          revokedSessionCount: revokedSessions.count,
        },
      },
    };
  });
}
