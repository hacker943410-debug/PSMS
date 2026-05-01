import type { FastifyInstance } from "fastify";
import {
  adminStaffDetailQuerySchema,
  adminStaffListQuerySchema,
} from "@psms/shared";

import {
  getAdminStaffDetail,
  getAdminStaffPageData,
  type AdminStaffDetail,
} from "../../queries/admin/staffs.query";
import { notFound, parseAdminQuery, requireAdminForRoute } from "./route-utils";

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
}
