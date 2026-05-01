import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { TonePillTone } from "./tone-pill";
import { TonePill } from "./tone-pill";

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
  tone?: TonePillTone;
  icon?: LucideIcon;
  className?: string;
};

export function MetricCard({
  label,
  value,
  helper,
  trend,
  tone = "neutral",
  icon: Icon,
  className = "",
}: MetricCardProps) {
  const iconToneClasses: Record<TonePillTone, string> = {
    neutral: "bg-slate-100 text-slate-500",
    success: "bg-emerald-100 text-emerald-600",
    warning: "bg-amber-100 text-amber-600",
    danger: "bg-rose-100 text-rose-600",
    info: "bg-blue-100 text-blue-600",
  };

  return (
    <article
      className={[
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <span
            className={[
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              iconToneClasses[tone],
            ].join(" ")}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold leading-4 text-slate-500">
              {label}
            </p>
            {trend ? <TonePill tone={tone}>{trend}</TonePill> : null}
          </div>
          <p className="mt-1 whitespace-nowrap text-xl font-bold leading-7 tracking-normal text-slate-950">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-xs leading-4 text-slate-500">{helper}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
