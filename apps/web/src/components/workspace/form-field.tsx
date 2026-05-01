import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type FormFieldProps = {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function FormField({
  label,
  required = false,
  children,
  hint,
  className = "",
}: FormFieldProps) {
  return (
    <label className={["block min-w-0", className].join(" ")}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({
  className = "",
  suppressHydrationWarning,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      suppressHydrationWarning={
        suppressHydrationWarning ?? (props.readOnly ? true : undefined)
      }
      className={[
        "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function SelectInput({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={[
        "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </select>
  );
}
