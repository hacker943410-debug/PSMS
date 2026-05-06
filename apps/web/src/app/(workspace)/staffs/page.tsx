import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import {
  FileDown,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import { Button, SelectInput, TextInput } from "@/components/workspace";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  createStaffsCloseHref,
  createStaffsHref,
  parseStaffsSearchParams,
  type PageSearchParams,
  type StaffsUrlState,
} from "@/lib/admin-foundation-url";
import {
  getAdminStaffsPageData,
  type AdminStaffDetail,
  type AdminStaffPageData,
} from "@/lib/admin-read-api";
import { StaffMutationPanel } from "./_components/staff-mutation-panel";

type StaffRole = "관리자" | "매니저" | "직원";
type StaffStatus = "활성" | "비활성";

type StaffRow = {
  id: string;
  name: string;
  role: StaffRole;
  store: string;
  phone: string;
  email: string;
  lastLogin: string;
  status: StaffStatus;
  isReference?: boolean;
};

const referenceTotal = 28;

const referenceStaffRows: StaffRow[] = [
  {
    id: "reference-kim",
    name: "김민수",
    role: "관리자",
    store: "강남본점",
    phone: "010-1234-5678",
    email: "kms@phoneshop.co.kr",
    lastLogin: "2025-05-19 09:21",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-lee",
    name: "이서연",
    role: "매니저",
    store: "강남본점",
    phone: "010-2345-6789",
    email: "sylee@phoneshop.co.kr",
    lastLogin: "2025-05-19 08:47",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-park",
    name: "박지훈",
    role: "직원",
    store: "강남본점",
    phone: "010-3456-7890",
    email: "jhpark@phoneshop.co.kr",
    lastLogin: "2025-05-19 10:03",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-choi",
    name: "최유리",
    role: "직원",
    store: "홍대점",
    phone: "010-4567-8901",
    email: "yrchoi@phoneshop.co.kr",
    lastLogin: "2025-05-19 09:11",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-jung",
    name: "정민호",
    role: "직원",
    store: "홍대점",
    phone: "010-5678-9012",
    email: "mhjung@phoneshop.co.kr",
    lastLogin: "2025-05-18 19:22",
    status: "비활성",
    isReference: true,
  },
  {
    id: "reference-han",
    name: "한예슬",
    role: "매니저",
    store: "부산서면점",
    phone: "010-6789-0123",
    email: "eshan@phoneshop.co.kr",
    lastLogin: "2025-05-19 07:58",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-oh",
    name: "오준석",
    role: "직원",
    store: "부산서면점",
    phone: "010-7890-1234",
    email: "jsoh@phoneshop.co.kr",
    lastLogin: "-",
    status: "비활성",
    isReference: true,
  },
  {
    id: "reference-lim",
    name: "임다은",
    role: "직원",
    store: "대구동성로점",
    phone: "010-8901-2345",
    email: "deim@phoneshop.co.kr",
    lastLogin: "2025-05-17 16:33",
    status: "비활성",
    isReference: true,
  },
];

const compactInputClass =
  "!h-9 !rounded-md !border-slate-200 !px-3 !text-xs !text-slate-700";

const roleBadgeClasses: Record<StaffRole, string> = {
  관리자: "border-blue-100 bg-blue-50 text-blue-700",
  매니저: "border-emerald-100 bg-emerald-50 text-emerald-700",
  직원: "border-slate-100 bg-slate-100 text-slate-600",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 16).replace("T", " ");
}

function toStaffRole(role: AdminStaffDetail["role"]): StaffRole {
  return role === "ADMIN" ? "관리자" : "직원";
}

function toStaffStatus(status: AdminStaffDetail["status"]): StaffStatus {
  return status === "ACTIVE" ? "활성" : "비활성";
}

function toStaffRows(data: AdminStaffPageData | undefined): StaffRow[] {
  return (data?.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    role: toStaffRole(row.role),
    store: row.storeName ?? "-",
    phone: row.phone ?? "-",
    email: row.loginId.includes("@")
      ? row.loginId
      : `${row.loginId}@phoneshop.co.kr`,
    lastLogin: formatDateTime(row.lastLoginAt),
    status: toStaffStatus(row.status),
  }));
}

