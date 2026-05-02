import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  WalletCards,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Button,
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

type SaleColumn = {
  key: string;
  header: string;
  className: string;
  cell: (row: SaleRow, index: number) => ReactNode;
};

const salesRows: SaleRow[] = [
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
    customer: "송지호",
    phone: "010-0123-4567",
    carrier: "SKT",
    type: "신규",
    device: "S23 (256G)",
    plan: "5GX 레귤러",
    amount: "₩ 699,000",
    receivable: "정상",
    owner: "박지훈",
  },
  {
    time: "2025-05-17 17:12",
    customer: "유채석",
    phone: "010-1111-2222",
    carrier: "KT",
    type: "신규",
    device: "iPhone 16 Pro Max (512G)",
    plan: "5G 시그니처",
    amount: "₩ 1,590,000",
    receivable: "보류",
    owner: "최유리",
  },
  {
    time: "2025-05-17 16:03",
    customer: "강다니엘",
    phone: "010-2222-3333",
    carrier: "LG U+",
    type: "번이",
    device: "Galaxy S25 (256G)",
    plan: "5G 베이직",
    amount: "₩ 1,049,000",
    receivable: "정상",
    owner: "김민수",
  },
  {
    time: "2025-05-17 14:58",
    customer: "수지",
    phone: "010-3333-4444",
    carrier: "SKT",
    type: "기변",
    device: "iPhone 15 (128G)",
    plan: "5GX 스탠다드",
    amount: "₩ 869,000",
    receivable: "미수 있음",
    owner: "이서연",
  },
  {
    time: "2025-05-17 13:37",
    customer: "차은우",
    phone: "010-4444-5555",
    carrier: "KT",
    type: "신규",
    device: "Galaxy Z Fold6 (512G)",
    plan: "5G 프리미어",
    amount: "₩ 1,899,000",
    receivable: "정상",
    owner: "박지훈",
  },
  {
    time: "2025-05-17 12:20",
    customer: "아이유",
    phone: "010-5555-6666",
    carrier: "LG U+",
    type: "번이",
    device: "iPhone 16 Plus (256G)",
    plan: "5G 슬림",
    amount: "₩ 1,089,000",
    receivable: "정상",
    owner: "최유리",
  },
  {
    time: "2025-05-17 11:08",
    customer: "성시경",
    phone: "010-6666-7777",
    carrier: "SKT",
    type: "기변",
    device: "Galaxy A35 (128G)",
    plan: "5G Y틴",
    amount: "₩ 399,000",
    receivable: "보류",
    owner: "김민수",
  },
  {
    time: "2025-05-17 10:01",
    customer: "장원영",
    phone: "010-7777-8888",
    carrier: "KT",
    type: "신규",
    device: "iPhone 16 (128G)",
    plan: "5G 베이직",
    amount: "₩ 979,000",
    receivable: "정상",
    owner: "이서연",
  },
  {
    time: "2025-05-16 18:22",
    customer: "이승기",
    phone: "010-8888-9999",
    carrier: "LG U+",
    type: "기변",
    device: "S24 (256G)",
    plan: "5G 시그니처",
    amount: "₩ 819,000",
    receivable: "정상",
    owner: "박지훈",
  },
  {
    time: "2025-05-16 17:41",
    customer: "전지현",
    phone: "010-9999-0000",
    carrier: "SKT",
    type: "번이",
    device: "Galaxy S25 Ultra (256G)",
    plan: "5GX 프리미어",
    amount: "₩ 1,599,000",
    receivable: "정상",
    owner: "최유리",
  },
  {
    time: "2025-05-16 16:05",
    customer: "조인성",
    phone: "010-1212-3434",
    carrier: "KT",
    type: "기변",
    device: "iPhone 15 Pro Max (512G)",
    plan: "5G 프리미어",
    amount: "₩ 1,689,000",
    receivable: "보류",
    owner: "김민수",
  },
];

const metricCards = [
  {
    label: "총 판매건수",
    value: "1,248건",
    helper: "전월 대비",
    accent: "▲ 12.3%",
    tone: "info",
    icon: ShoppingBag,
  },
  {
    label: "금일 판매",
    value: "28건",
    helper: "금액",
    accent: "₩ 78,560,000",
    tone: "success",
    icon: BarChart3,
  },
  {
    label: "평균 판매금액",
    value: "₩ 624,300",
    helper: "전월 대비",
    accent: "▲ 5.8%",
    tone: "warning",
    icon: BadgeDollarSign,
  },
  {
    label: "미수 포함 거래",
    value: "37건",
    helper: "금액",
    accent: "₩ 18,240,000",
    tone: "danger",
    icon: WalletCards,
  },
] as const;

