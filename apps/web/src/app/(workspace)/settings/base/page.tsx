import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  ImagePlus,
  Info,
  Lightbulb,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { Button, SelectInput, TextInput } from "@/components/workspace";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import {
  createBaseSettingsCloseHref,
  createBaseSettingsHref,
  parseBaseSettingsSearchParams,
  type BaseSettingsTab,
  type BaseSettingsUrlState,
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
  modelNo: string;
  manufacturer: string;
  releaseDate: string;
  status: BaseStatus;
  isReference?: boolean;
};

type BaseDrawerKind = "create" | "detail" | "edit";

const tabs = [
  { label: "매장", value: "stores" },
  { label: "직원", value: "stores" },
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

const referenceDeviceRows: BaseRow[] = [
  {
    id: "reference-iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    modelNo: "A3295",
    manufacturer: "Apple",
    releaseDate: "2024-09-20",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-iphone-16-pro",
    name: "iPhone 16 Pro",
    modelNo: "A3294",
    manufacturer: "Apple",
    releaseDate: "2024-09-20",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-iphone-16",
    name: "iPhone 16",
    modelNo: "A3287",
    manufacturer: "Apple",
    releaseDate: "2024-09-20",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-iphone-16-plus",
    name: "iPhone 16 Plus",
    modelNo: "A3290",
    manufacturer: "Apple",
    releaseDate: "2024-09-20",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-galaxy-s25-ultra",
    name: "Galaxy S25 Ultra",
    modelNo: "SM-S938N",
    manufacturer: "Samsung",
    releaseDate: "2025-02-07",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-galaxy-s25-plus",
    name: "Galaxy S25+",
    modelNo: "SM-S936N",
    manufacturer: "Samsung",
    releaseDate: "2025-02-07",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-galaxy-s25",
    name: "Galaxy S25",
    modelNo: "SM-S931N",
    manufacturer: "Samsung",
    releaseDate: "2025-02-07",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-galaxy-z-fold6",
    name: "Galaxy Z Fold6",
    modelNo: "SM-F956N",
    manufacturer: "Samsung",
    releaseDate: "2024-07-24",
    status: "활성",
    isReference: true,
  },
  {
    id: "reference-galaxy-z-flip6",
    name: "Galaxy Z Flip6",
    modelNo: "SM-F741N",
    manufacturer: "Samsung",
    releaseDate: "2024-07-24",
    status: "비활성",
    isReference: true,
  },
  {
    id: "reference-iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    modelNo: "A3105",
    manufacturer: "Apple",
    releaseDate: "2023-09-22",
    status: "비활성",
    isReference: true,
  },
];

const compactInputClass =
  "!h-[38px] !rounded-md !border-slate-200 !px-3 !text-sm !text-slate-700";
const drawerInputClass =
  "!h-[37px] !rounded-md !border-slate-200 !px-3 !text-sm !text-slate-700";

function toBaseStatus(status: AdminBaseListRow["status"]): BaseStatus {
  return status === "ACTIVE" ? "활성" : "비활성";
}

function toBaseRows(data: AdminBasePageData | undefined): BaseRow[] {
  return (data?.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    modelNo: readModelNo(row),
    manufacturer: readManufacturer(row),
    releaseDate: readReleaseDate(row),
    status: toBaseStatus(row.status),
  }));
}

function readModelNo(row: AdminBaseListRow) {
  if (row.tab === "deviceModels") {
    return row.modelNo ?? row.code ?? "-";
  }

  return row.code ?? row.carrierName ?? "-";
}

function readManufacturer(row: AdminBaseListRow) {
  if (row.tab === "deviceModels") {
    return row.manufacturer ?? "-";
  }

  return row.contactName ?? row.hex ?? row.phone ?? "-";
}

