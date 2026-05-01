import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  UserCheck,
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

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  carrier: "SKT" | "KT" | "LG U+";
  status: "active" | "pending" | "blocked";
  plan: string;
  store: string;
  lastVisit: string;
  salesCount: number;
};

const customers: CustomerRow[] = [
  {
    id: "C-001",
    name: "최민수",
    phone: "010-1234-5678",
    carrier: "SKT",
    status: "active",
    plan: "5G 베이직",
    store: "강남본점",
    lastVisit: "2025-05-18",
    salesCount: 4,
  },
  {
    id: "C-002",
    name: "한유나",
    phone: "010-2345-6789",
    carrier: "KT",
    status: "pending",
    plan: "5G 가족결합",
    store: "종로점",
    lastVisit: "2025-05-10",
    salesCount: 2,
  },
  {
    id: "C-003",
    name: "박지원",
    phone: "010-3456-7890",
    carrier: "LG U+",
    status: "active",
    plan: "데이터 세이브",
    store: "부산점",
    lastVisit: "2025-05-16",
    salesCount: 5,
  },
  {
    id: "C-004",
    name: "이상희",
    phone: "010-4567-9012",
    carrier: "SKT",
    status: "blocked",
    plan: "프리미엄",
    store: "인천점",
    lastVisit: "2025-04-20",
    salesCount: 1,
  },
  {
    id: "C-005",
    name: "오민재",
    phone: "010-5678-9012",
    carrier: "KT",
    status: "active",
    plan: "5G 가족결합",
    store: "강남본점",
    lastVisit: "2025-05-17",
    salesCount: 3,
  },
];

const columns: DataTableColumn<CustomerRow>[] = [
  { key: "id", header: "고객번호", cell: (row) => row.id },
  { key: "name", header: "이름", cell: (row) => row.name },
  { key: "phone", header: "연락처", cell: (row) => row.phone },
  { key: "carrier", header: "통신사", cell: (row) => row.carrier },
  { key: "plan", header: "요금제", cell: (row) => row.plan },
  { key: "store", header: "매장", cell: (row) => row.store },
  { key: "lastVisit", header: "최종방문", cell: (row) => row.lastVisit },
  {
    key: "salesCount",
    header: "판매건수",
    align: "right",
    cell: (row) => row.salesCount,
  },
  {
    key: "status",
    header: "상태",
    cell: (row) => {
      const tone = {
        active: "success",
        pending: "warning",
        blocked: "danger",
      } as const;
      const label = {
        active: "활성",
        pending: "보류",
        blocked: "차단",
      } as const;

      return <TonePill tone={tone[row.status]}>{label[row.status]}</TonePill>;
    },
  },
];

const summary = [
  { title: "활성", count: 42, tone: "success" as const },
  { title: "보류", count: 11, tone: "warning" as const },
  { title: "차단", count: 3, tone: "danger" as const },
  { title: "전체", count: 56, tone: "info" as const },
];

export default function CustomersPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <PageIntro
        title="고객 관리"
        description="고객 목록, 계약 상태, 미수 여부와 후속 조치 대상을 확인합니다."
        actions={
          <>
            <Button icon={Plus} variant="primary">
              고객 등록
            </Button>
            <Button icon={RefreshCw}>동기화</Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {summary.map((item) => (
          <MetricCard
            key={item.title}
            icon={Users}
            label={item.title}
            value={item.count.toString()}
            helper="현재 필터 기준"
            tone={item.tone}
          />
        ))}
      </section>

      <FilterBar
        actions={
          <>
            <Button variant="primary" icon={Search}>
              검색
            </Button>
            <Button icon={FileText}>CSV</Button>
          </>
        }
      >
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
        <FormField label="상태">
          <SelectInput defaultValue="all">
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="pending">보류</option>
            <option value="blocked">차단</option>
          </SelectInput>
        </FormField>
        <FormField label="매장 담당자">
          <SelectInput defaultValue="all">
            <option value="all">전체</option>
          </SelectInput>
        </FormField>
        <FormField label="검색어">
          <TextInput placeholder="이름, 전화번호, 고객번호" />
        </FormField>
      </FilterBar>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">고객 목록</h2>
            <TonePill tone="info">56건</TonePill>
          </div>
          <DataTable
            caption="고객"
            columns={columns}
            data={customers}
            getRowKey={(row) => row.id}
            bodyMaxHeight="100%"
            className="min-h-0 flex-1"
            bodyClassName="h-full"
          />
        </section>

        <section className="min-h-0 space-y-3 overflow-y-auto">
          <Panel title="통신사 비중" description="현재 고객 목록 기준">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>SKT</span>
                <TonePill tone="info">18</TonePill>
              </li>
              <li className="flex items-center justify-between">
                <span>KT</span>
                <TonePill tone="warning">20</TonePill>
              </li>
              <li className="flex items-center justify-between">
                <span>LG U+</span>
                <TonePill tone="success">18</TonePill>
              </li>
            </ul>
          </Panel>

          <Panel
            title="고객 상태 확인"
            description="빠른 상태 처리"
            actions={<TonePill tone="neutral">빠른 처리</TonePill>}
          >
            <div className="space-y-2">
              <Button
                icon={UserCheck}
                variant="ghost"
                className="w-full justify-start"
              >
                실명 인증 처리
              </Button>
              <Button
                icon={ShieldCheck}
                variant="ghost"
                className="w-full justify-start"
              >
                차단 계정 점검
              </Button>
            </div>
          </Panel>
        </section>
      </section>
    </div>
  );
}
