import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Eye,
  History,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button, SelectInput, TextInput } from "@/components/workspace";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  createPoliciesCloseHref,
  createPoliciesHref,
  parsePoliciesSearchParams,
  type PageSearchParams,
  type PoliciesTab,
  type PoliciesUrlState,
} from "@/lib/admin-foundation-url";
import {
  getAdminPoliciesPageData,
  type AdminPolicyListRow,
  type AdminPolicyPageData,
  type AdminPolicyRowStatus,
} from "@/lib/admin-read-api";

type PolicyStatus = "활성" | "예약" | "비활성" | "만료";
type PolicySalesType = "기기변경" | "신규가입" | "번호이동" | "전체";

type PolicyRow = {
  id: string;
  name: string;
  carrier: string;
  salesType: PolicySalesType;
  period: string;
  basis: string;
  status: PolicyStatus;
  version: string;
  updatedAt: string;
  isReference?: boolean;
};

const tabs = [
  { label: "통신사 수익 정책", value: "saleProfit" },
  { label: "직원 수수료 정책", value: "staffCommission" },
  { label: "단말 할인 정책", value: "discount" },
  { label: "개통 가능 규칙", value: "activationRule" },
] as const satisfies ReadonlyArray<{ label: string; value: PoliciesTab }>;

const referencePolicyRows: PolicyRow[] = [
  {
    id: "reference-skt-standard-profit-v21",
    name: "SKT 표준 수익 정책 v2.1",
    carrier: "SKT",
    salesType: "기기변경",
    period: "2025.05.01 ~ 2025.05.31",
    basis: "가입유형별 수익 (상세)",
    status: "활성",
    version: "2.1",
    updatedAt: "2025-05-18 14:32",
    isReference: true,
  },
  {
    id: "reference-skt-new-profit-v13",
    name: "SKT 신규가입 수익 정책 v1.3",
    carrier: "SKT",
    salesType: "신규가입",
    period: "2025.04.01 ~ 2025.05.31",
    basis: "가입유형별 수익",
    status: "활성",
    version: "1.3",
    updatedAt: "2025-05-11 09:15",
    isReference: true,
  },
  {
    id: "reference-kt-standard-profit-v20",
    name: "KT 표준 수익 정책 v2.0",
    carrier: "KT",
    salesType: "기기변경",
    period: "2025.04.20 ~ 2025.06.30",
    basis: "요금제 구간별 수익",
    status: "활성",
    version: "2.0",
    updatedAt: "2025-05-12 11:08",
    isReference: true,
  },
  {
    id: "reference-kt-new-profit-v11",
    name: "KT 신규가입 수익 정책 v1.1",
    carrier: "KT",
    salesType: "신규가입",
    period: "2025.04.20 ~ 2025.06.30",
    basis: "요금제 구간별 수익",
    status: "예약",
    version: "1.1",
    updatedAt: "2025-05-19 10:00",
    isReference: true,
  },
  {
    id: "reference-lgu-standard-profit-v15",
    name: "LG U+ 표준 수익 정책 v1.5",
    carrier: "LG U+",
    salesType: "기기변경",
    period: "2025.04.01 ~ 2025.05.15",
    basis: "수익 고정값",
    status: "만료",
    version: "1.5",
    updatedAt: "2025-05-15 18:20",
    isReference: true,
  },
  {
    id: "reference-lgu-new-profit-v12",
    name: "LG U+ 신규가입 수익 정책 v1.2",
    carrier: "LG U+",
    salesType: "신규가입",
    period: "2025.04.20 ~ 2025.05.31",
    basis: "수익 고정값",
    status: "활성",
    version: "1.2",
    updatedAt: "2025-05-17 16:45",
    isReference: true,
  },
  {
    id: "reference-mvno-common-profit-v10",
    name: "알뜰 통신사 공동 수익 정책 v1.0",
    carrier: "알뜰",
    salesType: "전체",
    period: "2025.01.01 ~ 2025.12.31",
    basis: "수익 고정값",
    status: "활성",
    version: "1.0",
    updatedAt: "2025-04-30 09:30",
    isReference: true,
  },
  {
    id: "reference-skt-business-profit-v10",
    name: "SKT 법인 회선 수익 정책 v1.0",
    carrier: "SKT",
    salesType: "신규가입",
    period: "2025.04.01 ~ 2025.06.30",
    basis: "법인 전용 수익",
    status: "비활성",
    version: "1.0",
    updatedAt: "2025-05-02 13:22",
    isReference: true,
  },
];

