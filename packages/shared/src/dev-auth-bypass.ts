import type { SessionContext } from "./auth";

export const DEV_AUTH_BYPASS_ENV = "PSMS_DEV_AUTH_BYPASS";

export const DEV_AUTH_BYPASS_SESSION: SessionContext = {
  sessionId: "dev-auth-bypass-session",
  userId: "dev-auth-bypass-user",
  role: "ADMIN",
  storeId: null,
  loginId: "dev-admin",
  name: "Development Admin",
  status: "ACTIVE",
};

export function isDevAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env) {
  const runtimeEnv = env.NODE_ENV?.trim().toLowerCase();
  const flag = env[DEV_AUTH_BYPASS_ENV]?.trim().toLowerCase();
  const enabled = flag ? flag === "true" : runtimeEnv === "development";

  return enabled && runtimeEnv !== "production" && runtimeEnv !== "test";
}
