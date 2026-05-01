"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { loginAction } from "@/server/actions/auth.actions";

type LoginFieldErrors = {
  loginId?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const loginId = String(formData.get("loginId") ?? "");
    const password = String(formData.get("password") ?? "");

    setMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await loginAction({ loginId, password });

      if (result.ok) {
        router.replace(result.data?.redirectTo ?? result.redirectTo ?? "/");
        router.refresh();
        return;
      }

      setMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form
      className="space-y-4"
      aria-describedby="login-status"
      onSubmit={handleSubmit}
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-800">아이디</span>
        <input
          type="text"
          name="loginId"
          inputMode="text"
          pattern="[A-Za-z0-9]+"
          autoComplete="username"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2"
          placeholder="admin1001"
          aria-invalid={fieldErrors.loginId ? "true" : undefined}
          aria-describedby={fieldErrors.loginId ? "login-id-error" : undefined}
        />
        {fieldErrors.loginId ? (
          <span id="login-id-error" className="block text-xs text-red-700">
            {fieldErrors.loginId}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-800">비밀번호</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2"
          placeholder="비밀번호"
          aria-invalid={fieldErrors.password ? "true" : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        {fieldErrors.password ? (
          <span id="password-error" className="block text-xs text-red-700">
            {fieldErrors.password}
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "로그인 중" : "로그인"}
      </button>

      <p
        id="login-status"
        className={message ? "text-sm text-red-700" : "sr-only"}
        aria-live="polite"
      >
        {message ?? "로그인 상태 메시지"}
      </p>
    </form>
  );
}
