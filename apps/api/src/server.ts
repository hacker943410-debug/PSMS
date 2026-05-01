import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const apiSourceDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(apiSourceDir, "../../..");

config({ path: resolve(workspaceRoot, ".env") });
config({ path: resolve(workspaceRoot, ".env.example") });

const { createApiApp } = await import("./app");

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 4273);
const app = await createApiApp();

await app.listen({ host, port });
