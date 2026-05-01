import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Panel({
  children,
  title,
  description,
  actions,
  footer,
  className = "",
}: PanelProps) {
  const hasHeader = title || description || actions;

  return (
    <section
      className={[
        "rounded-lg border border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold leading-6 text-slate-950">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm leading-5 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
      {footer ? (
        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
