import {
  CalendarClock,
  Search,
  RefreshCw,
  Wallet,
  WalletCards,
  CheckCircle2,
  AlertCircle,
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
  id: string;
  date: string;
  customer: string;
  phone: string;
  carrier: "SKT" | "KT" | "LG U+";
  category: string;
  amount: string;
  dueDate: string;
  status: "overdue" | "pending" | "clear";
  owner: string;
};

const rows: ReceivableRow[] = [
  {
    id: "RC-2501",
    date: "2025-05-18",
    customer: "최민수",
    phone: "010-1234-5678",
    carrier: "SKT",
    category: "판매+단말",
    amount: "1,280,000원",
    dueDate: "2025-05-22",
    status: "overdue",
    owner: "김민수",
  },
  {
    id: "RC-2502",
    date: "2025-05-18",
    customer: "한유나",
    phone: "010-2345-6789",
    carrier: "KT",
    category: "액세서리",
    amount: "360,000원",
    dueDate: "2025-05-24",
    status: "pending",
    owner: "이서연",
  },
  {
    id: "RC-2503",
    date: "2025-05-17",
    customer: "박지원",
    phone: "010-3456-7890",
    carrier: "LG U+",
    category: "판매만",
    amount: "890,000원",
    dueDate: "2025-05-25",
    status: "clear",
    owner: "김민수",
  },
  {
    id: "RC-2504",
    date: "2025-05-17",
    customer: "이상희",
    phone: "010-4567-9012",
    carrier: "SKT",
    category: "요금제 변경",
    amount: "180,000원",
    dueDate: "2025-05-29",
    status: "pending",
    owner: "박지훈",
  },
  {
    id: "RC-2505",
    date: "2025-05-16",
    customer: "오민재",
    phone: "010-5678-9012",
    carrier: "KT",
    category: "수리비",
    amount: "95,000원",
    dueDate: "2025-06-02",
    status: "clear",
    owner: "김민수",
  },
];

const columns: DataTableColumn<ReceivableRow>[] = [
  { key: "id", header: "번호", cell: (row) => row.id },
  { key: "date", header: "발생일", cell: (row) => row.date },
  { key: "customer", header: "고객명", cell: (row) => row.customer },
  { key: "phone", header: "연락처", cell: (row) => row.phone },
  { key: "carrier", header: "이동통신사", cell: (row) => row.carrier },
  { key: "category", header: "구분", cell: (row) => row.category },
  {
    key: "amount",
    header: "금액",
    align: "right",
    cell: (row) => <span className="font-semibold">{row.amount}</span>,
  },
  { key: "dueDate", header: "마감일", cell: (row) => row.dueDate },
  {
    key: "status",
    header: "상태",
    cell: (row) => {
      const tone = {
        overdue: "danger",
        pending: "warning",
        clear: "success",
      } as const;
      const label = {
        overdue: "연체",
        pending: "미수",
        clear: "완료",
      } as const;

      return <TonePill tone={tone[row.status]}>{label[row.status]}</TonePill>;
    },
  },
  { key: "owner", header: "담당자", cell: (row) => row.owner },
  {
    key: "action",
    header: "",
    cell: () => <Button className="min-h-7 px-2 text-xs">열기</Button>,
  },
];

export default function ReceivablesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <PageIntro
        title="미수금 관리"
        description="연체 구간, 수납 대기열, 상태 변경 대상을 한 화면에서 확인합니다."
        actions={
          <>
            <Button icon={RefreshCw} variant="primary">
              동기화
            </Button>
            <Button icon={Wallet}>내보내기</Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={CalendarClock}
          label="연체 건수"
          value="18"
          helper="미수 + 연체 합계"
          tone="warning"
        />
        <MetricCard
          icon={WalletCards}
          label="총 미수금"
          value="281만원"
          helper="담당자별 집계"
          tone="info"
        />
        <MetricCard
          icon={AlertCircle}
          label="연체"
          value="4"
          helper="오늘까지 회수 필요"
          tone="danger"
        />
        <MetricCard
          icon={CheckCircle2}
          label="금주 정리 완료"
          value="7"
          helper="정산 대기 상태"
          tone="success"
        />
      </section>

      <FilterBar
        actions={
          <>
            <Button variant="primary" icon={Search}>
              조회
            </Button>
            <Button>초기화</Button>
          </>
        }
      >
        <FormField label="기간">
          <TextInput readOnly value="2025-05-01 ~ 2025-05-31" />
        </FormField>
        <FormField label="매장">
          <SelectInput defaultValue="all">
            <option value="all">전체 매장</option>
          </SelectInput>
        </FormField>
        <FormField label="통신사">
          <SelectInput defaultValue="all">
            <option value="all">전체 통신사</option>
          </SelectInput>
        </FormField>
        <FormField label="담당자">
          <SelectInput defaultValue="all">
            <option value="all">전체 담당자</option>
          </SelectInput>
        </FormField>
        <FormField label="상태">
          <SelectInput defaultValue="all">
            <option value="all">전체 상태</option>
            <option value="overdue">연체</option>
            <option value="pending">미수</option>
            <option value="clear">완료</option>
          </SelectInput>
        </FormField>
      </FilterBar>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">미수금 목록</h2>
            <Button variant="ghost" className="px-2.5 text-xs">
              전체보기
            </Button>
          </div>
          <DataTable
            caption="미수금"
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            getRowClassName={(row) =>
              row.status === "overdue" ? "bg-rose-50/50" : ""
            }
            bodyMaxHeight="100%"
            className="min-h-0 flex-1"
            bodyClassName="h-full"
          />
        </section>

        <section className="min-h-0 space-y-3 overflow-y-auto">
          <Panel
            title="연체 구간"
            description="리스크별로 정렬된 수납 현황"
            actions={<TonePill tone="warning">검토</TonePill>}
          >
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>0~7일</span>
                <TonePill tone="success">6</TonePill>
              </li>
              <li className="flex items-center justify-between">
                <span>8~14일</span>
                <TonePill tone="warning">4</TonePill>
              </li>
              <li className="flex items-center justify-between">
                <span>15일+</span>
                <TonePill tone="danger">8</TonePill>
              </li>
            </ul>
          </Panel>

          <Panel
            title="진행중 액션"
            description="일일 마감 전 추심 안내 목록"
            actions={<TonePill tone="info">3건</TonePill>}
          >
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="rounded-md border border-slate-200 px-2 py-1">
                RC-2501 최민수 고객, 오늘 18:00 이전 통화 필요
              </li>
              <li className="rounded-md border border-slate-200 px-2 py-1">
                RC-2502 할부 서류 확인
              </li>
              <li className="rounded-md border border-slate-200 px-2 py-1">
                RC-2503 입금 내역 정산
              </li>
            </ul>
          </Panel>
        </section>
      </section>
    </div>
  );
}
