import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionByTokenHash } from "@/server/services/auth.service";
import type { SessionContext } from "@/types/auth";
import { SESSION_COOKIE_NAME, hashSessionToken } from "./session-token";

export async function getCurrentSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getSessionByTokenHash(hashSessionToken(sessionToken));
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
