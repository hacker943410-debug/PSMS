import {
  BadgeDollarSign,
  BarChart3,
  Download,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  Drawer,
  FilterBar,
  FormField,
  MetricCard,
  PageIntro,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";

type SaleRow = {
  time: string;
  customer: string;
  phone: string;
  carrier: "SKT" | "KT" | "LG U+";
  type: "신규" | "기변" | "번이";
  device: string;
  plan: string;
  amount: string;
  receivable: "정상" | "보류" | "미수 있음";
  owner: string;
};

const rows: SaleRow[] = [
  {
    time: "2025-05-19 14:32",
    customer: "김민수",
    phone: "010-1234-5678",
    carrier: "SKT",
    type: "신규",
    device: "Galaxy S25 (256G)",
    plan: "5GX 프라임",
    amount: "₩ 1,199,000",
    receivable: "정상",
    owner: "이서연",
  },
  {
    time: "2025-05-19 13:51",
    customer: "이지현",
    phone: "010-2345-6789",
    carrier: "KT",
    type: "기변",
    device: "iPhone 16 (128G)",
    plan: "5G 슬림",
    amount: "₩ 979,000",
    receivable: "보류",
    owner: "박지훈",
  },
  {
    time: "2025-05-19 11:20",
    customer: "박준호",
    phone: "010-3456-7890",
    carrier: "LG U+",
    type: "번이",
    device: "Galaxy S25 Ultra (512G)",
    plan: "5G 시그니처",
    amount: "₩ 1,449,000",
    receivable: "미수 있음",
    owner: "최유리",
  },
  {
    time: "2025-05-18 19:05",
    customer: "최은정",
    phone: "010-4567-8901",
    carrier: "SKT",
    type: "신규",
    device: "iPhone 16 Pro (256G)",
    plan: "5GX 플래티넘",
    amount: "₩ 1,350,000",
    receivable: "정상",
    owner: "김민수",
  },
  {
    time: "2025-05-18 17:44",
    customer: "정우성",
    phone: "010-5678-9012",
    carrier: "KT",
    type: "기변",
    device: "S24+ (256G)",
    plan: "5G 베이직",
    amount: "₩ 839,000",
    receivable: "정상",
    owner: "이서연",
  },
  {
    time: "2025-05-18 16:10",
    customer: "한지민",
    phone: "010-6789-0123",
    carrier: "LG U+",
    type: "번이",
    device: "iPhone 15 (128G)",
    plan: "5G 슬림+",
    amount: "₩ 759,000",
    receivable: "보류",
    owner: "박지훈",
  },
  {
    time: "2025-05-18 15:33",
    customer: "이태훈",
    phone: "010-7890-1234",
    carrier: "SKT",
    type: "기변",
    device: "Galaxy Z Flip6 (256G)",
    plan: "5GX 스탠다드",
    amount: "₩ 1,089,000",
    receivable: "정상",
    owner: "최유리",
  },
  {
    time: "2025-05-18 14:22",
    customer: "김하늘",
    phone: "010-8901-2345",
    carrier: "KT",
    type: "신규",
    device: "Galaxy A55 (128G)",
    plan: "5G Y틴",
    amount: "₩ 449,000",
    receivable: "정상",
    owner: "김민수",
  },
  {
    time: "2025-05-18 13:01",
    customer: "오세훈",
    phone: "010-9012-3456",
    carrier: "LG U+",
    type: "번이",
    device: "iPhone 16 (256G)",
    plan: "5G 프리미어",
    amount: "₩ 1,179,000",
    receivable: "미수 있음",
    owner: "이서연",
  },
  {
    time: "2025-05-17 18:45",
    customer: "송지효",
    phone: "010-0123-4567",
    carrier: "SKT",
    type: "신규",
    device: "S23 (256G)",
    plan: "5GX 레귤러",
    amount: "₩ 699,000",
    receivable: "정상",
    owner: "박지훈",
  },
];

const columns: DataTableColumn<SaleRow>[] = [
  {
    key: "time",
    header: "판매일",
    cell: (row) => (
      <span className="font-semibold text-blue-600">{row.time}</span>
    ),
  },
  { key: "customer", header: "고객명", cell: (row) => row.customer },
  { key: "phone", header: "연락처", cell: (row) => row.phone },
  { key: "carrier", header: "통신사", cell: (row) => row.carrier },
  {
    key: "type",
    header: "가입유형",
    cell: (row) => {
      const tone = {
        신규: "info",
        기변: "success",
        번이: "warning",
      } as const;

      return <TonePill tone={tone[row.type]}>{row.type}</TonePill>;
    },
  },
  { key: "device", header: "기종", cell: (row) => row.device },
  { key: "plan", header: "요금제", cell: (row) => row.plan },
  {
    key: "amount",
    header: "판매금액",
    align: "right",
    cell: (row) => (
      <span className="font-bold text-slate-900">{row.amount}</span>
    ),
  },
  {
    key: "receivable",
    header: "미수 상태",
    cell: (row) => {
      const tone = {
        정상: "success",
        보류: "warning",
        "미수 있음": "danger",
      } as const;

      return <TonePill tone={tone[row.receivable]}>{row.receivable}</TonePill>;
    },
  },
  { key: "owner", header: "담당자", cell: (row) => row.owner },
  {
    key: "detail",
    header: "상세",
    cell: () => <Button className="min-h-7 px-2 text-xs">보기</Button>,
  },
];

export default function SalesPage() {
  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_18.5rem] xl:gap-3">
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <PageIntro
          title="판매 관리"
          description="판매 내역을 조회하고 검색할 수 있습니다."
          actions={
            <>
              <Button variant="primary" icon={Plus}>
                판매 등록
              </Button>
              <Button icon={Download}>CSV 다운로드</Button>
              <Button icon={BarChart3}>상세 리포트</Button>
            </>
          }
        />

        <FilterBar
          actions={
            <>
              <Button icon={RefreshCw}>초기화</Button>
              <Button variant="primary" icon={Search}>
                검색
              </Button>
            </>
          }
        >
          <FormField label="기간">
            <TextInput readOnly value="2025.05.01 ~ 2025.05.19" />
          </FormField>
          <FormField label="매장">
            <SelectInput defaultValue="all">
              <option value="all">전체 매장</option>
            </SelectInput>
          </FormField>
          <FormField label="담당자">
            <SelectInput defaultValue="all">
              <option value="all">전체 담당자</option>
            </SelectInput>
          </FormField>
          <FormField label="통신사">
            <SelectInput defaultValue="all">
              <option value="all">전체</option>
            </SelectInput>
          </FormField>
          <FormField label="가입유형">
            <SelectInput defaultValue="all">
              <option value="all">전체</option>
            </SelectInput>
          </FormField>
          <FormField label="상태">
            <SelectInput defaultValue="all">
              <option value="all">전체</option>
            </SelectInput>
          </FormField>
          <FormField label="검색">
            <TextInput placeholder="고객/연락처/주문번호" />
          </FormField>
        </FilterBar>

        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            icon={ShoppingBag}
            label="총 판매건수"
            value="1,248건"
            helper="전월 대비 ▲ 12.3%"
            tone="info"
          />
          <MetricCard
            icon={BarChart3}
            label="금일 판매"
            value="28건"
            helper="금액 ₩ 78,560,000"
            tone="success"
          />
          <MetricCard
            icon={BadgeDollarSign}
            label="평균 판매금액"
            value="₩ 624,300"
            helper="전월 대비 ▲ 5.8%"
            tone="warning"
          />
          <MetricCard
            icon={WalletCards}
            label="미수 포함 거래"
            value="37건"
            helper="금액 ₩ 18,240,000"
            tone="danger"
          />
        </section>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">
              판매 목록 <span className="text-slate-500">(총 1,248건)</span>
            </h2>
            <div className="flex items-center gap-2">
              <SelectInput defaultValue="20" className="w-36">
                <option value="20">페이지당 20개</option>
              </SelectInput>
              <Button>열 설정</Button>
            </div>
          </div>
          <DataTable
            caption="판매 목록"
            columns={columns}
            data={rows}
            getRowKey={(row) => `${row.time}-${row.customer}`}
            getRowClassName={(_, index) => (index === 0 ? "bg-blue-50" : "")}
            bodyMaxHeight="100%"
            className="min-h-0 flex-1"
            bodyClassName="h-full"
          />
          <div className="mt-3 flex items-center justify-center gap-2">
            {["‹", "1", "2", "3", "4", "5", "…", "63", "›"].map((item) => (
              <button
                key={item}
                type="button"
                className={[
                  "flex size-8 items-center justify-center rounded-md border text-xs font-semibold",
                  item === "1"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="hidden min-h-0 xl:block">
        <Drawer title="판매 상세" description="SO-20250519-0001">
          <div className="space-y-4 text-sm">
            <section className="border-b border-slate-200 pb-4">
              <div className="grid grid-cols-[5rem_1fr] gap-y-2 text-xs">
                <span className="font-semibold text-slate-500">판매일</span>
                <span className="text-slate-800">2025-05-19 14:32</span>
                <span className="font-semibold text-slate-500">상태</span>
                <TonePill tone="success">정상</TonePill>
              </div>
            </section>
            <section className="space-y-2 border-b border-slate-200 pb-4">
              <h3 className="text-sm font-bold text-slate-950">고객 정보</h3>
              {[
                ["고객명", "김민수"],
                ["연락처", "010-1234-5678"],
                ["생년월일", "1992-03-15"],
                ["이메일", "kms1234@gmail.com"],
                ["주소", "서울특별시 강남구 테헤란로 123"],
              ].map(([label, value]) => (
                <p key={label} className="grid grid-cols-[5rem_1fr] text-xs">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="text-slate-800">{value}</span>
                </p>
              ))}
            </section>
            <section className="space-y-2 border-b border-slate-200 pb-4">
              <h3 className="text-sm font-bold text-slate-950">단말 정보</h3>
              <div className="flex gap-3">
                <div className="size-14 rounded-lg bg-slate-200" />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900">
                    Galaxy S25 (256G)
                  </p>
                  <p className="mt-1 text-slate-500">티타늄 실버</p>
                  <p className="mt-1 text-slate-500">출고가 ₩ 1,155,000</p>
                </div>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-slate-950">결제 정보</h3>
              {[
                ["판매금액", "₩ 1,199,000"],
                ["선수금", "₩ 300,000"],
                ["할부금", "₩ 899,000"],
                ["미수금", "₩ 0"],
                ["결제방법", "카드 (일시불)"],
              ].map(([label, value]) => (
                <p key={label} className="grid grid-cols-[5rem_1fr] text-xs">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800">{value}</span>
                </p>
              ))}
            </section>
          </div>
        </Drawer>
      </div>
    </div>
  );
}
