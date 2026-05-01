import {
  BadgeDollarSign,
  Bell,
  CalendarDays,
  Download,
  FileText,
  Percent,
  RefreshCw,
  Search,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  FilterBar,
  FormField,
  MetricCard,
  PageIntro,
  Panel,
  SelectInput,
  TextInput,
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
];

const receivableColumns: DataTableColumn<ReceivableRow>[] = [
  { key: "rank", header: "순위", cell: (row) => row.rank },
  { key: "name", header: "고객명", cell: (row) => row.name },
  { key: "phone", header: "연락처", cell: (row) => row.phone },
  { key: "carrier", header: "통신사", cell: (row) => row.carrier },
  { key: "product", header: "상품명", cell: (row) => row.product },
  { key: "dueDate", header: "만료 예정일", cell: (row) => row.dueDate },
  { key: "dDay", header: "D-Day", cell: (row) => row.dDay },
  {
    key: "status",
    header: "상태",
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

      return <TonePill tone={tone[row.status]}>{label[row.status]}</TonePill>;
    },
  },
];

const scheduleColumns: DataTableColumn<ScheduleRow>[] = [
  { key: "rank", header: "순위", cell: (row) => row.rank },
  { key: "type", header: "일정 유형", cell: (row) => row.type },
  { key: "title", header: "제목", cell: (row) => row.title },
  { key: "time", header: "일시", cell: (row) => row.time },
  { key: "owner", header: "담당자", cell: (row) => row.owner },
  {
    key: "status",
    header: "상태",
    cell: (row) => (
      <TonePill tone={row.status === "planned" ? "info" : "neutral"}>
        {row.status === "planned" ? "예정" : "안내"}
      </TonePill>
    ),
  },
];

const staffBars = [
  { name: "김민수", 접수: 28, 처리: 32, 완료: 18 },
  { name: "이서연", 접수: 25, 처리: 38, 완료: 22 },
  { name: "박지훈", 접수: 22, 처리: 31, 완료: 17 },
  { name: "최유리", 접수: 17, 처리: 26, 완료: 32 },
  { name: "정대현", 접수: 19, 처리: 27, 완료: 20 },
];

const storeBars = [
  { name: "강남본점", value: 35.4, amount: "₩ 35,420,000" },
  { name: "잠실점", value: 18.9, amount: "₩ 18,980,000" },
  { name: "홍대점", value: 12.4, amount: "₩ 12,450,000" },
  { name: "분당점", value: 7.5, amount: "₩ 7,580,000" },
  { name: "일산점", value: 4.1, amount: "₩ 4,130,000" },
];

