import type { ReactNode } from "react";

type WorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  header?: ReactNode;
  className?: string;
};

export function WorkspaceShell({
  sidebar,
  children,
  header,
  className = "",
}: WorkspaceShellProps) {
  return (
    <div
      className={[
        "min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]",
        className,
      ].join(" ")}
    >
      <div className="hidden min-h-screen lg:block">{sidebar}</div>
      <div className="flex min-w-0 flex-col">
        {header ? (
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            {header}
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
