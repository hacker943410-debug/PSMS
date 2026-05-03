import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Save,
} from "lucide-react";

import {
  Button,
  FormField,
  PageIntro,
  Panel,
  SelectInput,
  TextInput,
  TonePill,
} from "@/components/workspace";

const steps = [
  "고객구분 선택",
  "가입유형 선택",
  "상품구성/거래대리점 선택",
  "고객/재고/요금제",
  "금액/수납",
  "최종 검토/등록",
];

const compactPanelClass =
  "[&>div:first-child]:px-3 [&>div:first-child]:py-2 [&>div:nth-child(2)]:p-2.5 [&_label>span:first-child]:mb-0.5 [&_label>span:first-child]:leading-4 [@media(max-height:950px)]:[&>div:first-child]:py-1.5 [@media(max-height:950px)]:[&>div:nth-child(2)]:p-2";

const compactControlClass =
  "!h-7 !px-2 !text-[12px] [@media(max-height:950px)]:!h-[28px] [@media(max-height:950px)]:!px-1.5";
const compactButtonClass = "!min-h-7 !px-2.5 !text-[11px]";
const actionButtonClass =
  "!min-h-9 !px-5 !text-xs [@media(max-height:950px)]:!min-h-7 [@media(max-height:950px)]:!px-2.5 [@media(max-height:950px)]:!text-[11px]";

