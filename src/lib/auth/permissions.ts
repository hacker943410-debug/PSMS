import "server-only";

import { redirect } from "next/navigation";

import type { SessionContext, SessionRole } from "@/types/auth";

const ADMIN_ONLY_PATHS = ["/staffs", "/settings/base", "/settings/policies"];

export function requireRole(
  session: SessionContext,
  allowedRoles: SessionRole[]
) {
  if (!allowedRoles.includes(session.role)) {
    redirect("/forbidden");
  }
}

export function requireWorkspaceAccess(
  session: SessionContext,
  input: { storeId?: string | null }
) {
  if (session.role === "ADMIN") {
    return;
  }

  if (!session.storeId || !input.storeId || session.storeId !== input.storeId) {
    redirect("/forbidden");
  }
}

export function canAccessPath(session: SessionContext, pathname: string) {
  if (session.role === "ADMIN") {
    return true;
  }

  return !ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function canSeeAdminNavigation(session: SessionContext) {
  return session.role === "ADMIN";
}
