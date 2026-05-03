# `/receivables` Design Reference Candidate Completion Report

작성일: 2026-05-03

## 작업 범위

- 승인 반영: `/sales/new` 사용자 승인 완료 반영
- 기준 PNG: `C:\Project\PSMS_Tech\design-reference\receivables.png`
- 대상 route: `/receivables`
- 후보 반영: `/receivables` 사용자 승인 후보 반영
- 비대상: Auth, RBAC, API, DB, Prisma, 수납/취소/미수금 잔액 계산 로직

## 작업 분해

| 단계 | 담당                   | 내용                                                  | 결과 |
| ---- | ---------------------- | ----------------------------------------------------- | ---- |
| 1    | 메인 에이전트          | 하네스 문서 확인, `/sales/new` 승인 완료 반영         | 완료 |
| 2    | 메인 에이전트          | `/receivables` 현재 3개 viewport 캡처 수집            | 완료 |
| 3    | `project_manager`      | 승인 완료/후보 분리 기준의 Phase/Task 진행률 산정     | 완료 |
| 4    | `visual_ui_reviewer`   | 기준 PNG와 현재 캡처의 정밀 시각 차이 분석            | 완료 |
| 5    | `spark_ui_iterator`    | `/receivables` 순수 UI/Tailwind 밀도 패치             | 완료 |
| 6    | 메인 에이전트          | Spark diff 검토, KPI/필터/페이지네이션 미세 보정      | 완료 |
| 7    | `ui_runtime_validator` | 최종 캡처 기준 viewport 안정성 및 후보 가능 여부 확인 | 완료 |

## 모델 선택 이유

| 역할                   | 선택 이유                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `project_manager`      | 승인 완료와 승인 후보를 분리해 하네스 진행률, Phase/Task 변동률을 보수적으로 산정하는 데 적합하다.   |
| `visual_ui_reviewer`   | 기준 PNG와 현재 캡처의 좌표, 폰트, 카드 높이, 잘림 여부를 시각 기준으로 판단하는 데 적합하다.        |
| `spark_ui_iterator`    | Auth/API/DB 없이 `apps/web`의 presentational UI와 Tailwind 밀도만 조정하는 범위라 Spark 정책에 맞다. |
| `ui_runtime_validator` | Playwright 캡처와 1586/1440/1280 viewport의 잘림, 스크롤, 하단 버튼 가시성을 검증하는 데 적합하다.   |

## 변경 내용

