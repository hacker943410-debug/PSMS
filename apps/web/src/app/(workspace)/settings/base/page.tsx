import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  Info,
  Lightbulb,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  Drawer,
  EmptyState,
  FormField,
  PageIntro,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  createBaseSettingsCloseHref,
  createBaseSettingsHref,
  parseBaseSettingsSearchParams,
  type BaseSettingsUrlState,
  type BaseSettingsTab,
  type PageSearchParams,
} from "@/lib/admin-foundation-url";
import {
  getAdminBaseSettingsPageData,
  type AdminBaseDetail,
  type AdminBaseListRow,
  type AdminBasePageData,
} from "@/lib/admin-read-api";

type BaseStatus = "활성" | "비활성";

type BaseRow = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  extra: string;
  status: BaseStatus;
};

type BaseDrawerKind = "create" | "detail" | "edit";

const tabs = [
  { label: "매장", value: "stores" },
  { label: "통신사", value: "carriers" },
  { label: "거래대리점", value: "salesAgencies" },
  { label: "색상", value: "colors" },
  { label: "기종", value: "deviceModels" },
  { label: "요금제", value: "ratePlans" },
  { label: "부가서비스", value: "addOnServices" },
  { label: "백업", value: "backup" },
  { label: "복원", value: "restore" },
] as const satisfies ReadonlyArray<{ label: string; value: BaseSettingsTab }>;

const tabLabels = {
  stores: "매장",
  carriers: "통신사",
  salesAgencies: "거래대리점",
  colors: "색상",
  deviceModels: "기종",
  ratePlans: "요금제",
  addOnServices: "부가서비스",
  backup: "백업",
  restore: "복원",
} as const satisfies Record<BaseSettingsTab, string>;

function toBaseStatus(status: AdminBaseListRow["status"]): BaseStatus {
  return status === "ACTIVE" ? "활성" : "비활성";
}

function formatMoney(value: number | undefined) {
  return value === undefined ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

function toBaseRows(data: AdminBasePageData | undefined): BaseRow[] {
  return (data?.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    primary: readBasePrimary(row),
    secondary: readBaseSecondary(row),
    extra: readBaseExtra(row),
    status: toBaseStatus(row.status),
  }));
}

function readBasePrimary(row: AdminBaseListRow) {
  switch (row.tab) {
    case "deviceModels":
      return row.modelNo ?? "-";
    case "ratePlans":
    case "addOnServices":
    case "salesAgencies":
      return row.carrierName ?? "-";
    case "colors":
      return row.code ?? row.hex ?? "-";
    default:
      return row.code ?? "-";
  }
}

function readBaseSecondary(row: AdminBaseListRow) {
  switch (row.tab) {
    case "deviceModels":
      return row.manufacturer ?? "-";
    case "ratePlans":
    case "addOnServices":
      return formatMoney(row.monthlyFee);
    case "stores":
      return row.phone ?? "-";
    case "salesAgencies":
      return row.contactName ?? "-";
    case "colors":
      return row.hex ?? "-";
    default:
      return "-";
  }
}

function readBaseExtra(row: AdminBaseListRow) {
  switch (row.tab) {
    case "deviceModels":
      return row.releaseDate ?? "-";
    case "stores":
      return row.address ?? "-";
    case "salesAgencies":
      return row.contractStatus ?? "-";
    case "ratePlans":
    case "addOnServices":
      return row.description ?? "-";
    default:
      return "-";
  }
}

interface BaseEmptyStateProps {
  result: Awaited<ReturnType<typeof getAdminBaseSettingsPageData>>;
  label: string;
}

function BaseEmptyState({ result, label }: BaseEmptyStateProps) {
  if (result === null) {
    return (
      <EmptyState
        title={`${label}은 릴리즈 단계에서 연결됩니다`}
        description="백업/복원은 Electron 로컬 앱 단계에서 DB 파일 점검, 백업 위치, 복원 검증과 함께 활성화합니다."
        tone="info"
        icon={<Info className="size-5" />}
      />
    );
  }

  if (!result.ok) {
    return (
      <EmptyState
        title={`${label} 정보를 불러오지 못했습니다`}
        description={result.message}
        tone="error"
        icon={<Info className="size-5" />}
      />
    );
  }

  return (
    <EmptyState
      title={`조회된 ${label} 정보가 없습니다`}
      description="검색 조건을 변경하거나 신규 등록으로 기준 정보를 추가하세요."
      tone="neutral"
      icon={<Info className="size-5" />}
    />
  );
}

