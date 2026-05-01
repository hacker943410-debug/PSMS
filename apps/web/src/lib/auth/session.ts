import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionContext } from "@psms/shared";
import { SESSION_COOKIE_NAME } from "@psms/shared/session-token";

import { getSessionViaApi } from "@/lib/api-client";

export async function getCurrentSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getSessionViaApi(sessionToken);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
