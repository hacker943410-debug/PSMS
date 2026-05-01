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

  const showTestAccounts = process.env.NODE_ENV !== "production";

  return (
    <section className="space-y-6 text-slate-950">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
          Phone Shop Management System
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          PSMS 업무 콘솔
        </h1>
        <p className="text-sm text-slate-600">
          영문/숫자 아이디와 비밀번호를 입력해 주세요.
        </p>
      </header>

      {showTestAccounts ? (
        <section
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
          aria-label="테스트 계정"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">로컬 테스트 계정</h2>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">
              DEV ONLY
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-xs">
            <div className="grid grid-cols-[3.5rem_1fr] gap-2">
              <dt className="font-semibold text-blue-700">ADMIN</dt>
              <dd>
                <code>admin1001</code> / <code>LocalAdmin123!</code>
              </dd>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] gap-2">
              <dt className="font-semibold text-blue-700">STAFF</dt>
              <dd>
                <code>staff1001</code> / <code>LocalStaff123!</code>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <LoginForm />
    </section>
  );
}
