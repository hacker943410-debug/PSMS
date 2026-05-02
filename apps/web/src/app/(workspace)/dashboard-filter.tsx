"use client";

import { useMemo, useState } from "react";

import { SelectInput, TextInput } from "@/components/workspace";

type PeriodMode =
  | "today"
  | "recent7"
  | "recent30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

const periodRanges: Record<
  Exclude<PeriodMode, "custom">,
  { label: string; start: string; end: string }
> = {
  today: { label: "오늘", start: "2025-05-19", end: "2025-05-19" },
  recent7: { label: "최근 7일", start: "2025-05-13", end: "2025-05-19" },
  recent30: { label: "최근 30일", start: "2025-04-20", end: "2025-05-19" },
  thisMonth: { label: "이번 달", start: "2025-05-01", end: "2025-05-19" },
  lastMonth: { label: "지난 달", start: "2025-04-01", end: "2025-04-30" },
};

function formatRangeDate(value: string) {
  return value.replaceAll("-", ".");
}

export function DashboardFilter() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("recent30");
  const [customStart, setCustomStart] = useState("2025-04-20");
  const [customEnd, setCustomEnd] = useState("2025-05-19");
  const [store, setStore] = useState("all");
  const [staff, setStaff] = useState("all");

  const selectedRange = useMemo(() => {
    if (periodMode === "custom") {
      return {
        start: customStart,
        end: customEnd,
      };
    }

    return periodRanges[periodMode];
  }, [customEnd, customStart, periodMode]);

  const rangeLabel = `${formatRangeDate(selectedRange.start)} ~ ${formatRangeDate(
    selectedRange.end
  )}`;

  return (
    <section className="relative z-10 h-[58px] overflow-visible rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60">
      <div className="flex items-center gap-7 max-[1450px]:gap-5 max-[1350px]:gap-3">
        <label className="flex shrink-0 items-center gap-3 text-sm font-semibold text-slate-700">
          <span className="shrink-0">기간</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="block w-[126px] shrink-0 max-[1450px]:w-[118px] max-[1350px]:w-[112px]">
              <SelectInput
                value={periodMode}
                aria-label="기간 유형"
                className="h-8"
                onChange={(event) =>
                  setPeriodMode(event.target.value as PeriodMode)
                }
              >
                {Object.entries(periodRanges).map(([value, range]) => (
                  <option key={value} value={value}>
                    {range.label}
                  </option>
                ))}
                <option value="custom">직접 선택</option>
              </SelectInput>
            </span>
            {periodMode === "custom" ? (
              <>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  시작
                </span>
                <span className="block w-[150px] shrink-0 max-[1450px]:w-[142px] max-[1350px]:w-[132px]">
                  <TextInput
                    type="date"
                    aria-label="기간 시작"
                    value={customStart}
                    max={customEnd}
                    className="h-8 px-2.5"
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  종료
                </span>
                <span className="block w-[150px] shrink-0 max-[1450px]:w-[142px] max-[1350px]:w-[132px]">
                  <TextInput
                    type="date"
                    aria-label="기간 종료"
                    value={customEnd}
                    min={customStart}
                    className="h-8 px-2.5"
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </span>
              </>
            ) : (
              <span className="block w-[210px] shrink-0 max-[1450px]:w-[200px] max-[1350px]:w-[184px]">
                <TextInput
                  readOnly
                  aria-label="선택 기간 범위"
                  value={rangeLabel}
                  className="h-8 bg-slate-50 text-slate-600"
                />
              </span>
            )}
          </span>
        </label>
        <label className="flex shrink-0 items-center gap-3 text-sm font-semibold text-slate-700">
          <span className="shrink-0">매장</span>
          <span className="block w-[220px] shrink-0 max-[1450px]:w-[190px] max-[1350px]:w-[148px]">
            <SelectInput
              value={store}
              className="h-8"
              onChange={(event) => setStore(event.target.value)}
            >
              <option value="all">전체 매장</option>
              <option value="gangnam">강남본점</option>
              <option value="jamsil">잠실점</option>
              <option value="hongdae">홍대점</option>
              <option value="bundang">분당점</option>
              <option value="ilsan">일산점</option>
            </SelectInput>
          </span>
        </label>
        <label className="flex shrink-0 items-center gap-3 text-sm font-semibold text-slate-700">
          <span className="shrink-0">직원</span>
          <span className="block w-[244px] shrink-0 max-[1450px]:w-[204px] max-[1350px]:w-[148px]">
            <SelectInput
              value={staff}
              className="h-8"
              onChange={(event) => setStaff(event.target.value)}
            >
              <option value="all">전체 직원</option>
              <option value="kim">김민수</option>
              <option value="lee">이서연</option>
              <option value="park">박지훈</option>
              <option value="choi">최유리</option>
              <option value="jung">정대현</option>
            </SelectInput>
          </span>
        </label>
      </div>
    </section>
  );
}
