import type { ReactNode } from "react";

export type TonePillTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

type TonePillProps = {
  children: ReactNode;
  tone?: TonePillTone;
  className?: string;
};

const toneClasses: Record<TonePillTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function TonePill({
  children,
  tone = "neutral",
  className = "",
}: TonePillProps) {
  return (
    <span
      className={[
        "inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-medium leading-none",
        toneClasses[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
