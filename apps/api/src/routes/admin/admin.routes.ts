import type { FastifyInstance } from "fastify";

import { registerAdminBaseRoutes } from "./base.routes";
import { registerAdminPolicyRoutes } from "./policies.routes";
import { registerAdminStaffCredentialRoutes } from "./staff-credentials.routes";
import { registerAdminStaffRoutes } from "./staffs.routes";

export async function registerAdminRoutes(app: FastifyInstance) {
  await registerAdminStaffRoutes(app);
  await registerAdminStaffCredentialRoutes(app);
  await registerAdminBaseRoutes(app);
  await registerAdminPolicyRoutes(app);
}
