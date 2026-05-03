import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SelectInput } from "@/components/workspace";

type EventType = "sales" | "manual" | "expiry";

type CalendarEvent = {
  type: EventType;
  count: number;
};

type CalendarCell = {
  day: string;
  current?: boolean;
  today?: boolean;
  muted?: boolean;
  holiday?: string;
  events?: CalendarEvent[];
};

type WorkCard = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "blue" | "orange" | "rose";
  stats: string[];
};

type UpcomingItem = {
  title: string;
  subtitle: string;
  date: string;
  time: string;
  type: EventType | "payment";
  badge: string;
};

const workCards: WorkCard[] = [
  {
    label: "오늘 예정",
    value: "18건",
    icon: CalendarDays,
    tone: "blue",
    stats: ["판매/상담 10건", "수동 일정 6건", "유지 만료 2건"],
  },
  {
    label: "미처리 수동 일정",
    value: "7건",
    icon: AlertCircle,
    tone: "orange",
    stats: ["기한 초과 2건", "오늘 마감 3건", "예정 2건"],
  },
  {
    label: "유지 만료 임박",
    value: "12건",
    icon: ShieldCheck,
    tone: "rose",
    stats: ["7일 이내 8건", "15일 이내 4건", "30일 이내 0건"],
  },
];

const calendarCells: CalendarCell[] = [
  { day: "27", muted: true },
  { day: "28", muted: true },
  { day: "29", muted: true },
  { day: "30", muted: true },
  { day: "1", current: true, holiday: "근로자의날" },
  { day: "2", current: true },
  { day: "3", current: true },
  { day: "4", current: true },
  {
    day: "5",
    current: true,
    holiday: "어린이날",
    events: [{ type: "manual", count: 1 }],
  },
  { day: "6", current: true, holiday: "대체공휴일" },
  { day: "7", current: true, events: [{ type: "sales", count: 2 }] },
  { day: "8", current: true, events: [{ type: "manual", count: 1 }] },
  { day: "9", current: true, events: [{ type: "expiry", count: 1 }] },
  { day: "10", current: true },
  { day: "11", current: true },
  {
    day: "12",
    current: true,
    events: [
      { type: "sales", count: 3 },
      { type: "expiry", count: 1 },
    ],
  },
  { day: "13", current: true, events: [{ type: "manual", count: 2 }] },
  { day: "14", current: true, events: [{ type: "sales", count: 1 }] },
  {
    day: "15",
    current: true,
    today: true,
    events: [
      { type: "sales", count: 2 },
      { type: "manual", count: 1 },
      { type: "expiry", count: 2 },
      { type: "manual", count: 1 },
    ],
  },
  { day: "16", current: true, events: [{ type: "sales", count: 1 }] },
  { day: "17", current: true },
  { day: "18", current: true, events: [{ type: "expiry", count: 1 }] },
  { day: "19", current: true },
  {
    day: "20",
    current: true,
    events: [
      { type: "sales", count: 2 },
      { type: "manual", count: 1 },
    ],
  },
  { day: "21", current: true, events: [{ type: "manual", count: 1 }] },
  { day: "22", current: true, events: [{ type: "sales", count: 1 }] },
  { day: "23", current: true, events: [{ type: "expiry", count: 1 }] },
  { day: "24", current: true },
  { day: "25", current: true },
  { day: "26", current: true, events: [{ type: "manual", count: 1 }] },
  { day: "27", current: true, events: [{ type: "sales", count: 2 }] },
  { day: "28", current: true, events: [{ type: "expiry", count: 1 }] },
  { day: "29", current: true, events: [{ type: "manual", count: 1 }] },
  { day: "30", current: true, events: [{ type: "sales", count: 1 }] },
  { day: "31", current: true },
  { day: "1", muted: true },
  { day: "2", muted: true },
  { day: "3", muted: true },
  { day: "4", muted: true },
  { day: "5", muted: true },
  { day: "6", muted: true },
  { day: "7", muted: true },
];

