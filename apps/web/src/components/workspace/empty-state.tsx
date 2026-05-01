import type { ReactNode } from "react";

export type EmptyStateTone =
  | "neutral"
  | "info"
  | "warning"
  | "error"
  | "success";

type EmptyStateToneStyles = Record<
  EmptyStateTone,
  {
    container: string;
    iconWrap: string;
    icon: string;
    title: string;
    description: string;
  }
>;

const toneStyles: EmptyStateToneStyles = {
  neutral: {
    container: "border-slate-200 bg-slate-50 text-slate-600",
    iconWrap: "bg-slate-100 text-slate-500",
    icon: "text-slate-600",
    title: "text-slate-900",
    description: "text-slate-500",
  },
  info: {
    container: "border-sky-200 bg-sky-50 text-sky-700",
    iconWrap: "bg-sky-100 text-sky-600",
    icon: "text-sky-600",
    title: "text-sky-900",
    description: "text-sky-700",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-700",
    iconWrap: "bg-amber-100 text-amber-600",
    icon: "text-amber-600",
    title: "text-amber-900",
    description: "text-amber-700",
  },
  error: {
    container: "border-rose-200 bg-rose-50 text-rose-700",
    iconWrap: "bg-rose-100 text-rose-600",
    icon: "text-rose-600",
    title: "text-rose-900",
    description: "text-rose-700",
  },
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconWrap: "bg-emerald-100 text-emerald-600",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    description: "text-emerald-700",
  },
};

export interface EmptyStateProps {
  title?: string;
  description?: string;
  tone?: EmptyStateTone;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No items",
  description = "There are no items to display.",
  tone = "neutral",
  icon,
  className = "",
}: EmptyStateProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={`w-full rounded-lg border p-4 text-sm ${styles.container} ${className}`}
      role="status"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
        {icon ? (
          <span
            aria-hidden
            className={`grid h-8 w-8 place-items-center rounded-full ${styles.iconWrap}`}
          >
            <span className={`h-5 w-5 ${styles.icon}`}>{icon}</span>
          </span>
        ) : null}
        <h3 className={`text-xs font-semibold ${styles.title}`}>{title}</h3>
        <p className={`text-xs ${styles.description}`}>{description}</p>
      </div>
    </div>
  );
}
