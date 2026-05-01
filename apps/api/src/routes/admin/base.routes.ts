import type { FastifyInstance } from "fastify";
import {
  adminBaseDetailQuerySchema,
  adminBaseListQuerySchema,
} from "@psms/shared";

import {
  getAdminBaseDetail,
  getAdminBasePageData,
} from "../../queries/admin/base.query";
import { notFound, parseAdminQuery, requireAdminForRoute } from "./route-utils";

export async function registerAdminBaseRoutes(app: FastifyInstance) {
  app.get("/admin/base/page-data", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminBaseListQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    return {
      ok: true,
      data: await getAdminBasePageData(query),
    };
  });

  app.get("/admin/base/detail", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminBaseDetailQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    const detail = await getAdminBaseDetail(query);

    if (!detail) {
      return notFound(reply);
    }

    return {
      ok: true,
      data: detail,
    };
  });
}
