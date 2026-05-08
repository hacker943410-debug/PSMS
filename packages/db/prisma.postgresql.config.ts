import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: "../../.env" });
config({ path: "../../.env.example" });

export default defineConfig({
  schema: "prisma/schema.postgresql.prisma",
  migrations: {
    path: "prisma/postgresql-migrations",
  },
  datasource: {
    url: env("PSMS_PG_REHEARSAL_DATABASE_URL"),
  },
});
