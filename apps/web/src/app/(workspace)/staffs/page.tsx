import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  FileDown,
  Info,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  MetricCard,
  PageIntro,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";
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

type StaffRole = "관리자" | "직원";
type StaffStatus = "활성" | "비활성";

type StaffRow = {
  id: string;
  name: string;
  role: StaffRole;
  store: string;
  phone: string;
  loginId: string;
  lastLogin: string;
  status: StaffStatus;
};

type StaffDrawerKind = "create" | "detail" | "edit";

const roleTone: Record<StaffRole, "info" | "success" | "neutral"> = {
  관리자: "info",
  직원: "neutral",
};

const inputClassName = "h-8 text-xs";

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
    loginId: row.loginId,
    lastLogin: formatDateTime(row.lastLoginAt),
    status: toStaffStatus(row.status),
  }));
}

function createMetricCards(data: AdminStaffPageData | undefined) {
  const rows = data?.rows ?? [];
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const adminCount = rows.filter((row) => row.role === "ADMIN").length;

  return [
    {
      label: "전체 직원",
      value: `${data?.total ?? 0}명`,
      helper: "현재 조회 조건 기준",
      trend: "API",
      tone: "info" as const,
      icon: Users,
    },
    {
      label: "근무중",
      value: `${activeCount}명`,
      helper: "현재 페이지 활성 직원",
      trend: "page",
      tone: "success" as const,
      icon: UserCheck,
    },
    {
      label: "비활성",
      value: `${inactiveCount}명`,
      helper: "현재 페이지 비활성 직원",
      trend: "page",
      tone: "warning" as const,
      icon: UserX,
    },
    {
      label: "관리자 수",
      value: `${adminCount}명`,
      helper: "현재 페이지 관리자",
      trend: "page",
      tone: "info" as const,
      icon: ShieldCheck,
    },
  ];
}

interface StaffsEmptyStateProps {
  result: Awaited<ReturnType<typeof getAdminStaffsPageData>>;
}

