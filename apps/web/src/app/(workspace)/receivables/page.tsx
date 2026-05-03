import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Button,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";

type ReceivableStatus = "정상" | "부분수납" | "연체" | "완료 예정";

type ReceivableRow = {
  date: string;
  customer: string;
  phone: string;
  principal: string;
  balance: string;
  dueDate: string;
  lastPaidAt: string;
  owner: string;
  status: ReceivableStatus;
};

type ReceivableColumn = {
  key: string;
  header: string;
  className: string;
  cell: (row: ReceivableRow) => ReactNode;
};

const receivableRows: ReceivableRow[] = [
  {
    date: "2025-05-19",
    customer: "김한우",
    phone: "010-1234-5678",
    principal: "₩ 1,200,000",
    balance: "₩ 1,200,000",
    dueDate: "2025-05-26",
    lastPaidAt: "-",
    owner: "이서연",
    status: "정상",
  },
  {
    date: "2025-05-18",
    customer: "박지훈",
    phone: "010-2345-6789",
    principal: "₩ 2,380,000",
    balance: "₩ 880,000",
    dueDate: "2025-05-20",
    lastPaidAt: "2025-05-15",
    owner: "김민수",
    status: "부분수납",
  },
  {
    date: "2025-05-17",
    customer: "이수진",
    phone: "010-3456-7890",
    principal: "₩ 950,000",
    balance: "₩ 950,000",
    dueDate: "2025-05-12",
    lastPaidAt: "-",
    owner: "박지훈",
    status: "연체",
  },
  {
    date: "2025-05-16",
    customer: "최민호",
    phone: "010-4567-8901",
    principal: "₩ 1,650,000",
    balance: "₩ 350,000",
    dueDate: "2025-05-25",
    lastPaidAt: "2025-05-16",
    owner: "이서연",
    status: "부분수납",
  },
  {
    date: "2025-05-15",
    customer: "정예린",
    phone: "010-5678-9012",
    principal: "₩ 750,000",
    balance: "₩ 0",
    dueDate: "2025-05-14",
    lastPaidAt: "2025-05-14",
    owner: "김민수",
    status: "완료 예정",
  },
  {
    date: "2025-05-15",
    customer: "한승우",
    phone: "010-6789-0123",
    principal: "₩ 1,100,000",
    balance: "₩ 1,100,000",
    dueDate: "2025-05-28",
    lastPaidAt: "-",
    owner: "박지훈",
    status: "정상",
  },
  {
    date: "2025-05-14",
    customer: "오지민",
    phone: "010-7890-1234",
    principal: "₩ 2,900,000",
    balance: "₩ 1,400,000",
    dueDate: "2025-05-10",
    lastPaidAt: "2025-05-13",
    owner: "이서연",
    status: "연체",
  },
  {
    date: "2025-05-13",
    customer: "임채윤",
    phone: "010-8901-2345",
    principal: "₩ 480,000",
    balance: "₩ 480,000",
    dueDate: "2025-05-22",
    lastPaidAt: "-",
    owner: "김민수",
    status: "정상",
  },
  {
    date: "2025-05-12",
    customer: "유태민",
    phone: "010-9012-3456",
    principal: "₩ 1,350,000",
    balance: "₩ 200,000",
    dueDate: "2025-05-18",
    lastPaidAt: "2025-05-11",
    owner: "박지훈",
    status: "부분수납",
  },
  {
    date: "2025-05-11",
    customer: "서지우",
    phone: "010-0123-4567",
    principal: "₩ 600,000",
    balance: "₩ 600,000",
    dueDate: "2025-05-11",
    lastPaidAt: "-",
    owner: "이서연",
    status: "연체",
  },
];

