import Link from "next/link";

export const metadata = {
  title: "접근 권한 없음",
};

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md space-y-4 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">403</p>
        <h1 className="text-2xl font-semibold">접근 권한이 없습니다</h1>
        <p className="text-sm leading-6 text-slate-600">
          현재 계정으로는 요청한 업무 화면을 열 수 없습니다.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          대시보드로 이동
        </Link>
      </section>
    </main>
  );
}