const fallbackCarriers = [
  { id: "skt", code: "SKT", name: "SKT" },
  { id: "kt", code: "KT", name: "KT" },
  { id: "lgu", code: "LGU", name: "LG U+" },
  { id: "mvno", code: "MVNO", name: "알뜰" },
];

const criteriaRows = [
  ["Low", "22,000 ~ 44,000", "30,000", "-"],
  ["Mid", "44,001 ~ 77,000", "50,000", "-"],
  ["High", "77,001 ~ 110,000", "70,000", "-"],
  ["Premium", "110,001 이상", "100,000", "-"],
] as const;

const calculationRows = [
  ["요금제 구간 확인", "Mid (44,001 ~ 77,000원)"],
  ["기본 수익", "50,000원"],
  ["추가 수익", "0원"],
  ["총 수익", "50,000원"],
] as const;

const compactInputClass =
  "!h-[37px] !rounded-md !border-slate-200 !px-3 !text-sm !text-slate-700";

function formatDate(value: string | null) {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "상시";
}

function formatDateTime(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

function toPolicyStatus(status: AdminPolicyRowStatus): PolicyStatus {
  switch (status) {
    case "ACTIVE":
      return "활성";
    case "SCHEDULED":
      return "예약";
    case "EXPIRED":
      return "만료";
    case "INACTIVE":
      return "비활성";
  }
}

function toSalesType(row: AdminPolicyListRow): PolicySalesType {
  switch (row.subscriptionType) {
    case "NEW":
      return "신규가입";
    case "CHANGE_DEVICE":
      return "기기변경";
    case "NUMBER_PORTABILITY":
      return "번호이동";
    default:
      return "전체";
  }
}

function toPolicyRows(data: AdminPolicyPageData | undefined): PolicyRow[] {
  return (data?.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    carrier: row.carrierName ?? "공통",
    salesType: toSalesType(row),
    period: `${formatDate(row.effectiveFrom)} ~ ${formatDate(row.effectiveTo)}`,
    basis: `우선순위 ${row.priority}`,
    status: toPolicyStatus(row.status),
    version: row.version,
    updatedAt: formatDateTime(row.updatedAt),
  }));
}

function getSummary(rows: PolicyRow[], total: number, useReference: boolean) {
  if (useReference) {
    return [
      { label: "전체", value: 28, className: "bg-blue-50 text-blue-700" },
      { label: "활성", value: 12, className: "bg-emerald-50 text-emerald-700" },
      { label: "비활성", value: 8, className: "bg-slate-100 text-slate-700" },
      { label: "예약", value: 6, className: "bg-amber-50 text-amber-700" },
      { label: "만료", value: 2, className: "bg-slate-100 text-slate-700" },
    ];
  }

  return [
    { label: "전체", value: total, className: "bg-blue-50 text-blue-700" },
    {
      label: "활성",
      value: rows.filter((row) => row.status === "활성").length,
      className: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "비활성",
      value: rows.filter((row) => row.status === "비활성").length,
      className: "bg-slate-100 text-slate-700",
    },
    {
      label: "예약",
      value: rows.filter((row) => row.status === "예약").length,
      className: "bg-amber-50 text-amber-700",
    },
    {
      label: "만료",
      value: rows.filter((row) => row.status === "만료").length,
      className: "bg-slate-100 text-slate-700",
    },
  ];
}

function statusBadgeClass(status: PolicyStatus) {
  switch (status) {
    case "활성":
      return "bg-emerald-100 text-emerald-700";
    case "예약":
      return "bg-amber-100 text-amber-700";
    case "비활성":
    case "만료":
      return "bg-slate-100 text-slate-500";
  }
}

type LinkButtonVariant = "primary" | "secondary";

const linkButtonVariantClasses: Record<LinkButtonVariant, string> = {
  primary:
    "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
  secondary:
    "border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-200/70 hover:bg-slate-50",
};

function LinkButton({
  href,
  icon: Icon,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  icon?: LucideIcon;
  variant?: LinkButtonVariant;
  className?: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2",
        linkButtonVariantClasses[variant],
        className,
      ].join(" ")}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      <span>{children}</span>
    </Link>
  );
}

