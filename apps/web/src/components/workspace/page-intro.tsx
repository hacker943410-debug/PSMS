import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className = "",
}: PageIntroProps) {
  return (
    <header
      className={[
        "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold leading-8 tracking-normal text-slate-950 sm:text-3xl sm:leading-9">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-2 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