| 파일                                                                                      | 변경 요약                                                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/receivables/page.tsx`                                       | 필터 내부 grid 정렬, KPI 카드 금액 반응형 밀도, 테이블 행/페이지네이션 위치, 우측 상세 하단 영역을 기준 PNG에 맞게 보정 |
| `docs/00_system/design-reference-match-gate.md`                                           | `/sales/new` 승인 완료, `/receivables` 사용자 승인 후보, 진행률 갱신                                                    |
| `docs/80_ai_harness/design-reference-receivables-candidate-completion-report-20260503.md` | 이번 작업 완료 보고 추가                                                                                                |

## 주요 패치 상세

- `/sales/new`를 승인 완료 `3 / 10`으로 전환했다.
- `/receivables` 필터 카드 내부의 기간/매장/담당자/상태/고객 검색 배치를 기준 PNG에 더 가깝게 조정했다.
- KPI 금액이 1440x900, 1280x800에서 잘리지 않도록 카드 내부 padding, 아이콘 크기, 금액 폰트를 viewport별로 조정했다.
- 테이블 하단 페이지네이션이 화면 안에 안정적으로 보이도록 footer와 버튼 높이를 조정했다.
- 1586x992에서는 테이블 행 높이와 페이지 버튼 크기를 기준 PNG 밀도에 맞게 유지했다.
- 우측 상세 패널의 후속 일정 카드와 하단 액션 버튼 라인이 원본 높이감에 맞도록 재조정했다.

## 진행률

| 구분                                   |   이번 턴 전 | `/sales/new` 승인 반영 후 | `/receivables` 후보 반영 후 | 이번 턴 변동 |
| -------------------------------------- | -----------: | ------------------------: | --------------------------: | -----------: |
| Design Reference 승인 완료             |     `2 / 10` |                  `3 / 10` |                    `3 / 10` |         `+1` |
| Design Reference 승인 후보             |     `1 / 10` |                  `0 / 10` |                    `1 / 10` |          `0` |
| Design Reference Match Gate            | `20% / 100%` |              `30% / 100%` |                `30% / 100%` |      `+10%p` |
| Phase 1 Design System / Reference Gate | `52% / 100%` |              `55% / 100%` |                `57% / 100%` |       `+5%p` |
| Phase 5 Sales                          | `17% / 100%` |              `19% / 100%` |                `19% / 100%` |       `+2%p` |
| Phase 6 Receivable / Customer          |  `9% / 100%` |               `9% / 100%` |                `12% / 100%` |       `+3%p` |
| Phase 9 QA / Validation                | `40% / 100%` |              `40% / 100%` |                `42% / 100%` |       `+2%p` |
| 전체 프로젝트                          | `30% / 100%` |              `31% / 100%` |                `32% / 100%` |       `+2%p` |
| Web/API MVP 업무 기능 준비도           | `14% / 100%` |              `14% / 100%` |                `14% / 100%` |       `+0%p` |

Design Reference Match Gate는 사용자 승인 완료 기준이다. `/receivables`는 승인 후보이므로 공식 gate 완료율은 `30% / 100%`를 유지한다.

## Phase별 완료율

| Phase | 영역                           | 이번 턴 전 |  현재 |   변동 |
| ----: | ------------------------------ | ---------: | ----: | -----: |
|     0 | Baseline / Harness             |      `84%` | `84%` | `+0%p` |
|     1 | Design System / Reference Gate |      `52%` | `57%` | `+5%p` |
|     2 | Auth / RBAC                    |      `70%` | `70%` | `+0%p` |
|     3 | DB / Seed                      |      `59%` | `59%` | `+0%p` |
|     4 | Dashboard / Report             |       `9%` |  `9%` | `+0%p` |
|     5 | Sales                          |      `17%` | `19%` | `+2%p` |
|     6 | Receivable / Customer          |       `9%` | `12%` | `+3%p` |
|     7 | Schedule / Inventory           |       `9%` |  `9%` | `+0%p` |
|     8 | Admin Settings                 |      `14%` | `14%` | `+0%p` |
|     9 | QA / Validation                |      `40%` | `42%` | `+2%p` |

## Task별 완료율

| Task                                 | 이번 턴 전 |     현재 |     변동 |
| ------------------------------------ | ---------: | -------: | -------: |
| `/sales/new` 사용자 승인 반영        |       `0%` |   `100%` | `+100%p` |
| Gate 승인 완료 수 반영               |   `2 / 10` | `3 / 10` |     `+1` |
| Gate 승인 후보 수 반영               |   `1 / 10` | `1 / 10` |      `0` |
| `/receivables` 기준 PNG 분석         |       `0%` |   `100%` | `+100%p` |
| `/receivables` UI-only 패치          |       `0%` |   `100%` | `+100%p` |
| `/receivables` viewport 검증         |       `0%` |   `100%` | `+100%p` |
| `/receivables` 시각 리뷰             |       `0%` |   `100%` | `+100%p` |
| `/receivables` 사용자 승인 후보 판정 |   `0 / 10` | `1 / 10` |     `+1` |
| Auth / DB / API 변경                 |       `0%` |     `0%` |   `+0%p` |

## 검증

| 검증                                                                             | 결과                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `pnpm exec prettier --write "apps/web/src/app/(workspace)/receivables/page.tsx"` | 통과                                      |
| `pnpm --filter @psms/web typecheck`                                              | 통과                                      |
| `pnpm --filter @psms/web lint`                                                   | 통과                                      |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "receivables"` | 통과, chromium-1586/1440/1280 총 3 passed |

최종 캡처:

- `C:\Project\Activate\PSMS\.tmp\receivables-final-v3\receivables-1586x992.png`
- `C:\Project\Activate\PSMS\.tmp\receivables-final-v3\receivables-1440x900.png`
- `C:\Project\Activate\PSMS\.tmp\receivables-final-v3\receivables-1280x800.png`

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고      |
| ------------ | --------: | --------- |
| Auth         |        No | 변경 없음 |
| DB           |        No | 변경 없음 |
| API contract |        No | 변경 없음 |

## 남은 리스크

- `1280x800`에서는 여백이 타이트해 KPI 보조 문구와 일부 필터 라벨이 압축된다.
- 향후 실제 데이터 길이가 늘어나면 KPI 금액, 테이블 액션 컬럼, 우측 패널 일정 행은 다시 회귀 검증이 필요하다.
- 현재는 정적 UI 기준 후보이며, 실제 수납/취소 기능 연결과 미수금 잔액 계산 로직은 별도 Phase에서 구현해야 한다.

## 다음 작업 예정 3단계

| 순서 | 작업                                                                                  | 담당 제안                                                         |
| ---: | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
|    1 | 사용자가 `/receivables` 최종 캡처를 확인하고 승인 여부 결정                           | 메인 에이전트                                                     |
|    2 | 승인 시 `/receivables`를 승인 완료 `4 / 10`으로 전환하고 다음 route `/customers` 착수 | `project_manager`, 메인 에이전트                                  |
|    3 | `/customers` 원본 PNG 정밀 분석 및 UI 패치                                            | `visual_ui_reviewer`, `spark_ui_iterator`, `ui_runtime_validator` |
