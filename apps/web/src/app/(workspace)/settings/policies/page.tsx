import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Eye,
  History,
  Info,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  PageIntro,
  SelectInput,
  TextInput,
  TonePill,
  type TonePillTone,
} from "@/components/workspace";
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
  type AdminPolicyDetail,
  type AdminPolicyListRow,
  type AdminPolicyPageData,
  type AdminPolicyStatus,
} from "@/lib/admin-read-api";

type PolicyStatus = "활성" | "예약" | "비활성" | "만료";

type PolicyRow = {
  id: string;
  name: string;
  carrier: string;
  salesType: "기기변경" | "신규가입" | "번호이동" | "전체";
  period: string;
  basis: string;
  status: PolicyStatus;
  version: string;
  updatedAt: string;
};

const tabs = [
  { label: "통신사 수익 정책", value: "saleProfit" },
  { label: "직원 수수료 정책", value: "staffCommission" },
  { label: "단말 할인 정책", value: "discount" },
  { label: "개통 가능 규칙", value: "activationRule" },
] as const satisfies ReadonlyArray<{ label: string; value: PoliciesTab }>;

const statusTone: Record<PolicyStatus, TonePillTone> = {
  활성: "success",
  예약: "warning",
  비활성: "neutral",
  만료: "neutral",
};

const compactCellClass = "!px-2";
const compactActionCellClass = "!px-1";

function formatDate(value: string | null) {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "상시";
}