const receivableColumns: ReceivableColumn[] = [
  {
    key: "date",
    header: "등록일",
    className: "w-[10%]",
    cell: (row) => row.date,
  },
  {
    key: "customer",
    header: "고객명",
    className: "w-[10%]",
    cell: (row) => row.customer,
  },
  {
    key: "phone",
    header: "연락처",
    className: "w-[13%]",
    cell: (row) => row.phone,
  },
  {
    key: "principal",
    header: "원금",
    className: "w-[11%] text-right",
    cell: (row) => row.principal,
  },
  {
    key: "balance",
    header: "잔액",
    className: "w-[11%] text-right",
    cell: (row) => row.balance,
  },
  {
    key: "dueDate",
    header: "만기일",
    className: "w-[11%]",
    cell: (row) => (
      <span className={row.status === "연체" ? "text-rose-500" : ""}>
        {row.dueDate}
      </span>
    ),
  },
  {
    key: "lastPaidAt",
    header: "최근 수납일",
    className: "w-[12%] text-center",
    cell: (row) => row.lastPaidAt,
  },
  {
    key: "owner",
    header: "담당자",
    className: "w-[9%]",
    cell: (row) => row.owner,
  },
  {
    key: "status",
    header: "상태",
    className: "w-[8%] text-center",
    cell: (row) => <ReceivableStatusPill status={row.status} />,
  },
  {
    key: "action",
    header: "액션",
    className: "w-[5%] text-center",
    cell: () => (
      <button
        type="button"
        className="inline-flex h-7 min-w-[58px] items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm shadow-slate-200/40"
      >
        상세
        <ChevronRight className="size-3" aria-hidden />
      </button>
    ),
  },
];

const metricCards = [
  {
    label: "총 미수금 잔액",
    value: "₩ 126,450,000",
    helper: "전일 대비",
    accent: "▲ 6.8%",
    tone: "info",
    icon: Wallet,
  },
  {
    label: "연체 건수",
    value: "37건",
    helper: "전일 대비",
    accent: "▲ 2건",
    tone: "danger",
    icon: Bell,
  },
  {
    label: "부분 수납 건수",
    value: "24건",
    helper: "전일 대비",
    accent: "▲ 5건",
    tone: "warning",
    icon: Clock3,
  },
  {
    label: "금일 수납액",
    value: "₩ 9,850,000",
    helper: "전일 대비",
    accent: "▲ 1,320,000",
    tone: "success",
    icon: Wallet,
  },
] as const;

const toneClasses = {
  info: "bg-blue-100 text-blue-600",
  danger: "bg-rose-100 text-rose-600",
  warning: "bg-orange-100 text-orange-600",
  success: "bg-green-100 text-green-600",
} as const;

