"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, LogIn, ShieldCheck } from "lucide-react";

import { Button } from "@/components/workspace";
import type { CredentialTokenActionState } from "@/server/actions/credential-token.actions";
import type {
  CredentialTokenPreview,
  CredentialTokenPurpose,
} from "@psms/shared";

type CredentialTokenFormProps = {
  action: (
    state: CredentialTokenActionState,
    formData: FormData
  ) => Promise<CredentialTokenActionState>;
  preview: CredentialTokenPreview;
  purpose: CredentialTokenPurpose;
};

const initialState: CredentialTokenActionState = {
  ok: false,
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function purposeCopy(purpose: CredentialTokenPurpose) {
  if (purpose === "STAFF_ACTIVATION") {
    return {
      submit: "계정 활성화",
      pending: "활성화 중",
      success: "계정 활성화가 완료되었습니다.",
    };
  }

  return {
    submit: "비밀번호 재설정",
    pending: "재설정 중",
    success: "비밀번호 재설정이 완료되었습니다.",
  };
}

function MessageBox({ state }: { state: CredentialTokenActionState }) {
  if (!state.message) {
    return (
      <p id="status" className="sr-only" aria-live="polite">
        계정 접근 요청 처리 상태
      </p>
    );
  }

  return (
    <div
      className={[
        "rounded-lg border px-4 py-3 text-sm font-semibold",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
      id="status"
      aria-live="polite"
    >
      {state.message}
    </div>
  );
}

export function CredentialTokenForm({
  action,
  preview,
  purpose,
}: CredentialTokenFormProps) {
  const copy = purposeCopy(purpose);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.ok) {
    return (
      <section className="space-y-5 text-slate-950">
        <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <ShieldCheck className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{copy.success}</h2>
          <p className="text-sm leading-6 text-slate-600">
            새 비밀번호로 로그인할 수 있습니다.
          </p>
        </div>
        <Link
          href={state.redirectTo ?? "/login"}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2"
        >
          <LogIn className="size-4" aria-hidden />
          <span>로그인으로 이동</span>
        </Link>
      </section>
    );
  }

  return (
    <form action={formAction} className="space-y-5" aria-describedby="status">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm shadow-slate-200/70">
            <KeyRound className="size-5" aria-hidden />
          </div>
          <dl className="grid min-w-0 gap-2 text-sm">
            <div className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="font-semibold text-slate-500">대상</dt>
              <dd className="truncate font-semibold text-slate-900">
                {preview.name}
              </dd>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="font-semibold text-slate-500">아이디</dt>
              <dd className="truncate text-slate-700">{preview.loginId}</dd>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="font-semibold text-slate-500">만료</dt>
              <dd className="truncate text-slate-700">
                {formatDateTime(preview.expiresAt)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-800">
          새 비밀번호
        </span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={preview.passwordPolicy.minLength}
          maxLength={preview.passwordPolicy.maxLength}
          disabled={isPending}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400"
          aria-invalid={state.fieldErrors?.password ? "true" : undefined}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
        />
        {state.fieldErrors?.password ? (
          <span id="password-error" className="block text-xs text-rose-700">
            {state.fieldErrors.password}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-800">
          새 비밀번호 확인
        </span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          disabled={isPending}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400"
          aria-invalid={state.fieldErrors?.confirmPassword ? "true" : undefined}
          aria-describedby={
            state.fieldErrors?.confirmPassword
              ? "confirm-password-error"
              : undefined
          }
        />
        {state.fieldErrors?.confirmPassword ? (
          <span
            id="confirm-password-error"
            className="block text-xs text-rose-700"
          >
            {state.fieldErrors.confirmPassword}
          </span>
        ) : null}
      </label>

      <p className="text-xs leading-5 text-slate-500">
        {preview.passwordPolicy.minLength}자 이상, 영문 대/소문자, 숫자,
        특수문자 중 3종류 이상
      </p>

      <MessageBox state={state} />

      <Button
        type="submit"
        variant="primary"
        trailingIcon={ArrowRight}
        disabled={isPending}
        className="!h-10 !w-full"
      >
        {isPending ? copy.pending : copy.submit}
      </Button>
    </form>
  );
}