function StaffsEmptyState({ result }: StaffsEmptyStateProps) {
  if (!result.ok) {
    return (
      <EmptyState
        title="직원 목록을 불러오지 못했습니다"
        description={result.message}
        tone="error"
        icon={<Info className="size-5" />}
      />
    );
  }

  return (
    <EmptyState
      title="조회된 직원이 없습니다"
      description="필터 조건을 변경하거나 신규 직원을 등록하세요."
      tone="neutral"
      icon={<Users className="size-5" />}
    />
  );
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

function createColumns(state: StaffsUrlState): DataTableColumn<StaffRow>[] {
  return [
    {
      key: "name",
      header: "이름",
      cell: (row) => {
        const detailHref = createStaffsHref({
          ...state,
          detail: row.id,
          mode: undefined,
        });

        return (
          <Link
            href={detailHref}
            className="font-semibold text-slate-900 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            {row.name}
          </Link>
        );
      },
    },
    {
      key: "role",
      header: "역할",
      cell: (row) => <TonePill tone={roleTone[row.role]}>{row.role}</TonePill>,
    },
    { key: "store", header: "소속 매장", cell: (row) => row.store },
    { key: "phone", header: "연락처", cell: (row) => row.phone },
    { key: "loginId", header: "로그인 ID", cell: (row) => row.loginId },
    { key: "lastLogin", header: "최근 로그인", cell: (row) => row.lastLogin },
    {
      key: "status",
      header: "상태",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={
              row.status === "활성"
                ? "font-semibold text-blue-600"
                : "font-semibold text-slate-500"
            }
          >
            {row.status}
          </span>
          <span
            aria-hidden
            className={[
              "relative inline-flex h-5 w-9 rounded-full transition-colors",
              row.status === "활성" ? "bg-blue-600" : "bg-slate-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                row.status === "활성" ? "left-4" : "left-0.5",
              ].join(" ")}
            />
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "액션",
      align: "center",
      cell: (row) => (
        <Link
          href={createStaffsHref({
            ...state,
            detail: row.id,
            mode: undefined,
          })}
          aria-label={`${row.name} 직원 상세 보기`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
        >
          <MoreVertical className="size-4" aria-hidden />
        </Link>
      ),
    },
  ];
}

function StaffsFilterForm({
  state,
  stores,
}: {
  state: StaffsUrlState;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  return (
    <form action="/staffs" method="get">
      <input type="hidden" name="page" value="1" />
      {state.pageSize !== 10 ? (
        <input type="hidden" name="pageSize" value={state.pageSize} />
      ) : null}
      <FilterBar
        className="rounded-none border-0 border-b border-slate-200 shadow-none"
        actions={
          <>
            <LinkButton
              href="/staffs"
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
          </>
        }
      >
        <FormField label="검색" className="md:col-span-2 xl:col-span-1">
          <div className="relative">
            <TextInput
              name="q"
              placeholder="이름, 아이디, 이메일 검색"
              defaultValue={state.q ?? ""}
              className={`${inputClassName} pr-9`}
            />
            <Search
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </FormField>
        <FormField label="역할">
          <SelectInput
            name="role"
            defaultValue={state.role}
            className={inputClassName}
          >
            <option value="all">전체 역할</option>
            <option value="ADMIN">관리자</option>
            <option value="STAFF">직원</option>
          </SelectInput>
        </FormField>
        <FormField label="매장">
          <SelectInput
            name="storeId"
            defaultValue={state.storeId}
            className={inputClassName}
          >
            <option value="all">전체 매장</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="상태">
          <SelectInput
            name="status"
            defaultValue={state.status}
            className={inputClassName}
          >
            <option value="all">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="INACTIVE">비활성</option>
          </SelectInput>
        </FormField>
      </FilterBar>
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
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
      <p className="text-xs font-semibold text-slate-600">전체 {total}명</p>
      <div className="flex items-center gap-2">
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
      <form action="/staffs" method="get" className="flex items-center gap-2">
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
          className="h-8 w-28 text-xs"
        >
          <option value="10">10 / 페이지</option>
          <option value="20">20 / 페이지</option>
          <option value="50">50 / 페이지</option>
        </SelectInput>
        <Button type="submit" className="min-h-8 px-2.5 text-xs">
          적용
        </Button>
      </form>
    </div>
  );
}

function StaffRegistrationDrawer({
  closeHref,
  kind,
  staff,
  stores,
}: {
  closeHref: string;
  kind: StaffDrawerKind;
  staff?: AdminStaffDetail;
  stores: AdminStaffPageData["filterOptions"]["stores"];
}) {
  const copy = {
    create: {
      title: "신규 직원 등록",
      description: "직원 정보를 입력하여 새 직원을 등록하세요.",
      primaryAction: "등록",
    },
    detail: {
      title: "직원 상세",
      description: "선택한 직원의 기본 정보를 확인합니다.",
      primaryAction: "확인",
    },
    edit: {
      title: "직원 정보 수정",
      description: "선택한 직원의 기본 정보를 수정합니다.",
      primaryAction: "저장",
    },
  } satisfies Record<StaffDrawerKind, Record<string, string>>;

  const isReadOnly = kind === "detail";

  if (kind !== "create" && !staff) {
    return (
      <Drawer
        title={copy[kind].title}
        description="선택한 직원 상세 데이터를 불러오지 못했습니다."
        closeHref={closeHref}
        closeLabel={`${copy[kind].title} 닫기`}
        className="h-full min-h-0 xl:max-w-none"
      >
        <EmptyState
          title="직원 정보를 찾을 수 없습니다"
          description="목록을 새로 조회하거나 다른 직원을 선택하세요."
          tone="warning"
          icon={<UserX className="size-5" />}
        />
      </Drawer>
    );
  }

  return (
    <Drawer
      title={copy[kind].title}
      description={copy[kind].description}
      closeHref={closeHref}
      closeLabel={`${copy[kind].title} 닫기`}
      className="h-full min-h-0 xl:max-w-none"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button className="w-full">취소</Button>
          <Button variant="primary" className="w-full">
            {copy[kind].primaryAction}
          </Button>
        </div>
      }
    >
      <form className="space-y-4 text-sm">
        <FormField label="이름" required>
          <TextInput
            placeholder="이름을 입력하세요"
            defaultValue={staff?.name ?? ""}
            readOnly={isReadOnly}
          />
        </FormField>

        <FormField label="로그인 ID" required>
          <TextInput
            placeholder="영문/숫자 ID를 입력하세요"
            defaultValue={staff?.loginId ?? ""}
            readOnly={isReadOnly}
          />
        </FormField>

        <FormField label="역할" required>
          <SelectInput defaultValue={staff?.role ?? ""} disabled={isReadOnly}>
            <option value="">역할을 선택하세요</option>
            <option value="ADMIN">관리자</option>
            <option value="STAFF">직원</option>
          </SelectInput>
        </FormField>

        <FormField label="매장" required>
          <SelectInput
            defaultValue={staff?.storeId ?? ""}
            disabled={isReadOnly}
          >
            <option value="">매장을 선택하세요</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="연락처" required>
          <TextInput
            placeholder="010-1234-5678"
            defaultValue={staff?.phone ?? ""}
            readOnly={isReadOnly}
          />
        </FormField>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-slate-700">
            비밀번호 초기화
          </p>
          <label className="flex items-start gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-blue-600"
            />
            <span>초기 비밀번호를 설정하고 직원에게 안내합니다.</span>
          </label>
          <p className="text-xs leading-5 text-slate-400">
            기본 비밀번호는 직원의 이메일로 전송됩니다.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-slate-700">
            활성 여부 <span className="text-rose-500">*</span>
          </p>
          <div className="flex items-center gap-3">
            <span
              className={[
                "relative inline-flex h-6 w-11 rounded-full",
                staff?.status === "INACTIVE" ? "bg-slate-300" : "bg-blue-600",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 size-5 rounded-full bg-white shadow-sm",
                  staff?.status === "INACTIVE" ? "left-0.5" : "left-5",
                ].join(" ")}
              />
            </span>
            <span className="text-xs text-slate-600">
              {staff?.status === "INACTIVE"
                ? "비활성 상태입니다."
                : "활성 상태입니다."}
            </span>
          </div>
        </div>
      </form>
    </Drawer>
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
  const metricCards = createMetricCards(pageData);
  const drawerCloseHref = createStaffsCloseHref(urlState);
  const columns = createColumns(urlState);
  const drawerKind =
    urlState.mode === "create"
      ? "create"
      : urlState.mode === "edit" && urlState.detail
        ? "edit"
        : urlState.detail && !urlState.mode
          ? "detail"
          : undefined;

  return (
    <div
      className={[
        "grid min-h-0 flex-1 overflow-hidden",
        drawerKind
          ? "xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-3 2xl:grid-cols-[minmax(0,1fr)_24.5rem]"
          : "",
      ].join(" ")}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <PageIntro
          title="직원 관리"
          description="직원 목록을 관리하고 새로운 직원을 등록할 수 있습니다."
          actions={
            <>
              <Button icon={FileDown}>엑셀 다운로드</Button>
              <LinkButton
                href={createStaffsHref({
                  ...urlState,
                  detail: undefined,
                  mode: "create",
                })}
                variant="primary"
                icon={UserPlus}
              >
                신규 직원 등록
              </LinkButton>
            </>
          }
        />

        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {metricCards.map((card) => (
            <MetricCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              helper={card.helper}
              trend={card.trend}
              tone={card.tone}
              className="p-4"
            />
          ))}
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <StaffsFilterForm state={urlState} stores={stores} />

          <DataTable
            caption="직원 목록"
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            emptyState={<StaffsEmptyState result={pageResult} />}
            bodyMaxHeight="100%"
            className="min-h-0 flex-1 rounded-none border-0 shadow-none"
            bodyClassName="h-full"
          />

          <Pagination state={urlState} total={pageData?.total ?? 0} />
        </section>
      </div>

      {drawerKind ? (
        <div className="hidden min-h-0 xl:block">
          <StaffRegistrationDrawer
            closeHref={drawerCloseHref}
            kind={drawerKind}
            staff={pageData?.detail}
            stores={stores}
          />
        </div>
      ) : null}
    </div>
  );
}