const upcomingItems: UpcomingItem[] = [
  {
    title: "갤럭시 S24 판매",
    subtitle: "김민수 고객",
    date: "05.16 (금)",
    time: "10:00",
    type: "sales",
    badge: "판매",
  },
  {
    title: "매장 프로모션 세팅",
    subtitle: "강남본점",
    date: "05.16 (금)",
    time: "11:00",
    type: "manual",
    badge: "수동",
  },
  {
    title: "아이폰 13 유지 만료",
    subtitle: "이서연 고객",
    date: "05.16 (금)",
    time: "13:00",
    type: "expiry",
    badge: "유지 만료",
  },
  {
    title: "아이폰 15 수납",
    subtitle: "박지훈 고객",
    date: "05.16 (금)",
    time: "14:00",
    type: "payment",
    badge: "수납",
  },
  {
    title: "재고 실사 진행",
    subtitle: "강남본점",
    date: "05.17 (토)",
    time: "09:00",
    type: "manual",
    badge: "수동",
  },
  {
    title: "갤럭시 A53 유지 만료",
    subtitle: "최유리 고객",
    date: "05.17 (토)",
    time: "10:00",
    type: "expiry",
    badge: "유지 만료",
  },
  {
    title: "아이폰 14 판매",
    subtitle: "정민호 고객",
    date: "05.17 (토)",
    time: "11:00",
    type: "sales",
    badge: "판매",
  },
  {
    title: "갤럭시 S23 수납",
    subtitle: "한예지 고객",
    date: "05.17 (토)",
    time: "13:30",
    type: "payment",
    badge: "수납",
  },
];

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

const eventMeta: Record<
  EventType,
  { label: string; chip: string; dot: string; legend: string }
> = {
  sales: {
    label: "판매/수납",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    legend: "판매/수납 이벤트",
  },
  manual: {
    label: "수동 일정",
    chip: "border-orange-200 bg-orange-50 text-orange-800",
    dot: "bg-orange-400",
    legend: "수동 일정",
  },
  expiry: {
    label: "유지 만료",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
    legend: "유지 만료",
  },
};

const workToneClass: Record<WorkCard["tone"], string> = {
  blue: "border-blue-100 bg-blue-50/35 text-blue-600",
  orange: "border-orange-100 bg-orange-50/35 text-orange-600",
  rose: "border-rose-100 bg-rose-50/35 text-rose-600",
};

const iconToneClass: Record<WorkCard["tone"], string> = {
  blue: "bg-blue-100 text-blue-600",
  orange: "bg-orange-100 text-orange-600",
  rose: "bg-rose-100 text-rose-600",
};