function createMetricCards(
  data: AdminStaffPageData | undefined,
  useReferenceRows: boolean
) {
  if (useReferenceRows) {
    return [
      {
        label: "전체 직원",
        value: "28명",
        helper: "전체 등록 직원",
        delta: "▲ 4명",
        tone: "blue" as const,
        icon: Users,
      },
      {
        label: "근무중",
        value: "24명",
        helper: "활성 상태 직원",
        delta: "▲ 3명",
        tone: "green" as const,
        icon: UserCheck,
      },
      {
        label: "비활성",
        value: "4명",
        helper: "비활성 상태 직원",
        delta: "▼ 1명",
        tone: "orange" as const,
        icon: UserX,
      },
      {
        label: "관리자 수",
        value: "5명",
        helper: "전체 관리자",
        delta: "▲ 1명",
        tone: "purple" as const,
        icon: ShieldCheck,
      },
    ];
  }

  const rows = data?.rows ?? [];
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const adminCount = rows.filter((row) => row.role === "ADMIN").length;

  return [
    {
      label: "전체 직원",
      value: `${data?.total ?? 0}명`,
      helper: "현재 조회 조건 기준",
      delta: "▲ 0명",
      tone: "blue" as const,
      icon: Users,
    },
    {
      label: "근무중",
      value: `${activeCount}명`,
      helper: "현재 페이지 활성 직원",
      delta: "▲ 0명",
      tone: "green" as const,
      icon: UserCheck,
    },
    {
      label: "비활성",
      value: `${inactiveCount}명`,
      helper: "현재 페이지 비활성 직원",
      delta: "▼ 0명",
      tone: "orange" as const,
      icon: UserX,
    },
    {
      label: "관리자 수",
      value: `${adminCount}명`,
      helper: "현재 페이지 관리자",
      delta: "▲ 0명",
      tone: "purple" as const,
      icon: ShieldCheck,
    },
  ];
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

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span
      className={[
        "inline-flex h-6 min-w-[48px] items-center justify-center rounded-md border px-2 text-xs font-bold leading-none",
        roleBadgeClasses[role],
      ].join(" ")}
    >
      {role}
    </span>
  );
}

function StatusSwitch({ status }: { status: StaffStatus }) {
  const isActive = status === "활성";

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          isActive
            ? "text-xs font-bold text-blue-600"
            : "text-xs font-bold text-slate-500"
        }
      >
        {status}
      </span>
      <span
        aria-hidden
        className={[
          "relative inline-flex h-5 w-9 rounded-full transition-colors",
          isActive ? "bg-blue-600" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            isActive ? "left-4" : "left-0.5",
          ].join(" ")}
        />
      </span>
    </div>
  );
}

