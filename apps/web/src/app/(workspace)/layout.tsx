import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LogOut, Store } from "lucide-react";
import { isDevAuthBypassEnabled } from "@psms/shared/dev-auth-bypass";
import { Button, WorkspaceShell } from "@/components/workspace";
import { WorkspaceNavigation } from "@/app/(workspace)/_components/workspace-navigation";
import { requireSession } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/auth.actions";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireSession();
  const isAuthBypassed = isDevAuthBypassEnabled();

  async function logoutAndRedirect() {
    "use server";

    await logoutAction();
    redirect("/login");
  }

  const storeLabel = session.storeId
    ? `매장 ID ${session.storeId}`
    : "전체 매장";

  return (
    <WorkspaceShell
      sidebar={
        <WorkspaceNavigation
          role={session.role}
          footer={
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">현재 매장</p>
                <p className="mt-1 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                  <span className="truncate">{storeLabel}</span>
                  <Store className="size-4 text-slate-400" aria-hidden />
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-white">
                    {session.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {session.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {session.loginId}
                    </p>
                  </div>
                </div>
                {isAuthBypassed ? null : (
                  <form action={logoutAndRedirect} className="mt-4">
                    <Button
                      type="submit"
                      variant="ghost"
                      icon={LogOut}
                      className="w-full justify-start px-0"
                    >
                      로그아웃
                    </Button>
                  </form>
                )}
              </div>
            </div>
          }
        />
      }
    >
      {children}
    </WorkspaceShell>
  );
}
