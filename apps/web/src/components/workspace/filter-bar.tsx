import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  quickActions?: ReactNode;
  className?: string;
};

export function FilterBar({
  children,
  actions,
  quickActions,
  className = "",
}: FilterBarProps) {
  return (
    <section
      className={[
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60",
        className,
      ].join(" ")}
    >
      <div className="grid gap-2.5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {children}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {quickActions ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {quickActions}
        </div>
      ) : null}
    </section>
  );
}
