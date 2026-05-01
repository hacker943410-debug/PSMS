import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type WorkspaceSidebarItem = {
  label: string;
  href: string;
  isActive?: boolean;
  badge?: ReactNode;
  icon?: LucideIcon;
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
        "flex h-[100dvh] min-h-[100dvh] w-full flex-col border-r border-slate-200 bg-white",
        className,
      ].join(" ")}
    >
      <div className="px-4 pb-5 pt-6">
        {brand ?? (
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-md border border-orange-200 bg-orange-50 text-sm font-black text-orange-500">
              P
            </span>
            <p className="text-lg font-bold tracking-tight text-slate-950">
              PhoneShop
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="sr-only">{section.title}</h2>
            <div className="mt-2 space-y-1">
              {section.items.map((item) => (
                <a
                  key={`${section.title}-${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={item.isActive ? "page" : undefined}
                  className={[
                    "flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    item.isActive
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {item.icon ? (
                      <item.icon className="size-4 shrink-0" aria-hidden />
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="shrink-0">{item.badge}</span>
                  ) : null}
                </a>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {footer ? <div className="px-4 pb-4">{footer}</div> : null}
    </aside>
  );
}
