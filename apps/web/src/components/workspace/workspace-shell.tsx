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
        "h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#f6f7fb] text-slate-950 lg:grid lg:grid-cols-[13.625rem_minmax(0,1fr)]",
        className,
      ].join(" ")}
    >
      <div className="hidden h-[100dvh] lg:block">{sidebar}</div>
      <div className="flex min-h-0 min-w-0 flex-col">
        {header ? (
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-5 sm:py-3 lg:px-6">
            {header}
          </div>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden px-4 py-4 sm:px-5 lg:pb-4 lg:pl-[29px] lg:pr-6 lg:pt-[25px]">
          <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
