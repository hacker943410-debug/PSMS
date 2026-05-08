import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, LogIn, ShieldCheck } from "lucide-react";

import { verifyCredentialTokenViaApi } from "@/lib/credential-token-api";
import {
  completePasswordResetAction,
  completeStaffActivationAction,
} from "@/server/actions/credential-token.actions";
import { CredentialTokenForm } from "./credential-token-form";
import type { CredentialTokenPurpose } from "@psms/shared";
import {
  getCredentialTokenCompletionCookieConfig,
  getCredentialTokenCookieConfig,
  normalizeCredentialUrlToken,
} from "@/lib/credential-token-cookie";
import { verifyCredentialTokenCompletionMarker } from "@/lib/credential-token-completion";

type CredentialTokenPageProps = {
  purpose: CredentialTokenPurpose;
};

function purposeCopy(purpose: CredentialTokenPurpose) {
  if (purpose === "STAFF_ACTIVATION") {
    return {
      eyebrow: "Staff Activation",
      title: "직원 계정 활성화",
      body: "계정 확인이 완료되었습니다.",
    };
  }

  return {
    eyebrow: "Password Reset",
    title: "비밀번호 재설정",
    body: "계정 확인이 완료되었습니다.",
  };
}

function safeFailureMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    VALIDATION_FAILED: "요청 링크를 확인할 수 없습니다.",
    INVALID_CREDENTIAL_TOKEN: "요청 링크가 만료되었거나 이미 사용되었습니다.",
    CREDENTIAL_TOKEN_UNAVAILABLE: "계정 접근 요청을 처리할 수 없습니다.",
    RATE_LIMITED: "요청 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
    API_UNAVAILABLE: "API 서버에 연결할 수 없습니다.",
    API_INVALID_RESPONSE: "API 응답을 확인할 수 없습니다.",
  };

  return messages[code ?? ""] ?? "요청을 처리할 수 없습니다.";
}

function successTitle(purpose: CredentialTokenPurpose) {
  return purpose === "STAFF_ACTIVATION"
    ? "계정 활성화가 완료되었습니다."
    : "비밀번호 재설정이 완료되었습니다.";
}

function MissingOrInvalidToken({ message }: { message: string }) {
  return (
    <section className="space-y-5 text-slate-950">
      <div className="flex size-12 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">요청 링크 확인 필요</h1>
        <p className="text-sm leading-6 text-slate-600">{message}</p>
      </div>
      <Link
        href="/login"
        className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/70 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
      >
        로그인으로 이동
      </Link>
    </section>
  );
}

function CredentialTokenSuccess({
  purpose,
}: {
  purpose: CredentialTokenPurpose;
}) {
  return (
    <section className="space-y-5 text-slate-950">
      <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <ShieldCheck className="size-6" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{successTitle(purpose)}</h1>
        <p className="text-sm leading-6 text-slate-600">
          새 비밀번호로 로그인할 수 있습니다.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2"
      >
        <LogIn className="size-4" aria-hidden />
        <span>로그인으로 이동</span>
      </Link>
    </section>
  );
}

async function getStoredCredentialToken(purpose: CredentialTokenPurpose) {
  const cookieStore = await cookies();
  const { cookieName } = getCredentialTokenCookieConfig(purpose);

  return normalizeCredentialUrlToken(cookieStore.get(cookieName)?.value);
}

async function getStoredCompletionFlag(purpose: CredentialTokenPurpose) {
  const cookieStore = await cookies();
  const { cookieName } = getCredentialTokenCompletionCookieConfig(purpose);

  return verifyCredentialTokenCompletionMarker(
    purpose,
    cookieStore.get(cookieName)?.value
  );
}

export async function CredentialTokenPage({
  purpose,
}: CredentialTokenPageProps) {
  const copy = purposeCopy(purpose);
  const token = await getStoredCredentialToken(purpose);

  if (!token) {
    if (await getStoredCompletionFlag(purpose)) {
      return <CredentialTokenSuccess purpose={purpose} />;
    }

    return <MissingOrInvalidToken message="요청 링크를 확인할 수 없습니다." />;
  }

  const result = await verifyCredentialTokenViaApi(purpose, { token });

  if (result.ok === false) {
    return <MissingOrInvalidToken message={safeFailureMessage(result.code)} />;
  }

  if (!result.data) {
    return <MissingOrInvalidToken message="요청을 처리할 수 없습니다." />;
  }

  const completeAction =
    purpose === "STAFF_ACTIVATION"
      ? completeStaffActivationAction
      : completePasswordResetAction;

  return (
    <section className="space-y-6 text-slate-950">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <ShieldCheck className="size-4" aria-hidden />
          <span>{copy.eyebrow}</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">{copy.title}</h1>
        <p className="text-sm leading-6 text-slate-600">{copy.body}</p>
      </header>

      <CredentialTokenForm
        action={completeAction}
        preview={result.data}
        purpose={purpose}
      />
    </section>
  );
}