function formatDateTime(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

function toPolicyStatus(status: AdminPolicyStatus): PolicyStatus {
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

function toSalesType(row: AdminPolicyListRow): PolicyRow["salesType"] {
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

function createPolicySummary(rows: PolicyRow[], total: number) {
  return [
    { label: "전체", value: String(total), tone: "info" },
    {
      label: "활성",
      value: String(rows.filter((row) => row.status === "활성").length),
      tone: "success",
    },
    {
      label: "비활성",
      value: String(rows.filter((row) => row.status === "비활성").length),
      tone: "neutral",
    },
    {
      label: "예약",
      value: String(rows.filter((row) => row.status === "예약").length),
      tone: "warning",
    },
    {
      label: "만료",
      value: String(rows.filter((row) => row.status === "만료").length),
      tone: "neutral",
    },
  ] satisfies ReadonlyArray<{
    label: string;
    value: string;
    tone: TonePillTone;
  }>;
}

interface PoliciesEmptyStateProps {
  result: Awaited<ReturnType<typeof getAdminPoliciesPageData>>;
}

function PoliciesEmptyState({ result }: PoliciesEmptyStateProps) {
  if (!result.ok) {
    return (
      <EmptyState
        title="정책 목록을 불러오지 못했습니다"
        description={result.message}
        tone="error"
        icon={<Info className="size-5" />}
      />
    );
  }

  return (
    <EmptyState
      title="조회된 정책이 없습니다"
      description="통신사, 판매유형, 적용상태 조건을 변경하거나 신규 정책을 등록하세요."
      tone="neutral"
      icon={<BookOpen className="size-5" />}
    />
  );
}

const baseInfo = [
  ["통신사", "SKT"],
  ["판매유형", "기기변경"],
  ["적용기간", "2025.05.01 ~ 2025.05.31"],
  ["버전", "2.1 (이전 버전: 2.0)"],
  ["최종수정자", "관리자 (admin@phoneshop.co.kr)"],
  ["최종수정일", "2025-05-18 14:32"],
] as const;

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

function createPolicyBaseInfo(detail: AdminPolicyDetail | undefined) {
  if (!detail) {
    return baseInfo;
  }

  return [
    ["통신사", detail.carrierName ?? "공통"],
    ["판매유형", toSalesType(detail)],
    [
      "적용기간",
      `${formatDate(detail.effectiveFrom)} ~ ${formatDate(detail.effectiveTo)}`,
    ],
    ["버전", detail.version],
    ["최종수정자", detail.auditSummary.updatedById ?? "-"],
    ["최종수정일", formatDateTime(detail.updatedAt)],
  ] as const;
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

function createColumns(state: PoliciesUrlState): DataTableColumn<PolicyRow>[] {
  return [
    {
      key: "select",
      header: <span className="sr-only">선택</span>,
      className: compactCellClass,
      cell: (row) => (
        <input
          type="checkbox"
          defaultChecked={row.id === state.detail}
          aria-label={`${row.name} 선택`}
          className="size-4 rounded border-slate-300 text-blue-600"
        />
      ),
    },
    {
      key: "name",
      header: "정책명",
      className: compactCellClass,
      cell: (row) => (
        <Link
          href={createPoliciesHref({
            ...state,
            detail: row.id,
            mode: undefined,
            confirm: undefined,
          })}
          className="inline-block max-w-48 truncate align-middle font-semibold text-slate-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          title={row.name}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "carrier",
      header: "통신사",
      className: compactCellClass,
      cell: (row) => row.carrier,
    },
    {
      key: "salesType",
      header: "판매유형",
      className: compactCellClass,
      cell: (row) => row.salesType,
    },
    {
      key: "period",
      header: "적용기간",
      className: compactCellClass,
      cell: (row) => row.period,
    },
    {
      key: "basis",
      header: "기준값",
      className: compactCellClass,
      cell: (row) => (
        <span
          className={[
            "inline-block max-w-32 truncate align-middle",
            row.id === state.detail ? "font-semibold text-blue-600" : "",
          ].join(" ")}
          title={row.basis}
        >
          {row.basis}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      className: compactCellClass,
      cell: (row) => (
        <TonePill
          tone={statusTone[row.status]}
          className="min-w-12 justify-center"
        >
          {row.status}
        </TonePill>
      ),
    },
    {
      key: "version",
      header: "버전",
      className: compactCellClass,
      cell: (row) => row.version,
    },
    {
      key: "updatedAt",
      header: "최종수정일",
      className: compactCellClass,
      cell: (row) => row.updatedAt,
    },
    {
      key: "actions",
      header: "액션",
      align: "center",
      className: compactActionCellClass,
      cell: (row) => (
        <div className="flex justify-center gap-1">
          <Link
            href={createPoliciesHref({
              ...state,
              detail: row.id,
              mode: undefined,
              confirm: undefined,
            })}
            aria-label={`${row.name} 상세 보기`}
            className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
          >
            <Eye className="size-3.5" aria-hidden />
          </Link>
          <Link
            href={createPoliciesHref({
              ...state,
              detail: row.id,
              mode: "edit",
              confirm: undefined,
            })}
            aria-label={`${row.name} 작업 메뉴`}
            className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
          >
            <MoreVertical className="size-3.5" aria-hidden />
          </Link>
        </div>
      ),
    },
  ];
}

function PolicyTabs({
  state,
  carriers,
}: {
  state: PoliciesUrlState;
  carriers: AdminPolicyPageData["filterOptions"]["carriers"];
}) {
  const periodValue =
    state.from && state.to
      ? `${state.from} ~ ${state.to}`
      : "2025.04.20 ~ 2025.05.19";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="grid min-w-[38rem] grid-cols-4 border-b border-slate-200 text-center text-sm font-semibold">
        {tabs.map((tab) => {
          const active = tab.value === state.tab;

          return (
            <a
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
                "inline-flex min-h-11 items-center justify-center border-b-2 px-3 transition-colors",
                active
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-950",
              ].join(" ")}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <form action="/settings/policies" method="get">
        <input type="hidden" name="tab" value={state.tab} />
        <input type="hidden" name="page" value="1" />
        {state.pageSize !== 10 ? (
          <input type="hidden" name="pageSize" value={state.pageSize} />
        ) : null}
        {state.from ? (
          <input type="hidden" name="from" value={state.from} />
        ) : null}
        {state.to ? <input type="hidden" name="to" value={state.to} /> : null}
        <div className="grid gap-3 px-4 py-3 xl:grid-cols-5">
          <FormField label="검색">
            <div className="relative">
              <TextInput
                name="q"
                placeholder="정책명 검색"
                defaultValue={state.q ?? ""}
                className="h-8 pr-9 text-xs"
              />
              <Search
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </FormField>
          <FormField label="통신사">
            <SelectInput
              name="carrierId"
              defaultValue={state.carrierId}
              className="h-8 text-xs"
            >
              <option value="all">전체 통신사</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="판매유형">
            <SelectInput
              name="salesType"
              defaultValue={state.salesType}
              className="h-8 text-xs"
            >
              <option value="all">전체</option>
              <option value="CHANGE">기기변경</option>
              <option value="NEW">신규가입</option>
            </SelectInput>
          </FormField>
          <FormField label="적용상태">
            <SelectInput
              name="status"
              defaultValue={state.status}
              className="h-8 text-xs"
            >
              <option value="all">전체</option>
              <option value="ACTIVE">활성</option>
              <option value="SCHEDULED">예약</option>
              <option value="INACTIVE">비활성</option>
              <option value="EXPIRED">만료</option>
            </SelectInput>
          </FormField>
          <FormField label="적용기간">
            <div className="relative">
              <TextInput
                readOnly
                value={periodValue}
                className="h-8 pr-9 text-xs"
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </FormField>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 pb-3 pt-2">
          <LinkButton
            href={createPoliciesHref({ tab: state.tab })}
            icon={RefreshCw}
            className="min-h-8 px-3 text-xs"
          >
            초기화
          </LinkButton>
          <Button
            type="submit"
            variant="primary"
            icon={Search}
            className="min-h-8 px-3 text-xs"
          >
            조회
          </Button>
        </div>
      </form>
    </div>
  );
}

function PolicyCreatePanel({
  closeHref,
  carriers,
}: {
  closeHref: string;
  carriers: AdminPolicyPageData["filterOptions"]["carriers"];
}) {
  return (
    <aside
      aria-label="정책 등록 패널"
      className="hidden h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 xl:flex"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-950">
            신규 정책 등록
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <TonePill tone="info">초안</TonePill>
            <TonePill tone="neutral">읽기 화면</TonePill>
          </div>
        </div>
        <a
          href={closeHref}
          aria-label="정책 등록 닫기"
          className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="size-4" aria-hidden />
        </a>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
        <EmptyState
          title="정책 등록 준비 중"
          description="읽기 화면 연결은 완료되었고 등록/수정 저장은 다음 mutation 단계에서 활성화됩니다."
          tone="info"
          icon={<BookOpen className="size-5" />}
        />

        <form className="space-y-3 text-sm">
          <FormField label="정책명" required>
            <TextInput placeholder="정책명을 입력하세요" />
          </FormField>
          <FormField label="통신사">
            <SelectInput defaultValue="all">
              <option value="all">공통</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="판매유형">
            <SelectInput defaultValue="NEW">
              <option value="NEW">신규가입</option>
              <option value="CHANGE_DEVICE">기기변경</option>
              <option value="NUMBER_PORTABILITY">번호이동</option>
            </SelectInput>
          </FormField>
          <FormField label="적용상태">
            <SelectInput defaultValue="INACTIVE">
              <option value="INACTIVE">비활성</option>
              <option value="SCHEDULED">예약</option>
              <option value="ACTIVE">활성</option>
            </SelectInput>
          </FormField>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-4 py-3">
        <Button className="w-full">취소</Button>
        <Button variant="primary" className="w-full" disabled>
          저장
        </Button>
      </div>
    </aside>
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
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.max(
      1,
      Math.min(state.page - 2, totalPages - Math.min(5, totalPages) + 1)
    );

    return start + index;
  });
  const linkClassName =
    "flex size-8 items-center justify-center rounded-md border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2";

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
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
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
          className="h-8 w-24 text-xs"
        >
          <option value="10">10개씩 보기</option>
          <option value="20">20개씩 보기</option>
          <option value="50">50개씩 보기</option>
        </SelectInput>
        <Button type="submit" className="min-h-8 px-2.5 text-xs">
          적용
        </Button>
      </form>
      <div className="flex items-center gap-1.5">
        <Link
          href={pageHref(Math.max(1, state.page - 1))}
          aria-label="이전 페이지"
          className={`${linkClassName} border-transparent bg-white text-slate-600 hover:border-slate-200`}
        >
          ‹
        </Link>
        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={pageHref(pageNumber)}
            aria-current={pageNumber === state.page ? "page" : undefined}
            className={[
              linkClassName,
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
          className={`${linkClassName} border-transparent bg-white text-slate-600 hover:border-slate-200`}
        >
          ›
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        {rowCount > 0 ? (state.page - 1) * state.pageSize + 1 : 0} -{" "}
        {(state.page - 1) * state.pageSize + rowCount} of {total}
      </p>
    </div>
  );
}

function PolicyDetailPanel({
  closeHref,
  editHref,
  detail,
}: {
  closeHref: string;
  editHref: string;
  detail?: AdminPolicyDetail;
}) {
  const infoRows = createPolicyBaseInfo(detail);
  const status = detail ? toPolicyStatus(detail.status) : "활성";

  if (!detail) {
    return (
      <aside
        aria-label="정책 상세 패널"
        className="hidden h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 xl:flex"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-950">
              정책 상세
            </h2>
            <div className="mt-2">
              <TonePill tone="warning">데이터 없음</TonePill>
            </div>
          </div>
          <a
            href={closeHref}
            aria-label="정책 상세 닫기"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="size-4" aria-hidden />
          </a>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <EmptyState
            title="정책 정보를 찾을 수 없습니다"
            description="목록을 새로 조회하거나 다른 정책을 선택하세요."
            tone="warning"
            icon={<Info className="size-5" />}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="정책 상세 패널"
      className="hidden h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 xl:flex"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-950">
            {detail?.name ?? "정책 상세"}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <TonePill tone={statusTone[status]}>{status}</TonePill>
            <TonePill tone="neutral">{detail?.version ?? "-"}</TonePill>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton
            href={editHref}
            variant="primary"
            className="min-h-8 px-3 text-xs"
          >
            정책 편집
          </LinkButton>
          <a
            href={closeHref}
            aria-label="정책 상세 닫기"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="size-4" aria-hidden />
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-950">기본 정보</h3>
          <dl className="overflow-hidden rounded-md border border-slate-200">
            {infoRows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[6rem_1fr] border-b border-slate-100 last:border-b-0"
              >
                <dt className="bg-slate-50 px-3 py-2 font-semibold text-slate-500">
                  {label}
                </dt>
                <dd className="min-w-0 px-3 py-2 font-medium text-slate-700">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-950">적용 조건</h3>
          <ul className="space-y-1 rounded-md border border-slate-200 p-3 text-slate-700">
            <li>요금제 유형: 전체</li>
            <li>최소 요금제: 월 22,000원 이상</li>
            <li>약정 기간: 24개월</li>
            <li>중복 적용: 다른 수익 정책과 중복 적용 없음</li>
            <li>우선순위: 100 (낮을수록 우선)</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-950">기준값 상세</h3>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">요금제 구간</th>
                  <th className="px-2 py-1.5">월 요금</th>
                  <th className="px-2 py-1.5 text-right">기본 수익</th>
                  <th className="px-2 py-1.5">추가 조건</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteriaRows.map(([grade, fee, amount, extra]) => (
                  <tr key={grade}>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">
                      {grade}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{fee}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                      {amount}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-950">예시 계산</h3>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="font-bold text-blue-700">
              예시: 월 요금 69,000원 / 24개월 약정
            </p>
            <div className="mt-2 space-y-1.5">
              {calculationRows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[6.5rem_1fr] gap-2 text-slate-700"
                >
                  <span className={label === "총 수익" ? "font-bold" : ""}>
                    {label}
                  </span>
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
            <h3 className="text-sm font-bold text-slate-950">버전 히스토리</h3>
            <button
              type="button"
              className="text-xs font-semibold text-blue-600"
            >
              더보기
            </button>
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <div>
              <p className="font-bold text-blue-600">v2.1 (현재)</p>
              <p className="mt-1 text-slate-600">
                2025-05-18 14:32 · 관리자 · 기준값 조정
              </p>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="font-bold text-slate-700">v2.0</p>
              <p className="mt-1 text-slate-600">
                2025-05-01 09:10 · 관리자 · 신규 정책 등록
              </p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
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
  const policyRows = toPolicyRows(pageData);
  const policySummary = createPolicySummary(policyRows, pageData?.total ?? 0);
  const carriers = pageData?.filterOptions.carriers ?? [];
  const detailCloseHref = createPoliciesCloseHref(urlState);
  const detailEditHref = createPoliciesHref({
    ...urlState,
    detail: urlState.detail,
    mode: "edit",
    confirm: undefined,
  });
  const panelCloseHref = createPoliciesCloseHref(urlState);
  const columns = createColumns(urlState);
  const isDetailPanelOpen =
    urlState.detail !== undefined && urlState.mode !== "create";
  const isCreatePanelOpen = urlState.mode === "create";

  return (
    <div
      className={[
        "grid h-full min-h-0 flex-1 overflow-hidden",
        isDetailPanelOpen || isCreatePanelOpen
          ? "xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-3 2xl:grid-cols-[minmax(0,1fr)_22rem]"
          : "",
      ].join(" ")}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <PageIntro
          title={
            <span className="inline-flex items-center gap-3">
              정책 관리
              <TonePill tone="info">ADMIN ONLY</TonePill>
            </span>
          }
          description="수익, 수수료, 할인, 개통 관련 정책을 체계적으로 관리합니다."
          actions={
            <>
              <Button icon={BookOpen} className="min-h-8 px-3 text-xs">
                정책 가이드
              </Button>
              <Button icon={History} className="min-h-8 px-3 text-xs">
                변경 이력
              </Button>
            </>
          }
        />

        <PolicyTabs state={urlState} carriers={carriers} />

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">
                총 {pageData?.total ?? 0}건의 정책
              </h2>
              {policySummary.map((item) => (
                <TonePill key={item.label} tone={item.tone}>
                  {item.label} {item.value}
                </TonePill>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button icon={CheckSquare} className="min-h-8 px-3 text-xs">
                정책 활성화
              </Button>
              <LinkButton
                href={createPoliciesHref({
                  ...urlState,
                  detail: undefined,
                  mode: "create",
                  confirm: undefined,
                })}
                icon={Plus}
                variant="primary"
                className="min-h-8 px-3 text-xs"
              >
                신규 정책 등록
              </LinkButton>
            </div>
          </div>

          <DataTable
            caption="정책 목록"
            columns={columns}
            data={policyRows}
            getRowKey={(row) => row.id}
            getRowClassName={(row) =>
              row.id === urlState.detail
                ? "bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-500"
                : ""
            }
            emptyState={<PoliciesEmptyState result={pageResult} />}
            bodyMaxHeight="100%"
            className="min-h-0 flex-1 rounded-none border-0 shadow-none"
            bodyClassName="h-full"
          />

          <PolicyPagination
            state={urlState}
            total={pageData?.total ?? 0}
            rowCount={policyRows.length}
          />
        </section>
      </div>

      {isCreatePanelOpen ? (
        <PolicyCreatePanel closeHref={panelCloseHref} carriers={carriers} />
      ) : isDetailPanelOpen ? (
        <PolicyDetailPanel
          closeHref={detailCloseHref}
          editHref={detailEditHref}
          detail={pageData?.detail}
        />
      ) : null}
    </div>
  );
}
