import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Info,
  Percent,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";

import { DashboardFilter } from "./dashboard-filter";
import {
  Button,
  MetricCard,
  PageIntro,
  Panel,
  TonePill,
} from "@/components/workspace";

type ReceivableRow = {
  rank: number;
  name: string;
  phone: string;
  carrier: string;
  product: string;
  dueDate: string;
  dDay: string;
  status: "urgent" | "watch" | "safe";
};

type ScheduleRow = {
  rank: number;
  type: string;
  title: string;
  time: string;
  owner: string;
  status: "planned" | "info";
};

type DashboardColumn<TData> = {
  key: string;
  header: string;
  cell: (row: TData) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
};

const receivableRows: ReceivableRow[] = [
  {
    rank: 1,
    name: "김*훈",
    phone: "010-1234-5678",
    carrier: "SKT",
    product: "T플랜 스페셜",
    dueDate: "2025-05-22",
    dDay: "D-3",
    status: "urgent",
  },
  {
    rank: 2,
    name: "이*연",
    phone: "010-2345-6789",
    carrier: "KT",
    product: "5G 슬림",
    dueDate: "2025-05-23",
    dDay: "D-4",
    status: "urgent",
  },
  {
    rank: 3,
    name: "박*수",
    phone: "010-3456-7890",
    carrier: "LG U+",
    product: "5G 프리미어",
    dueDate: "2025-05-24",
    dDay: "D-5",
    status: "urgent",
  },
  {
    rank: 4,
    name: "최*영",
    phone: "010-4567-8901",
    carrier: "SKT",
    product: "0 청년 69",
    dueDate: "2025-05-25",
    dDay: "D-6",
    status: "watch",
  },
  {
    rank: 5,
    name: "정*민",
    phone: "010-5678-9012",
    carrier: "KT",
    product: "데이터 ON 비디오",
    dueDate: "2025-05-26",
    dDay: "D-7",
    status: "watch",
  },
  {
    rank: 6,
    name: "한*희",
    phone: "010-6789-0123",
    carrier: "LG U+",
    product: "U+스마트 플랜",
    dueDate: "2025-05-27",
    dDay: "D-8",
    status: "safe",
  },
];

const scheduleRows: ScheduleRow[] = [
  {
    rank: 1,
    type: "개통 일정",
    title: "이*현 고객 개통",
    time: "2025-05-20 10:00",
    owner: "김민수",
    status: "planned",
  },
  {
    rank: 2,
    type: "유지보수",
    title: "키즈폰 필름 부착",
    time: "2025-05-20 11:00",
    owner: "이서연",
    status: "planned",
  },
  {
    rank: 3,
    type: "해지 일정",
    title: "박*철 고객 해지",
    time: "2025-05-20 13:00",
    owner: "박지훈",
    status: "planned",
  },
  {
    rank: 4,
    type: "상담 예약",
    title: "기업 회선 상담",
    time: "2025-05-20 15:00",
    owner: "정대현",
    status: "planned",
  },
  {
    rank: 5,
    type: "배송 일정",
    title: "온라인 주문 발송",
    time: "2025-05-20 16:00",
    owner: "김민수",
    status: "info",
  },
  {
    rank: 6,
    type: "상담 예약",
    title: "VIP 고객 재방문",
    time: "2025-05-20 17:00",
    owner: "최유리",
    status: "info",
  },
];

const receivableColumns: DashboardColumn<ReceivableRow>[] = [
  {
    key: "rank",
    header: "순위",
    cell: (row) => row.rank,
    className: "w-[7%]",
  },
  {
    key: "name",
    header: "고객명",
    cell: (row) => row.name,
    className: "w-[12%]",
  },
  {
    key: "phone",
    header: "연락처",
    cell: (row) => row.phone,
    className: "w-[18%]",
  },
  {
    key: "carrier",
    header: "통신사",
    cell: (row) => <CarrierBadge carrier={row.carrier} />,
    className: "w-[11%]",
  },
  {
    key: "product",
    header: "상품명",
    cell: (row) => row.product,
    className: "w-[19%]",
  },
  {
    key: "dueDate",
    header: "만료 예정일",
    cell: (row) => row.dueDate,
    className: "w-[15%]",
  },
  {
    key: "dDay",
    header: "D-Day",
    cell: (row) => row.dDay,
    className: "w-[9%]",
  },
  {
    key: "status",
    header: "상태",
    className: "w-[9%]",
    cell: (row) => {
      const tone = {
        urgent: "danger",
        watch: "warning",
        safe: "info",
      } as const;
      const label = {
        urgent: "임박",
        watch: "주의",
        safe: "안내",
      } as const;

      return (
        <TonePill
          tone={tone[row.status]}
          className="max-[1535px]:min-h-5 max-[1535px]:px-1.5 max-[1535px]:text-[10px]"
        >
          {label[row.status]}
        </TonePill>
      );
    },
  },
];