const upcomingTone = {
  sales: {
    icon: ShoppingCart,
    iconClass: "bg-green-100 text-green-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  payment: {
    icon: ShoppingCart,
    iconClass: "bg-green-100 text-green-600",
    badge: "bg-green-50 text-green-700",
  },
  manual: {
    icon: CalendarClock,
    iconClass: "bg-orange-100 text-orange-600",
    badge: "bg-orange-50 text-orange-700",
  },
  expiry: {
    icon: ShieldCheck,
    iconClass: "bg-violet-100 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
} satisfies Record<
  UpcomingItem["type"],
  { icon: LucideIcon; iconClass: string; badge: string }
>;

function HeaderSelect({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <label
      className={[
        "flex items-center gap-1.5 [@media(min-width:1500px)]:gap-2",
        className,
      ].join(" ")}
    >
      <span className="whitespace-nowrap text-xs font-bold text-slate-600">
        {label}
      </span>
      <SelectInput
        defaultValue="all"
        className="!h-9 !w-[92px] !text-xs [@media(min-width:1301px)]:!w-[112px] [@media(min-width:1500px)]:!w-[136px]"
      >
        <option value="all">{value}</option>
      </SelectInput>
    </label>
  );
}

function WorkloadCard({ card }: { card: WorkCard }) {
  const Icon = card.icon;

  return (
    <article
      className={[
        "flex h-[92px] flex-col rounded-lg border px-4 py-3",
        workToneClass[card.tone],
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            "flex size-10 items-center justify-center rounded-full",
            iconToneClass[card.tone],
          ].join(" ")}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
        >
          자세히 보기
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="ml-16 -mt-9 min-w-0">
        <p className="text-sm font-semibold leading-5 text-slate-600">
          {card.label}
        </p>
        <p
          className={[
            "text-[24px] font-bold leading-7",
            card.tone === "blue"
              ? "text-slate-950"
              : card.tone === "orange"
                ? "text-orange-500"
                : "text-rose-500",
          ].join(" ")}
        >
          {card.value}
        </p>
      </div>
      <div className="mt-auto flex h-6 items-end gap-5 border-t border-slate-200/70 pt-1 text-xs font-medium text-slate-600">
        {card.stats.map((stat) => (
          <span key={stat} className="whitespace-nowrap">
            {stat}
          </span>
        ))}
      </div>
    </article>
  );
}

function EventChip({ event }: { event: CalendarEvent }) {
  const meta = eventMeta[event.type];

  return (
    <div
      className={[
        "flex h-[12px] items-center gap-1 truncate rounded-[4px] border px-1.5 text-[10px] font-bold leading-[12px]",
        meta.chip,
      ].join(" ")}
    >
      <span
        className={["size-1.5 shrink-0 rounded-full", meta.dot].join(" ")}
      />
      <span className="truncate">
        {meta.label} {event.count}건
      </span>
    </div>
  );
}

function CalendarCellView({
  cell,
  index,
}: {
  cell: CalendarCell;
  index: number;
}) {
  const isSunday = index % 7 === 0;
  const isSaturday = index % 7 === 6;

  return (
    <div
      className={[
        "min-h-0 overflow-hidden border-b border-r border-slate-100 bg-white p-[2px]",
        cell.muted ? "bg-slate-50/50" : "",
      ].join(" ")}
    >
      <div className="mb-px flex h-[16px] items-center gap-1 text-xs font-semibold">
        <span
          className={[
            "inline-flex size-[18px] items-center justify-center rounded-full",
            cell.today
              ? "bg-blue-600 text-white"
              : isSunday
                ? "text-red-500"
                : isSaturday
                  ? "text-blue-500"
                  : cell.muted
                    ? "text-slate-400"
                    : "text-slate-600",
          ].join(" ")}
        >
          {cell.day}
        </span>
        {cell.holiday ? (
          <span className="truncate text-[11px] font-bold text-red-500">
            {cell.holiday}
          </span>
        ) : null}
      </div>
      <div className="space-y-px">
        {cell.events?.map((event, eventIndex) => (
          <EventChip
            key={`${cell.day}-${event.type}-${eventIndex}`}
            event={event}
          />
        ))}
      </div>
    </div>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const meta = upcomingTone[item.type];
  const Icon = meta.icon;

  return (
    <li className="grid h-[54px] grid-cols-[44px_minmax(0,1fr)_86px] items-center border-b border-slate-100 last:border-b-0">
      <span
        className={[
          "flex size-9 items-center justify-center rounded-full",
          meta.iconClass,
        ].join(" ")}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-5 text-slate-800">
          {item.title}
        </p>
        <p className="truncate text-xs font-medium leading-4 text-slate-400">
          {item.subtitle}
        </p>
      </div>
      <div className="justify-self-end text-right">
        <p className="whitespace-nowrap text-sm font-medium leading-5 text-slate-500">
          {item.date} | {item.time}
        </p>
        <span
          className={[
            "mt-1 inline-flex h-6 items-center justify-center rounded-md px-2 text-xs font-bold",
            meta.badge,
          ].join(" ")}
        >
          {item.badge}
        </span>
      </div>
    </li>
  );
}

export default function SchedulePage() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        fontFamily:
          'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif',
      }}
    >
      <header className="mb-2 flex h-[72px] shrink-0 items-start justify-between gap-4">
        <div className="min-w-[168px] shrink-0">
          <h1 className="text-[28px] font-bold leading-9 tracking-normal text-slate-950">
            일정 관리
          </h1>
          <p className="mt-1 text-xs leading-4 text-slate-500">
            업무 류와 월간 일정을 한눈에 관리하세요.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-3 [@media(min-width:1500px)]:gap-3">
          <div className="flex h-9 overflow-hidden rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700">
            <button
              type="button"
              className="flex w-9 items-center justify-center border-r border-slate-200 text-slate-500"
              aria-label="이전 달"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <div className="grid w-[82px] place-items-center">2025.05</div>
            <button
              type="button"
              className="flex w-9 items-center justify-center border-l border-slate-200 text-slate-500"
              aria-label="다음 달"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <HeaderSelect label="담당자" value="전체 담당자" />
          <HeaderSelect label="일정 유형" value="전체 유형" />
          <HeaderSelect label="매장" value="전체 매장" />
          <button
            type="button"
            aria-label="초기화"
            className="inline-flex h-9 min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/70 transition-colors hover:bg-slate-50 [@media(max-width:1300px)]:w-9 [@media(max-width:1300px)]:px-0 [@media(min-width:1500px)]:px-3"
          >
            <RefreshCw className="size-4" aria-hidden />
            <span className="[@media(max-width:1300px)]:hidden">초기화</span>
          </button>
          <button
            type="button"
            aria-label="수동 일정 등록"
            className="inline-flex h-9 min-h-9 items-center justify-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700 [@media(max-width:1300px)]:w-9 [@media(max-width:1300px)]:px-0 [@media(min-width:1500px)]:px-4"
          >
            <Plus className="size-4" aria-hidden />
            <span className="[@media(max-width:1300px)]:hidden">
              수동 일정 등록
            </span>
          </button>
        </div>
      </header>

      <section className="h-[150px] shrink-0 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm shadow-slate-200/60">
        <h2 className="text-base font-bold leading-5 text-slate-950">
          업무 류
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-5">
          {workCards.map((card) => (
            <WorkloadCard key={card.label} card={card} />
          ))}
        </div>
      </section>

      <section className="mt-2 grid h-[calc(100vh-268px)] max-h-[622px] shrink-0 grid-cols-[minmax(0,1fr)_390px] gap-3 [@media(min-height:950px)]:h-[632px] [@media(min-height:950px)]:max-h-[632px]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm shadow-slate-200/60">
          <div className="flex h-7 shrink-0 items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">월간 일정</h2>
            <div className="flex items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-bold">
                {["월", "주", "일"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={[
                      "h-8 w-9",
                      mode === "월"
                        ? "bg-blue-600 text-white"
                        : "text-slate-600",
                    ].join(" ")}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="h-8 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600"
              >
                오늘
              </button>
            </div>
          </div>

          <div className="mt-1 grid min-h-0 flex-1 grid-cols-7 grid-rows-[30px_repeat(6,minmax(0,1fr))] overflow-hidden rounded-none border border-slate-100 text-xs">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={[
                  "flex items-center justify-center border-b border-r border-slate-100 bg-slate-50 font-bold",
                  index === 0
                    ? "text-red-500"
                    : index === 6
                      ? "text-blue-500"
                      : "text-slate-600",
                ].join(" ")}
              >
                {day}
              </div>
            ))}
            {calendarCells.map((cell, index) => (
              <CalendarCellView
                key={`${cell.day}-${index}`}
                cell={cell}
                index={index}
              />
            ))}
          </div>

          <div className="flex h-7 shrink-0 items-end justify-center gap-8 text-xs font-medium text-slate-600">
            {(Object.keys(eventMeta) as EventType[]).map((type) => (
              <span key={type} className="inline-flex items-center gap-2">
                <span
                  className={["size-2 rounded-full", eventMeta[type].dot].join(
                    " "
                  )}
                />
                {eventMeta[type].legend}
              </span>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm shadow-slate-200/60">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-950">
              다가오는 일정
            </h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
            >
              전체 보기
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
          <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
            {upcomingItems.map((item) => (
              <UpcomingRow key={`${item.title}-${item.time}`} item={item} />
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 text-xs font-bold text-slate-700"
          >
            더보기
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
        </aside>
      </section>

      <footer className="flex h-0 shrink-0 items-center justify-center overflow-hidden text-xs text-slate-400 [@media(min-height:950px)]:h-[42px]">
        © 2025 PhoneShop. All rights reserved.
      </footer>
    </div>
  );
}