function Stepper() {
  return (
    <ol className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/60 [@media(max-height:950px)]:gap-1.5 [@media(max-height:950px)]:px-2.5 [@media(max-height:950px)]:py-1 [@media(min-height:960px)]:mb-3">
      {steps.map((step, index) => {
        const active = index === 3;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={[
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold [@media(max-height:950px)]:size-6 [@media(max-height:950px)]:text-[11px]",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              {index + 1}
            </span>
            <span
              className={[
                "truncate text-xs font-bold [@media(max-height:950px)]:text-[11px]",
                active ? "text-blue-600" : "text-slate-500",
              ].join(" ")}
            >
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span className="hidden h-px flex-1 bg-slate-200 xl:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function AlertBox({
  tone,
  title,
  body,
}: {
  tone: "danger" | "warning";
  title: string;
  body: string;
}) {
  const classes = {
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  return (
    <div
      className={[
        "rounded-lg border p-3 [@media(max-height:950px)]:p-2",
        classes[tone],
      ].join(" ")}
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs leading-4">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function SalesNewPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden [@media(min-height:960px)]:gap-2">
      <PageIntro
        className="gap-2 [&_h1]:text-2xl [&_h1]:leading-8 [&_p]:mt-0.5"
        title="판매 등록"
        description="단계별로 정보를 입력하여 새로운 판매를 등록하세요."
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
              {["오늘", "7일", "30일", "3개월", "6개월", "1년"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={[
                    "min-h-8 border-r border-slate-200 px-3 text-xs font-semibold last:border-r-0",
                    item === "30일"
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-600",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button
              className={`${compactButtonClass} hidden 2xl:inline-flex`}
              icon={CalendarDays}
            >
              2025.04.20 ~ 2025.05.19
            </Button>
            <Button
              className={`${compactButtonClass} hidden 2xl:inline-flex`}
              icon={BarChart3}
            >
              상세 리포트
            </Button>
            <Button className={compactButtonClass} icon={Download}>
              CSV
            </Button>
            <Button className={compactButtonClass} icon={FileText}>
              PDF
            </Button>
          </>
        }
      />

      <Stepper />

      <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_17rem] [@media(min-height:960px)]:gap-2">
        <div className="min-h-0 min-w-0 overflow-y-auto pr-1 xl:pr-2">
          <div className="space-y-1.5 pb-1 [@media(min-height:960px)]:space-y-2.5">
            <Panel className={compactPanelClass} title="고객 정보">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <FormField label="고객명" required>
                  <TextInput
                    className={compactControlClass}
                    value="김민수"
                    readOnly
                  />
                </FormField>
                <FormField label="연락처" required>
                  <TextInput
                    className={compactControlClass}
                    value="010-1234-5678"
                    readOnly
                  />
                </FormField>
                <FormField label="생년월일">
                  <TextInput
                    className={compactControlClass}
                    value="1990-05-15"
                    readOnly
                  />
                </FormField>
                <FormField label="고객 유형">
                  <SelectInput
                    className={compactControlClass}
                    defaultValue="personal"
                  >
                    <option value="personal">일반 개인</option>
                  </SelectInput>
                </FormField>
                <FormField label="식별번호">
                  <SelectInput
                    className={compactControlClass}
                    defaultValue="resident"
                  >
                    <option value="resident">내국인 주민번호</option>
                  </SelectInput>
                </FormField>
                <FormField label="번호">
                  <TextInput
                    className={compactControlClass}
                    value="900515-1******"
                    readOnly
                  />
                </FormField>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p className="font-bold">본인 명의 인증 완료</p>
                  <p className="mt-1">PASS 인증 · 2025.05.19 10:34</p>
                </div>
              </div>
            </Panel>

            <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3 [@media(min-height:960px)]:gap-3">
              <Panel className={compactPanelClass} title="재고 선택">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <FormField label="브랜드">
                    <SelectInput
                      className={compactControlClass}
                      defaultValue="samsung"
                    >
                      <option value="samsung">삼성</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="모델명">
                    <SelectInput
                      className={compactControlClass}
                      defaultValue="s25"
                    >
                      <option value="s25">Galaxy S25</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="색상">
                    <SelectInput
                      className={compactControlClass}
                      defaultValue="navy"
                    >
                      <option value="navy">네이비</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="용량">
                    <SelectInput
                      className={compactControlClass}
                      defaultValue="256"
                    >
                      <option value="256">256GB</option>
                    </SelectInput>
                  </FormField>
                </div>
                <div className="mt-2">
                  <FormField label="검색">
                    <TextInput
                      className={compactControlClass}
                      placeholder="재고 IMEI / 일련번호 검색"
                    />
                  </FormField>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex gap-2.5">
                    <div className="relative h-16 w-[3.8rem] shrink-0 rounded-[14px] border border-slate-400 bg-slate-300">
                      <span className="absolute left-1/2 top-1 h-1.5 w-9 -translate-x-1/2 rounded-full bg-slate-400/80"></span>
                      <span className="absolute inset-x-1.5 top-3.5 bottom-3 rounded-[11px] border border-slate-300/80 bg-slate-200"></span>
                      <span className="absolute bottom-1.5 left-1/2 h-1.5 w-5 -translate-x-1/2 rounded-full border border-slate-400/80 bg-slate-300/80"></span>
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900">
                          S25-256-NV-2505-00123
                        </p>
                        <TonePill tone="success">재고 있음</TonePill>
                      </div>
                      <p className="mt-1.5 text-slate-500">
                        IMEI 351234567890123
                      </p>
                      <p className="mt-1 text-slate-500">출고가 1,155,000원</p>
                      <p className="mt-1 text-slate-500">입고일 2025-05-12</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <AlertBox
                    tone="danger"
                    title="재고 없음"
                    body="선택하신 모델/용량/색상에 해당하는 재고가 없습니다."
                  />
                  <AlertBox
                    tone="danger"
                    title="요금제/통신사 매칭 불가"
                    body="선택한 단말은 KT 전용 모델입니다. 다른 통신사를 선택해주세요."
                  />
                </div>
              </Panel>

              <div className="space-y-1.5 [@media(min-height:960px)]:space-y-2.5">
                <Panel className={compactPanelClass} title="통신사 및 요금제">
                  <FormField label="통신사" required>
                    <div className="grid grid-cols-3 gap-2">
                      {["SKT", "KT", "LG U+"].map((carrier) => (
                        <button
                          key={carrier}
                          type="button"
                          className={[
                            "min-h-8 rounded-md border text-[13px] font-bold",
                            carrier === "KT"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-700",
                          ].join(" ")}
                        >
                          {carrier}
                        </button>
                      ))}
                    </div>
                  </FormField>
                  <div className="mt-2">
                    <FormField label="요금제 선택" required>
                      <SelectInput
                        className={compactControlClass}
                        defaultValue="slim"
                      >
                        <option value="slim">5G 슬림 (월 69,000원)</option>
                      </SelectInput>
                    </FormField>
                  </div>
                  <div className="mt-2">
                    <AlertBox
                      tone="warning"
                      title="요금제/통신사 매칭 불가"
                      body="선택하신 요금제는 SKT 전용입니다. KT 가능한 요금제를 선택해주세요."
                    />
                  </div>
                </Panel>

                <Panel className={compactPanelClass} title="부가서비스">
                  <div className="space-y-1.5 text-[13px]">
                    {[
                      ["T 컬러링", "1,100원/월", false],
                      ["보험 (분실/파손60)", "5,500원/월", true],
                      ["스팸차단", "1,100원/월", false],
                      ["데이터 쉐어링 2GB", "2,200원/월", false],
                    ].map(([label, price, checked]) => (
                      <label
                        key={label.toString()}
                        className="flex items-center justify-between gap-2.5"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            defaultChecked={Boolean(checked)}
                          />
                          <span className="text-slate-700">{label}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {price}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                    <span className="font-semibold text-slate-500">
                      선택한 부가서비스 1개
                    </span>
                    <span className="font-bold text-slate-800">5,500원/월</span>
                  </div>
                </Panel>
              </div>

              <div className="space-y-1.5 [@media(min-height:960px)]:space-y-2.5">
                <Panel className={compactPanelClass} title="거래 대리점">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <FormField label="거래 대리점" required>
                      <SelectInput
                        className={compactControlClass}
                        defaultValue="agency"
                      >
                        <option value="agency">폰샵 강남 대리점</option>
                      </SelectInput>
                    </FormField>
                    <FormField label="담당자">
                      <SelectInput
                        className={compactControlClass}
                        defaultValue="owner"
                      >
                        <option value="owner">이성훈</option>
                      </SelectInput>
                    </FormField>
                  </div>
                  <div className="mt-2">
                    <AlertBox
                      tone="danger"
                      title="거래 대리점 없음"
                      body="선택한 기간에 유효한 계약 정보가 없습니다."
                    />
                  </div>
                </Panel>

                <Panel className={compactPanelClass} title="정책/할인 적용">
                  <div className="space-y-1.5">
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        className="rounded-md bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                      >
                        공시지원금
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-bold text-slate-500"
                      >
                        선택약정
                      </button>
                    </div>
                    <FormField label="지원금">
                      <TextInput
                        className={compactControlClass}
                        value="450,000원"
                        readOnly
                      />
                    </FormField>
                    <FormField label="추가지원금(15%)">
                      <TextInput
                        className={compactControlClass}
                        value="67,500원"
                        readOnly
                      />
                    </FormField>
                    <FormField label="할인 유형">
                      <SelectInput
                        className={compactControlClass}
                        defaultValue="store"
                      >
                        <option value="store">매장 추가 할인</option>
                      </SelectInput>
                    </FormField>
                    <FormField label="매장 추가 할인">
                      <TextInput
                        className={compactControlClass}
                        value="30,000원"
                        readOnly
                      />
                    </FormField>
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                      총 할인 금액 547,500원
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 space-y-1.5 overflow-y-auto xl:block [@media(min-height:960px)]:space-y-2.5">
          <Panel
            className={compactPanelClass}
            title="판매 요약"
            actions={
              <TonePill className="!min-h-5 !px-2" tone="success">
                모든 필수 항목 입력 완료
              </TonePill>
            }
          >
            <div className="space-y-1.5 text-xs [&_p]:leading-4">
              {[
                ["고객명", "김민수"],
                ["연락처", "010-1234-5678"],
                ["통신사", "KT"],
                ["요금제", "5G 슬림 (69,000원)"],
                ["단말", "Galaxy S25 256GB"],
                ["가입유형", "신규가입"],
                ["거래 대리점", "폰샵 강남 대리점"],
                ["담당자", "이성훈"],
              ].map(([label, value]) => (
                <p key={label} className="grid grid-cols-[5rem_1fr] gap-2">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="text-right font-semibold text-slate-800">
                    {value}
                  </span>
                </p>
              ))}
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <div className="flex items-center justify-between bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-700">
                <span>예상 수익</span>
                <span>112,500원</span>
              </div>
              <div className="flex items-center justify-between bg-rose-50 px-3 py-1.5 text-[13px] font-bold text-rose-700">
                <span>단말 할인</span>
                <span>547,500원</span>
              </div>
              <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-blue-700">
                <span>수납 예정</span>
                <span>607,500원</span>
              </div>
            </div>
          </Panel>

          <Panel className={compactPanelClass} title="검증 요약">
            <div className="space-y-1.5 text-xs [&_p]:leading-4">
              {[
                ["필수 항목", "완료", "success"],
                ["재고 검증", "완료", "success"],
                ["통신사/요금제 매칭", "완료", "success"],
                ["금액 규칙 검증", "경고 1건", "warning"],
                ["대리점 계약", "미검증", "danger"],
              ].map(([label, value, tone]) => (
                <p
                  key={label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-600">{label}</span>
                  <TonePill
                    className="!min-h-5 !px-2"
                    tone={tone as "success" | "warning" | "danger"}
                  >
                    {value}
                  </TonePill>
                </p>
              ))}
            </div>
          </Panel>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <div className="flex gap-2.5">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-bold">입력 금액 규칙 불일치</p>
                <p className="mt-1 leading-4">
                  매장 추가 할인 금액이 권장 범위를 초과했습니다.
                </p>
                <Button className="mt-2 min-h-8 px-3 text-xs">상세 보기</Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-lg shadow-slate-300/40 [@media(max-height:950px)]:px-3 [@media(max-height:950px)]:py-1 [@media(max-height:950px)]:shadow-sm [@media(max-height:950px)]:shadow-slate-200/40 [@media(min-height:960px)]:mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button className={actionButtonClass} icon={ChevronLeft}>
            이전
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button className={actionButtonClass} icon={Save}>
              임시저장
            </Button>
            <Button className={actionButtonClass} trailingIcon={ChevronRight}>
              다음
            </Button>
            <Button
              className={actionButtonClass}
              variant="primary"
              icon={CheckCircle2}
            >
              판매 등록
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
