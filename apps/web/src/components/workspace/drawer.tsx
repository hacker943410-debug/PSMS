import type { ReactNode } from "react";
import { X } from "lucide-react";

type DrawerProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeHref?: string;
  closeLabel?: string;
  className?: string;
};

export function Drawer({
  title,
  description,
  children,
  footer,
  closeHref,
  closeLabel = "Close drawer",
  className = "",
}: DrawerProps) {
  return (
    <aside
      className={[
        "flex h-[calc(100dvh-1rem)] min-h-[calc(100dvh-1rem)] w-full flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/40 xl:max-w-[20rem]",
        className,
      ].join(" ")}
      aria-label="Drawer panel"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {closeHref ? (
          <a
            href={closeHref}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden />
          </a>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? (
        <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
      ) : null}
    </aside>
  );
}
