import {
  CalendarDays,
  Download,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button, SelectInput, TextInput } from "@/components/workspace";

type InventoryStatus = "입고" | "예약" | "판매완료" | "불량";

type InventoryRow = {
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

type FieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
};

const inventoryRows: InventoryRow[] = [
  {
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

const statusClasses: Record<InventoryStatus, string> = {
  입고: "border-blue-200 bg-blue-50 text-blue-700",
  예약: "border-amber-200 bg-amber-50 text-amber-700",
  판매완료: "border-emerald-200 bg-emerald-50 text-emerald-700",
  불량: "border-rose-200 bg-rose-50 text-rose-700",
};

const inputClass =
  "!h-8 !rounded-md !border-slate-200 !px-3 !text-xs !text-slate-700";
const filterLabelClass = "mb-1.5 block text-xs font-bold text-slate-600";
const drawerInputClass = "!h-8 !rounded-md !px-3 !text-xs !leading-8";
const drawerLabelClass =
  "mb-0.5 block text-[11px] font-bold leading-[14px] text-slate-700 [@media(min-height:950px)]:mb-1.5 [@media(min-height:950px)]:text-xs [@media(min-height:950px)]:leading-4";
const drawerHintClass =
  "mt-0.5 block text-[10px] font-semibold leading-[13px] text-blue-600 [@media(min-height:950px)]:mt-1.5 [@media(min-height:950px)]:text-[11px] [@media(min-height:950px)]:leading-4";

function Field({
  label,
  required = false,
  children,
  hint,
  className = "",
}: FieldProps) {
  return (
    <label className={["block min-w-0", className].join(" ")}>
      <span className={filterLabelClass}>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[11px] font-semibold leading-4 text-blue-600">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function DrawerField({
  label,
  required = false,
  children,
  hint,
  className = "",
}: FieldProps) {
  return (
    <label className={["block min-w-0", className].join(" ")}>
      <span className={drawerLabelClass}>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className={drawerHintClass}>{hint}</span> : null}
    </label>
  );
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={[
        "inline-flex h-6 min-w-[56px] items-center justify-center rounded-md border px-2 text-[11px] font-bold leading-none",
        statusClasses[status],
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function FilterPanel() {
  return (
    <section className="h-[219px] shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="flex h-[59px] items-center justify-end gap-2 border-b border-slate-100 px-4">
        <Button
          icon={RefreshCw}
          className="!h-8 !min-h-8 !px-3 !text-xs !text-slate-600"
        >
          초기화
        </Button>
        <Button
          icon={Search}
          variant="primary"
          className="!h-8 !min-h-8 !px-4 !text-xs"
        >
          조회
        </Button>
      </div>

      <div className="px-4 pt-5">
        <div className="grid grid-cols-4 gap-x-6">
          <Field label="매장">
            <SelectInput defaultValue="all" className={inputClass}>
              <option value="all">전체 매장</option>
              <option value="gangnam">강남본점</option>
              <option value="dasan">다산점</option>
              <option value="hongdae">홍대점</option>
            </SelectInput>
          </Field>
          <Field label="통신사">
            <SelectInput defaultValue="all" className={inputClass}>
              <option value="all">전체 통신사</option>
              <option value="skt">SKT</option>
              <option value="kt">KT</option>
              <option value="lgu">LG U+</option>
            </SelectInput>
          </Field>
          <Field label="기종">
            <SelectInput defaultValue="" className={inputClass}>
              <option value="">기종 선택</option>
              <option value="s25">갤럭시 S25</option>
              <option value="iphone16">아이폰 16</option>
            </SelectInput>
          </Field>
          <Field label="상태">
            <SelectInput defaultValue="all" className={inputClass}>
              <option value="all">전체 상태</option>
              <option value="in">입고</option>
              <option value="reserved">예약</option>
              <option value="sold">판매완료</option>
              <option value="bad">불량</option>
            </SelectInput>
          </Field>
        </div>

        <div className="mt-[17px] grid grid-cols-[280px_280px] gap-x-[58px]">
          <Field label="입고일">
            <span className="relative block">
              <TextInput
                readOnly
                value="2025.04.20  ~  2025.05.19"
                className={`${inputClass} !pr-9`}
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </span>
          </Field>
          <Field label="검색">
            <span className="relative block">
              <TextInput
                placeholder="S/N, Model No. 검색"
                className={`${inputClass} !pr-9`}
              />
              <Search
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </span>
          </Field>
        </div>
      </div>
    </section>
  );
}

function InventoryTable() {
  const pages = ["‹", "1", "2", "3", "4", "5", "...", "63", "›"];

  return (
    <section className="flex h-[calc(100dvh-347px)] max-h-[611px] min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 [@media(min-height:950px)]:h-[611px]">
      <div className="flex h-[57px] shrink-0 items-center justify-between px-4">
        <h2 className="text-base font-bold leading-5 text-slate-950">
          전체 1,248건
        </h2>
        <Button
          icon={Download}
          className="!h-8 !min-h-8 !px-3 !text-xs !text-slate-700"
        >
          엑셀 다운로드
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden border-t border-slate-100">
        <table className="w-full table-fixed text-xs">
          <caption className="sr-only">재고 목록</caption>
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead>
            <tr className="h-9 border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500">
              <th className="px-3 text-left">
                <span className="sr-only">선택</span>
              </th>
              <th className="px-2 text-left">상태</th>
              <th className="px-2 text-left">매장</th>
              <th className="px-2 text-left">통신사</th>
              <th className="px-2 text-left">기종</th>
              <th className="px-2 text-left">색상</th>
              <th className="px-2 text-left">용량</th>
              <th className="px-2 text-left">S/N</th>
              <th className="px-2 text-left">Model No.</th>
              <th className="px-2 text-right">입고가</th>
              <th className="px-2 text-left">입고일</th>
              <th className="px-2 text-left">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventoryRows.map((row) => (
              <tr
                key={row.serialNumber}
                className="h-[41px] text-xs font-medium text-slate-700 [@media(min-height:950px)]:h-11"
              >
                <td className="px-3">
                  <input
                    type="checkbox"
                    aria-label={`${row.device} ${row.serialNumber} 선택`}
                    className="size-4 rounded border-slate-300 text-blue-600"
                  />
                </td>
                <td className="px-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="truncate px-2">{row.store}</td>
                <td className="truncate px-2">{row.carrier}</td>
                <td className="truncate px-2">{row.device}</td>
                <td className="truncate px-2">{row.color}</td>
                <td className="truncate px-2">{row.capacity}</td>
                <td className="truncate px-2">{row.serialNumber}</td>
                <td className="truncate px-2">{row.modelNo}</td>
                <td className="truncate px-2 text-right font-bold text-slate-950">
                  {row.cost}
                </td>
                <td className="truncate px-2">{row.receivedAt}</td>
                <td className="truncate px-2">{row.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex h-[54px] shrink-0 items-center justify-center border-t border-slate-100 px-4">
        <div className="flex items-center justify-center gap-2">
          {pages.map((page, index) => (
            <button
              key={`${page}-${index}`}
              type="button"
              className={[
                "flex size-8 items-center justify-center rounded-md border text-sm font-medium",
                page === "1"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-transparent text-slate-600",
              ].join(" ")}
            >
              {page}
            </button>
          ))}
          <SelectInput
            defaultValue="20"
            className="ml-4 !h-8 !w-[108px] !text-xs"
          >
            <option value="20">20건</option>
            <option value="50">50건</option>
          </SelectInput>
        </div>
      </div>
    </section>
  );
}

function DrawerSelect({ placeholder }: { placeholder: string }) {
  return (
    <SelectInput defaultValue="" className={drawerInputClass}>
      <option value="">{placeholder}</option>
    </SelectInput>
  );
}

function InventoryRegisterPanel() {
  return (
    <aside
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl shadow-slate-300/40"
      aria-label="재고 등록"
    >
      <div className="flex h-[76px] shrink-0 items-start justify-between border-b border-slate-200 px-6 pt-[18px]">
        <div>
          <h2 className="text-[18px] font-bold leading-6 text-slate-950">
            재고 등록
          </h2>
          <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">
            새로운 재고 정보를 등록합니다.
          </p>
        </div>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-slate-500"
          aria-label="재고 등록 닫기"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-6 pb-2 pt-5 [@media(min-height:950px)]:px-[28px] [@media(min-height:950px)]:pb-3">
        <DrawerField label="매장" required>
          <DrawerSelect placeholder="매장 선택" />
        </DrawerField>
        <DrawerField label="통신사" required>
          <DrawerSelect placeholder="통신사 선택" />
        </DrawerField>
        <DrawerField label="기종" required>
          <DrawerSelect placeholder="기종 선택" />
        </DrawerField>
        <DrawerField label="색상" required>
          <DrawerSelect placeholder="색상 선택" />
        </DrawerField>
        <DrawerField label="용량" required>
          <DrawerSelect placeholder="용량 선택" />
        </DrawerField>
        <DrawerField label="S/N" required>
          <TextInput
            placeholder="S/N 입력"
            className={drawerInputClass}
            aria-label="S/N 입력"
          />
        </DrawerField>
        <DrawerField
          label="Model No."
          required
          hint={
            <>
              Model No.는 자동으로 대문자 변환되며,
              <br />앞 2글자 이후 하이픈(-)이 자동으로 입력됩니다.
            </>
          }
        >
          <TextInput placeholder="예) SM-S931N" className={drawerInputClass} />
        </DrawerField>
        <DrawerField
          label="입고가"
          required
          hint="금액은 자동으로 콤마(,)가 적용되고 '원'이 표시됩니다."
        >
          <div className="relative">
            <TextInput
              value="0"
              readOnly
              className={`${drawerInputClass} !pr-7`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
              원
            </span>
          </div>
        </DrawerField>
        <DrawerField label="상태" required>
          <SelectInput defaultValue="입고" className={drawerInputClass}>
            <option value="입고">입고</option>
            <option value="예약">예약</option>
            <option value="불량">불량</option>
          </SelectInput>
        </DrawerField>
        <DrawerField label="입고일" required>
          <div className="relative">
            <TextInput
              value="2025-05-19"
              readOnly
              className={`${drawerInputClass} !pr-9`}
            />
            <CalendarDays
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </DrawerField>
        <DrawerField label="담당자" required>
          <DrawerSelect placeholder="담당자 선택" />
        </DrawerField>
        <DrawerField label="메모">
          <textarea
            rows={2}
            placeholder="메모를 입력하세요. (선택)"
            className="h-11 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-4 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </DrawerField>
      </div>

      <div className="grid h-[50px] shrink-0 grid-cols-2 gap-3 border-t border-slate-200 px-5 py-2 [@media(min-height:950px)]:h-16 [@media(min-height:950px)]:py-3">
        <Button className="!h-8 !min-h-8 !text-xs [@media(min-height:950px)]:!h-10 [@media(min-height:950px)]:!min-h-10 [@media(min-height:950px)]:!text-sm">
          취소
        </Button>
        <Button
          variant="primary"
          className="!h-8 !min-h-8 !text-xs [@media(min-height:950px)]:!h-10 [@media(min-height:950px)]:!min-h-10 [@media(min-height:950px)]:!text-sm"
        >
          등록하기
        </Button>
      </div>
    </aside>
  );
}

export default function InventoryPage() {
  return (
    <div
      className="-mb-4 -mr-6 -mt-[25px] grid h-[100dvh] min-h-0 grid-cols-[minmax(0,1fr)_374px] gap-3 overflow-hidden"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden pb-4 pt-[25px]">
        <header className="flex h-[61px] shrink-0 items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold leading-9 tracking-normal text-slate-950">
              재고 관리
            </h1>
            <p className="mt-1 text-xs leading-4 text-slate-500">
              재고 등록, 조회 및 재고 현황을 체계적으로 관리하세요.
            </p>
          </div>
          <Button
            icon={Plus}
            variant="primary"
            className="!h-9 !min-h-9 !px-4 !text-sm"
          >
            재고 등록
          </Button>
        </header>

        <FilterPanel />
        <InventoryTable />
      </div>

      <InventoryRegisterPanel />
    </div>
  );
}
