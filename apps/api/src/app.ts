import Fastify from "fastify";

import { registerAdminRoutes } from "./routes/admin/admin.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerHealthRoutes } from "./routes/health.routes";

export async function createApiApp() {
  const app = Fastify({
    logger:
      process.env.NODE_ENV === "production"
        ? {
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "req.body.password",
                "req.body.sessionToken",
                "sessionToken",
                "sessionTokenHash",
                "passwordHash",
              ],
              censor: "[redacted]",
            },
          }
        : false,
    bodyLimit: 1_048_576,
    trustProxy: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    reply.code(500).send({
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "요청을 처리하지 못했습니다.",
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);

  return app;
}
