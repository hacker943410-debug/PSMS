import {
  AlertTriangle,
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

function Stepper() {
  return (
    <ol className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60">
      {steps.map((step, index) => {
        const active = index === 3;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={[
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              {index + 1}
            </span>
            <span
              className={[
                "truncate text-xs font-bold",
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
    <div className={["rounded-lg border p-4", classes[tone]].join(" ")}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs leading-5">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function SalesNewPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <PageIntro
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
                    "min-h-9 border-r border-slate-200 px-3 text-xs font-semibold last:border-r-0",
                    item === "30일"
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-600",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button icon={Download}>CSV</Button>
            <Button icon={FileText}>PDF</Button>
          </>
        }
      />

      <Stepper />

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_18.5rem]">
        <div className="min-h-0 min-w-0 overflow-y-auto pr-1">
          <div className="space-y-3 pb-1">
            <Panel title="고객 정보">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <FormField label="고객명" required>
                  <TextInput value="김민수" readOnly />
                </FormField>
                <FormField label="연락처" required>
                  <TextInput value="010-1234-5678" readOnly />
                </FormField>
                <FormField label="생년월일">
                  <TextInput value="1990-05-15" readOnly />
                </FormField>
                <FormField label="고객 유형">
                  <SelectInput defaultValue="personal">
                    <option value="personal">일반 개인</option>
                  </SelectInput>
                </FormField>
                <FormField label="식별번호">
                  <SelectInput defaultValue="resident">
                    <option value="resident">내국인 주민번호</option>
                  </SelectInput>
                </FormField>
                <FormField label="번호">
                  <TextInput value="900515-1******" readOnly />
                </FormField>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p className="font-bold">본인 명의 인증 완료</p>
                  <p className="mt-1">PASS 인증 · 2025.05.19 10:34</p>
                </div>
              </div>
            </Panel>

            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              <Panel title="재고 선택">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <FormField label="브랜드">
                    <SelectInput defaultValue="samsung">
                      <option value="samsung">삼성</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="모델명">
                    <SelectInput defaultValue="s25">
                      <option value="s25">Galaxy S25</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="색상">
                    <SelectInput defaultValue="navy">
                      <option value="navy">네이비</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="용량">
                    <SelectInput defaultValue="256">
                      <option value="256">256GB</option>
                    </SelectInput>
                  </FormField>
                </div>
                <div className="mt-3">
                  <FormField label="검색">
                    <TextInput placeholder="재고 IMEI / 일련번호 검색" />
                  </FormField>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex gap-3">
                    <div className="size-16 rounded-lg bg-slate-300" />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900">
                          S25-256-NV-2505-00123
                        </p>
                        <TonePill tone="success">재고 있음</TonePill>
                      </div>
                      <p className="mt-2 text-slate-500">
                        IMEI 351234567890123
                      </p>
                      <p className="mt-1 text-slate-500">출고가 1,155,000원</p>
                      <p className="mt-1 text-slate-500">입고일 2025-05-12</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
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

              <div className="space-y-3">
                <Panel title="통신사 및 요금제">
                  <FormField label="통신사" required>
                    <div className="grid grid-cols-3 gap-2">
                      {["SKT", "KT", "LG U+"].map((carrier) => (
                        <button
                          key={carrier}
                          type="button"
                          className={[
                            "min-h-8 rounded-md border text-sm font-bold",
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
                  <div className="mt-3">
                    <FormField label="요금제 선택" required>
                      <SelectInput defaultValue="slim">
                        <option value="slim">5G 슬림 (월 69,000원)</option>
                      </SelectInput>
                    </FormField>
                  </div>
                  <div className="mt-3">
                    <AlertBox
                      tone="warning"
                      title="요금제/통신사 매칭 불가"
                      body="선택하신 요금제는 SKT 전용입니다. KT 가능한 요금제를 선택해주세요."
                    />
                  </div>
                </Panel>

                <Panel title="부가서비스">
                  <div className="space-y-2 text-sm">
                    {[
                      ["T 컬러링", "1,100원/월", false],
                      ["보험 (분실/파손60)", "5,500원/월", true],
                      ["스팸차단", "1,100원/월", false],
                      ["데이터 쉐어링 2GB", "2,200원/월", false],
                    ].map(([label, price, checked]) => (
                      <label
                        key={label.toString()}
                        className="flex items-center justify-between gap-3"
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
                </Panel>
              </div>

              <div className="space-y-3">
                <Panel title="거래 대리점">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <FormField label="거래 대리점" required>
                      <SelectInput defaultValue="agency">
                        <option value="agency">폰샵 강남 대리점</option>
                      </SelectInput>
                    </FormField>
                    <FormField label="담당자">
                      <SelectInput defaultValue="owner">
                        <option value="owner">이성훈</option>
                      </SelectInput>
                    </FormField>
                  </div>
                  <div className="mt-3">
                    <AlertBox
                      tone="danger"
                      title="거래 대리점 없음"
                      body="선택한 기간에 유효한 계약 정보가 없습니다."
                    />
                  </div>
                </Panel>

                <Panel title="정책/할인 적용">
                  <div className="space-y-2.5">
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                      >
                        공시지원금
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-bold text-slate-500"
                      >
                        선택약정
                      </button>
                    </div>
                    <FormField label="지원금">
                      <TextInput value="450,000원" readOnly />
                    </FormField>
                    <FormField label="추가지원금(15%)">
                      <TextInput value="67,500원" readOnly />
                    </FormField>
                    <FormField label="할인 유형">
                      <SelectInput defaultValue="store">
                        <option value="store">매장 추가 할인</option>
                      </SelectInput>
                    </FormField>
                    <FormField label="매장 추가 할인">
                      <TextInput value="30,000원" readOnly />
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

        <aside className="hidden min-h-0 space-y-3 overflow-y-auto xl:block">
          <Panel
            title="판매 요약"
            actions={
              <TonePill tone="success">모든 필수 항목 입력 완료</TonePill>
            }
          >
            <div className="space-y-2.5 text-xs">
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
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="flex items-center justify-between bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
                <span>예상 수익</span>
                <span>112,500원</span>
              </div>
              <div className="flex items-center justify-between bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700">
                <span>단말 할인</span>
                <span>547,500원</span>
              </div>
              <div className="flex items-center justify-between bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700">
                <span>수납 예정</span>
                <span>607,500원</span>
              </div>
            </div>
          </Panel>

          <Panel title="검증 요약">
            <div className="space-y-2.5 text-xs">
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
                  <TonePill tone={tone as "success" | "warning" | "danger"}>
                    {value}
                  </TonePill>
                </p>
              ))}
            </div>
          </Panel>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-bold">입력 금액 규칙 불일치</p>
                <p className="mt-1 leading-5">
                  매장 추가 할인 금액이 권장 범위를 초과했습니다.
                </p>
                <Button className="mt-3 min-h-8 px-3 text-xs">상세 보기</Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-300/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button icon={ChevronLeft}>이전</Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button icon={Save}>임시저장</Button>
            <Button trailingIcon={ChevronRight}>다음</Button>
            <Button variant="primary" icon={CheckCircle2}>
              판매 등록
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
