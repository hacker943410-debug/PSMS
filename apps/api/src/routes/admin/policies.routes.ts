import type { FastifyInstance } from "fastify";
import {
  adminPolicyDetailQuerySchema,
  adminPolicyListQuerySchema,
} from "@psms/shared";

import {
  getAdminPolicyDetail,
  getAdminPolicyPageData,
} from "../../queries/admin/policies.query";
import { notFound, parseAdminQuery, requireAdminForRoute } from "./route-utils";

export async function registerAdminPolicyRoutes(app: FastifyInstance) {
  app.get("/admin/policies/page-data", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminPolicyListQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    return {
      ok: true,
      data: await getAdminPolicyPageData(query),
    };
  });

  app.get("/admin/policies/detail", async (request, reply) => {
    const guardFailure = await requireAdminForRoute(request, reply);

    if (guardFailure) {
      return guardFailure;
    }

    const query = parseAdminQuery(
      adminPolicyDetailQuerySchema,
      request.query,
      reply
    );

    if ("ok" in query) {
      return query;
    }

    const detail = await getAdminPolicyDetail(query);

    if (!detail) {
      return notFound(reply);
    }

    return {
      ok: true,
      data: detail,
    };
  });
}