function readReleaseDate(row: AdminBaseListRow) {
  if (row.tab === "deviceModels") {
    return row.releaseDate ?? "-";
  }

  return row.updatedAt ? row.updatedAt.slice(0, 10) : "-";
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

function Tabs({ state }: { state: BaseSettingsUrlState }) {
  return (
    <nav className="h-[55px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <ul className="flex h-full min-w-0 items-center overflow-hidden px-2">
        {tabs.map((tab, index) => {
          const active = tab.value === state.tab;

          return (
            <li key={`${tab.label}-${index}`} className="h-full shrink-0">
              <Link
                href={createBaseSettingsHref({
                  ...state,
                  tab: tab.value,
                  page: 1,
                  detail: undefined,
                  mode: undefined,
                })}
                className={[
                  "inline-flex h-full min-w-[72px] items-center justify-center border-b-2 px-3 text-sm font-bold transition-colors",
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-950",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StatusBadge({ status }: { status: BaseStatus }) {
  const isActive = status === "활성";

  return (
    <span
      className={[
        "inline-flex h-7 min-w-[43px] items-center justify-center rounded-md px-2 text-xs font-bold",
        isActive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function BaseRowLink({
  row,
  state,
  children,
  className = "",
}: {
  row: BaseRow;
  state: BaseSettingsUrlState;
  children: ReactNode;
  className?: string;
}) {
  const href = row.isReference
    ? createBaseSettingsHref({ ...state, detail: undefined, mode: "create" })
    : createBaseSettingsHref({ ...state, detail: row.id, mode: undefined });

  return (
    <Link
      href={href}
      className={[
        "font-medium text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
        className,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function BaseSearchForm({ state }: { state: BaseSettingsUrlState }) {
  const label = tabLabels[state.tab];

  return (
    <form action="/settings/base" method="get" className="relative w-[190px]">
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
        placeholder={`${label}명 또는 모델명 검색`}
        defaultValue={state.q ?? ""}
        className={`${compactInputClass} !pr-9`}
      />
      <button
        type="submit"
        aria-label="기초정보 검색"
        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
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
    "flex size-8 items-center justify-center rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2";

  function pageHref(page: number) {
    return createBaseSettingsHref({
      ...state,
      page,
      detail: undefined,
      mode: undefined,
    });
  }

  return (
    <div className="flex h-[88px] shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-5 [@media(max-height:850px)]:!h-12 [@media(max-height:950px)]:h-[62px]">
      <p className="w-[160px] text-sm font-medium text-slate-600">
        총 {total}건
      </p>
      <div className="flex flex-1 items-center justify-center gap-3">
        <Link
          href={pageHref(Math.max(1, state.page - 1))}
          aria-label="이전 페이지"
          className={`${linkClassName} border-transparent bg-white text-slate-500 hover:border-slate-200`}
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
      <form
        action="/settings/base"
        method="get"
        className="flex w-[160px] items-center justify-end"
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
          className="!h-9 !w-[108px] !rounded-md !text-xs"
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

function HelpPanel() {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white px-5 py-[31px] shadow-sm shadow-slate-200/60 [@media(max-width:1499px)]:hidden">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Info className="size-5" aria-hidden />
        </span>
        <h2 className="text-base font-bold text-slate-950">기초정보란?</h2>
      </div>
      <p className="mt-[25px] text-sm font-medium leading-7 text-slate-600">
        기초정보는 판매 등록, 재고 등록, 고객 응대 등 주요 업무에서 기준
        데이터로 활용됩니다.
      </p>
      <div className="my-[24px] border-t border-slate-200" />
      <h3 className="text-sm font-bold text-slate-900">주요 활용 화면</h3>
      <ul className="mt-4 space-y-[18px] text-xs font-medium leading-5 text-slate-600">
        <li className="flex gap-3">
          <span className="text-blue-600">•</span>
          <span>판매 관리 &gt; 판매 등록</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600">•</span>
          <span>재고 관리 &gt; 재고 등록</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600">•</span>
          <span>고객 관리 &gt; 개통 등록</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600">•</span>
          <span>보고서 &gt; 판매 현황</span>
        </li>
      </ul>
      <div className="my-[24px] border-t border-slate-200" />
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Lightbulb className="size-5" aria-hidden />
        </span>
        <h3 className="font-bold text-slate-950">운영 팁</h3>
      </div>
      <p className="mt-[22px] text-xs font-medium leading-6 text-slate-600">
        신규 기종 등록 시 정확한 출시일과 제조사를 입력하면 재고 및 통계 분석에
        도움이 됩니다.
      </p>
    </aside>
  );
}

function BaseTablePanel({
  rows,
  state,
  total,
  currentTabLabel,
  pageResult,
}: {
  rows: BaseRow[];
  state: BaseSettingsUrlState;
  total: number;
  currentTabLabel: string;
  pageResult: Awaited<ReturnType<typeof getAdminBaseSettingsPageData>>;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="h-[156px] shrink-0 px-5 pt-[22px] [@media(max-height:850px)]:!h-[132px] [@media(max-height:950px)]:h-[140px]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold leading-6 text-slate-950">
              {currentTabLabel} 관리
            </h2>
            <Info className="size-4 text-slate-400" aria-hidden />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            판매 및 재고 관리에서 사용하는 {currentTabLabel} 정보를 관리합니다.
          </p>
        </div>

        <div className="mt-[36px] flex items-center justify-between gap-3 [@media(max-height:850px)]:!mt-4 [@media(max-height:950px)]:mt-6">
          <div className="flex items-center gap-2">
            <LinkButton
              href={createBaseSettingsHref({
                ...state,
                detail: undefined,
                mode: "create",
              })}
              variant="primary"
              icon={Plus}
              className="!min-h-[37px] !px-4 !text-sm"
            >
              신규 등록
            </LinkButton>
            <Button icon={Pencil} className="!min-h-[37px] !px-4 !text-sm">
              수정
            </Button>
            <Button
              icon={Trash2}
              variant="danger"
              className="!min-h-[37px] !px-4 !text-sm"
            >
              삭제
            </Button>
            <Button
              icon={CheckCircle2}
              className="!min-h-[37px] !px-4 !text-sm"
            >
              활성
            </Button>
            <Button icon={XCircle} className="!min-h-[37px] !px-4 !text-sm">
              비활성
            </Button>
          </div>
          <BaseSearchForm state={state} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">{currentTabLabel} 목록</caption>
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="h-[50px] border-y border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 [@media(max-height:850px)]:!h-8 [@media(max-height:950px)]:h-11">
              <th className="px-5 text-left">
                <span className="sr-only">선택</span>
              </th>
              <th className="px-2 text-left">기종명</th>
              <th className="px-2 text-left">모델명</th>
              <th className="px-2 text-left">제조사</th>
              <th className="px-2 text-left">출시일</th>
              <th className="px-2 text-left">상태</th>
              <th className="px-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-[46px] text-sm font-medium text-slate-600 [@media(max-height:850px)]:!h-8 [@media(max-height:950px)]:h-[42px]"
                >
                  <td className="px-5">
                    <input
                      type="checkbox"
                      aria-label={`${row.name} 선택`}
                      className="size-4 rounded border-slate-300 text-blue-600"
                    />
                  </td>
                  <td className="truncate px-2">
                    <BaseRowLink row={row} state={state}>
                      {row.name}
                    </BaseRowLink>
                  </td>
                  <td className="truncate px-2">{row.modelNo}</td>
                  <td className="truncate px-2">{row.manufacturer}</td>
                  <td className="truncate px-2">{row.releaseDate}</td>
                  <td className="px-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-2 text-center">
                    <BaseRowLink
                      row={row}
                      state={state}
                      className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
                    >
                      <MoreVertical className="size-4" aria-hidden />
                      <span className="sr-only">{row.name} 상세 보기</span>
                    </BaseRowLink>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="h-[460px] px-5 text-center text-sm text-slate-500 [@media(max-height:850px)]:!h-[320px] [@media(max-height:950px)]:h-[420px]"
                >
                  {pageResult === null
                    ? `${currentTabLabel}은 릴리즈 단계에서 연결됩니다.`
                    : pageResult.ok
                      ? `조회된 ${currentTabLabel} 정보가 없습니다.`
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

function DrawerField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-3 block text-sm font-bold leading-4 text-slate-700 [@media(max-height:850px)]:!mb-1 [@media(max-height:950px)]:mb-2">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function DeviceRegisterPanel({
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
  const isReadOnly = kind === "detail";

  return (
    <aside
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl shadow-slate-300/40 [@media(max-width:1399px)]:hidden"
      aria-label={`${title} ${modeLabel}`}
    >
      <div className="flex h-[62px] shrink-0 items-center justify-between border-b border-slate-200 px-6">
        <h2 className="text-xl font-bold leading-6 text-slate-950">
          {title} {modeLabel}
        </h2>
        <Link
          href={closeHref}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label={`${title} 패널 닫기`}
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <form className="min-h-0 flex-1 space-y-[23px] overflow-hidden px-[22px] pb-4 pt-[27px] text-sm [@media(max-height:850px)]:!space-y-2 [@media(max-height:850px)]:!pb-1 [@media(max-height:850px)]:!pt-3 [@media(max-height:950px)]:space-y-[14px] [@media(max-height:950px)]:pb-2 [@media(max-height:950px)]:pt-5">
        <DrawerField label="기종명" required>
          <TextInput
            placeholder="예) Galaxy S25 Ultra"
            defaultValue={item?.name ?? ""}
            readOnly={isReadOnly}
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField label="모델명" required>
          <TextInput
            placeholder="예) SM-S938N"
            defaultValue={item?.modelNo ?? item?.code ?? ""}
            readOnly={isReadOnly}
            className={drawerInputClass}
          />
        </DrawerField>

        <DrawerField label="제조사" required>
          <SelectInput
            defaultValue={item?.manufacturer ?? ""}
            disabled={isReadOnly}
            className={drawerInputClass}
          >
            <option value="">선택하세요</option>
            <option value="Samsung">Samsung</option>
            <option value="Apple">Apple</option>
          </SelectInput>
        </DrawerField>

        <DrawerField label="출시일" required>
          <div className="relative">
            <TextInput
              placeholder="날짜 선택"
              readOnly={isReadOnly}
              className={`${drawerInputClass} !pr-10`}
            />
            <CalendarDays
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </DrawerField>

        <fieldset className="space-y-4 [@media(max-height:850px)]:!space-y-2 [@media(max-height:950px)]:space-y-3">
          <legend className="text-sm font-bold text-slate-700">5G 지원</legend>
          <div className="flex gap-6 text-sm font-medium text-slate-600">
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

        <div className="space-y-3 [@media(max-height:850px)]:!space-y-2">
          <p className="text-sm font-bold text-slate-700">대표 이미지</p>
          <div className="flex h-[95px] flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-xs font-medium text-slate-500 [@media(max-height:850px)]:!h-16 [@media(max-height:950px)]:h-20">
            <ImagePlus
              className="mb-2 size-6 text-slate-400 [@media(max-height:850px)]:!mb-1 [@media(max-height:850px)]:!size-5"
              aria-hidden
            />
            <span className="text-sm font-bold text-slate-600">
              이미지 업로드
            </span>
            <span className="mt-1">JPG, PNG 파일 (최대 2MB)</span>
          </div>
        </div>

        <fieldset className="space-y-4 [@media(max-height:850px)]:!space-y-2 [@media(max-height:950px)]:space-y-3">
          <legend className="text-sm font-bold text-slate-700">상태</legend>
          <div className="flex gap-6 text-sm font-medium text-slate-600">
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

        <DrawerField label="메모">
          <textarea
            rows={3}
            placeholder="메모를 입력하세요 (선택)"
            className="h-[64px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 [@media(max-height:850px)]:!h-10 [@media(max-height:950px)]:h-[52px]"
          />
          <p className="mt-2 text-right text-xs text-slate-400">0 / 200</p>
        </DrawerField>
      </form>

      <div className="grid h-[86px] shrink-0 grid-cols-[1fr_64px] gap-3 border-t border-slate-200 px-[22px] py-[18px] [@media(max-height:850px)]:!h-[60px] [@media(max-height:850px)]:!py-2 [@media(max-height:950px)]:h-[66px] [@media(max-height:950px)]:py-[13px]">
        <Button className="!h-10 !min-h-10 !text-sm">취소</Button>
        <Button variant="primary" className="!h-10 !min-h-10 !text-sm">
          저장
        </Button>
      </div>
    </aside>
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
  const selectedItem = pageData?.detail;
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
  const activeDrawerKind = isDrawerOpen ? drawerKind : "create";
  const useReferenceRows = urlState.tab === "deviceModels" && rows.length < 10;
  const displayRows = useReferenceRows ? referenceDeviceRows : rows;
  const displayTotal = useReferenceRows ? 128 : (pageData?.total ?? 0);

  return (
    <div
      className="-mb-4 -mr-6 -mt-[25px] grid h-[100dvh] min-h-0 grid-cols-[minmax(0,1fr)_334px] gap-3 overflow-hidden [@media(max-width:1399px)]:grid-cols-1 [@media(max-width:1399px)]:gap-0"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pb-4 pt-[25px]">
        <header className="flex h-[74px] shrink-0 items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold leading-9 tracking-normal text-slate-950">
                기초정보
              </h1>
              <span className="inline-flex h-7 items-center rounded-md bg-blue-100 px-3 text-xs font-bold text-blue-600">
                ADMIN 전용
              </span>
            </div>
            <p className="mt-1 text-xs leading-4 text-slate-500">
              운영에 필요한 기준 정보를 관리합니다.
            </p>
          </div>
        </header>

        <Tabs state={urlState} />

        <div className="h-4 shrink-0" />

        <section className="grid h-[756px] min-h-0 shrink-0 grid-cols-[minmax(0,1fr)_212px] overflow-hidden [@media(max-width:1499px)]:grid-cols-1 [@media(max-height:850px)]:!h-[610px] [@media(max-height:950px)]:h-[726px]">
          <BaseTablePanel
            rows={displayRows}
            state={urlState}
            total={displayTotal}
            currentTabLabel={currentTabLabel}
            pageResult={pageResult}
          />
          <HelpPanel />
        </section>
      </div>

      <DeviceRegisterPanel
        closeHref={drawerCloseHref}
        item={selectedItem}
        title={currentTabLabel}
        kind={activeDrawerKind}
      />
    </div>
  );
}
