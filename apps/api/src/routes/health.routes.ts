import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "psms-api",
    port: Number(process.env.API_PORT ?? 4273),
  }));
}
