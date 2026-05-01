import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
  secondary:
    "border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-200/70 hover:bg-slate-50",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
};

export function Button({
  variant = "secondary",
  icon: Icon,
  trailingIcon: TrailingIcon,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      <span>{children}</span>
      {TrailingIcon ? <TrailingIcon className="size-4" aria-hidden /> : null}
    </button>
  );
}
