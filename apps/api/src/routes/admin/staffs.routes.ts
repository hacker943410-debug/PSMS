import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  adminCreateStaffInputSchema,
  adminChangeStaffStatusInputSchema,
  adminStaffDetailQuerySchema,
  adminStaffListQuerySchema,
  adminUpdateStaffInputSchema,
} from "@psms/shared";

import { requireAdminSession } from "../../auth/admin-session.guard";
import {
  getAdminStaffDetail,
  getAdminStaffPageData,
} from "../../queries/admin/staffs.query";
import {
  getAdminRequestMetadata,
  notFound,
  parseAdminBody,
  parseAdminQuery,
  requireAdminForRoute,
} from "./route-utils";
import {
  auditAdminMutationForbidden,
  changeAdminStaffStatus,
  createAdminStaffUser,
  updateAdminStaff,
} from "../../services/admin/staffs.service";

const staffMutationRoutes = {
  changeStatus: "/admin/staffs/change-status",
  create: "/admin/staffs/create",
  update: "/admin/staffs/update",
} as const;

async function requireAdminForStaffMutation(
  request: FastifyRequest,
  reply: FastifyReply,
  input: {
    route: string;
    attemptedAction: string;
  }
) {
  const metadata = getAdminRequestMetadata(request);
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

export async function registerAdminStaffRoutes(app: FastifyInstance) {
  app.get("/admin/staffs/page-data", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminStaffListQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    return {
      ok: true,
      data: await getAdminStaffPageData(query),
    };
  });

  app.get("/admin/staffs/detail", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminStaffDetailQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    const detail = await getAdminStaffDetail(query);

    if (!detail) {
      return notFound(reply);
    }

    return {
      ok: true,
      data: detail,
    };
  });

  app.post("/admin/staffs/change-status", async (request, reply) => {
    const guard = await requireAdminForStaffMutation(request, reply, {
      route: staffMutationRoutes.changeStatus,
      attemptedAction: "ADMIN_STAFF_STATUS_CHANGED",
    });

    if (!guard.ok) {
      return guard.result;
    }

    const input = parseAdminBody(
      adminChangeStaffStatusInputSchema,
      request.body,
      reply
    );

    if ("ok" in input) {
      return input;
    }

    const result = await changeAdminStaffStatus(
      input,
      guard.session,
      guard.metadata
    );

    reply.code(result.statusCode);

    return result.result;
  });

  app.post("/admin/staffs/update", async (request, reply) => {
    const guard = await requireAdminForStaffMutation(request, reply, {
      route: staffMutationRoutes.update,
      attemptedAction: "ADMIN_STAFF_UPDATED",
    });

    if (!guard.ok) {
      return guard.result;
    }

    const input = parseAdminBody(
      adminUpdateStaffInputSchema,
      request.body,
      reply
    );

    if ("ok" in input) {
      return input;
    }

    const result = await updateAdminStaff(input, guard.session, guard.metadata);

    reply.code(result.statusCode);

    return result.result;
  });

  app.post("/admin/staffs/create", async (request, reply) => {
    const guard = await requireAdminForStaffMutation(request, reply, {
      route: staffMutationRoutes.create,
      attemptedAction: "ADMIN_STAFF_CREATED",
    });

    if (!guard.ok) {
      return guard.result;
    }

    const input = parseAdminBody(
      adminCreateStaffInputSchema,
      request.body,
      reply
    );

    if ("ok" in input) {
      return input;
    }

    const result = await createAdminStaffUser(
      input,
      guard.session,
      guard.metadata
    );

    reply.code(result.statusCode);

    return result.result;
  });
}