const saleColumns: SaleColumn[] = [
  {
    key: "time",
    header: "판매일",
    className: "w-[12%]",
    cell: (row) => (
      <span className="font-semibold text-blue-600">{row.time}</span>
    ),
  },
  {
    key: "customer",
    header: "고객명",
    className: "w-[7%]",
    cell: (row) => row.customer,
  },
  {
    key: "phone",
    header: "연락처",
    className: "w-[11%]",
    cell: (row) => row.phone,
  },
  {
    key: "carrier",
    header: "통신사",
    className: "w-[6%]",
    cell: (row) => row.carrier,
  },
  {
    key: "type",
    header: "가입유형",
    className: "w-[7%]",
    cell: (row) => <SaleTypePill type={row.type} />,
  },
  {
    key: "device",
    header: "기종",
    className: "w-[14%]",
    cell: (row) => row.device,
  },
  {
    key: "plan",
    header: "요금제",
    className: "w-[12%]",
    cell: (row) => row.plan,
  },
  {
    key: "amount",
    header: "판매금액",
    className: "w-[10%] text-right",
    cell: (row) => (
      <span className="font-bold text-slate-900">{row.amount}</span>
    ),
  },
  {
    key: "receivable",
    header: "미수 상태",
    className: "w-[9%] px-0 text-center",
    cell: (row) => <ReceivablePill status={row.receivable} />,
  },
  {
    key: "owner",
    header: "담당자",
    className: "w-[7%]",
    cell: (row) => row.owner,
  },
  {
    key: "detail",
    header: "상세",
    className: "w-[5%] px-0 text-center",
    cell: () => (
      <button
        type="button"
        className="inline-flex h-6 min-w-9 items-center justify-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 max-[1350px]:h-5 max-[1350px]:min-w-6 max-[1350px]:px-0 max-[1350px]:text-[10px]"
      >
        보기
      </button>
    ),
  },
];

const toneClasses = {
  info: "bg-blue-100 text-blue-600",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-rose-100 text-rose-600",
} as const;

function SaleTypePill({ type }: { type: SaleRow["type"] }) {
  const classes = {
    신규: "border-blue-200 bg-blue-50 text-blue-700",
    기변: "border-emerald-200 bg-emerald-50 text-emerald-700",
    번이: "border-violet-200 bg-violet-50 text-violet-700",
  }[type];

  return (
    <span
      className={[
        "inline-flex h-5 min-w-8 items-center justify-center rounded border px-1.5 text-[11px] font-bold",
        classes,
      ].join(" ")}
    >
      {type}
    </span>
  );
}

function ReceivablePill({ status }: { status: SaleRow["receivable"] }) {
  const tone = {
    정상: "success",
    보류: "warning",
    "미수 있음": "danger",
  } as const;

  return (
    <TonePill
      tone={tone[status]}
      className="min-h-5 px-2 text-[11px] leading-4 max-[1350px]:px-1 max-[1350px]:text-[10px]"
    >
      {status}
    </TonePill>
  );
}

function SalesMetricCard({
  label,
  value,
  helper,
  accent,
  tone,
  icon: Icon,
}: (typeof metricCards)[number]) {
  return (
    <article className="flex h-[94px] items-center rounded-lg border border-slate-200 bg-white px-4 shadow-sm shadow-slate-200/60 max-[1350px]:px-3">
      <span
        className={[
          "mr-4 flex size-[50px] shrink-0 items-center justify-center rounded-full max-[1350px]:mr-3 max-[1350px]:size-10",
          toneClasses[tone],
        ].join(" ")}
      >
        <Icon className="size-6 max-[1350px]:size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-4 text-slate-500 max-[1350px]:text-[10px]">
          {label}
        </p>
        <p className="mt-1 text-[22px] font-bold leading-7 tracking-normal text-slate-950 max-[1350px]:text-lg max-[1350px]:leading-6">
          {value}
        </p>
        <p className="mt-1 text-xs leading-4 text-slate-500 max-[1350px]:text-[10px]">
          {helper}{" "}
          <span
            className={
              tone === "danger"
                ? "font-bold text-rose-500"
                : tone === "info"
                  ? "font-bold text-blue-600"
                  : "font-bold text-slate-600"
            }
          >
            {accent}
          </span>
        </p>
      </div>
    </article>
  );
}

