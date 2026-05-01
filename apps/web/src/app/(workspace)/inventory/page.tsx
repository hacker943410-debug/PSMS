import { CalendarDays, Download, Plus, RefreshCw, Search } from "lucide-react";

import {
  Button,
  DataTable,
  type DataTableColumn,
  Drawer,
  FilterBar,
  FormField,
  PageIntro,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";

type InventoryStatus = "입고" | "예약" | "판매완료" | "불량";

type InventoryRow = {
  id: string;
  status: InventoryStatus;
  store: string;
  carrier: "SKT" | "KT" | "LG U+";
  device: string;
  color: string;
  capacity: string;
  serialNumber: string;
  modelNo: string;
  cost: string;
  receivedAt: string;
  owner: string;
};

const inventoryRows: InventoryRow[] = [
  {
    id: "INV-0001",
    status: "입고",
    store: "강남본점",
    carrier: "SKT",
    device: "갤럭시 S25",
    color: "네이비",
    capacity: "256GB",
    serialNumber: "R3CX30X7A1B",
    modelNo: "SM-S931N",
    cost: "1,155,000원",
    receivedAt: "2025-05-19",
    owner: "김민수",
  },
  {
    id: "INV-0002",
    status: "예약",
    store: "강남본점",
    carrier: "KT",
    device: "아이폰 16 Pro",
    color: "티타늄 화이트",
    capacity: "256GB",
    serialNumber: "DX1Y2Z3A4B5",
    modelNo: "MYN13KH/A",
    cost: "1,540,000원",
    receivedAt: "2025-05-19",
    owner: "이서연",
  },
  {
    id: "INV-0003",
    status: "판매완료",
    store: "다산점",
    carrier: "LG U+",
    device: "갤럭시 S24",
    color: "마블 그레이",
    capacity: "256GB",
    serialNumber: "R3CX20X6B2C",
    modelNo: "SM-S921N",
    cost: "1,012,000원",
    receivedAt: "2025-05-18",
    owner: "박지훈",
  },
  {
    id: "INV-0004",
    status: "입고",
    store: "홍대점",
    carrier: "SKT",
    device: "아이폰 16",
    color: "블랙",
    capacity: "128GB",
    serialNumber: "FFX1Y2Z9C8D",
    modelNo: "MYDQ3KH/A",
    cost: "1,190,000원",
    receivedAt: "2025-05-18",
    owner: "최유리",
  },
  {
    id: "INV-0005",
    status: "불량",
    store: "강남본점",
    carrier: "KT",
    device: "갤럭시 Z Fold6",
    color: "실버 섀도우",
    capacity: "512GB",
    serialNumber: "R5DX30X1E9F",
    modelNo: "SM-F956N",
    cost: "1,850,000원",
    receivedAt: "2025-05-17",
    owner: "김민수",
  },
  {
    id: "INV-0006",
    status: "예약",
    store: "잠실점",
    carrier: "LG U+",
    device: "아이폰 16 Pro Max",
    color: "데저트 티타늄",
    capacity: "512GB",
    serialNumber: "G0H1J2K3L4M",
    modelNo: "MU6Y3KH/A",
    cost: "1,925,000원",
    receivedAt: "2025-05-17",
    owner: "이서연",
  },
  {
    id: "INV-0007",
    status: "입고",
    store: "다산점",
    carrier: "SKT",
    device: "갤럭시 A55",
    color: "어썸 라일락",
    capacity: "128GB",
    serialNumber: "A55K20X7P3Q",
    modelNo: "SM-A556N",
    cost: "499,400원",
    receivedAt: "2025-05-16",
    owner: "박지훈",
  },
  {
    id: "INV-0008",
    status: "판매완료",
    store: "홍대점",
    carrier: "KT",
    device: "갤럭시 S24+",
    color: "오닉스 블랙",
    capacity: "256GB",
    serialNumber: "R3CX20X8C7D",
    modelNo: "SM-S926N",
    cost: "1,144,000원",
    receivedAt: "2025-05-16",
    owner: "최유리",
  },
  {
    id: "INV-0009",
    status: "입고",
    store: "강남본점",
    carrier: "LG U+",
    device: "아이폰 15",
    color: "블루",
    capacity: "128GB",
    serialNumber: "F2GH3J4K5L6",
    modelNo: "MTLP3KH/A",
    cost: "985,000원",
    receivedAt: "2025-05-15",
    owner: "김민수",
  },
  {
    id: "INV-0010",
    status: "불량",
    store: "잠실점",
    carrier: "SKT",
    device: "갤럭시 S23",
    color: "크림",
    capacity: "256GB",
    serialNumber: "R3CX10X2D5E",
    modelNo: "SM-S911N",
    cost: "870,000원",
    receivedAt: "2025-05-14",
    owner: "이서연",
  },
];

const statusTone: Record<
  InventoryStatus,
  "info" | "warning" | "success" | "danger"
> = {
  입고: "info",
  예약: "warning",
  판매완료: "success",
  불량: "danger",
};

const columns: DataTableColumn<InventoryRow>[] = [
  {
    key: "select",
    header: <span className="sr-only">선택</span>,
    cell: (row) => (
      <input
        type="checkbox"
        aria-label={`${row.device} ${row.serialNumber} 선택`}
        className="size-4 rounded border-slate-300 text-blue-600"
      />
    ),
  },
  {
    key: "status",
    header: "상태",
    cell: (row) => (
      <TonePill
        tone={statusTone[row.status]}
        className="min-w-14 justify-center"
      >
        {row.status}
      </TonePill>
    ),
  },
  { key: "store", header: "매장", cell: (row) => row.store },
  { key: "carrier", header: "통신사", cell: (row) => row.carrier },
  { key: "device", header: "기종", cell: (row) => row.device },
  { key: "color", header: "색상", cell: (row) => row.color },
  { key: "capacity", header: "용량", cell: (row) => row.capacity },
  { key: "serialNumber", header: "S/N", cell: (row) => row.serialNumber },
  { key: "modelNo", header: "Model No.", cell: (row) => row.modelNo },
  {
    key: "cost",
    header: "입고가",
    align: "right",
    cell: (row) => (
      <span className="font-semibold text-slate-900">{row.cost}</span>
    ),
  },
  { key: "receivedAt", header: "입고일", cell: (row) => row.receivedAt },
  { key: "owner", header: "담당자", cell: (row) => row.owner },
];

const filterSelectClass = "h-8 text-xs";
const filterInputClass = "h-8 text-xs";

function Pagination() {
  const pages = ["‹", "1", "2", "3", "4", "5", "...", "63", "›"];

  return (
    <div className="flex items-center justify-center gap-2 py-2.5">
      {pages.map((page, index) => (
        <button
          key={`${page}-${index}`}
          type="button"
          className={[
            "flex size-8 items-center justify-center rounded-md border text-xs font-semibold",
            page === "1"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-transparent bg-white text-slate-600 hover:border-slate-200",
          ].join(" ")}
        >
          {page}
        </button>
      ))}
      <SelectInput defaultValue="20" className="ml-3 h-8 w-20 text-xs">
        <option value="20">20건</option>
        <option value="50">50건</option>
      </SelectInput>
    </div>
  );
}

function InventoryDrawer() {
  return (
    <Drawer
      title="재고 등록"
      description="새로운 재고 정보를 등록합니다."
      className="xl:max-w-none"
      closeLabel="재고 등록 닫기"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button className="w-full">취소</Button>
          <Button variant="primary" className="w-full">
            등록하기
          </Button>
        </div>
      }
    >
      <form className="space-y-3 text-sm">
        <FormField label="매장" required>
          <SelectInput defaultValue="">
            <option value="">매장 선택</option>
            <option value="gangnam">강남본점</option>
            <option value="dasan">다산점</option>
            <option value="hongdae">홍대점</option>
          </SelectInput>
        </FormField>

        <FormField label="통신사" required>
          <SelectInput defaultValue="">
            <option value="">통신사 선택</option>
            <option value="skt">SKT</option>
            <option value="kt">KT</option>
            <option value="lgu">LG U+</option>
          </SelectInput>
        </FormField>

        <FormField label="기종" required>
          <SelectInput defaultValue="">
            <option value="">기종 선택</option>
            <option value="s25">갤럭시 S25</option>
            <option value="iphone16">아이폰 16 Pro</option>
            <option value="fold6">갤럭시 Z Fold6</option>
          </SelectInput>
        </FormField>

        <FormField label="색상" required>
          <SelectInput defaultValue="">
            <option value="">색상 선택</option>
            <option value="navy">네이비</option>
            <option value="white">티타늄 화이트</option>
            <option value="black">블랙</option>
          </SelectInput>
        </FormField>

        <FormField label="용량" required>
          <SelectInput defaultValue="">
            <option value="">용량 선택</option>
            <option value="128">128GB</option>
            <option value="256">256GB</option>
            <option value="512">512GB</option>
            <option value="1024">1TB</option>
          </SelectInput>
        </FormField>

        <FormField label="S/N" required>
          <TextInput placeholder="S/N 입력" />
        </FormField>

        <FormField
          label="Model No."
          required
          hint="Model No.는 자동으로 대문자 변환되며, 앞 2글자 이후 하이픈(-)이 자동으로 입력됩니다."
        >
          <TextInput placeholder="예) SM-S931N" />
        </FormField>

        <FormField
          label="입고가"
          required
          hint="금액은 자동으로 콤마(,)가 적용되고 '원'이 표시됩니다."
        >
          <TextInput placeholder="0" />
        </FormField>

        <FormField label="상태" required>
          <SelectInput defaultValue="입고">
            <option value="입고">입고</option>
            <option value="예약">예약</option>
            <option value="불량">불량</option>
          </SelectInput>
        </FormField>

        <FormField label="입고일" required>
          <div className="relative">
            <TextInput value="2025-05-19" readOnly className="pr-9" />
            <CalendarDays
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </FormField>

        <FormField label="담당자" required>
          <SelectInput defaultValue="">
            <option value="">담당자 선택</option>
            <option value="kim">김민수</option>
            <option value="lee">이서연</option>
            <option value="park">박지훈</option>
          </SelectInput>
        </FormField>

        <FormField label="메모">
          <textarea
            rows={2}
            placeholder="메모를 입력하세요. (선택)"
            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </FormField>
      </form>
    </Drawer>
  );
}