const scheduleColumns: DashboardColumn<ScheduleRow>[] = [
  {
    key: "rank",
    header: "순위",
    cell: (row) => row.rank,
    className: "w-[7%]",
  },
  {
    key: "type",
    header: "일정 유형",
    cell: (row) => row.type,
    className: "w-[17%]",
  },
  {
    key: "title",
    header: "제목",
    cell: (row) => row.title,
    className: "w-[27%]",
  },
  {
    key: "time",
    header: "일시",
    cell: (row) => row.time,
    className: "w-[24%]",
  },
  {
    key: "owner",
    header: "담당자",
    cell: (row) => row.owner,
    className: "w-[15%]",
  },
  {
    key: "status",
    header: "상태",
    className: "w-[10%]",
    cell: (row) => (
      <TonePill
        tone={row.status === "planned" ? "info" : "neutral"}
        className="max-[1535px]:min-h-5 max-[1535px]:px-1.5 max-[1535px]:text-[10px]"
      >
        {row.status === "planned" ? "예정" : "안내"}
      </TonePill>
    ),
  },
];

const storeBars = [
  { name: "강남본점", value: 35.4, amount: "₩ 35,420,000" },
  { name: "잠실점", value: 18.9, amount: "₩ 18,980,000" },
  { name: "홍대점", value: 12.4, amount: "₩ 12,450,000" },
  { name: "분당점", value: 7.5, amount: "₩ 7,580,000" },
  { name: "일산점", value: 4.1, amount: "₩ 4,130,000" },
];

const dashboardMetricCardClass =
  "h-[102px] max-[1350px]:p-3 max-[1350px]:[&>div]:gap-2 max-[1350px]:[&_span]:size-9 max-[1350px]:[&_svg]:size-4 max-[1350px]:[&_p]:truncate max-[1350px]:[&_p]:text-[11px]";

const dashboardChartPanelClass =
  "flex h-[252px] flex-col overflow-hidden max-[1350px]:h-[166px] [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:overflow-hidden max-[1350px]:[&>div:first-child]:px-3 max-[1350px]:[&>div:first-child]:py-2 max-[1350px]:[&>div:last-child]:p-2";

const dashboardFullChartPanelClass = `${dashboardChartPanelClass} [&>div:last-child]:p-2 max-[1350px]:[&>div:last-child]:p-1`;

const stackSeries = [
  { key: "완료", label: "완료", color: "#94a3b8" },
  { key: "처리", label: "처리", color: "#5cc7c8" },
  { key: "접수", label: "접수", color: "#3b82f6" },
] as const;

const staffStackedBars = [
  { name: "김민수", 접수: 22, 처리: 31, 완료: 24 },
  { name: "이서연", 접수: 21, 처리: 38, 완료: 24 },
  { name: "박지훈", 접수: 18, 처리: 31, 완료: 22 },
  { name: "최유리", 접수: 33, 처리: 26, 완료: 16 },
  { name: "정대현", 접수: 21, 처리: 27, 완료: 19 },
];

const periodChartBars = [
  12, 16, 22, 18, 15, 10, 12, 15, 21, 19, 13, 21, 18, 14, 16, 15, 17, 19,
];
const periodChartLine = [
  42, 63, 54, 49, 38, 44, 53, 59, 56, 61, 42, 45, 46, 64,
];

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Info className="size-3.5 text-slate-400" aria-hidden />
    </span>
  );
}

function ChartSelectButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-200/50 max-[1450px]:hidden"
    >
      <span>{children}</span>
      <ChevronDown className="size-3.5" aria-hidden />
    </button>
  );
}