function Tabs({ state }: { state: BaseSettingsUrlState }) {
  return (
    <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <ul className="flex min-w-0 overflow-x-auto px-3">
        {tabs.map((tab) => {
          const active = tab.value === state.tab;

          return (
            <li key={tab.value} className="shrink-0">
              <a
                href={createBaseSettingsHref({
                  ...state,
                  tab: tab.value,
                  page: 1,
                  detail: undefined,
                  mode: undefined,
                })}
                className={[
                  "inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors",
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-950",
                ].join(" ")}
              >
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type LinkButtonVariant = "primary" | "secondary" | "danger";

const linkButtonVariantClasses: Record<LinkButtonVariant, string> = {
  primary:
    "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
  secondary:
    "border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-200/70 hover:bg-slate-50",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
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

function createColumns(
  state: BaseSettingsUrlState
): DataTableColumn<BaseRow>[] {
  return [
    {
      key: "select",
      header: <span className="sr-only">선택</span>,
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`${row.name} 선택`}
          className="size-4 rounded border-slate-300 text-blue-600"
        />
      ),
    },
    {
      key: "name",
      header: "이름",
      cell: (row) => (
        <Link
          href={createBaseSettingsHref({
            ...state,
            detail: row.id,
            mode: undefined,
          })}
          className="font-semibold text-slate-700 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          {row.name}
        </Link>
      ),
    },
    { key: "primary", header: "코드/분류", cell: (row) => row.primary },
    { key: "secondary", header: "속성", cell: (row) => row.secondary },
    { key: "extra", header: "추가 정보", cell: (row) => row.extra },
    {
      key: "status",
      header: "상태",
      cell: (row) => (
        <TonePill tone={row.status === "활성" ? "success" : "neutral"}>
          {row.status}
        </TonePill>
      ),
    },
    {
      key: "actions",
      header: "관리",
      align: "center",
      cell: (row) => (
        <Link
          href={createBaseSettingsHref({
            ...state,
            detail: row.id,
            mode: undefined,
          })}
          aria-label={`${row.name} 상세 보기`}
          className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
        >
          <MoreVertical className="size-4" aria-hidden />
        </Link>
      ),
    },
  ];
}

function BaseSearchForm({ state }: { state: BaseSettingsUrlState }) {
  const label = tabLabels[state.tab];

  return (
    <form action="/settings/base" method="get" className="relative">
      <input type="hidden" name="tab" value={state.tab} />
      <input type="hidden" name="page" value="1" />
      {state.status !== "all" ? (
        <input type="hidden" name="status" value={state.status} />
      ) : null}
      {state.pageSize !== 10 ? (
        <input type="hidden" name="pageSize" value={state.pageSize} />
      ) : null}
      <TextInput
        name="q"
        placeholder={`${label} 검색`}
        defaultValue={state.q ?? ""}
        className="h-8 pr-9 text-xs"
      />
      <button
        type="submit"
        aria-label="기초정보 검색"
        className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
      >
        <Search className="size-4" aria-hidden />
      </button>
    </form>
  );
}

function Pagination({
  state,
  total,
}: {
  state: BaseSettingsUrlState;
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
    return createBaseSettingsHref({
      ...state,
      page,
      detail: undefined,
      mode: undefined,
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
      <p className="text-xs font-semibold text-slate-600">총 {total}건</p>
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
                ? "border-blue-500 bg-blue-600 text-white"
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
        action="/settings/base"
        method="get"
        className="flex items-center gap-2"
      >
        <input type="hidden" name="tab" value={state.tab} />
        <input type="hidden" name="page" value="1" />
        {state.status !== "all" ? (
          <input type="hidden" name="status" value={state.status} />
        ) : null}
        {state.q ? <input type="hidden" name="q" value={state.q} /> : null}
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

function HelpPanel() {
  return (
    <aside className="hidden min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm shadow-slate-200/60 2xl:block">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Info className="size-5" aria-hidden />
        </span>
        <h2 className="font-bold text-slate-950">기초정보란?</h2>
      </div>
      <p className="mt-4 leading-6 text-slate-600">
        기초정보는 판매 등록, 재고 등록, 고객 응대 등 주요 업무에서 기준
        데이터로 활용됩니다.
      </p>
      <div className="my-5 border-t border-slate-200" />
      <h3 className="text-sm font-bold text-slate-900">주요 활용 화면</h3>
      <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
        <li className="flex gap-2">
          <span className="text-blue-600">•</span>
          <span>판매 관리 &gt; 판매 등록</span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600">•</span>
          <span>재고 관리 &gt; 재고 등록</span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600">•</span>
          <span>고객 관리 &gt; 개통 등록</span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600">•</span>
          <span>보고서 &gt; 판매 현황</span>
        </li>
      </ul>
      <div className="my-5 border-t border-slate-200" />
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Lightbulb className="size-5" aria-hidden />
        </span>
        <h3 className="font-bold text-slate-950">운영 팁</h3>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        신규 기종 등록 시 정확한 출시일과 제조사를 입력하면 재고 및 통계 분석에
        도움이 됩니다.
      </p>
    </aside>
  );
}

function DeviceDrawer({
  closeHref,
  item,
  title,
  kind,
}: {
  closeHref: string;
  item?: AdminBaseDetail;
  title: string;
  kind: BaseDrawerKind;
}) {
  const modeLabel =
    kind === "create" ? "등록" : kind === "edit" ? "수정" : "상세";

  if (kind !== "create" && !item) {
    return (
      <Drawer
        title={`${title} ${modeLabel}`}
        closeHref={closeHref}
        closeLabel={`${title} 패널 닫기`}
        className="hidden h-full min-h-0 xl:flex xl:max-w-none"
      >
        <EmptyState
          title={`${title} 정보를 찾을 수 없습니다`}
          description="목록을 새로 조회하거나 다른 항목을 선택하세요."
          tone="warning"
          icon={<Info className="size-5" />}
        />
      </Drawer>
    );
  }

  return (
    <Drawer
      title={`${title} ${modeLabel}`}
      closeHref={closeHref}
      closeLabel={`${title} 패널 닫기`}
      className="hidden h-full min-h-0 xl:flex xl:max-w-none"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button className="w-full">취소</Button>
          <Button variant="primary" className="w-full">
            저장
          </Button>
        </div>
      }
    >
      <form className="space-y-4 text-sm">
        <FormField label="이름" required>
          <TextInput
            placeholder="예) Galaxy S25 Ultra"
            defaultValue={item?.name ?? ""}
          />
        </FormField>

        <FormField label="코드/모델" required>
          <TextInput
            placeholder="예) SM-S938N"
            defaultValue={item?.modelNo ?? item?.code ?? ""}
          />
        </FormField>

        <FormField label="분류">
          <TextInput
            placeholder="제조사 또는 통신사"
            defaultValue={item?.manufacturer ?? item?.carrierName ?? ""}
          />
        </FormField>

        <FormField label="출시일" required>
          <div className="relative">
            <TextInput placeholder="날짜 선택" className="pr-9" />
            <CalendarDays
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-700">
            5G 지원
          </legend>
          <div className="flex gap-5 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="fiveG"
                defaultChecked
                className="size-4 text-blue-600"
              />
              지원
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="fiveG"
                className="size-4 text-blue-600"
              />
              미지원
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">대표 이미지</p>
          <div className="flex min-h-24 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
            <Smartphone className="mb-2 size-6 text-slate-400" aria-hidden />
            <span className="font-semibold text-slate-600">이미지 업로드</span>
            <span className="mt-1">JPG, PNG 파일 (최대 2MB)</span>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-700">상태</legend>
          <div className="flex gap-5 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                defaultChecked
                className="size-4 text-blue-600"
              />
              활성
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                className="size-4 text-blue-600"
              />
              비활성
            </label>
          </div>
        </fieldset>

        <FormField label="메모">
          <textarea
            rows={3}
            placeholder="메모를 입력하세요 (선택)"
            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-1 text-right text-xs text-slate-400">0 / 200</p>
        </FormField>
      </form>
    </Drawer>
  );
}

type SettingsBasePageProps = {
  searchParams: PageSearchParams;
};

export default async function SettingsBasePage({
  searchParams,
}: SettingsBasePageProps) {
  requireRole(await requireSession(), ["ADMIN"]);
  const urlState = parseBaseSettingsSearchParams(await searchParams);
  const pageResult = await getAdminBaseSettingsPageData(urlState);
  const pageData = pageResult?.ok ? pageResult.data : undefined;
  const rows = toBaseRows(pageData);
  const currentTabLabel = tabLabels[urlState.tab];
  const drawerCloseHref = createBaseSettingsCloseHref(urlState);
  const columns = createColumns(urlState);
  const selectedItem = pageData?.detail;
  const selectedItemEditHref = selectedItem
    ? createBaseSettingsHref({
        ...urlState,
        detail: selectedItem.id,
        mode: "edit",
      })
    : undefined;
  const isDrawerOpen =
    urlState.mode === "create" ||
    (urlState.detail !== undefined &&
      (urlState.mode === "edit" || urlState.mode === undefined));
  const drawerKind: BaseDrawerKind =
    urlState.mode === "create"
      ? "create"
      : urlState.mode === "edit"
        ? "edit"
        : "detail";

  return (
    <div
      className={[
        "grid min-h-0 flex-1 overflow-hidden",
        isDrawerOpen
          ? "xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-3 2xl:grid-cols-[minmax(0,1fr)_21rem]"
          : "",
      ].join(" ")}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <PageIntro
          title={
            <span className="inline-flex items-center gap-3">
              기초정보
              <TonePill tone="info">ADMIN 전용</TonePill>
            </span>
          }
          description="운영에 필요한 기준 정보를 관리합니다."
        />

        <Tabs state={urlState} />

        <section className="grid min-h-0 flex-1 gap-3 overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_13.5rem]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-950">
                      {currentTabLabel} 관리
                    </h2>
                    <Info className="size-4 text-slate-400" aria-hidden />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    판매 및 재고 관리에서 사용하는 {currentTabLabel} 정보를
                    관리합니다.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 xl:grid-cols-[auto_minmax(11rem,1fr)] xl:items-center">
                <div className="flex flex-wrap gap-1.5">
                  <LinkButton
                    href={createBaseSettingsHref({
                      ...urlState,
                      detail: undefined,
                      mode: "create",
                    })}
                    variant="primary"
                    icon={Plus}
                    className="min-h-8 px-2.5 text-xs"
                  >
                    신규 등록
                  </LinkButton>
                  {selectedItemEditHref ? (
                    <LinkButton
                      href={selectedItemEditHref}
                      icon={Pencil}
                      className="min-h-8 px-2.5 text-xs"
                    >
                      수정
                    </LinkButton>
                  ) : (
                    <Button
                      icon={Pencil}
                      disabled
                      className="min-h-8 px-2.5 text-xs"
                    >
                      수정
                    </Button>
                  )}
                  <Button
                    icon={Trash2}
                    variant="danger"
                    disabled
                    className="min-h-8 px-2.5 text-xs"
                  >
                    삭제
                  </Button>
                  <Button
                    icon={CheckCircle2}
                    className="min-h-8 px-2.5 text-xs"
                  >
                    활성
                  </Button>
                  <Button icon={XCircle} className="min-h-8 px-2.5 text-xs">
                    비활성
                  </Button>
                </div>
                <BaseSearchForm state={urlState} />
              </div>
            </div>

            <DataTable
              caption={`${currentTabLabel} 목록`}
              columns={columns}
              data={rows}
              getRowKey={(row) => row.id}
              emptyState={
                <BaseEmptyState result={pageResult} label={currentTabLabel} />
              }
              bodyMaxHeight="100%"
              className="min-h-0 flex-1 rounded-none border-0 shadow-none"
              bodyClassName="h-full"
            />

            <Pagination state={urlState} total={pageData?.total ?? 0} />
          </section>

          <HelpPanel />
        </section>
      </div>

      {isDrawerOpen ? (
        <DeviceDrawer
          closeHref={drawerCloseHref}
          item={selectedItem}
          title={currentTabLabel}
          kind={drawerKind}
        />
      ) : null}
    </div>
  );
}
