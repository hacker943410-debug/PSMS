# `/schedule` Design Reference Candidate Completion Report

작성일: 2026-05-03

## 작업 범위

- 승인 반영: `/customers` 사용자 승인 완료 반영
- 기준 PNG: `C:\Project\PSMS_Tech\design-reference\schedule.png`
- 대상 route: `/schedule`
- 후보 반영: `/schedule` 사용자 승인 후보 반영
- 유지 조건: 날짜 셀 안 일정 4개 표시 유지
- 비대상: Auth, RBAC, API, DB, Prisma, 일정/고객/판매 비즈니스 로직

## 작업 분해

| 단계 | 담당                   | 내용                                                        | 결과 |
| ---: | ---------------------- | ----------------------------------------------------------- | ---- |
|    1 | 메인 에이전트          | 하네스 문서와 게이트 현황 확인, `/customers` 승인 반영      | 완료 |
|    2 | `project_manager`      | Phase/Task 진행률과 모델 선택 이유 산정                     | 완료 |
|    3 | `visual_ui_reviewer`   | `schedule.png`와 현재 캡처의 좌표/밀도 차이 분석            | 완료 |
|    4 | `spark_ui_iterator`    | `/schedule` UI-only Tailwind/정적 레이아웃 보정             | 완료 |
|    5 | 메인 에이전트          | 1280 헤더 컨트롤 잘림 보정, 최종 캡처 수집                  | 완료 |
|    6 | `ui_runtime_validator` | 3개 viewport, console/network/hydration, 일정 4개 표시 검증 | 완료 |

## 모델 선택 이유

| 역할        | 선택                   | 이유                                                                        |
| ----------- | ---------------------- | --------------------------------------------------------------------------- |
| 메인        | GPT-5                  | 하네스 승인 규칙, 진행률 산정, 서브에이전트 결과 통합과 최종 검증 담당      |
| PM          | `project_manager`      | 승인 완료와 승인 후보를 분리해 Phase/Task 진행률을 보수적으로 산정하기 적합 |
| 시각 검토   | `visual_ui_reviewer`   | 원본 PNG와 현재 screenshot의 좌표, 높이, 캘린더 밀도 차이를 판단하기 적합   |
| UI 반복     | `spark_ui_iterator`    | Auth/API/DB 없이 `apps/web` presentational UI와 Tailwind 밀도 조정에 적합   |
| 런타임 검증 | `ui_runtime_validator` | Playwright 기반 scroll, console, network, hydration, viewport 확인에 적합   |

## 진행률

| 구분                       | 승인 완료 | 승인 후보 | Phase 1 | Design Reference Match Gate | 전체 | Web/API MVP |
| -------------------------- | --------: | --------: | ------: | --------------------------: | ---: | ----------: |
| 작업 전                    |      4/10 |      1/10 |     62% |                         40% |  34% |         14% |
| `/customers` 승인 반영 후  |      5/10 |      0/10 |     65% |                         50% |  35% |         14% |
| `/schedule` 후보화 완료 후 |      5/10 |      1/10 |     67% |                         50% |  36% |         14% |

## Phase별 변동

| Phase | 영역                           | 작업 전 | 현재 | 이번 변동 |
| ----: | ------------------------------ | ------: | ---: | --------: |
|     0 | Baseline / Harness             |     84% |  84% |      +0%p |
|     1 | Design System / Reference Gate |     62% |  67% |      +5%p |
|     2 | Auth / RBAC                    |     70% |  70% |      +0%p |
|     3 | DB / Seed                      |     59% |  59% |      +0%p |
|     4 | Dashboard / Report             |      9% |   9% |      +0%p |
|     5 | Sales                          |     19% |  19% |      +0%p |
|     6 | Receivable / Customer          |     15% |  15% |      +0%p |
|     7 | Schedule / Inventory           |      9% |  12% |      +3%p |
|     8 | Admin Settings                 |     14% |  14% |      +0%p |
|     9 | QA / Validation                |     44% |  46% |      +2%p |

## Task별 변동

| Task                                     |   작업 전 |           현재 |        이번 변동 |
| ---------------------------------------- | --------: | -------------: | ---------------: |
| `/customers` 사용자 승인 완료 반영       | 후보 1/10 | 승인 완료 5/10 | 완료 +1, 후보 -1 |
| `/schedule` 기준 PNG 분석                |        0% |           100% |           +100%p |
| `/schedule` UI-only 패치                 |        0% |           100% |           +100%p |
| `/schedule` 1586/1440/1280 viewport 검증 |        0% |           100% |           +100%p |
| `/schedule` 승인 후보 반영               |      0/10 |      후보 1/10 |          후보 +1 |
| Auth / DB / API 변경                     |        0% |             0% |             +0%p |

## 변경 파일

| 파일                                                                                   | 변경 요약                                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/schedule/page.tsx`                                       | 상단 컨트롤 반응형 폭 보정, 업무 류/캘린더/다가오는 일정 패널 밀도 조정, 날짜 셀 일정 4개 표시 유지 |
| `docs/00_system/design-reference-match-gate.md`                                        | `/customers` 승인 완료, `/schedule` 승인 후보, 진행률 5/10 및 전체 36% 반영                         |
| `docs/80_ai_harness/design-reference-schedule-candidate-completion-report-20260503.md` | 이번 작업 완료 보고 추가                                                                            |

## 검증

| 검증                                                                          | 결과                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm exec prettier --write "apps/web/src/app/(workspace)/schedule/page.tsx"` | 통과                                                                                                       |
| `pnpm --filter @psms/web typecheck`                                           | 통과                                                                                                       |
| `pnpm --filter @psms/web lint`                                                | 통과                                                                                                       |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "schedule"` | 통과, chromium-1586/1440/1280 총 3 passed                                                                  |
| `ui_runtime_validator`                                                        | 통과, page-level scroll 없음, 1280 헤더 잘림 없음, 15일 일정 4개 유지, console/network/hydration 이상 없음 |

최종 캡처:

- `C:\Project\Activate\PSMS\.tmp\schedule-final-v2\schedule-1586x992.png`
- `C:\Project\Activate\PSMS\.tmp\schedule-final-v2\schedule-1440x900.png`
- `C:\Project\Activate\PSMS\.tmp\schedule-final-v2\schedule-1280x800.png`

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고      |
| ------------ | --------: | --------- |
| Auth         |        No | 변경 없음 |
| DB           |        No | 변경 없음 |
| API contract |        No | 변경 없음 |

## 잔여 리스크

- `/schedule`은 아직 사용자 승인 후보이며, 사용자 승인 전에는 완료로 계산하지 않는다.
- 원본보다 캘린더 높이가 큰 부분은 이전 사용자 요구인 날짜 셀 일정 4개 표시를 우선한 의도적 차이다.
- 현재는 정적 디자인 후보이며, 실제 일정 CRUD/API/필터 동작은 별도 업무 기능 Phase에서 구현해야 한다.

## 다음 작업 예정 3단계

| 순서 | 작업                                                                               | 담당 제안                                                         |
| ---: | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
|    1 | 사용자가 `/schedule` 최종 캡처와 실제 화면을 확인하고 승인 여부 결정               | 메인 에이전트                                                     |
|    2 | 승인 시 `/schedule`을 승인 완료 `6 / 10`으로 전환하고 다음 route `/inventory` 착수 | `project_manager`, 메인 에이전트                                  |
|    3 | `/inventory` 원본 PNG 정밀 분석, Spark UI-only 패치, Playwright runtime 검증       | `visual_ui_reviewer`, `spark_ui_iterator`, `ui_runtime_validator` |