function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Button icon={BookOpen} className="!min-h-9 !px-4 !text-sm">
        정책 가이드
      </Button>
      <Button icon={History} className="!min-h-9 !px-4 !text-sm">
        변경 이력
      </Button>
    </div>
  );
}

function PolicyTabs({ state }: { state: PoliciesUrlState }) {
  return (
    <div className="grid h-[51px] grid-cols-4 border-b border-slate-200 text-center text-sm font-bold">
      {tabs.map((tab) => {
        const active = tab.value === state.tab;

        return (
          <Link
            key={tab.value}
            href={createPoliciesHref({
              ...state,
              tab: tab.value,
              page: 1,
              detail: undefined,
              mode: undefined,
              confirm: undefined,
            })}
            className={[
              "inline-flex h-full items-center justify-center border-b-2 transition-colors",
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-950",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function FilterLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-bold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function PolicyFilterPanel({
  state,
  carriers,
}: {
  state: PoliciesUrlState;
  carriers: AdminPolicyPageData["filterOptions"]["carriers"];
}) {
  const periodValue =
    state.from && state.to
      ? `${state.from.replaceAll("-", ".")} ~ ${state.to.replaceAll("-", ".")}`
      : "2025.04.20 ~ 2025.05.19";
  const carrierOptions = carriers.length > 0 ? carriers : fallbackCarriers;

  return (
    <section className="h-[194px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <PolicyTabs state={state} />

      <form action="/settings/policies" method="get">
        <input type="hidden" name="tab" value={state.tab} />
        <input type="hidden" name="page" value="1" />
        {state.pageSize !== 10 ? (
          <input type="hidden" name="pageSize" value={state.pageSize} />
        ) : null}
        {state.q ? <input type="hidden" name="q" value={state.q} /> : null}

        <div className="grid grid-cols-[178px_178px_178px_222px] gap-[15px] px-[18px] pt-[25px] [@media(max-width:1499px)]:grid-cols-[1fr_1fr_1fr_1.2fr]">
          <FilterLabel label="통신사">
            <SelectInput
              name="carrierId"
              defaultValue={state.carrierId}
              className={compactInputClass}
            >
              <option value="all">전체 통신사</option>
              {carrierOptions.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </SelectInput>
          </FilterLabel>
          <FilterLabel label="판매유형">
            <SelectInput
              name="salesType"
              defaultValue={state.salesType}
              className={compactInputClass}
            >
              <option value="all">전체</option>
              <option value="CHANGE">기기변경</option>
              <option value="NEW">신규가입</option>
            </SelectInput>
          </FilterLabel>
          <FilterLabel label="적용상태">
            <SelectInput
              name="status"
              defaultValue={state.status}
              className={compactInputClass}
            >
              <option value="all">전체</option>
              <option value="ACTIVE">활성</option>
              <option value="SCHEDULED">예약</option>
              <option value="INACTIVE">비활성</option>
              <option value="EXPIRED">만료</option>
            </SelectInput>
          </FilterLabel>
          <FilterLabel label="적용기간">
            <div className="relative">
              <TextInput
                readOnly
                value={periodValue}
                className={`${compactInputClass} !pr-10`}
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </FilterLabel>
        </div>

        <div className="mt-[11px] flex justify-end gap-2 px-[14px]">
          <LinkButton
            href={createPoliciesHref({ tab: state.tab })}
            icon={RefreshCw}
            className="!min-h-[36px] !px-4 !text-sm"
          >
            초기화
          </LinkButton>
          <Button
            type="submit"
            variant="primary"
            icon={Search}
            className="!min-h-[36px] !px-5 !text-sm"
          >
            조회
          </Button>
        </div>
      </form>
    </section>
  );
}

function SummaryBar({
  state,
  summary,
}: {
  state: PoliciesUrlState;
  summary: ReturnType<typeof getSummary>;
}) {
  return (
    <div className="flex h-[38px] shrink-0 items-center justify-between">
      <div className="flex items-center gap-2">
        <p className="mr-1 text-sm font-bold text-slate-950">총 28건의 정책</p>
        {summary.map((item) => (
          <span
            key={item.label}
            className={[
              "inline-flex h-7 items-center rounded-md px-3 text-xs font-bold",
              item.className,
            ].join(" ")}
          >
            {item.label} {item.value}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button icon={CheckSquare} className="!min-h-10 !px-4 !text-sm">
          정책 활성화
        </Button>
        <LinkButton
          href={createPoliciesHref({
            ...state,
            detail: undefined,
            mode: "create",
            confirm: undefined,
          })}
          icon={Plus}
          variant="primary"
          className="!min-h-10 !px-5 !text-sm"
        >
          신규 정책 등록
        </LinkButton>
      </div>
    </div>
  );
}

function rowHref(row: PolicyRow, state: PoliciesUrlState, mode?: "edit") {
  if (row.isReference) {
    return createPoliciesHref({
      ...state,
      detail: undefined,
      mode: undefined,
      confirm: undefined,
    });
  }

  return createPoliciesHref({
    ...state,
    detail: row.id,
    mode,
    confirm: undefined,
  });
}

function StatusBadge({ status }: { status: PolicyStatus }) {
  return (
    <span
      className={[
        "inline-flex h-7 min-w-[43px] items-center justify-center rounded-md px-2 text-xs font-bold",
        statusBadgeClass(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function PolicyTable({
  rows,
  state,
  selectedRow,
  total,
}: {
  rows: PolicyRow[];
  state: PoliciesUrlState;
  selectedRow: PolicyRow;
  total: number;
}) {
  return (
    <section className="flex h-[550px] min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 [@media(max-height:850px)]:!h-[430px] [@media(max-height:950px)]:h-[520px]">
      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full table-fixed text-[12.5px]">
          <caption className="sr-only">정책 목록</caption>
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[21%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[17%]" />
            <col className="w-[15%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[12%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead>
            <tr className="h-11 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
              <th className="px-3 text-left">
                <span className="sr-only">선택</span>
              </th>
              <th className="px-2 text-left">정책명</th>
              <th className="px-2 text-left">통신사</th>
              <th className="px-2 text-left">판매유형</th>
              <th className="px-2 text-left">적용기간</th>
              <th className="px-2 text-left">기준값</th>
              <th className="px-2 text-left">상태</th>
              <th className="px-2 text-left">버전</th>
              <th className="px-2 text-left">최종수정일</th>
              <th className="px-2 text-center">액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.id === selectedRow.id;

              return (
                <tr
                  key={row.id}
                  className={[
                    "h-[55px] border-b border-slate-100 text-[12.5px] font-medium text-slate-600 [@media(max-height:850px)]:!h-[42px] [@media(max-height:950px)]:h-[50px]",
                    isSelected
                      ? "bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-500"
                      : "bg-white",
                  ].join(" ")}
                >
                  <td className="px-3">
                    <input
                      type="checkbox"
                      defaultChecked={isSelected}
                      aria-label={`${row.name} 선택`}
                      className="size-4 rounded border-slate-300 text-blue-600"
                    />
                  </td>
                  <td className="truncate px-2 font-medium text-slate-700">
                    <Link href={rowHref(row, state)} title={row.name}>
                      {row.name}
                    </Link>
                  </td>
                  <td className="truncate px-2">{row.carrier}</td>
                  <td className="truncate px-2">{row.salesType}</td>
                  <td className="truncate px-2">{row.period}</td>
                  <td className="truncate px-1.5">
                    <span
                      className={
                        isSelected ? "font-semibold text-blue-600" : undefined
                      }
                    >
                      {row.basis}
                    </span>
                  </td>
                  <td className="px-1.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-1.5">{row.version}</td>
                  <td className="truncate px-1.5">{row.updatedAt}</td>
                  <td className="px-2">
                    <div className="flex justify-center gap-2">
                      <Link
                        href={rowHref(row, state)}
                        aria-label={`${row.name} 상세 보기`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <Eye className="size-4" aria-hidden />
                      </Link>
                      <Link
                        href={rowHref(row, state, "edit")}
                        aria-label={`${row.name} 작업 메뉴`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PolicyPagination state={state} total={total} rowCount={rows.length} />
    </section>
  );
}

function PolicyPagination({
  state,
  total,
  rowCount,
}: {
  state: PoliciesUrlState;
  total: number;
  rowCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const pages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => {
    const start = Math.max(
      1,
      Math.min(state.page - 1, totalPages - Math.min(3, totalPages) + 1)
    );

    return start + index;
  });

  function pageHref(page: number) {
    return createPoliciesHref({
      ...state,
      page,
      detail: undefined,
      mode: undefined,
      confirm: undefined,
    });
  }

  return (
    <div className="flex h-[58px] shrink-0 items-center justify-between border-t border-slate-100 px-4 [@media(max-height:850px)]:!h-[50px]">
      <form
        action="/settings/policies"
        method="get"
        className="flex items-center gap-2"
      >
        {state.tab !== "saleProfit" ? (
          <input type="hidden" name="tab" value={state.tab} />
        ) : null}
        {state.carrierId !== "all" ? (
          <input type="hidden" name="carrierId" value={state.carrierId} />
        ) : null}
        {state.salesType !== "all" ? (
          <input type="hidden" name="salesType" value={state.salesType} />
        ) : null}
        {state.status !== "all" ? (
          <input type="hidden" name="status" value={state.status} />
        ) : null}
        {state.from ? (
          <input type="hidden" name="from" value={state.from} />
        ) : null}
        {state.to ? <input type="hidden" name="to" value={state.to} /> : null}
        {state.q ? <input type="hidden" name="q" value={state.q} /> : null}
        <input type="hidden" name="page" value="1" />
        <SelectInput
          name="pageSize"
          defaultValue={String(state.pageSize)}
          className="!h-9 !w-[96px] !rounded-md !text-xs"
        >
          <option value="10">10개씩 보기</option>
          <option value="20">20개씩 보기</option>
          <option value="50">50개씩 보기</option>
        </SelectInput>
        <Button type="submit" className="sr-only">
          적용
        </Button>
      </form>

      <div className="flex flex-1 items-center justify-center gap-3">
        <Link
          href={pageHref(Math.max(1, state.page - 1))}
          aria-label="이전 페이지"
          className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
        >
          ‹
        </Link>
        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={pageHref(pageNumber)}
            aria-current={pageNumber === state.page ? "page" : undefined}
            className={[
              "flex size-8 items-center justify-center rounded-md border text-sm font-medium",
              pageNumber === state.page
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-transparent bg-white text-slate-600 hover:border-slate-200",
            ].join(" ")}
          >
            {pageNumber}
          </Link>
        ))}
        <Link
          href={pageHref(Math.min(totalPages, state.page + 1))}
          aria-label="다음 페이지"
          className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
        >
          ›
        </Link>
      </div>

      <p className="w-[120px] text-right text-xs font-medium text-slate-500">
        {rowCount > 0 ? (state.page - 1) * state.pageSize + 1 : 0} -{" "}
        {(state.page - 1) * state.pageSize + state.pageSize} of {total}
      </p>
    </div>
  );
}

function DetailInfoTable({ row }: { row: PolicyRow }) {
  const infoRows = [
    ["통신사", row.carrier],
    ["판매유형", row.salesType],
    ["적용기간", row.period],
    ["버전", `${row.version} (이전 버전: 2.0)`],
    ["최종수정자", "관리자 (admin@phoneshop.co.kr)"],
    ["최종수정일", row.updatedAt],
  ] as const;

  return (
    <dl className="overflow-hidden rounded-md border border-slate-200 text-xs">
      {infoRows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[96px_1fr] border-b border-slate-100 last:border-b-0"
        >
          <dt className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-500">
            {label}
          </dt>
          <dd className="min-w-0 px-3 py-1.5 font-medium text-slate-700">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PolicyDetailPanel({
  closeHref,
  editHref,
  row,
}: {
  closeHref: string;
  editHref: string;
  row: PolicyRow;
}) {
  return (
    <aside
      aria-label="정책 상세"
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white [@media(max-width:1399px)]:hidden"
    >
      <div className="flex h-[99px] shrink-0 items-start justify-between border-b border-slate-100 px-5 pt-[22px]">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold leading-7 text-slate-950">
            {row.name}
          </h2>
          <div className="mt-4 flex items-center gap-2">
            <StatusBadge status={row.status} />
            <span className="inline-flex h-7 items-center rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-500">
              v{row.version}
            </span>
          </div>
        </div>
        <div className="-mt-2 flex shrink-0 flex-col items-end gap-3">
          <Link
            href={closeHref}
            aria-label="정책 상세 닫기"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="size-5" aria-hidden />
          </Link>
          <LinkButton
            href={editHref}
            variant="primary"
            className="!min-h-9 !px-4 !text-sm"
          >
            정책 편집
          </LinkButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-5 py-4 text-xs [@media(max-height:950px)]:space-y-2.5 [@media(max-height:950px)]:py-3">
        <section>
          <h3 className="mb-2 text-[15px] font-bold text-slate-950">
            기본 정보
          </h3>
          <DetailInfoTable row={row} />
        </section>

        <section>
          <h3 className="mb-2 text-[15px] font-bold text-slate-950">
            적용 조건
          </h3>
          <ul className="space-y-1 rounded-md border border-slate-200 p-2.5 font-medium leading-4 text-slate-600">
            <li>• 요금제 유형: 전체</li>
            <li>• 최소 요금제: 월 22,000원 이상</li>
            <li>• 약정 기간: 24개월</li>
            <li>• 중복 적용: 다른 수익 정책과 중복 적용 없음</li>
            <li>• 우선순위: 100 (낮을수록 우선)</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[15px] font-bold text-slate-950">
            기준값 상세
          </h3>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full table-fixed text-left text-[10px]">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[32%]" />
                <col className="w-[26%]" />
                <col className="w-[19%]" />
              </colgroup>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-bold">요금제 구간</th>
                  <th className="px-2 py-1.5 font-bold">월 요금 (원)</th>
                  <th className="px-2 py-1.5 text-right font-bold">
                    기본 수익 (원)
                  </th>
                  <th className="px-2 py-1.5 text-center font-bold">
                    추가 수익 조건
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteriaRows.map(([grade, fee, amount, extra]) => (
                  <tr key={grade}>
                    <td className="px-2 py-1 font-semibold text-slate-700">
                      {grade}
                    </td>
                    <td className="px-2 py-1 text-slate-600">{fee}</td>
                    <td className="px-2 py-1 text-right font-semibold text-slate-800">
                      {amount}
                    </td>
                    <td className="px-2 py-1 text-center text-slate-600">
                      {extra}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[15px] font-bold text-slate-950">
            예시 계산
          </h3>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5">
            <p className="font-bold text-blue-700">
              예시: 월 요금 69,000원 / 24개월 약정
            </p>
            <div className="mt-1.5 space-y-1">
              {calculationRows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[112px_18px_1fr] gap-2 text-slate-700"
                >
                  <span className={label === "총 수익" ? "font-bold" : ""}>
                    {label}
                  </span>
                  <span className="text-center text-slate-500">→</span>
                  <span
                    className={[
                      "text-right",
                      label === "총 수익"
                        ? "font-bold text-blue-700"
                        : "font-medium",
                    ].join(" ")}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-950">
              버전 히스토리
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
            >
              더보기 <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-2.5">
            <div>
              <p className="font-bold text-blue-600">v2.1 (현재)</p>
              <p className="mt-1 text-slate-600">
                2025-05-18 14:32 · 관리자 · 변경사항: 기준값 조정 (Mid 구간
                +5,000원)
              </p>
            </div>
            <div className="border-t border-slate-100 pt-2 [@media(max-height:950px)]:hidden">
              <p className="font-bold text-slate-700">v2.0</p>
              <p className="mt-1 text-slate-600">
                2025-05-01 09:10 · 관리자 · 변경사항: 신규 정책 등록
              </p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function PolicyCreatePanel({
  closeHref,
  carriers,
}: {
  closeHref: string;
  carriers: AdminPolicyPageData["filterOptions"]["carriers"];
}) {
  const carrierOptions = carriers.length > 0 ? carriers : fallbackCarriers;

  return (
    <aside
      aria-label="정책 등록"
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white [@media(max-width:1399px)]:hidden"
    >
      <div className="flex h-[62px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
        <h2 className="text-xl font-bold text-slate-950">신규 정책 등록</h2>
        <Link
          href={closeHref}
          aria-label="정책 등록 닫기"
          className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <form className="min-h-0 flex-1 space-y-4 overflow-hidden px-5 py-5 text-sm">
        <FilterLabel label="정책명">
          <TextInput placeholder="정책명을 입력하세요" />
        </FilterLabel>
        <FilterLabel label="통신사">
          <SelectInput defaultValue="all">
            <option value="all">공통</option>
            {carrierOptions.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </SelectInput>
        </FilterLabel>
        <FilterLabel label="판매유형">
          <SelectInput defaultValue="NEW">
            <option value="NEW">신규가입</option>
            <option value="CHANGE_DEVICE">기기변경</option>
            <option value="NUMBER_PORTABILITY">번호이동</option>
          </SelectInput>
        </FilterLabel>
        <FilterLabel label="적용상태">
          <SelectInput defaultValue="INACTIVE">
            <option value="INACTIVE">비활성</option>
            <option value="SCHEDULED">예약</option>
            <option value="ACTIVE">활성</option>
          </SelectInput>
        </FilterLabel>
      </form>

      <div className="grid h-[86px] shrink-0 grid-cols-2 gap-3 border-t border-slate-200 px-5 py-[18px]">
        <Button className="!h-10 !min-h-10 !text-sm">취소</Button>
        <Button variant="primary" className="!h-10 !min-h-10 !text-sm" disabled>
          저장
        </Button>
      </div>
    </aside>
  );
}

function selectedPolicyRow(rows: PolicyRow[], state: PoliciesUrlState) {
  return rows.find((row) => row.id === state.detail) ?? rows[0];
}

type SettingsPoliciesPageProps = {
  searchParams: PageSearchParams;
};

export default async function SettingsPoliciesPage({
  searchParams,
}: SettingsPoliciesPageProps) {
  requireRole(await requireSession(), ["ADMIN"]);
  const urlState = parsePoliciesSearchParams(await searchParams);
  const pageResult = await getAdminPoliciesPageData(urlState);
  const pageData = pageResult.ok ? pageResult.data : undefined;
  const rows = toPolicyRows(pageData);
  const useReferenceRows = rows.length < 8;
  const displayRows = useReferenceRows ? referencePolicyRows : rows;
  const displayTotal = useReferenceRows ? 28 : (pageData?.total ?? 0);
  const summary = getSummary(displayRows, displayTotal, useReferenceRows);
  const carriers = pageData?.filterOptions.carriers ?? [];
  const selectedRow = selectedPolicyRow(displayRows, urlState);
  const closeHref = createPoliciesCloseHref(urlState);
  const editHref =
    selectedRow && !selectedRow.isReference
      ? createPoliciesHref({
          ...urlState,
          detail: selectedRow.id,
          mode: "edit",
          confirm: undefined,
        })
      : createPoliciesHref({
          ...urlState,
          detail: undefined,
          mode: undefined,
          confirm: undefined,
        });

  return (
    <div
      className="-mb-4 -mr-6 -mt-[25px] grid h-[100dvh] min-h-0 grid-cols-[minmax(0,1fr)_366px] gap-4 overflow-hidden [@media(max-width:1399px)]:grid-cols-1 [@media(max-width:1399px)]:gap-0"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pb-4 pt-[25px]">
        <header className="flex h-[79px] shrink-0 items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-bold leading-9 tracking-normal text-slate-950">
                정책 관리
              </h1>
              <span className="inline-flex h-7 items-center rounded-md bg-blue-600 px-3 text-xs font-bold text-white">
                ADMIN ONLY
              </span>
            </div>
            <p className="mt-1 text-xs leading-4 text-slate-500">
              수익, 수수료, 할인, 개통 관련 정책을 체계적으로 관리합니다.
            </p>
          </div>
          <HeaderActions />
        </header>

        <PolicyFilterPanel state={urlState} carriers={carriers} />

        <div className="h-5 shrink-0" />

        <SummaryBar state={urlState} summary={summary} />

        <div className="h-[18px] shrink-0" />

        <PolicyTable
          rows={displayRows}
          state={urlState}
          selectedRow={selectedRow}
          total={displayTotal}
        />
      </div>

      {urlState.mode === "create" ? (
        <PolicyCreatePanel closeHref={closeHref} carriers={carriers} />
      ) : (
        <PolicyDetailPanel
          closeHref={closeHref}
          editHref={editHref}
          row={selectedRow}
        />
      )}
    </div>
  );
}
