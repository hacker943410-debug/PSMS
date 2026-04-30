import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { LoginForm } from "./_components/login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PSMS 로그인",
  description: "PSMS 로그인",
};

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/");
  }

  return (
    <section className="space-y-6 text-slate-950">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Phone Shop Management System
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          PSMS 업무 콘솔
        </h1>
        <p className="text-sm text-slate-600">
          계정 및 비밀번호를 입력해 주세요.
        </p>
      </header>

      <LoginForm />
    </section>
  );
}
