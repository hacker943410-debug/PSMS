import type { ReactNode } from "react";

export type WorkspaceSidebarItem = {
  label: string;
  href: string;
  isActive?: boolean;
  badge?: ReactNode;
};

export type WorkspaceSidebarSection = {
  title: string;
  items: WorkspaceSidebarItem[];
};

type WorkspaceSidebarProps = {
  sections: WorkspaceSidebarSection[];
  brand?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function WorkspaceSidebar({
  sections,
  brand,
  footer,
  className = "",
}: WorkspaceSidebarProps) {
  return (
    <aside
      className={[
        "flex h-full w-full flex-col border-r border-slate-200 bg-white",
        className,
      ].join(" ")}
    >
      <div className="border-b border-slate-200 px-5 py-5">
        {brand ?? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              PSMS
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              Phone Shop Console
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </h2>
            <div className="mt-2 space-y-1">
              {section.items.map((item) => (
                <a
                  key={`${section.title}-${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={item.isActive ? "page" : undefined}
                  className={[
                    "flex min-h-10 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    item.isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="shrink-0">{item.badge}</span>
                  ) : null}
                </a>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {footer ? (
        <div className="border-t border-slate-200 px-5 py-4">{footer}</div>
      ) : null}
    </aside>
  );
}
