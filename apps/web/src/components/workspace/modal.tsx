import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeHref?: string;
  closeLabel?: string;
  className?: string;
};

export function Modal({
  title,
  description,
  children,
  footer,
  closeHref,
  closeLabel = "모달 닫기",
  className = "",
}: ModalProps) {
  return (
    <section
      className={[
        "rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-300/40",
        className,
      ].join(" ")}
      aria-label="모달"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">
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
      <div className="px-5 py-5">{children}</div>
      {footer ? (
        <div className="border-t border-slate-200 px-5 py-4">{footer}</div>
      ) : null}
    </section>
  );
}
