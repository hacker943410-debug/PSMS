import {
  CalendarClock,
  Bell,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Button, PageIntro, Panel, TonePill } from "@/components/workspace";

type ScheduleStatus = "scheduled" | "done" | "confirmed";
type ScheduleCategory = "sales" | "manual" | "expiry";

type ScheduleItem = {
  id: string;
  title: string;
  time: string;
  owner: string;
  status: ScheduleStatus;
  type: string;
  category: ScheduleCategory;
};

type CalendarDay = {
  label: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: ScheduleItem[];
};

const workloadCards: {
  label: string;
  value: string;
  tone: "info" | "warning" | "neutral";
  badge: string;
  note: string;
  icon: typeof CalendarClock;
  iconClassName: string;
  panelClassName: string;
}[] = [
  {
    label: "오늘 예정",
    value: "18",
    tone: "info",
    badge: "자세히 보기",
    note: "판매/상담 10건 · 수동 일정 6건 · 유지 만료 2건",
    icon: CalendarClock,
    iconClassName: "bg-blue-100 text-blue-600",
    panelClassName: "bg-blue-50/40",
  },
  {
    label: "미처리 수동 일정",
    value: "7",
    tone: "warning",
    badge: "확인 필요",
    note: "기한 초과 2건 · 오늘 마감 3건 · 예정 2건",
    icon: Clock3,
    iconClassName: "bg-amber-100 text-amber-600",
    panelClassName: "bg-amber-50/40",
  },
  {
    label: "유지 만료 임박",
    value: "12",
    tone: "neutral",
    badge: "30일 이내",
    note: "7일 이내 8건 · 15일 이내 4건 · 30일 이내 0건",
    icon: Bell,
    iconClassName: "bg-rose-100 text-rose-600",
    panelClassName: "bg-rose-50/40",
  },
];

const statusTone: Record<ScheduleStatus, "info" | "success" | "warning"> = {
  scheduled: "info",
  done: "success",
  confirmed: "warning",
};

const statusLabel: Record<ScheduleStatus, string> = {
  scheduled: "예정",
  done: "완료",
  confirmed: "확정",
};

const scheduleEventsByDay: Record<number, ScheduleItem[]> = {
  2: [
    {
      id: "SCH-1001",
      title: "김과장 보유폰 상담",
      time: "09:00",
      owner: "최매니저",
      status: "confirmed",
      type: "상담",
      category: "sales",
    },
    {
      id: "SCH-1002",
      title: "입고 입점 미팅",
      time: "11:30",
      owner: "홍대리",
      status: "scheduled",
      type: "미팅",
      category: "manual",
    },
  ],
  5: [
    {
      id: "SCH-1003",
      title: "교체기기 검수",
      time: "13:00",
      owner: "이스태프",
      status: "scheduled",
      type: "현장",
      category: "manual",
    },
  ],
  11: [
    {
      id: "SCH-1004",
      title: "신규 계약 오리엔테이션",
      time: "10:20",
      owner: "박주임",
      status: "done",
      type: "교육",
      category: "sales",
    },
  ],
  13: [
    {
      id: "SCH-1005",
      title: "A/S 방문 일정 확인",
      time: "14:40",
      owner: "윤팀장",
      status: "confirmed",
      type: "AS",
      category: "expiry",
    },
  ],
  18: [
    {
      id: "SCH-1006",
      title: "휴대폰 수리 픽업",
      time: "16:20",
      owner: "김과장",
      status: "scheduled",
      type: "수리",
      category: "expiry",
    },
  ],
  23: [
    {
      id: "SCH-1007",
      title: "월간 실적 공유",
      time: "15:00",
      owner: "최매니저",
      status: "confirmed",
      type: "회의",
      category: "manual",
    },
  ],
  28: [
    {
      id: "SCH-1008",
      title: "재고 점검 회의",
      time: "11:10",
      owner: "홍대리",
      status: "done",
      type: "회의",
      category: "sales",
    },
  ],
};

const upcomingSchedules: ScheduleItem[] = [
  {
    id: "UP-1",
    title: "입고 검수 미팅",
    time: "오늘 14:00",
    owner: "박주임",
    status: "confirmed",
    type: "미팅",
    category: "manual",
  },
  {
    id: "UP-2",
    title: "AS 출고 확인콜",
    time: "오늘 16:30",
    owner: "이스태프",
    status: "scheduled",
    type: "AS",
    category: "expiry",
  },
  {
    id: "UP-3",
    title: "월말 보고서 제출",
    time: "내일 10:00",
    owner: "최매니저",
    status: "scheduled",
    type: "업무",
    category: "manual",
  },
  {
    id: "UP-4",
    title: "고객 방문 장비 점검",
    time: "목 09:30",
    owner: "윤팀장",
    status: "confirmed",
    type: "점검",
    category: "sales",
  },
];