function CarrierBadge({ carrier }: { carrier: string }) {
  const tone =
    carrier === "SKT"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : carrier === "KT"
        ? "border-teal-200 bg-teal-50 text-teal-700"
        : carrier === "LG U+"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-violet-200 bg-violet-50 text-violet-700";

  return (
    <span
      className={[
        "mx-auto inline-flex min-w-10 items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold max-[1350px]:min-w-0 max-[1350px]:px-1 max-[1350px]:py-0 max-[1350px]:text-[8.5px] max-[1350px]:leading-4",
        tone,
      ].join(" ")}
    >
      {carrier}
    </span>
  );
}

function StaffStackedChart() {
  const chartTop = 12;
  const chartHeight = 118;
  const chartLeft = 30;
  const chartRight = 292;
  const scale = chartHeight / 100;
  const barWidth = 23;
  const xPositions = [48, 95, 142, 189, 236];
  const axis = [100, 75, 50, 25, 0];

  return (
    <div className="min-h-0">
      <div className="mb-0 flex justify-center gap-4 text-[11px] font-semibold text-slate-500 max-[1350px]:hidden">
        {stackSeries
          .slice()
          .reverse()
          .map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
      </div>
      <svg
        viewBox="0 0 304 164"
        className="h-[160px] w-full max-[1350px]:h-[106px]"
        role="img"
        aria-label="직원 업무 처리 현황 차트"
      >
        {axis.map((value) => {
          const y = chartTop + (100 - value) * scale;

          return (
            <g key={value}>
              <text
                x="5"
                y={y + 4}
                className="fill-slate-500 text-[10px] font-semibold"
              >
                {value}
              </text>
              <line
                x1={chartLeft}
                y1={y}
                x2={chartRight}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            </g>
          );
        })}
        {staffStackedBars.map((item, index) => {
          let cursor = chartTop + chartHeight;

          return (
            <g key={item.name}>
              {stackSeries.map((series) => {
                const value = item[series.key];
                const height = value * scale;
                cursor -= height;

                return (
                  <rect
                    key={series.key}
                    x={xPositions[index]}
                    y={cursor}
                    width={barWidth}
                    height={height}
                    fill={series.color}
                  />
                );
              })}
              <text
                x={xPositions[index] + barWidth / 2}
                y="155"
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-semibold"
              >
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StoreHorizontalChart() {
  return (
    <div className="flex h-full min-h-0 flex-col justify-end">
      <div className="space-y-3 max-[1350px]:space-y-1.5">
        {storeBars.map((item) => (
          <div
            key={item.name}
            className="grid grid-cols-[3.5rem_1fr_5.4rem] items-center gap-3 max-[1350px]:grid-cols-[3rem_1fr_4.8rem] max-[1350px]:gap-2"
          >
            <p className="truncate text-xs font-semibold text-slate-600 max-[1350px]:text-[10px]">
              {item.name}
            </p>
            <div className="h-3 rounded-sm bg-transparent">
              <div
                className="h-3 rounded-sm bg-[#3b82f6]"
                style={{ width: `${Math.min(item.value * 2.35, 100)}%` }}
              />
            </div>
            <p className="truncate text-right text-[11px] font-semibold text-slate-700 max-[1350px]:text-[10px]">
              {item.amount}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[3.5rem_1fr] gap-3 text-[11px] font-semibold text-slate-500 max-[1350px]:mt-1 max-[1350px]:hidden">
        <span />
        <div className="grid grid-cols-5">
          {["0", "10M", "20M", "30M", "40M"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CarrierDonutChart() {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    {
      label: "SKT",
      count: "564건",
      ratio: "(45.2%)",
      percent: 45.2,
      color: "#3b82f6",
    },
    {
      label: "KT",
      count: "348건",
      ratio: "(27.9%)",
      percent: 27.9,
      color: "#5cc7c8",
    },
    {
      label: "LG U+",
      count: "298건",
      ratio: "(23.9%)",
      percent: 23.9,
      color: "#ec7894",
    },
    {
      label: "알뜰폰",
      count: "38건",
      ratio: "(3.0%)",
      percent: 3,
      color: "#c455f7",
    },
  ];
  let offset = 0;

  return (
    <div className="mx-auto grid h-full min-h-0 w-fit grid-cols-[140px_112px] items-center justify-center gap-2 min-[1700px]:grid-cols-[148px_132px] min-[1700px]:gap-3 max-[1535px]:grid-cols-[126px_100px] max-[1350px]:grid-cols-[94px_86px]">
      <svg
        viewBox="0 0 126 126"
        className="size-[140px] shrink-0 min-[1700px]:size-[148px] max-[1535px]:size-[126px] max-[1350px]:size-[94px]"
        role="img"
        aria-label="통신사별 판매 건수 도넛 차트"
      >
        <circle
          cx="63"
          cy="63"
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth="18"
        />
        {segments.map((segment) => {
          const length = (segment.percent / 100) * circumference;
          const dashArray = `${Math.max(length - 2, 0)} ${circumference}`;
          const dashOffset = -offset;
          offset += length;

          return (
            <circle
              key={segment.label}
              cx="63"
              cy="63"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 63 63)"
            />
          );
        })}
        <text
          x="63"
          y="57"
          textAnchor="middle"
          className="fill-slate-500 text-[10px] font-semibold max-[1350px]:text-[8px]"
        >
          총 판매 건수
        </text>
        <text
          x="63"
          y="78"
          textAnchor="middle"
          className="fill-slate-950 text-[18px] font-bold max-[1535px]:text-[17px] max-[1350px]:text-[13px]"
        >
          1,248건
        </text>
      </svg>
      <div className="min-w-0 space-y-3 text-[11px] font-semibold text-slate-600 max-[1350px]:space-y-1 max-[1350px]:text-[10px]">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="grid min-w-0 grid-cols-[0.5rem_2.4rem_minmax(0,1fr)] items-center gap-1.5 max-[1350px]:grid-cols-[0.45rem_2.05rem_minmax(0,1fr)] max-[1350px]:gap-1"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span>{segment.label}</span>
            <span className="truncate whitespace-nowrap text-slate-500">
              {segment.count}
              <span className="max-[1700px]:hidden"> {segment.ratio}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeriodMixedChart() {
  const chartLeft = 38;
  const chartRight = 292;
  const chartTop = 18;
  const chartHeight = 114;
  const barWidth = 8;
  const barGap = 6;
  const linePoints = periodChartLine.map((value, index) => {
    const x =
      chartLeft +
      index * ((chartRight - chartLeft) / (periodChartLine.length - 1));
    const y = chartTop + (100 - value) * (chartHeight / 100);

    return `${x},${y}`;
  });

  return (
    <div className="min-h-0">
      <div className="mb-0 flex justify-center gap-5 text-[11px] font-semibold text-slate-500 max-[1350px]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[#82bdf7]" />
          매출액(원)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#3b82f6]" />
          건수(건)
        </span>
      </div>
      <svg
        viewBox="0 0 304 164"
        className="h-[160px] w-full max-[1350px]:h-[106px]"
        role="img"
        aria-label="기간별 매출 흐름 차트"
      >
        {[40, 30, 20, 10, 0].map((value) => {
          const y = chartTop + (40 - value) * (chartHeight / 40);

          return (
            <g key={value}>
              <text
                x="8"
                y={y + 4}
                className="fill-slate-500 text-[10px] font-semibold"
              >
                {value === 0 ? "0" : `${value}M`}
              </text>
              <line
                x1={chartLeft}
                y1={y}
                x2={chartRight}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            </g>
          );
        })}
        {[100, 60, 20, 0].map((value) => {
          const y = chartTop + (100 - value) * (chartHeight / 100);

          return (
            <text
              key={value}
              x="298"
              y={y + 4}
              textAnchor="end"
              className="fill-slate-500 text-[10px] font-semibold"
            >
              {value}
            </text>
          );
        })}
        {periodChartBars.map((value, index) => {
          const x = chartLeft + 4 + index * (barWidth + barGap);
          const height = value * (chartHeight / 40);
          const y = chartTop + chartHeight - height;

          return (
            <rect
              key={`${value}-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx="1.5"
              fill="#82bdf7"
            />
          );
        })}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={linePoints.join(" ")}
        />
        {linePoints.map((point, index) => {
          const [x, y] = point.split(",");

          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2.5"
              fill="white"
              stroke="#3b82f6"
              strokeWidth="2"
            />
          );
        })}
        {[
          ["04.20", 42],
          ["04.27", 98],
          ["05.04", 160],
          ["05.11", 222],
          ["05.18", 282],
        ].map(([label, x]) => (
          <text
            key={label}
            x={x}
            y="158"
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-semibold"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function DashboardTable<TData>({
  title,
  action,
  columns,
  data,
}: {
  title: ReactNode;
  action?: ReactNode;
  columns: DashboardColumn<TData>[];
  data: TData[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-100 px-4 max-[1535px]:h-9 max-[1535px]:px-3">
        <h2 className="inline-flex items-center gap-1 text-base font-bold text-slate-950 max-[1535px]:text-sm">
          {title}
          <Info className="size-3.5 text-slate-400" aria-hidden />
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full table-fixed text-[11px]">
          <thead className="bg-slate-50">
            <tr className="h-[31px] max-[1535px]:h-6">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    "truncate px-2.5 text-center text-[11px] font-semibold text-slate-500 max-[1535px]:px-1.5 max-[1535px]:text-[9.5px]",
                    column.className ?? "",
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="h-[34px] max-[1535px]:h-[21px]">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      "px-2.5 text-center align-middle text-slate-700 max-[1535px]:px-1.5 max-[1535px]:text-[9.5px]",
                      column.key === "status"
                        ? "whitespace-nowrap"
                        : "truncate",
                      column.className ?? "",
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
      <button
        type="button"
        className="relative z-10 flex h-10 shrink-0 items-center justify-center gap-1 border-t border-slate-100 bg-white text-xs font-bold text-blue-600 max-[1535px]:h-7"
      >
        전체 보기
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export default function WorkspaceHomePage() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <PageIntro
        title="대시보드"
        description="매장 현황과 주요 지표를 한눈에 확인하세요."
        actions={
          <>
            <Button icon={BarChart3}>상세 리포트</Button>
            <Button icon={Download}>CSV</Button>
            <Button icon={FileText}>PDF</Button>
          </>
        }
      />

      <DashboardFilter />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={ShoppingBag}
          className={dashboardMetricCardClass}
          label="오늘 판매"
          value="28건"
          helper="전일 대비 ▲ 16.7%"
          tone="info"
        />
        <MetricCard
          icon={BadgeDollarSign}
          className={dashboardMetricCardClass}
          label="월 매출"
          value="₩ 78,560,000"
          helper="전월 대비 ▲ 12.3%"
          tone="success"
        />
        <MetricCard
          icon={WalletCards}
          className={dashboardMetricCardClass}
          label="미수금 잔액"
          value="₩ 18,240,000"
          helper="전월 대비 ▲ 5.8%"
          tone="danger"
        />
        <MetricCard
          icon={Bell}
          className={dashboardMetricCardClass}
          label="유지만료 예정"
          value="37건"
          helper="7일 이내 만료 · 12건"
          tone="warning"
        />
        <MetricCard
          icon={Percent}
          className={dashboardMetricCardClass}
          label="수납 완료율"
          value="92.4%"
          helper="목표 90% · ▲ 2.4%p"
          tone="info"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[330fr_320fr_306fr_323fr]">
        <Panel
          title={<PanelTitle>직원 업무 처리 현황</PanelTitle>}
          actions={<ChartSelectButton>전체 업무</ChartSelectButton>}
          className={dashboardFullChartPanelClass}
        >
          <StaffStackedChart />
        </Panel>

        <Panel
          title={<PanelTitle>매장별 매출 실적</PanelTitle>}
          actions={<ChartSelectButton>매출액</ChartSelectButton>}
          className={dashboardChartPanelClass}
        >
          <StoreHorizontalChart />
        </Panel>

        <Panel
          title={<PanelTitle>통신사별 판매 건수</PanelTitle>}
          className={dashboardChartPanelClass}
        >
          <CarrierDonutChart />
        </Panel>

        <Panel
          title={<PanelTitle>기간별 매출 흐름</PanelTitle>}
          actions={<ChartSelectButton>일별</ChartSelectButton>}
          className={dashboardFullChartPanelClass}
        >
          <PeriodMixedChart />
        </Panel>
      </section>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[634fr_668fr] 2xl:h-[326px] 2xl:flex-none">
        <DashboardTable
          title="유지만료예정고객 Top 10"
          action={
            <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 max-[1535px]:px-2 max-[1535px]:text-[10px]">
              <AlertTriangle className="size-3.5" aria-hidden />
              7일 이내 만료 12건
            </span>
          }
          columns={receivableColumns}
          data={receivableRows}
        />

        <DashboardTable
          title="예정된 일정 Top 10"
          columns={scheduleColumns}
          data={scheduleRows}
        />
      </section>

      <footer className="shrink-0 pb-1 text-center text-xs text-slate-400">
        © 2025 PhoneShop. All rights reserved.
      </footer>
    </div>
  );
}
