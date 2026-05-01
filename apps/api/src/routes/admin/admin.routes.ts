import type { FastifyInstance } from "fastify";

import { registerAdminBaseRoutes } from "./base.routes";
import { registerAdminPolicyRoutes } from "./policies.routes";
import { registerAdminStaffRoutes } from "./staffs.routes";

export async function registerAdminRoutes(app: FastifyInstance) {
  await registerAdminStaffRoutes(app);
  await registerAdminBaseRoutes(app);
  await registerAdminPolicyRoutes(app);
}