const generateCalendarDays = (): CalendarDay[] => {
  const cells: CalendarDay[] = [];
  const daysInMonth = 31;
  const leadOffset = 3; // 2025-05 starts on Thursday (visual-only)
  const prevMonthDays = 30;

  for (let i = 0; i < 42; i += 1) {
    const index = i - leadOffset;

    if (index <= 0) {
      cells.push({
        label: `${prevMonthDays + index}`,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
      continue;
    }

    if (index > daysInMonth) {
      cells.push({
        label: `${index - daysInMonth}`,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
      continue;
    }

    cells.push({
      label: `${index}`,
      isCurrentMonth: true,
      isToday: index === 20,
      events: scheduleEventsByDay[index] ?? [],
    });
  }

  return cells;
};

const calendarDays = generateCalendarDays();

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

const legendItems = [
  { label: "판매/수납 이벤트", className: "bg-emerald-500" },
  { label: "수동 일정", className: "bg-amber-500" },
  { label: "유지 만료", className: "bg-violet-500" },
];

const categoryMeta: Record<
  ScheduleCategory,
  {
    label: string;
    chipClassName: string;
    iconClassName: string;
  }
> = {
  sales: {
    label: "판매/수납",
    chipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-100 text-emerald-600",
  },
  manual: {
    label: "수동 일정",
    chipClassName: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-100 text-amber-600",
  },
  expiry: {
    label: "유지 만료",
    chipClassName: "border-violet-200 bg-violet-50 text-violet-700",
    iconClassName: "bg-violet-100 text-violet-600",
  },
};

function getCategoryCounts(events: ScheduleItem[]) {
  return (Object.keys(categoryMeta) as ScheduleCategory[])
    .map((category) => ({
      category,
      count: events.filter((event) => event.category === category).length,
    }))
    .filter((item) => item.count > 0);
}

export default function SchedulePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <PageIntro
        className="lg:!flex-col 2xl:!flex-row"
        title="일정 관리"
        description="업무 류와 월간 일정을 한눈에 관리하세요."
        actions={
          <div className="flex max-w-5xl flex-wrap items-center justify-end gap-2">
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center px-2 text-slate-500 hover:bg-slate-100"
                aria-label="이전 달"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="grid h-9 min-w-28 place-items-center border-x border-slate-200 px-3 text-sm font-semibold text-slate-700">
                2025.05
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center px-2 text-slate-500 hover:bg-slate-100"
                aria-label="다음 달"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <label className="inline-flex h-9 min-w-32 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500">
              담당자
              <select className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-slate-700 outline-none">
                <option>전체 담당자</option>
                <option>김과장</option>
                <option>홍대리</option>
              </select>
            </label>
            <label className="inline-flex h-9 min-w-36 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500">
              일정 유형
              <select className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-slate-700 outline-none">
                <option>전체 유형</option>
                <option>판매/수납</option>
                <option>수동 일정</option>
                <option>유지 만료</option>
              </select>
            </label>
            <label className="inline-flex h-9 min-w-32 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500">
              매장
              <select className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-slate-700 outline-none">
                <option>전체 매장</option>
                <option>강남본점</option>
                <option>잠실점</option>
              </select>
            </label>
            <Button icon={RefreshCw}>초기화</Button>
            <Button icon={Plus} variant="primary">
              수동 일정 등록
            </Button>
          </div>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-950">업무 류</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {workloadCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className={[
                  "rounded-lg border border-slate-200 p-4",
                  card.panelClassName,
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={[
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
                      card.iconClassName,
                    ].join(" ")}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <TonePill tone={card.tone}>{card.badge}</TonePill>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950">
                  {card.value}건
                </p>
                <p className="mt-3 border-t border-slate-200 pt-2 text-xs leading-4 text-slate-600">
                  {card.note}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarClock className="h-4 w-4" />
              <span>월간 캘린더</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-semibold">
                {["월", "주", "일"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={[
                      "h-8 px-3",
                      mode === "월"
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                오늘
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1 rounded-lg border border-slate-200 bg-white p-1.5 text-xs">
            {weekDays.map((day) => (
              <div
                key={day}
                className="rounded-md border-b border-slate-200 pb-1 text-center text-[11px] font-semibold text-slate-500"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day, idx) => (
              <div
                key={`${day.label}-${idx}`}
                className={`relative min-h-0 overflow-hidden rounded-lg border p-1.5 transition-colors ${
                  day.isCurrentMonth ? "bg-white" : "bg-slate-50 text-slate-400"
                } ${
                  day.isToday ? "border-sky-500 bg-sky-50" : "border-slate-200"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${
                      day.isCurrentMonth && day.isToday
                        ? "bg-sky-600 text-white"
                        : ""
                    }`}
                  >
                    {day.label}
                  </span>
                  {day.isCurrentMonth && day.events.length > 0 && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {day.events.length}건
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {getCategoryCounts(day.events).map((item) => (
                    <div
                      key={item.category}
                      className={[
                        "flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-semibold",
                        categoryMeta[item.category].chipClassName,
                      ].join(" ")}
                    >
                      <span className="inline-block size-1.5 rounded-full bg-current" />
                      <span className="truncate">
                        {categoryMeta[item.category].label} {item.count}건
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex shrink-0 items-center justify-center gap-5 text-xs text-slate-600">
            {legendItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5"
              >
                <span
                  className={["size-2 rounded-full", item.className].join(" ")}
                  aria-hidden
                />
                {item.label}
              </span>
            ))}
          </div>
        </section>

        <section className="min-h-0 flex flex-col gap-3 overflow-y-auto">
          <Panel
            title="다가오는 일정"
            description="오늘/내일/이번 주 핵심 일정"
            actions={
              <Button variant="ghost" className="min-h-7 px-2 text-xs">
                전체 보기
              </Button>
            }
            footer={
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                더보기
                <ChevronRight className="size-3" aria-hidden />
              </button>
            }
          >
            <ul className="space-y-2">
              {upcomingSchedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="flex items-center gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <span
                    className={[
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                      categoryMeta[schedule.category].iconClassName,
                    ].join(" ")}
                  >
                    <CalendarClock className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {schedule.title}
                      </p>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        {schedule.time}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {schedule.type} · {schedule.owner}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <TonePill tone={statusTone[schedule.status]}>
                      {statusLabel[schedule.status]}
                    </TonePill>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </section>
    </div>
  );
}
