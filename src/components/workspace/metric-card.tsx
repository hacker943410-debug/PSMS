import type { ReactNode } from "react";
import type { TonePillTone } from "./tone-pill";
import { TonePill } from "./tone-pill";

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
  tone?: TonePillTone;
  className?: string;
};

export function MetricCard({
  label,
  value,
  helper,
  trend,
  tone = "neutral",
  className = "",
}: MetricCardProps) {
  return (
    <article
      className={[
        "rounded-lg border border-slate-200 bg-white p-5 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-slate-600">{label}</p>
        {trend ? <TonePill tone={tone}>{trend}</TonePill> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold leading-8 text-slate-950">
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-sm leading-5 text-slate-500">{helper}</p>
      ) : null}
    </article>
  );
}
