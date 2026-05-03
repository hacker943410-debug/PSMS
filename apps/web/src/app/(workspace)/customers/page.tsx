import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Search,
  Smartphone,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button, SelectInput, TextInput } from "@/components/workspace";

type CustomerGrade = "VIP" | "일반" | "잠재" | "주의";

type CustomerRow = {
  name: string;
  grade: CustomerGrade;
  phone: string;
  lastSaleAt: string;
  carrier: "SKT" | "KT" | "LG U+";
  plan: string;
  remainingInstallment: string;
  receivable: string;
};

type DetailMetric = {
  label: string;
  value: ReactNode;
  helper: ReactNode;
  tone: "success" | "info" | "warning" | "purple" | "danger";
  icon: LucideIcon;
};

const customers: CustomerRow[] = [
  {
    name: "김민수",
    grade: "VIP",
    phone: "010-1234-5678",
    lastSaleAt: "2025-05-20",
    carrier: "SKT",
    plan: "5GX 프라임",
    remainingInstallment: "312,000원",
    receivable: "120,000원",
  },
  {
    name: "이서연",
    grade: "일반",
    phone: "010-2345-6789",
    lastSaleAt: "2025-05-18",
    carrier: "KT",
    plan: "5G 슬림",
    remainingInstallment: "0원",
    receivable: "-",
  },
  {
    name: "박지훈",
    grade: "일반",
    phone: "010-3456-7890",
    lastSaleAt: "2025-05-15",
    carrier: "LG U+",
    plan: "5G 스탠다드",
    remainingInstallment: "188,000원",
    receivable: "-",
  },
  {
    name: "최유리",
    grade: "잠재",
    phone: "010-4567-8901",
    lastSaleAt: "2025-05-10",
    carrier: "SKT",
    plan: "0 청년 69",
    remainingInstallment: "640,000원",
    receivable: "80,000원",
  },
  {
    name: "정태훈",
    grade: "일반",
    phone: "010-5678-9012",
    lastSaleAt: "2025-05-08",
    carrier: "KT",
    plan: "데이터 ON 비디오",
    remainingInstallment: "0원",
    receivable: "-",
  },
  {
    name: "한예림",
    grade: "VIP",
    phone: "010-6789-0123",
    lastSaleAt: "2025-05-05",
    carrier: "LG U+",
    plan: "U+ 스마일 플랜",
    remainingInstallment: "251,000원",
    receivable: "-",
  },
  {
    name: "오준석",
    grade: "일반",
    phone: "010-7890-1234",
    lastSaleAt: "2025-04-28",
    carrier: "SKT",
    plan: "5GX 프라임",
    remainingInstallment: "96,000원",
    receivable: "-",
  },
  {
    name: "권민아",
    grade: "주의",
    phone: "010-8901-2345",
    lastSaleAt: "2025-04-25",
    carrier: "KT",
    plan: "Y 슈퍼플랜",
    remainingInstallment: "407,000원",
    receivable: "45,000원",
  },
  {
    name: "이동현",
    grade: "일반",
    phone: "010-9012-3456",
    lastSaleAt: "2025-04-20",
    carrier: "LG U+",
    plan: "5G 라이트",
    remainingInstallment: "0원",
    receivable: "-",
  },
  {
    name: "조하나",
    grade: "일반",
    phone: "010-0123-4567",
    lastSaleAt: "2025-04-18",
    carrier: "SKT",
    plan: "0 틴 49",
    remainingInstallment: "128,000원",
    receivable: "-",
  },
];

const saleRows = [
  {
    date: "2025-05-20",
    product: "갤럭시 S25 울트라 (256G)",
    carrier: "SKT",
    plan: "5GX 프라임",
    term: "24 개월",
    amount: "1,529,000원",
    status: "판매",
  },
  {
    date: "2024-11-20",
    product: "갤럭시 Z Flip6 (256G)",
    carrier: "SKT",
    plan: "5GX 프라임",
    term: "24 개월",
    amount: "1,353,000원",
    status: "완납",
  },
  {
    date: "2023-08-15",
    product: "에어팟 프로 2세대",
    carrier: "-",
    plan: "-",
    term: "일시불",
    amount: "359,000원",
    status: "완납",
  },
  {
    date: "2022-06-10",
    product: "갤럭시 S22 (128G)",
    carrier: "SKT",
    plan: "5GX 스탠다드",
    term: "24 개월",
    amount: "891,000원",
    status: "완납",
  },
];

