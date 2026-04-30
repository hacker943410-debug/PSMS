import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function AuthLayout({ children }: Props) {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