function SalesFilter() {
  return (
    <section className="h-[105px] rounded-lg border border-slate-200 bg-white px-4 py-[17px] shadow-sm shadow-slate-200/60">
      <div className="grid grid-cols-[315fr_220fr_260fr_250fr] items-center gap-x-10 gap-y-3 text-xs font-semibold text-slate-600 max-[1450px]:gap-x-7 max-[1350px]:grid-cols-[350fr_190fr_225fr_210fr] max-[1350px]:gap-x-4">
        <label className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
          <span>기간</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <TextInput
              readOnly
              value="2025.05.01 ~ 2025.05.19"
              className="h-8 pl-9 text-xs max-[1350px]:pl-8 max-[1350px]:text-[10px]"
            />
          </span>
        </label>
        <label className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
          <span>매장</span>
          <SelectInput defaultValue="all" className="h-8 text-xs">
            <option value="all">전체 매장</option>
          </SelectInput>
        </label>
        <label className="grid grid-cols-[3rem_1fr] items-center gap-3">
          <span>담당자</span>
          <SelectInput defaultValue="all" className="h-8 text-xs">
            <option value="all">전체 담당자</option>
          </SelectInput>
        </label>
        <label className="grid grid-cols-[3rem_1fr] items-center gap-3">
          <span>통신사</span>
          <SelectInput defaultValue="all" className="h-8 text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
        <label className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
          <span>가입유형</span>
          <SelectInput defaultValue="all" className="h-8 text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
        <label className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
          <span>상태</span>
          <SelectInput defaultValue="all" className="h-8 text-xs">
            <option value="all">전체</option>
          </SelectInput>
        </label>
        <label className="relative col-span-1 block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <TextInput
            placeholder="고객명, 연락처, 주문번호 검색"
            className="h-8 pr-9 text-xs"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button
            icon={RefreshCw}
            className="h-8 min-h-8 whitespace-nowrap px-3 text-xs text-slate-600 max-[1350px]:gap-1 max-[1350px]:px-2 max-[1350px]:text-[11px] max-[1350px]:[&_svg]:hidden"
          >
            초기화
          </Button>
          <Button
            variant="primary"
            icon={Search}
            className="h-8 min-h-8 whitespace-nowrap px-3 text-xs max-[1350px]:gap-1 max-[1350px]:px-2 max-[1350px]:text-[11px] max-[1350px]:[&_svg]:hidden"
          >
            검색
          </Button>
        </div>
      </div>
    </section>
  );
}