function StaffDetailLink({
  row,
  state,
  children,
  ariaLabel,
  className = "",
}: {
  row: StaffRow;
  state: StaffsUrlState;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const href = row.isReference
    ? createStaffsHref({ ...state, detail: undefined, mode: "create" })
    : createStaffsHref({ ...state, detail: row.id, mode: undefined });

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={[
        "font-bold text-slate-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
        className,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function StaffsFilterForm({
  state,
  stores,
}: {
  state: StaffsUrlState;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  return (
    <form
      action="/staffs"
      method="get"
      className="flex h-[80px] shrink-0 items-center gap-[14px] border-b border-slate-100 px-[14px] [@media(max-height:850px)]:h-16"
    >
      <input type="hidden" name="page" value="1" />
      {state.pageSize !== 10 ? (
        <input type="hidden" name="pageSize" value={state.pageSize} />
      ) : null}
      <label className="relative block w-[253px]">
        <span className="sr-only">검색</span>
        <TextInput
          name="q"
          placeholder="이름, 아이디, 이메일 검색"
          defaultValue={state.q ?? ""}
          className={`${compactInputClass} !pr-9`}
        />
        <Search
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </label>
      <label className="block w-[139px]">
        <span className="sr-only">역할</span>
        <SelectInput
          name="role"
          defaultValue={state.role}
          className={compactInputClass}
        >
          <option value="all">전체 역할</option>
          <option value="ADMIN">관리자</option>
          <option value="STAFF">직원</option>
        </SelectInput>
      </label>
      <label className="block w-[146px]">
        <span className="sr-only">매장</span>
        <SelectInput
          name="storeId"
          defaultValue={state.storeId}
          className={compactInputClass}
        >
          <option value="all">전체 매장</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </SelectInput>
      </label>
      <label className="block w-[139px]">
        <span className="sr-only">상태</span>
        <SelectInput
          name="status"
          defaultValue={state.status}
          className={compactInputClass}
        >
          <option value="all">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="INACTIVE">비활성</option>
        </SelectInput>
      </label>
      <Button type="submit" icon={Search} className="!min-h-9 !px-3 !text-xs">
        조회
      </Button>
      <LinkButton
        href="/staffs"
        icon={RefreshCw}
        className="ml-auto !min-h-9 !px-3 !text-xs"
      >
        초기화
      </LinkButton>
    </form>
  );
}

function Pagination({
  state,
  total,
}: {
  state: StaffsUrlState;
  total: number;
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
    return createStaffsHref({
      ...state,
      page,
      detail: undefined,
      mode: undefined,
    });
  }

  return (
    <div className="flex h-[66px] shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 [@media(max-height:850px)]:h-[54px]">
      <p className="w-[160px] text-sm font-medium text-slate-600">
        전체 {total}명
      </p>
      <div className="flex flex-1 items-center justify-center gap-2">
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
                ? "border-blue-500 bg-blue-50 text-blue-700"
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
      <form
        action="/staffs"
        method="get"
        className="flex w-[160px] items-center justify-end"
      >
        {state.role !== "all" ? (
          <input type="hidden" name="role" value={state.role} />
        ) : null}
        {state.storeId !== "all" ? (
          <input type="hidden" name="storeId" value={state.storeId} />
        ) : null}
        {state.status !== "all" ? (
          <input type="hidden" name="status" value={state.status} />
        ) : null}
        {state.q ? <input type="hidden" name="q" value={state.q} /> : null}
        <input type="hidden" name="page" value="1" />
        <SelectInput
          name="pageSize"
          defaultValue={String(state.pageSize)}
          className="!h-9 !w-[112px] !rounded-md !text-xs"
        >
          <option value="10">10 / 페이지</option>
          <option value="20">20 / 페이지</option>
          <option value="50">50 / 페이지</option>
        </SelectInput>
        <Button type="submit" className="sr-only">
          적용
        </Button>
      </form>
    </div>
  );
}

function StaffMetricCards({
  cards,
}: {
  cards: ReturnType<typeof createMetricCards>;
}) {
  const toneClasses = {
    blue: {
      icon: "bg-blue-100 text-blue-600",
      delta: "text-blue-600",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-600",
      delta: "text-blue-600",
    },
    orange: {
      icon: "bg-orange-100 text-orange-500",
      delta: "text-rose-500",
    },
    purple: {
      icon: "bg-violet-100 text-violet-600",
      delta: "text-blue-600",
    },
  } satisfies Record<
    ReturnType<typeof createMetricCards>[number]["tone"],
    { icon: string; delta: string }
  >;

  return (
    <section className="grid h-[159px] shrink-0 grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const tone = toneClasses[card.tone];

        return (
          <article
            key={card.label}
            className="flex min-w-0 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm shadow-slate-200/70"
          >
            <span
              className={[
                "flex size-[58px] shrink-0 items-center justify-center rounded-full",
                tone.icon,
              ].join(" ")}
            >
              <Icon className="size-7" aria-hidden />
            </span>
            <div className="ml-4 min-w-0">
              <p className="text-xs font-bold leading-4 text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-[25px] font-bold leading-8 tracking-normal text-slate-950">
                {card.value}
              </p>
              <p className="mt-1 text-xs font-medium leading-4 text-slate-500">
                {card.helper}
              </p>
              <p
                className={[
                  "mt-2 text-xs font-bold leading-4",
                  tone.delta,
                ].join(" ")}
              >
                {card.delta}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StaffsTablePanel({
  rows,
  state,
  total,
  pageResult,
  stores,
}: {
  rows: StaffRow[];
  state: StaffsUrlState;
  total: number;
  pageResult: Awaited<ReturnType<typeof getAdminStaffsPageData>>;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  return (
    <section className="flex h-[598px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 [@media(max-height:850px)]:h-[505px]">
      <StaffsFilterForm state={state} stores={stores} />

      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full table-fixed text-xs">
          <caption className="sr-only">직원 목록</caption>
          <colgroup>
            <col className="w-[8.5%]" />
            <col className="w-[10.5%]" />
            <col className="w-[11.5%]" />
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[6.5%]" />
          </colgroup>
          <thead>
            <tr className="h-[41px] border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 [@media(max-height:850px)]:h-9">
              <th className="px-4 text-left">이름</th>
              <th className="px-3 text-left">역할</th>
              <th className="px-3 text-left">소속 매장</th>
              <th className="px-3 text-left">연락처</th>
              <th className="px-3 text-left">이메일</th>
              <th className="px-3 text-left">최근 로그인</th>
              <th className="px-3 text-left">상태</th>
              <th className="px-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-[51px] text-xs font-medium text-slate-600 [@media(max-height:850px)]:h-[43px]"
                >
                  <td className="truncate px-4">
                    <StaffDetailLink row={row} state={state}>
                      {row.name}
                    </StaffDetailLink>
                  </td>
                  <td className="px-3">
                    <RoleBadge role={row.role} />
                  </td>
                  <td className="truncate px-3">{row.store}</td>
                  <td className="truncate px-3">{row.phone}</td>
                  <td className="truncate px-3">{row.email}</td>
                  <td className="truncate px-3">{row.lastLogin}</td>
                  <td className="px-3">
                    <StatusSwitch status={row.status} />
                  </td>
                  <td className="px-3 text-center">
                    <StaffDetailLink
                      row={row}
                      state={state}
                      ariaLabel={`${row.name} 직원 상세 보기`}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <MoreVertical className="size-4" aria-hidden />
                      <span className="sr-only">{row.name} 직원 상세 보기</span>
                    </StaffDetailLink>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="h-[408px] px-4 text-center text-sm text-slate-500"
                >
                  {pageResult.ok
                    ? "조회된 직원이 없습니다."
                    : pageResult.message}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination state={state} total={total} />
    </section>
  );
}

type StaffsPageProps = {
  searchParams: PageSearchParams;
};

export default async function StaffsPage({ searchParams }: StaffsPageProps) {
  requireRole(await requireSession(), ["ADMIN"]);
  const urlState = parseStaffsSearchParams(await searchParams);
  const pageResult = await getAdminStaffsPageData(urlState);
  const pageData = pageResult.ok ? pageResult.data : undefined;
  const rows = toStaffRows(pageData);
  const stores = pageData?.filterOptions.stores ?? [];
  const useReferenceRows = false;
  const displayRows = useReferenceRows ? referenceStaffRows : rows;
  const displayTotal = useReferenceRows
    ? referenceTotal
    : (pageData?.total ?? 0);
  const metricCards = createMetricCards(pageData, useReferenceRows);
  const drawerCloseHref = createStaffsCloseHref(urlState);
  const drawerKind =
    urlState.mode === "create"
      ? "create"
      : urlState.mode === "edit" && urlState.detail
        ? "edit"
        : urlState.detail && !urlState.mode
          ? "detail"
          : undefined;
  const hasDrawer = Boolean(drawerKind);
  const staffDetail = pageData?.detail;
  const drawerEditHref = staffDetail
    ? createStaffsHref({
        ...urlState,
        detail: staffDetail.id,
        mode: "edit",
      })
    : undefined;
  const pageLayoutClassName = [
    "-mb-4 -mr-6 -mt-[25px] grid h-[100dvh] min-h-0 overflow-hidden",
    hasDrawer
      ? "grid-cols-[minmax(0,1fr)_412px] gap-[30px]"
      : "grid-cols-1 gap-0",
    "[@media(max-width:1399px)]:grid-cols-1 [@media(max-width:1399px)]:gap-0",
  ].join(" ");

  return (
    <div
      className={pageLayoutClassName}
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pb-4 pt-[25px]">
        <header className="flex h-[76px] shrink-0 items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold leading-9 tracking-normal text-slate-950">
              직원 관리
            </h1>
            <p className="mt-1 text-xs leading-4 text-slate-500">
              직원 목록을 관리하고 새로운 직원을 등록할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-[5px]">
            <Button
              icon={FileDown}
              className="!h-[42px] !min-h-[42px] !px-4 !text-sm"
            >
              엑셀 다운로드
            </Button>
            <LinkButton
              href={createStaffsHref({
                ...urlState,
                detail: undefined,
                mode: "create",
              })}
              variant="primary"
              icon={UserPlus}
              className="!min-h-[42px] !px-5"
            >
              신규 직원 등록
            </LinkButton>
          </div>
        </header>

        <div className="h-0 shrink-0 [@media(min-height:950px)]:h-4" />

        <StaffMetricCards cards={metricCards} />

        <div className="h-[30px] shrink-0 [@media(max-height:850px)]:h-[18px]" />

        <StaffsTablePanel
          rows={displayRows}
          state={urlState}
          total={displayTotal}
          pageResult={pageResult}
          stores={stores}
        />

        <p className="mt-[29px] text-center text-xs font-medium text-slate-400 [@media(max-height:850px)]:hidden">
          © 2025 PhoneShop. All rights reserved.
        </p>
      </div>

      {drawerKind ? (
        <StaffMutationPanel
          key={`${drawerKind}-${staffDetail?.id ?? "create"}-${
            staffDetail?.updatedAt ?? ""
          }`}
          closeHref={drawerCloseHref}
          editHref={drawerEditHref}
          kind={drawerKind}
          staff={staffDetail}
          stores={stores}
        />
      ) : null}
    </div>
  );
}