const memoRows = [
  {
    date: "2025-05-20 15:30",
    type: "요금제 변경 상담",
    memo: "5GX 프라임 유지, 부가서비스 정리 요청",
    owner: "김민수 매니저",
  },
  {
    date: "2025-05-05 11:20",
    type: "미수 안내",
    memo: "5월 미수금 120,000원 안내, 5/25 입금 예정",
    owner: "김민수 매니저",
  },
  {
    date: "2022-04-10 16:40",
    type: "기기 변경 상담",
    memo: "S25 울트라 사전예약 상담 진행",
    owner: "김민수 매니저",
  },
];

const detailMetrics: DetailMetric[] = [
  {
    label: "현재 계약 상태",
    value: "정상 유지",
    helper: "2024.11.20 개통",
    tone: "success",
    icon: CheckCircle2,
  },
  {
    label: "월 요금제",
    value: "89,000원",
    helper: "5GX 프라임",
    tone: "info",
    icon: Smartphone,
  },
  {
    label: "잔여 할부금",
    value: "312,000원",
    helper: "(6개월 남음)",
    tone: "warning",
    icon: FileText,
  },
  {
    label: "최근 판매",
    value: "2025-05-20",
    helper: "갤럭시 S25 울트라",
    tone: "purple",
    icon: ImageIcon,
  },
  {
    label: "미수 현황",
    value: "120,000원",
    helper: (
      <span className="rounded-md bg-rose-50 px-2 py-1 font-bold text-rose-600">
        연체 12일
      </span>
    ),
    tone: "danger",
    icon: WalletCards,
  },
];

const gradeClasses: Record<CustomerGrade, string> = {
  VIP: "bg-blue-100 text-blue-700",
  일반: "bg-emerald-50 text-emerald-700",
  잠재: "bg-orange-50 text-orange-700",
  주의: "bg-amber-50 text-amber-700",
};

const metricToneClasses: Record<DetailMetric["tone"], string> = {
  success: "bg-green-100 text-green-600",
  info: "bg-blue-100 text-blue-600",
  warning: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  danger: "bg-rose-100 text-rose-600",
};

function GradeBadge({ grade }: { grade: CustomerGrade }) {
  return (
    <span
      className={[
        "inline-flex h-6 items-center justify-center rounded-md px-2 text-xs font-bold leading-none",
        gradeClasses[grade],
      ].join(" ")}
    >
      {grade}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex h-6 min-w-[40px] items-center justify-center rounded-md bg-emerald-50 px-2 text-xs font-bold text-emerald-700">
      {status}
    </span>
  );
}

function CustomersFilter() {
  return (
    <section className="h-[86px] shrink-0 rounded-lg border border-slate-200 bg-white px-5 py-[18px] shadow-sm shadow-slate-200/60">
      <div className="grid grid-cols-[170px_repeat(4,minmax(92px,1fr))] items-end gap-4 text-xs font-semibold text-slate-600">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <TextInput
            placeholder="고객명/연락처 검색"
            className="!h-9 !pr-9 !text-xs"
          />
        </label>
        <label className="space-y-1">
          <span>매장</span>
          <SelectInput defaultValue="all" className="!h-9 !text-xs">
            <option value="all">전체 매장</option>
          </SelectInput>
        </label>
        <label className="space-y-1">
          <span>통신사</span>
          <SelectInput defaultValue="all" className="!h-9 !text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
        <label className="space-y-1">
          <span>계약 상태</span>
          <SelectInput defaultValue="all" className="!h-9 !text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
        <label className="space-y-1">
          <span>미수 상태</span>
          <SelectInput defaultValue="all" className="!h-9 !text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
      </div>
    </section>
  );
}