function ReceivableStatusPill({ status }: { status: ReceivableStatus }) {
  const classes = {
    정상: "border-emerald-200 bg-emerald-50 text-emerald-700",
    부분수납: "border-orange-200 bg-orange-50 text-orange-600",
    연체: "border-rose-200 bg-rose-50 text-rose-600",
    "완료 예정": "border-violet-200 bg-violet-50 text-violet-600",
  }[status];

  return (
    <span
      className={[
        "inline-flex h-6 min-w-[46px] items-center justify-center rounded-md border px-2 text-[11px] font-bold leading-none",
        classes,
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function ReceivableMetricCard({
  label,
  value,
  helper,
  accent,
  tone,
  icon: Icon,
}: (typeof metricCards)[number]) {
  return (
    <article className="flex h-[110px] items-center rounded-lg border border-slate-200 bg-white px-2 shadow-sm shadow-slate-200/60 [@media(min-width:1350px)]:px-3 [@media(min-width:1500px)]:px-4">
      <span
        className={[
          "mr-2 flex size-9 shrink-0 items-center justify-center rounded-full [@media(min-width:1350px)]:mr-3 [@media(min-width:1350px)]:size-11 [@media(min-width:1500px)]:mr-4 [@media(min-width:1500px)]:size-[52px]",
          toneClasses[tone],
        ].join(" ")}
      >
        <Icon
          className="size-4 [@media(min-width:1350px)]:size-5 [@media(min-width:1500px)]:size-6"
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-4 text-slate-500">
          {label}
        </p>
        <p className="mt-1 whitespace-nowrap text-[13px] font-bold leading-6 tracking-normal text-slate-950 [@media(min-width:1350px)]:text-[17px] [@media(min-width:1500px)]:text-[21px] [@media(min-width:1500px)]:leading-7">
          {value}
        </p>
        <p className="mt-0.5 text-xs leading-4 text-slate-500">
          {helper}{" "}
          <span
            className={
              tone === "success"
                ? "font-bold text-blue-600"
                : tone === "danger" || tone === "warning"
                  ? "font-bold text-rose-500"
                  : "font-bold text-blue-600"
            }
          >
            {accent}
          </span>
        </p>
      </div>
    </article>
  );
}

function ReceivablesFilter() {
  const quickRanges = ["오늘", "7일", "30일", "3개월", "6개월", "1년"];

  return (
    <section className="mt-7 h-[154px] rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/60">
      <div className="space-y-4 text-xs font-semibold text-slate-600">
        <div className="grid grid-cols-[330px_minmax(0,1fr)_minmax(0,1fr)] gap-x-8 [@media(min-width:1800px)]:grid-cols-[430px_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid grid-cols-[2rem_1fr] items-start gap-2">
            <span className="pt-2">기간</span>
            <span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <TextInput
                  readOnly
                  value="2025.04.20 ~ 2025.05.19"
                  className="!h-8 !px-3 !pl-9 !text-xs"
                />
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                {quickRanges.map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={[
                      "h-7 min-w-[34px] whitespace-nowrap rounded-md border px-2 text-[11px] font-bold",
                      range === "30일"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-500",
                    ].join(" ")}
                  >
                    {range}
                  </button>
                ))}
              </span>
            </span>
          </label>

          <label className="grid grid-cols-[2rem_1fr] items-start gap-2">
            <span className="pt-2">매장</span>
            <SelectInput defaultValue="all" className="!h-8 !text-xs">
              <option value="all">전체 매장</option>
            </SelectInput>
          </label>

          <label className="grid grid-cols-[3rem_1fr] items-start gap-2">
            <span className="pt-2">담당자</span>
            <SelectInput defaultValue="all" className="!h-8 !text-xs">
              <option value="all">전체 담당자</option>
            </SelectInput>
          </label>
        </div>

        <div className="grid grid-cols-[170px_170px_minmax(0,1fr)] items-center gap-x-6 [@media(min-width:1800px)]:grid-cols-[210px_210px_minmax(0,1fr)]">
          <label className="grid grid-cols-[2rem_1fr] items-center gap-2">
            <span>상태</span>
            <SelectInput defaultValue="all" className="!h-8 !text-xs">
              <option value="all">전체 상태</option>
            </SelectInput>
          </label>

          <label className="grid grid-cols-[4rem_1fr] items-center gap-2">
            <span>연체 여부</span>
            <SelectInput defaultValue="all" className="!h-8 !text-xs">
              <option value="all">전체</option>
            </SelectInput>
          </label>

          <div className="grid grid-cols-[4rem_1fr_auto] items-center gap-3">
            <span>고객 검색</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                placeholder="고객명, 연락처 검색"
                className="!h-8 !pr-9 !text-xs"
              />
            </span>
            <span className="flex items-center gap-2">
              <Button
                icon={RefreshCw}
                className="!h-8 !min-h-8 whitespace-nowrap !px-3 !text-xs text-slate-600"
              >
                초기화
              </Button>
              <Button
                variant="primary"
                icon={Search}
                className="!h-8 !min-h-8 whitespace-nowrap !px-3 !text-xs"
              >
                조회
              </Button>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReceivablesTable() {
  return (
    <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 [@media(min-height:950px)]:mb-4">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <div className="flex h-full items-end gap-6 text-sm font-bold">
          {[
            ["전체", "87"],
            ["정상", "36"],
            ["부분수납", "24"],
            ["연체", "21"],
            ["완료 예정", "6"],
          ].map(([label, count], index) => (
            <button
              key={label}
              type="button"
              className={[
                "relative h-full px-1 pt-2 text-slate-700",
                index === 0 ? "text-blue-600" : "",
              ].join(" ")}
            >
              {label} ({count})
              {index === 0 ? (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600" />
              ) : null}
            </button>
          ))}
        </div>
        <Button
          icon={Download}
          className="!h-8 !min-h-8 !px-3 !text-xs text-slate-600"
        >
          CSV 다운로드
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="h-9 border-y border-slate-100 bg-slate-50">
              {receivableColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    "truncate px-2 text-left text-xs font-bold text-slate-500",
                    column.className,
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receivableRows.map((row, index) => (
              <tr
                key={`${row.date}-${row.customer}`}
                className={[
                  "h-8 bg-white [@media(min-height:950px)]:h-9",
                  index >= 10 ? "hidden" : "",
                ].join(" ")}
              >
                {receivableColumns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      "truncate px-2 align-middle text-xs font-medium text-slate-700",
                      column.className,
                    ].join(" ")}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid h-[54px] shrink-0 grid-cols-[7.5rem_minmax(0,1fr)_7.5rem] items-center px-5 [@media(min-height:950px)]:h-[58px]">
        <p className="justify-self-start whitespace-nowrap text-sm font-semibold text-slate-600">
          전체 <span className="text-blue-600">87건</span>
        </p>
        <div className="flex items-center justify-self-center gap-2">
          {["‹", "1", "2", "3", "4", "5", "...", "9", "›"].map((item) => (
            <button
              key={item}
              type="button"
              className={[
                "flex size-7 items-center justify-center rounded-md border text-sm font-semibold [@media(min-height:950px)]:size-8",
                item === "1"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>
        <SelectInput
          defaultValue="10"
          className="justify-self-end !h-7 !w-[102px] shrink-0 !text-sm [@media(min-height:950px)]:!h-8 [@media(min-height:950px)]:!w-[108px]"
        >
          <option value="10">10 / 페이지</option>
        </SelectInput>
      </div>
    </section>
  );
}

function DetailInfoCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/50 [@media(min-height:950px)]:p-4",
        className,
      ].join(" ")}
    >
      <h3 className="mb-3 text-[15px] font-bold leading-5 text-slate-950 [@media(min-height:950px)]:mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
  valueClassName = "",
  nowrap = true,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  nowrap?: boolean;
  compact?: boolean;
}) {
  const hasCustomTextColor =
    /\b!?text-(?:slate|gray|zinc|neutral|stone|rose|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}\b/.test(
      valueClassName
    );

  return (
    <p
      className={[
        "grid",
        compact
          ? "grid-cols-[3.5rem_minmax(0,1fr)] gap-1.5 text-[11.5px] leading-[22px] [@media(min-height:950px)]:text-xs [@media(min-height:950px)]:leading-6"
          : "grid-cols-[5rem_minmax(0,1fr)] gap-2 text-xs leading-[23px]",
      ].join(" ")}
    >
      <span className="whitespace-nowrap font-medium text-slate-500">
        {label}
      </span>
      <span
        className={[
          "min-w-0 font-medium",
          hasCustomTextColor ? "" : "text-slate-700",
          nowrap ? "whitespace-nowrap" : "break-keep",
          valueClassName,
        ].join(" ")}
      >
        {value}
      </span>
    </p>
  );
}

function ReceivableDetailPanel() {
  return (
    <aside className="-mt-5 flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between bg-white px-[18px]">
        <h2 className="text-[18px] font-bold leading-6 text-slate-950">
          미수금 상세
        </h2>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-slate-500"
          aria-label="상세 닫기"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-[18px] pb-0">
        <div className="flex items-center gap-2">
          <TonePill
            tone="warning"
            className="min-h-7 border-orange-200 bg-orange-50 px-3 text-xs text-orange-600"
          >
            부분수납
          </TonePill>
          <TonePill tone="danger" className="min-h-7 px-3 text-xs">
            D-2
          </TonePill>
        </div>

        <div className="grid grid-cols-2 gap-[10px]">
          <DetailInfoCard title="기본 정보">
            <div className="space-y-1.5 [@media(min-height:950px)]:space-y-2">
              <DetailRow compact label="고객명" value="박지훈" />
              <DetailRow compact label="연락처" value="010-2345-6789" />
              <DetailRow compact label="등록일" value="2025-05-18" />
              <DetailRow compact label="담당자" value="김민수" />
              <DetailRow compact label="매장" value="강남본점" />
            </div>
          </DetailInfoCard>

          <DetailInfoCard title="금액 정보">
            <div className="space-y-1.5 [@media(min-height:950px)]:space-y-2">
              <DetailRow
                compact
                label="원금"
                value="₩ 2,380,000"
                valueClassName="justify-self-end text-right font-semibold text-slate-900"
              />
              <DetailRow
                compact
                label="총 수납액"
                value="₩ 1,500,000"
                valueClassName="justify-self-end text-right font-semibold text-slate-900"
              />
              <DetailRow
                compact
                label="잔액"
                value="₩ 880,000"
                valueClassName="justify-self-end text-right text-base font-bold text-rose-500"
              />
              <DetailRow
                compact
                label="만기일"
                value={
                  <>
                    2025-05-20 <span className="text-rose-500">(D-2)</span>
                  </>
                }
                valueClassName="justify-self-end text-right"
              />
            </div>
          </DetailInfoCard>
        </div>

        <DetailInfoCard
          title="상태 정보"
          className="[@media(min-height:950px)]:min-h-[168px]"
        >
          <div className="space-y-0.5">
            <DetailRow
              label="상태"
              value="부분수납"
              valueClassName="font-bold text-orange-500"
            />
            <DetailRow
              label="연체 여부"
              value="미연체"
              valueClassName="font-bold text-emerald-600"
            />
            <DetailRow label="최근 수납일" value="2025-05-15 (4일 전)" />
            <DetailRow
              label="다음 후속 일정"
              nowrap={false}
              value={
                <span className="inline-flex items-center gap-1">
                  2025-05-21 14:00 (연락 예정)
                  <CalendarDays
                    className="size-3.5 text-slate-400"
                    aria-hidden
                  />
                </span>
              }
            />
          </div>
        </DetailInfoCard>

        <DetailInfoCard
          title="수납 내역"
          className="min-h-[192px] [@media(min-height:950px)]:min-h-[210px] [&_h3]:mb-0"
        >
          <div className="-mt-6 mb-2 flex justify-end">
            <Button
              icon={Plus}
              className="!h-7 !min-h-7 !gap-1 !px-1.5 !text-[11px] !text-blue-600 [&_svg]:!size-3.5"
            >
              수납 등록
            </Button>
          </div>
          <table className="w-full table-fixed text-[11px] text-slate-700">
            <colgroup>
              <col className="w-[23%]" />
              <col className="w-[23%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead>
              <tr className="h-7 bg-slate-50 text-slate-500">
                <th className="whitespace-nowrap px-1 text-left font-bold">
                  수납일
                </th>
                <th className="whitespace-nowrap px-1 text-right font-bold">
                  수납 금액
                </th>
                <th className="whitespace-nowrap px-1 text-center font-bold">
                  수납 방법
                </th>
                <th className="whitespace-nowrap px-1 text-center font-bold">
                  담당자
                </th>
                <th className="whitespace-nowrap px-1 text-center font-bold">
                  메모
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="h-8">
                <td className="whitespace-nowrap px-1">2025-05-15</td>
                <td className="whitespace-nowrap px-1 text-right font-semibold text-slate-900">
                  ₩ 1,000,000
                </td>
                <td className="whitespace-nowrap px-1 text-center">계좌이체</td>
                <td className="whitespace-nowrap px-1 text-center">김민수</td>
                <td className="whitespace-nowrap px-1 text-center">
                  20일 약속
                </td>
              </tr>
              <tr className="h-8">
                <td className="whitespace-nowrap px-1">2025-05-11</td>
                <td className="whitespace-nowrap px-1 text-right font-semibold text-slate-900">
                  ₩ 500,000
                </td>
                <td className="whitespace-nowrap px-1 text-center">카드</td>
                <td className="whitespace-nowrap px-1 text-center">김민수</td>
                <td className="whitespace-nowrap px-1 text-center">-</td>
              </tr>
              <tr className="h-8 font-bold">
                <td className="whitespace-nowrap px-1">합계</td>
                <td className="whitespace-nowrap px-1 text-right">
                  ₩ 1,500,000
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </DetailInfoCard>

        <DetailInfoCard
          title="후속 일정"
          className="min-h-[116px] [@media(min-height:950px)]:min-h-[168px] [&_h3]:mb-0"
        >
          <div className="-mt-6 mb-3 flex justify-end">
            <Button
              icon={Plus}
              className="!h-7 !min-h-7 !gap-1 !px-1.5 !text-[11px] !text-blue-600 [&_svg]:!size-3.5"
            >
              후속 일정 등록
            </Button>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-100 pt-3 text-sm">
            <CalendarClock
              className="size-5 shrink-0 text-slate-400"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[13px] font-semibold leading-5 text-slate-700">
                2025-05-21 (수) 14:00
              </p>
              <p className="text-xs text-slate-500">연락 예정</p>
            </div>
            <span className="ml-3 shrink-0 text-xs font-medium text-slate-600">
              김민수
            </span>
            <span className="ml-5 rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600">
              예정
            </span>
            <ChevronRight className="size-4 text-slate-400" aria-hidden />
          </div>
        </DetailInfoCard>
      </div>

      <div className="grid h-[74px] shrink-0 grid-cols-[1fr_1.18fr_1fr] gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <Button className="!h-9 !min-h-9 whitespace-nowrap !text-[13px]">
          수납 취소
        </Button>
        <Button className="!h-9 !min-h-9 whitespace-nowrap !text-[13px]">
          후속 일정 등록
        </Button>
        <Button
          variant="primary"
          className="!h-9 !min-h-9 whitespace-nowrap !text-[13px]"
        >
          수납 등록
        </Button>
      </div>
    </aside>
  );
}

export default function ReceivablesPage() {
  return (
    <div
      className="-ml-1 -mr-6 -mt-[5px] grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4 overflow-hidden"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-start justify-between">
          <div className="min-w-0">
            <h1 className="text-[25px] font-bold leading-8 tracking-normal text-slate-950">
              미수금 관리
            </h1>
            <p className="mt-0.5 text-xs leading-4 text-slate-500">
              고객별 미수금 현황을 확인하고 수납 및 후속 관리를 진행하세요.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              icon={CalendarClock}
              className="!h-9 !min-h-9 !px-3 !text-xs"
            >
              후속 일정 연결
            </Button>
            <Button icon={Wallet} className="!h-9 !min-h-9 !px-3 !text-xs">
              수납 등록
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              className="!h-9 !min-h-9 !px-4 !text-xs"
            >
              수동 미수금 등록
            </Button>
          </div>
        </header>

        <ReceivablesFilter />

        <section className="mt-4 grid h-[110px] shrink-0 grid-cols-4 gap-3">
          {metricCards.map((metric) => (
            <ReceivableMetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <ReceivablesTable />
      </div>

      <ReceivableDetailPanel />
    </div>
  );
}
