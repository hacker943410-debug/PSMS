# `/customers` Design Reference Candidate Completion Report

작성일: 2026-05-03

## 작업 범위

- 승인 반영: `/receivables` 사용자 승인 완료 반영
- 기준 PNG: `C:\Project\PSMS_Tech\design-reference\customers.png`
- 대상 route: `/customers`
- 후보 반영: `/customers` 사용자 승인 후보 반영
- 비대상: Auth, RBAC, API, DB, Prisma, 고객/미수/판매 비즈니스 로직

## 작업 분해

| 단계 | 담당                 | 내용                                                          | 결과 |
| ---: | -------------------- | ------------------------------------------------------------- | ---- |
|    1 | 메인 에이전트        | 하네스 문서와 게이트 현황 확인, `/receivables` 승인 반영      | 완료 |
|    2 | `project_manager`    | Phase/Task 진행률 산정과 모델 선택 이유 초안 작성             | 완료 |
|    3 | `visual_ui_reviewer` | `customers.png`와 현재 캡처의 좌표/밀도 차이 분석             | 완료 |
|    4 | `spark_ui_iterator`  | `/customers` UI-only Tailwind/정적 레이아웃 1차 패치          | 완료 |
|    5 | 메인 에이전트        | Spark 결과 통합, 원본 문구/우측 상세/좌측 페이지네이션 재보정 | 완료 |
|    6 | 메인 에이전트        | 3개 viewport 캡처, typecheck/lint/e2e 검증                    | 완료 |

## 모델 선택 이유

| 역할      | 선택                 | 이유                                                                        |
| --------- | -------------------- | --------------------------------------------------------------------------- |
| 메인      | GPT-5                | 하네스 승인 규칙, 진행률 산정, 서브에이전트 결과 통합과 최종 검증 담당      |
| PM        | `project_manager`    | 승인 완료와 승인 후보를 분리해 Phase/Task 진행률을 보수적으로 산정하기 적합 |
| 시각 검토 | `visual_ui_reviewer` | 원본 PNG와 현재 screenshot의 좌표, 높이, 폰트, 정렬 차이를 판단하기 적합    |
| UI 반복   | `spark_ui_iterator`  | Auth/API/DB 없이 `apps/web` presentational UI와 Tailwind 밀도 조정에 적합   |

## 진행률

| 구분                        | 승인 완료 | 승인 후보 | Phase 1 | Design Reference Match Gate | 전체 | Web/API MVP |
| --------------------------- | --------: | --------: | ------: | --------------------------: | ---: | ----------: |
| 작업 전                     |      3/10 |      1/10 |     57% |                         30% |  32% |         14% |
| `/receivables` 승인 반영 후 |      4/10 |      0/10 |     60% |                         40% |  33% |         14% |
| `/customers` 후보화 완료 후 |      4/10 |      1/10 |     62% |                         40% |  34% |         14% |

## Phase별 변동

| Phase | 영역                           | 작업 전 | 현재 | 이번 변동 |
| ----: | ------------------------------ | ------: | ---: | --------: |
|     0 | Baseline / Harness             |     84% |  84% |      +0%p |
|     1 | Design System / Reference Gate |     57% |  62% |      +5%p |
|     2 | Auth / RBAC                    |     70% |  70% |      +0%p |
|     3 | DB / Seed                      |     59% |  59% |      +0%p |
|     4 | Dashboard / Report             |      9% |   9% |      +0%p |
|     5 | Sales                          |     19% |  19% |      +0%p |
|     6 | Receivable / Customer          |     12% |  15% |      +3%p |
|     7 | Schedule / Inventory           |      9% |   9% |      +0%p |
|     8 | Admin Settings                 |     14% |  14% |      +0%p |
|     9 | QA / Validation                |     42% |  44% |      +2%p |

## Task별 변동

| Task                                      |   작업 전 |           현재 |        이번 변동 |
| ----------------------------------------- | --------: | -------------: | ---------------: |
| `/receivables` 사용자 승인 완료 반영      | 후보 1/10 | 승인 완료 4/10 | 완료 +1, 후보 -1 |
| `/customers` 기준 PNG 분석                |        0% |           100% |           +100%p |
| `/customers` UI-only 패치                 |        0% |           100% |           +100%p |
| `/customers` 1586/1440/1280 viewport 검증 |        0% |           100% |           +100%p |
| `/customers` 승인 후보 반영               |      0/10 |      후보 1/10 |          후보 +1 |
| Auth / DB / API 변경                      |        0% |             0% |             +0%p |

## 변경 파일

| 파일                                                                                    | 변경 요약                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/customers/page.tsx`                                       | `customers.png` 기준 정적 고객 목록/검색/페이지네이션/우측 고객 상세 패널 구조로 재구성, 상세 패널의 판매 이력/상담 메모 카드 밀도와 `전체 보기` 링크 위치 보정 |
| `docs/00_system/design-reference-match-gate.md`                                         | `/receivables` 승인 완료, `/customers` 승인 후보, 진행률 4/10 및 전체 34% 반영                                                                                  |
| `docs/80_ai_harness/design-reference-customers-candidate-completion-report-20260503.md` | 이번 작업 완료 보고 추가                                                                                                                                        |

## 검증

| 검증                                                                           | 결과                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| `pnpm exec prettier --write "apps/web/src/app/(workspace)/customers/page.tsx"` | 통과                                      |
| `pnpm --filter @psms/web typecheck`                                            | 통과                                      |
| `pnpm --filter @psms/web lint`                                                 | 통과                                      |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "customers"` | 통과, chromium-1586/1440/1280 총 3 passed |

최종 캡처:

- `C:\Project\Activate\PSMS\.tmp\customers-final\customers-1586x992.png`
- `C:\Project\Activate\PSMS\.tmp\customers-final\customers-1440x900.png`
- `C:\Project\Activate\PSMS\.tmp\customers-final\customers-1280x800.png`

## 잔여 리스크

- `/customers`는 아직 사용자 승인 후보이며, 사용자 승인 전에는 완료로 계산하지 않는다.
- 1280/1440 viewport는 회귀 방지용으로만 확인했으며, 실제 기준은 사용자 화면과 원본 PNG 기준인 1586x992이다.
- 현재는 정적 디자인 후보이며, 고객 상세 데이터 연동과 실제 필터/페이지네이션 동작은 별도 업무 기능 Phase에서 구현해야 한다.

## 다음 작업 예정 3단계

| 순서 | 작업                                                                               | 담당 제안                                                         |
| ---: | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
|    1 | 사용자가 `/customers` 최종 캡처와 실제 화면을 확인하고 승인 여부 결정              | 메인 에이전트                                                     |
|    2 | 승인 시 `/customers`를 승인 완료 `5 / 10`으로 전환하고 다음 route `/schedule` 착수 | `project_manager`, 메인 에이전트                                  |
|    3 | `/schedule` 원본 PNG 정밀 분석, Spark UI-only 패치, Playwright runtime 검증        | `visual_ui_reviewer`, `spark_ui_iterator`, `ui_runtime_validator` |