function CustomersTable() {
  return (
    <section className="mt-5 flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 [height:clamp(500px,calc(100dvh-304px),687px)]">
      <div className="flex h-[58px] shrink-0 items-center px-5">
        <h2 className="text-base font-bold text-slate-950">
          전체 고객 <span className="text-blue-600">1,248명</span>
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3">
        <table className="w-[950px] table-fixed text-xs">
          <colgroup>
            <col className="w-12" />
            <col className="w-[149px]" />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
            <col className="w-[100px]" />
            <col className="w-[170px]" />
            <col className="w-[130px]" />
            <col className="w-[103px]" />
          </colgroup>
          <thead>
            <tr className="h-12 border-y border-slate-100 bg-slate-50 text-slate-500">
              <th className="text-center">
                <input
                  type="checkbox"
                  aria-label="고객 체크"
                  className="size-4 rounded border-slate-200"
                />
              </th>
              <th className="px-1 text-left font-bold">고객명</th>
              <th className="px-1 text-left font-bold">연락처</th>
              <th className="px-1 text-left font-bold">최근 판매일</th>
              <th className="px-1 text-left font-bold">통신사</th>
              <th className="px-1 text-left font-bold">현재 요금제</th>
              <th className="px-1 text-right font-bold">잔여 할부금</th>
              <th className="px-1 text-right font-bold">미수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {customers.map((customer) => (
              <tr
                key={customer.phone}
                className="h-[51px] bg-white font-medium"
              >
                <td className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`${customer.name} 고객 체크`}
                    className="size-4 rounded border-slate-200"
                  />
                </td>
                <td className="truncate px-1">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-bold text-slate-700">
                      {customer.name}
                    </span>
                    <GradeBadge grade={customer.grade} />
                  </span>
                </td>
                <td className="truncate px-1">{customer.phone}</td>
                <td className="truncate px-1">{customer.lastSaleAt}</td>
                <td className="truncate px-1">{customer.carrier}</td>
                <td className="truncate px-1">{customer.plan}</td>
                <td className="truncate px-1 text-right">
                  {customer.remainingInstallment}
                </td>
                <td
                  className={[
                    "truncate px-1 text-right",
                    customer.receivable !== "-"
                      ? "font-bold text-rose-500"
                      : "",
                  ].join(" ")}
                >
                  {customer.receivable}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid h-[58px] shrink-0 grid-cols-[8rem_minmax(0,1fr)_8rem] items-center px-5">
        <p className="whitespace-nowrap text-sm font-semibold text-slate-600">
          전체 <span className="text-blue-600">1,248명</span>
        </p>
        <div className="flex items-center justify-self-center gap-4 text-sm font-semibold">
          {["<", "<", "1", "2", "3", "4", "5", "...", "125", ">"].map(
            (item, index) => (
              <button
                key={`${item}-${index}`}
                type="button"
                className={[
                  "flex size-8 items-center justify-center rounded-md",
                  item === "1"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                {item}
              </button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function DetailMetricCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: DetailMetric) {
  return (
    <article className="flex h-[160px] flex-col items-center rounded-lg border border-slate-200 bg-white px-2 py-5 text-center [@media(min-height:950px)]:h-[174px] [@media(min-height:950px)]:py-6">
      <span
        className={[
          "flex size-12 items-center justify-center rounded-full [@media(min-height:950px)]:size-14",
          metricToneClasses[tone],
        ].join(" ")}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-5 text-xs font-semibold leading-4 text-slate-500">
        {label}
      </p>
      <p className="mt-2 whitespace-nowrap text-[17px] font-bold leading-6 text-slate-950">
        {value}
      </p>
      <p className="mt-1 min-h-5 text-xs font-medium leading-4 text-slate-400">
        {helper}
      </p>
    </article>
  );
}

function DetailCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function CustomerDetailPanel() {
  return (
    <aside className="-mb-4 -mt-5 flex h-[100dvh] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-8px_0_22px_rgba(15,23,42,0.08)]">
      <div className="flex h-[60px] shrink-0 items-center justify-between px-5">
        <h2 className="text-[17px] font-bold leading-6 text-slate-950">
          고객 상세
        </h2>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-slate-500"
          aria-label="고객 상세 닫기"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-[10px] overflow-hidden px-5 [@media(min-height:950px)]:space-y-3">
        <DetailCard className="h-[300px] p-4 [@media(min-height:950px)]:h-[314px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold leading-8 text-slate-950">
                  김민수
                </h3>
                <GradeBadge grade="VIP" />
              </div>
              <p className="mt-0.5 text-xl font-bold leading-7 text-slate-950">
                010-1234-5678
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                최근 상담 2025-05-20
              </p>
            </div>
            <div className="grid grid-cols-[4rem_5.5rem] gap-y-5 pt-1 text-xs font-semibold">
              <span className="text-slate-400">담당자</span>
              <span className="text-right text-slate-600">김민수 매니저</span>
              <span className="text-slate-400">소속 매장</span>
              <span className="text-right text-slate-600">강남본점</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-5 gap-2 [@media(min-height:950px)]:mt-7">
            {detailMetrics.map((metric) => (
              <DetailMetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </DetailCard>

        <DetailCard className="flex h-[264px] flex-col px-4 pt-4 [@media(min-height:950px)]:h-[302px]">
          <div className="flex h-10 shrink-0 items-end gap-8 border-b border-slate-100 text-sm font-bold">
            {["판매 이력", "미수금 이력", "상담/메모", "기본정보"].map(
              (tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={[
                    "relative h-full px-1 text-slate-500",
                    index === 0 ? "text-blue-600" : "",
                  ].join(" ")}
                >
                  {tab}
                  {index === 0 ? (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600" />
                  ) : null}
                </button>
              )
            )}
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-hidden">
            <table className="w-full table-fixed text-[11px] text-slate-600">
              <thead>
                <tr className="h-8 border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="w-[15%] px-2 text-left font-bold">판매일</th>
                  <th className="w-[28%] px-2 text-left font-bold">상품명</th>
                  <th className="w-[10%] px-2 text-left font-bold">통신사</th>
                  <th className="w-[14%] px-2 text-left font-bold">요금제</th>
                  <th className="w-[12%] px-2 text-left font-bold">
                    할부 개월
                  </th>
                  <th className="w-[15%] px-2 text-right font-bold">
                    판매 금액
                  </th>
                  <th className="w-[8%] px-2 text-center font-bold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {saleRows.map((row) => (
                  <tr
                    key={`${row.date}-${row.product}`}
                    className="h-8 font-medium [@media(min-height:950px)]:h-9"
                  >
                    <td className="truncate px-2">{row.date}</td>
                    <td className="truncate px-2">{row.product}</td>
                    <td className="truncate px-2">{row.carrier}</td>
                    <td className="truncate px-2">{row.plan}</td>
                    <td className="truncate px-2">{row.term}</td>
                    <td className="truncate px-2 text-right">{row.amount}</td>
                    <td className="px-2 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-8 shrink-0 items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-black leading-none text-blue-600"
              style={{ fontSize: 10, fontWeight: 900, lineHeight: 1 }}
            >
              전체 보기
              <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>
        </DetailCard>

        <DetailCard className="flex h-[178px] flex-col px-4 pt-4 [@media(min-height:950px)]:h-[212px]">
          <div className="flex h-8 shrink-0 items-start justify-between">
            <h3 className="text-base font-bold text-slate-950">
              최근 상담/메모
            </h3>
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-hidden">
            <table className="w-full table-fixed text-[11px] text-slate-600">
              <tbody className="divide-y divide-slate-100">
                {memoRows.map((row) => (
                  <tr
                    key={`${row.date}-${row.type}`}
                    className="h-8 [@media(min-height:950px)]:h-10"
                  >
                    <td className="w-[21%] truncate px-2">{row.date}</td>
                    <td className="w-[24%] truncate px-2">{row.type}</td>
                    <td className="w-[37%] truncate px-2">{row.memo}</td>
                    <td className="w-[18%] truncate px-2 text-right">
                      {row.owner}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex h-8 shrink-0 items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-black leading-none text-blue-600"
              style={{ fontSize: 10, fontWeight: 900, lineHeight: 1 }}
            >
              전체 보기
              <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>
        </DetailCard>
      </div>

      <div className="flex h-[72px] shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5">
        <Button className="!h-10 !min-h-10 !px-5 !text-sm">
          상담/메모 등록
        </Button>
        <Button variant="primary" className="!h-10 !min-h-10 !px-6 !text-sm">
          수정
        </Button>
      </div>
    </aside>
  );
}

export default function CustomersPage() {
  return (
    <div
      className="-ml-1 -mr-6 -mt-[5px] grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_686px] overflow-hidden"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pr-6">
        <header className="flex h-[76px] shrink-0 flex-col justify-start">
          <h1 className="text-[28px] font-bold leading-9 tracking-normal text-slate-950">
            고객 관리
          </h1>
          <p className="mt-1 text-xs leading-4 text-slate-500">
            고객 정보 조회 및 관리, 상담 내역과 판매 이력을 확인하세요.
          </p>
        </header>

        <CustomersFilter />
        <CustomersTable />
      </div>

      <CustomerDetailPanel />
    </div>
  );
}
