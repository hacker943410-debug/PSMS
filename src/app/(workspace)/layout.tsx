import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { TonePill, WorkspaceShell } from "@/components/workspace";
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

  async function logoutAndRedirect() {
    "use server";

    await logoutAction();
    redirect("/login");
  }

  return (
    <WorkspaceShell
      sidebar={
        <WorkspaceNavigation
          role={session.role}
          footer={
            <div className="text-xs leading-5 text-slate-500">
              {session.name} · {session.role}
            </div>
          }
        />
      }
      header={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-700">
              PSMS Workspace
            </p>
            <p className="truncate text-xs text-slate-500">{session.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <TonePill tone={session.role === "ADMIN" ? "info" : "success"}>
              {session.role}
            </TonePill>
            <form action={logoutAndRedirect}>
              <button
                type="submit"
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