function SalesTable() {
  return (
    <section className="flex h-[632px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 max-[1535px]:min-h-0 max-[1535px]:flex-1">
      <div className="flex h-10 shrink-0 items-center justify-between px-4">
        <h2 className="text-base font-bold text-slate-950">
          판매 목록 <span className="text-slate-500">(총 1,248건)</span>
        </h2>
        <div className="flex items-center gap-2">
          <SelectInput defaultValue="20" className="h-8 w-[110px] text-xs">
            <option value="20">페이지당 20개</option>
          </SelectInput>
          <Button
            icon={Settings}
            className="h-8 min-h-8 w-[88px] whitespace-nowrap px-2 text-xs max-[1350px]:w-[72px] max-[1350px]:gap-1 max-[1350px]:text-[11px] max-[1350px]:[&_svg]:hidden"
          >
            열 설정
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="h-[27px] border-y border-slate-200 bg-slate-50">
              {saleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    "truncate px-2 text-left text-[11px] font-semibold text-slate-500",
                    column.className,
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salesRows.map((row, index) => (
              <tr
                key={`${row.time}-${row.customer}`}
                className={[
                  "h-[25px]",
                  index === 0 ? "bg-blue-50" : "bg-white",
                ].join(" ")}
              >
                {saleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      "truncate px-2 align-middle text-[11px] font-medium text-slate-700 max-[1350px]:px-1.5 max-[1350px]:text-[10px]",
                      column.className,
                    ].join(" ")}
                  >
                    {column.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex h-[42px] shrink-0 items-center justify-center gap-2">
        {["‹", "1", "2", "3", "4", "5", "...", "63", "›"].map((item) => (
          <button
            key={item}
            type="button"
            className={[
              "flex size-7 items-center justify-center rounded-md border text-xs font-semibold",
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
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <p className="grid grid-cols-[4.4rem_1fr] gap-2 text-xs leading-4">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "text-slate-700"}>
        {value}
      </span>
    </p>
  );
}

function SalesDetailPanel() {
  return (
    <aside className="-mb-4 -mt-[25px] flex h-[100dvh] min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-base font-bold text-slate-950">판매 상세</h2>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded text-slate-500"
          aria-label="상세 닫기"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4">
        <section className="border-b border-slate-200 pb-3">
          <div className="grid grid-cols-[4.4rem_1fr_auto] gap-x-2 gap-y-2 text-xs leading-4 max-[1350px]:grid-cols-[4.4rem_1fr]">
            <span className="font-semibold text-slate-500">주문번호</span>
            <span className="whitespace-nowrap text-[11px] font-bold text-slate-900">
              SO-20250519-0001
            </span>
            <TonePill className="min-h-5 px-1.5 text-[10px] max-[1350px]:hidden">
              복사
            </TonePill>
            <span className="font-semibold text-slate-500">판매일</span>
            <span className="text-slate-700">2025-05-19 14:32</span>
            <TonePill
              tone="success"
              className="min-h-5 px-1.5 text-[10px] max-[1350px]:hidden"
            >
              정상
            </TonePill>
          </div>
        </section>
        <section className="space-y-1.5 border-b border-slate-200 py-3">
          <h3 className="mb-2 text-sm font-bold text-slate-950">고객 정보</h3>
          <DetailRow label="고객명" value="김민수" />
          <DetailRow label="연락처" value="010-1234-5678" />
          <DetailRow label="생년월일" value="1992-03-15" />
          <DetailRow label="이메일" value="kms1234@gmail.com" />
          <DetailRow label="주소" value="서울특별시 강남구 테헤란로 123" />
        </section>
        <section className="border-b border-slate-200 py-3">
          <h3 className="mb-2 text-sm font-bold text-slate-950">단말 정보</h3>
          <div className="flex gap-3">
            <div className="relative h-[58px] w-[48px] shrink-0 overflow-hidden rounded-md bg-slate-200">
              <div className="absolute left-1 top-1 h-10 w-2 rounded-full bg-slate-950" />
              <div className="absolute right-1 top-2 h-12 w-8 rounded-full bg-gradient-to-br from-slate-500 via-slate-100 to-slate-800" />
            </div>
            <div className="min-w-0 space-y-0.5 text-xs leading-4">
              <p className="font-bold text-slate-900">Galaxy S25 (256G)</p>
              <p className="text-slate-600">색상　티타늄 실버</p>
              <p className="text-slate-600">출고가　₩ 1,155,000</p>
              <p className="text-slate-600">할인액　₩ 0</p>
            </div>
          </div>
        </section>
        <section className="space-y-1.5 border-b border-slate-200 py-3">
          <h3 className="mb-2 text-sm font-bold text-slate-950">
            요금제/가입 정보
          </h3>
          <DetailRow label="통신사" value="SKT" />
          <DetailRow label="가입유형" value={<SaleTypePill type="신규" />} />
          <DetailRow label="요금제" value="5GX 프라임 (110,000원)" />
          <DetailRow label="약정기간" value="24개월" />
          <DetailRow label="부가서비스" value="T우주 패스, 보험 프리미엄" />
        </section>
        <section className="space-y-1.5 border-b border-slate-200 py-3">
          <h3 className="mb-2 text-sm font-bold text-slate-950">결제 정보</h3>
          <DetailRow label="판매금액" value="₩ 1,199,000" strong />
          <DetailRow label="선수금" value="₩ 300,000" strong />
          <DetailRow label="할부금" value="₩ 899,000 (24개월)" strong />
          <DetailRow label="미수금" value="₩ 0" strong />
          <DetailRow label="결제방법" value="카드 (일시불)" strong />
        </section>
        <section className="space-y-1.5 py-3">
          <h3 className="mb-2 text-sm font-bold text-slate-950">담당자/메모</h3>
          <DetailRow label="담당자" value="이서연" />
          <DetailRow
            label="메모"
            value="고객 요청으로 액정 강화필름 부착 서비스 제공"
          />
        </section>
      </div>
      <div className="flex h-[68px] shrink-0 items-center justify-center border-t border-slate-200 px-4">
        <button
          type="button"
          className="h-8 w-[110px] rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700"
        >
          닫기
        </button>
      </div>
    </aside>
  );
}

export default function SalesPage() {
  return (
    <div className="-mr-6 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_272px] gap-3 overflow-hidden max-[1350px]:grid-cols-[minmax(0,1fr)_248px]">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden pr-1">
        <header className="flex h-[45px] shrink-0 items-start justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-8 tracking-normal text-slate-950">
              판매 관리
            </h1>
            <p className="mt-0.5 text-xs leading-4 text-slate-500">
              판매 내역을 조회하고 검색할 수 있습니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="primary"
              icon={Plus}
              className="h-8 min-h-8 px-3 text-xs"
            >
              판매 등록
            </Button>
            <Button icon={Download} className="h-8 min-h-8 px-3 text-xs">
              CSV 다운로드
            </Button>
            <Button icon={FileText} className="h-8 min-h-8 px-3 text-xs">
              상세 리포트
            </Button>
          </div>
        </header>

        <SalesFilter />

        <section className="grid h-[94px] shrink-0 grid-cols-4 gap-4 max-[1350px]:gap-3">
          {metricCards.map((metric) => (
            <SalesMetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <SalesTable />
      </div>

      <SalesDetailPanel />
    </div>
  );
}
