# Stage 1 Schedule Reference Density Follow-up Completion Report

## Summary

- `/schedule` 화면을 `schedule.png` 기준에 더 가깝게 보정했다.
- 상단 command row, `업무 류` 3개 카드, compact category event chip, 우측 `다가오는 일정` rail을 반영했다.
- 1280 폭에서 title이 `일정 관 / 리`처럼 깨지던 문제를 breakpoint override로 수정했다.
- Auth / DB / API Contract 변경 여부: `No / No / No`.

## Work Breakdown

| Task                      | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 결과                                                         |
| ------------------------- | ----------: | ----------: | --------: | ------------------------------------------------------------ |
| Visual checklist 수집     |   0% / 100% | 100% / 100% |     +100% | `visual_ui_reviewer`가 reference gap 정리                    |
| Spark static UI patch     |   0% / 100% | 100% / 100% |     +100% | KPI, command row, compact chip, right rail 1차 구현          |
| Main Codex reference 보정 |   0% / 100% | 100% / 100% |     +100% | non-reference 알림 패널 제거, bottom legend, right rail 정리 |
| 1280 header wrap 보정     |   0% / 100% | 100% / 100% |     +100% | `lg:!flex-col 2xl:!flex-row` 적용                            |
| Schedule viewport QA      |   0% / 100% | 100% / 100% |     +100% | 1586/1440/1280 screenshot 및 no-scroll 확인                  |
| 전체 회귀 검증            |   0% / 100% | 100% / 100% |     +100% | route guard 12, density 30 통과                              |

## Phase Progress

|                 Phase | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 근거                                               |
| --------------------: | ----------: | ----------: | --------: | -------------------------------------------------- |
|               Overall |  34% / 100% |  35% / 100% |       +1% | 일정 화면 기준 PNG 정합성 추가 개선                |
|    0 Baseline/Harness |  85% / 100% |  86% / 100% |       +1% | E2E login hydration wait 보강                      |
|  1 Design System Gate |  72% / 100% |  75% / 100% |       +3% | schedule reference KPI/command/chip/rail 구조 반영 |
|           2 Auth/RBAC |  70% / 100% |  70% / 100% |       +0% | Auth logic 변경 없음, route guard 통과             |
|             3 DB/Seed |  59% / 100% |  59% / 100% |       +0% | DB/schema/seed 변경 없음                           |
|    4 Dashboard/Report |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                          |
|               5 Sales |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                          |
| 6 Receivable/Customer |  10% / 100% |  10% / 100% |       +0% | 변경 없음                                          |
|  7 Schedule/Inventory |  13% / 100% |  15% / 100% |       +2% | `/schedule` reference 구조 보정                    |
|      8 Admin Settings |  15% / 100% |  15% / 100% |       +0% | 변경 없음                                          |
|       9 QA/Validation |  37% / 100% |  39% / 100% |       +2% | schedule screenshots, full route/density E2E 통과  |

## Subagent Delegation

| 작업                   | Subagent             | Model   | 선택 이유                                      | 결과                                                            |
| ---------------------- | -------------------- | ------- | ---------------------------------------------- | --------------------------------------------------------------- |
| 기준 PNG gap checklist | `visual_ui_reviewer` | GPT-5.5 | reference hierarchy 판단 필요                  | command row, workload cards, chip density, right rail 기준 제시 |
| 정적 UI 보정           | `spark_ui_iterator`  | Spark   | Tailwind/static JSX/dummy data만 수정하는 작업 | KPI, compact command row, flat chips, quick action 제거         |
| 통합 보정/검증         | Main Codex           | GPT-5   | 1280 layout break와 E2E 안정성 판단 필요       | title wrap 보정, screenshot QA, 전체 검증 수행                  |

## Model Selection Rationale

- Spark는 `apps/web/src/app/(workspace)/schedule/page.tsx`의 presentational UI만 담당했다.
- GPT-5.5 visual reviewer는 기준 PNG와의 구조 차이를 판단하는 역할로 제한했다.
- Main Codex는 responsive fit, E2E flake 판단, 완료 보고서 작성을 맡았다.
- Auth, RBAC, DB, API, schedule CRUD, schedule generation rule은 이번 범위에서 제외했다.

## Changed Files

| File                                                                                                  | 변경 내용                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/schedule/page.tsx`                                                      | reference형 command row, 업무 류 KPI, compact category chips, right rail, 1280 title wrap 보정 |
| `test/e2e/global-setup.ts`                                                                            | 로그인 폼 조작 전 `networkidle` 대기 보강                                                      |
| `docs/80_ai_harness/stage-1-schedule-reference-density-followup-completion-report-20260501-205833.md` | 이번 작업 완료 보고서                                                                          |

## Validation Results

| 검증                           | 결과 | 근거                                           |
| ------------------------------ | ---- | ---------------------------------------------- |
| `pnpm format:check`            | Pass | Prettier all matched files                     |
| `pnpm lint`                    | Pass | API tsc lint, Web eslint 통과                  |
| `pnpm typecheck`               | Pass | shared/db/api/web typecheck 통과               |
| `pnpm build`                   | Pass | Next production build 성공                     |
| `pnpm db:validate`             | Pass | Prisma schema valid                            |
| `/schedule` density 3 viewport | Pass | 3 passed                                       |
| `pnpm test:e2e:route-guards`   | Pass | 12 passed on rerun                             |
| `pnpm test:e2e:design-density` | Pass | 30 passed                                      |
| `git diff --check`             | Pass | exit 0, 기존 CRLF normalization warning만 표시 |

## Runtime Notes

| 항목                  | 결과           | 처리                                                       |
| --------------------- | -------------- | ---------------------------------------------------------- |
| `1586x992` screenshot | Pass           | reference형 command row + KPI + calendar + right rail 표시 |
| `1440x900` screenshot | Pass           | page/main overflow 0                                       |
| `1280x800` screenshot | Pass           | title wrap 문제 해소, calendar chip은 truncate로 수납      |
| route guard 첫 실행   | Transient fail | 로컬 `ERR_NO_BUFFER_SPACE`; 재실행 12 passed               |

## Residual Risks

| Risk                                          | 영향                                    | 다음 대응                                            |
| --------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| 1280에서 calendar chip text는 일부 truncate됨 | 실제 긴 일정명 다수 연결 시 정보량 제한 | detail drawer/API 연결 시 +n summary와 drawer로 보완 |
| 기준 PNG와 pixel-perfect는 아직 아님          | spacing/color/icon 원형 세부 차이 남음  | visual screenshot diff 단계에서 미세 보정            |
| 정적 UI만 구현됨                              | 일정 CRUD/filter 동작 없음              | API read model preflight 이후 구현                   |

## Next Planned 3 Stages

1. `visual_ui_reviewer` + `ui_runtime_validator`: `/schedule` 최종 screenshot diff를 기준 PNG와 비교하고 spacing/color/icon 디테일을 보정한다.
2. `spark_ui_iterator` + `frontend_agent`: receivables/customers/inventory/staffs/base/policies에 static Drawer/Form, tabs, pagination/footer를 추가한다.
3. `frontend_agent` + `backend_agent` + `qa_agent`: schedule/receivable/customer read model API contract preflight와 기능 E2E 분리를 시작한다.