export default function InventoryPage() {
  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-3 2xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <PageIntro
          title="재고 관리"
          description="재고 등록, 조회 및 재고 현황을 체계적으로 관리하세요."
          actions={
            <Button icon={Plus} variant="primary">
              재고 등록
            </Button>
          }
        />

        <FilterBar
          className="px-3 py-2.5"
          actions={
            <>
              <Button icon={RefreshCw} className="min-h-8 px-3 text-xs">
                초기화
              </Button>
              <Button
                icon={Search}
                variant="primary"
                className="min-h-8 px-3 text-xs"
              >
                조회
              </Button>
            </>
          }
        >
          <FormField label="매장">
            <SelectInput defaultValue="all" className={filterSelectClass}>
              <option value="all">전체 매장</option>
              <option value="gangnam">강남본점</option>
              <option value="dasan">다산점</option>
              <option value="hongdae">홍대점</option>
            </SelectInput>
          </FormField>
          <FormField label="통신사">
            <SelectInput defaultValue="all" className={filterSelectClass}>
              <option value="all">전체 통신사</option>
              <option value="skt">SKT</option>
              <option value="kt">KT</option>
              <option value="lgu">LG U+</option>
            </SelectInput>
          </FormField>
          <FormField label="기종">
            <SelectInput defaultValue="all" className={filterSelectClass}>
              <option value="all">기종 선택</option>
              <option value="s25">갤럭시 S25</option>
              <option value="iphone16">아이폰 16</option>
            </SelectInput>
          </FormField>
          <FormField label="상태">
            <SelectInput defaultValue="all" className={filterSelectClass}>
              <option value="all">전체 상태</option>
              <option value="입고">입고</option>
              <option value="예약">예약</option>
              <option value="판매완료">판매완료</option>
              <option value="불량">불량</option>
            </SelectInput>
          </FormField>
          <FormField label="입고일" className="md:col-span-2 xl:col-span-2">
            <div className="relative">
              <TextInput
                readOnly
                value="2025.04.20 ~ 2025.05.19"
                className={`${filterInputClass} pr-9`}
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </FormField>
          <FormField label="검색">
            <TextInput
              placeholder="S/N, Model No. 검색"
              className={filterInputClass}
            />
          </FormField>
        </FilterBar>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
            <h2 className="text-sm font-bold text-slate-950">전체 1,248건</h2>
            <Button icon={Download} className="min-h-8 px-3 text-xs">
              엑셀 다운로드
            </Button>
          </div>
          <DataTable
            caption="재고 목록"
            columns={columns}
            data={inventoryRows}
            getRowKey={(row) => row.id}
            bodyMaxHeight="100%"
            className="min-h-0 flex-1 rounded-none border-x-0 border-b-0 border-t-0 shadow-none"
            bodyClassName="h-full"
          />
          <div className="border-t border-slate-200">
            <Pagination />
          </div>
        </section>
      </div>

      <div className="hidden min-h-0 xl:block">
        <InventoryDrawer />
      </div>
    </div>
  );
}