export default function WorkspaceHomePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <PageIntro
        title="대시보드"
        description="매장 현황과 주요 지표를 한눈에 확인하세요."
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
              {["오늘", "7일", "30일", "3개월", "6개월", "1년"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={[
                    "min-h-9 border-r border-slate-200 px-3 text-xs font-semibold last:border-r-0",
                    item === "30일"
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button icon={CalendarDays}>2025.04.20 ~ 2025.05.19</Button>
            <Button icon={Download}>CSV</Button>
            <Button icon={FileText}>PDF</Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={ShoppingBag}
          label="오늘 판매"
          value="28건"
          helper="전일 대비 ▲ 16.7%"
          tone="info"
        />
        <MetricCard
          icon={BadgeDollarSign}
          label="월 매출"
          value="₩ 78,560,000"
          helper="전월 대비 ▲ 12.3%"
          tone="success"
        />
        <MetricCard
          icon={WalletCards}
          label="미수금 잔액"
          value="₩ 18,240,000"
          helper="전월 대비 ▲ 5.8%"
          tone="danger"
        />
        <MetricCard
          icon={Bell}
          label="유지만료 예정"
          value="37건"
          helper="7일 이내 만료 · 12건"
          tone="warning"
        />
        <MetricCard
          icon={Percent}
          label="수납 완료율"
          value="92.4%"
          helper="목표 90% · ▲ 2.4%p"
          tone="info"
        />
      </section>

      <FilterBar
        className="hidden 2xl:block"
        actions={
          <>
            <Button icon={RefreshCw}>초기화</Button>
            <Button variant="primary" icon={Search}>
              조회
            </Button>
          </>
        }
      >
        <FormField label="기간">
          <TextInput readOnly value="2025.04.20 ~ 2025.05.19" />
        </FormField>
        <FormField label="매장">
          <SelectInput defaultValue="all">
            <option value="all">전체 매장</option>
          </SelectInput>
        </FormField>
        <FormField label="직원">
          <SelectInput defaultValue="all">
            <option value="all">전체 직원</option>
          </SelectInput>
        </FormField>
      </FilterBar>

      <section className="grid gap-3 xl:grid-cols-4">
        <Panel
          title="직원 업무 처리 현황"
          actions={<TonePill>전체 업무</TonePill>}
        >
          <div className="grid h-32 grid-cols-5 items-end gap-2 border-b border-slate-200 px-2">
            {staffBars.map((item) => (
              <div key={item.name} className="flex h-full flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <div
                    className="w-5 bg-blue-500"
                    style={{ height: `${item.접수 * 2}%` }}
                  />
                  <div
                    className="w-5 bg-teal-400"
                    style={{ height: `${item.처리 * 1.6}%` }}
                  />
                  <div
                    className="w-5 bg-slate-400"
                    style={{ height: `${item.완료 * 2.1}%` }}
                  />
                </div>
                <p className="mt-2 truncate text-center text-xs font-semibold text-slate-500">
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="매장별 매출 실적" actions={<TonePill>매출액</TonePill>}>
          <div className="space-y-3">
            {storeBars.map((item) => (
              <div
                key={item.name}
                className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-3"
              >
                <p className="text-xs font-semibold text-slate-600">
                  {item.name}
                </p>
                <div className="h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(item.value * 2.3, 100)}%` }}
                  />
                </div>
                <p className="text-right text-xs font-semibold text-slate-700">
                  {item.amount}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="통신사별 판매 건수">
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="grid size-28 place-items-center rounded-full border-[18px] border-blue-500 bg-white text-center shadow-inner">
              <div>
                <p className="text-xs text-slate-500">총 판매 건수</p>
                <p className="text-xl font-bold text-slate-950">1,248건</p>
              </div>
            </div>
            <div className="space-y-2 text-xs font-semibold text-slate-600">
              <p>
                <span className="mr-2 inline-block size-2 rounded-full bg-blue-500" />
                SKT 564건
              </p>
              <p>
                <span className="mr-2 inline-block size-2 rounded-full bg-teal-400" />
                KT 348건
              </p>
              <p>
                <span className="mr-2 inline-block size-2 rounded-full bg-rose-400" />
                LG U+ 298건
              </p>
              <p>
                <span className="mr-2 inline-block size-2 rounded-full bg-amber-400" />
                알뜰폰 38건
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="기간별 매출 흐름" actions={<TonePill>일별</TonePill>}>
          <div className="flex h-32 items-end gap-2 border-b border-slate-200 px-2">
            {[
              38, 48, 72, 58, 52, 34, 44, 50, 68, 63, 47, 60, 41, 45, 43, 49,
            ].map((height, index) => (
              <div
                key={`${height}-${index}`}
                className="flex-1 rounded-t bg-blue-300"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
        <div className="min-h-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">
              유지만료예정고객 Top 10
            </h2>
            <TonePill tone="warning">7일 이내 만료 12건</TonePill>
          </div>
          <DataTable
            caption="유지만료예정고객"
            columns={receivableColumns}
            data={receivableRows}
            bodyMaxHeight="min(16.5rem, 100%)"
            getRowKey={(row) => `${row.rank}-${row.name}`}
          />
        </div>

        <div className="min-h-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">
              예정된 일정 Top 10
            </h2>
            <Button variant="ghost">전체 보기</Button>
          </div>
          <DataTable
            caption="예정된 일정"
            columns={scheduleColumns}
            data={scheduleRows}
            bodyMaxHeight="min(16.5rem, 100%)"
            getRowKey={(row) => `${row.rank}-${row.title}`}
          />
        </div>
      </section>
    </div>
  );
}
