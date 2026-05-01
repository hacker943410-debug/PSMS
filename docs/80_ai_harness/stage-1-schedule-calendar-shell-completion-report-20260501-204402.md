# Stage 1 Schedule Calendar Shell Completion Report

## Summary

- `/schedule` 화면을 기존 table 중심 구조에서 월간 캘린더 shell + 우측 다가오는 일정/알림 패널 구조로 전환했다.
- 기준 이미지 `C:\Project\PSMS_Tech\design-reference\schedule.png`의 큰 흐름인 월간 일정판과 우측 예정 목록을 반영했다.
- 6주 캘린더가 `1586x992` 화면에 들어오도록 캘린더 그리드를 `flex/min-h-0` 기반으로 보정했다.
- 이번 작업은 정적 UI 전용이며 Auth / DB / API Contract 변경 여부는 `No / No / No`다.

## Work Breakdown

| Task                         | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 결과                                 |
| ---------------------------- | ----------: | ----------: | --------: | ------------------------------------ |
| 기준 PNG 구조 확인           |   0% / 100% | 100% / 100% |     +100% | schedule.png 직접 확인               |
| Spark UI calendar shell 구현 |   0% / 100% | 100% / 100% |     +100% | 월간 캘린더, 상태칩, 우측 패널 적용  |
| Main Codex density 보정      |   0% / 100% | 100% / 100% |     +100% | 6주 행이 1586x992 안에 보이도록 조정 |
| Schedule 단독 runtime 검증   |   0% / 100% | 100% / 100% |     +100% | 3 viewports schedule density 통과    |
| 전체 회귀 검증               |   0% / 100% | 100% / 100% |     +100% | route guard 12, density 30 통과      |

## Phase Progress

|                 Phase | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 근거                                           |
| --------------------: | ----------: | ----------: | --------: | ---------------------------------------------- |
|               Overall |  33% / 100% |  34% / 100% |       +1% | 일정 화면 기준 구조 개선                       |
|    0 Baseline/Harness |  85% / 100% |  85% / 100% |       +0% | 하네스 구조 변경 없음                          |
|  1 Design System Gate |  69% / 100% |  72% / 100% |       +3% | `/schedule` 월간 캘린더 shell 반영             |
|           2 Auth/RBAC |  70% / 100% |  70% / 100% |       +0% | route guard 회귀 통과, auth 변경 없음          |
|             3 DB/Seed |  59% / 100% |  59% / 100% |       +0% | DB/schema/seed 변경 없음                       |
|    4 Dashboard/Report |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                      |
|               5 Sales |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                      |
| 6 Receivable/Customer |  10% / 100% |  10% / 100% |       +0% | 변경 없음                                      |
|  7 Schedule/Inventory |  10% / 100% |  13% / 100% |       +3% | 일정 화면 기준 구조 반영                       |
|      8 Admin Settings |  15% / 100% |  15% / 100% |       +0% | 변경 없음                                      |
|       9 QA/Validation |  36% / 100% |  37% / 100% |       +1% | schedule screenshot/runtime 및 전체 E2E 재검증 |

## Subagent Delegation

| 작업                     | Subagent             | Model   | 선택 이유                                                | 결과                                                               |
| ------------------------ | -------------------- | ------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| 기준 PNG 시각 리뷰       | `visual_ui_reviewer` | GPT-5.5 | schedule.png 대비 구조/시각 차이 판단 필요               | 부분 통과, 상단 KPI/flat grid/event chip 차이를 잔여 리스크로 제시 |
| 정적 calendar shell 구현 | `spark_ui_iterator`  | Spark   | 순수 presentational UI, Tailwind, static dummy data 범위 | `/schedule` 월간 캘린더와 우측 일정/알림 패널 구현                 |
| 보정/검증 통합           | Main Codex           | GPT-5   | viewport fit, 회귀 검증, 하네스 보고 통합 필요           | 6주 캘린더 fit 보정 및 전체 검증 완료                              |

## Model Selection Rationale

- Spark는 `apps/web` 단일 화면의 정적 UI skeleton, Tailwind layout, dummy data만 담당했다.
- visual reviewer는 기준 PNG와의 hierarchy 차이를 판단해야 하므로 GPT-5.5 review 경로를 사용했다.
- Main Codex는 런타임 검증, viewport fit 판단, 전체 회귀 검증, 보고서 작성까지 통합했다.
- Auth, API, DB, schedule CRUD, Audit Log는 이번 작업 범위에서 제외했다.

## Changed Files

| File                                                                                      | 변경 내용                                                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/schedule/page.tsx`                                          | 월간 캘린더 shell, 상태칩, 우측 다가오는 일정/알림 패널, 6주 fit 보정 |
| `docs/80_ai_harness/stage-1-schedule-calendar-shell-completion-report-20260501-204402.md` | 이번 작업 완료 보고서                                                 |

## Validation Results

| 검증                                                                                                                                                  | 결과 | 근거                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `pnpm format:check`                                                                                                                                   | Pass | Prettier all matched files                     |
| `pnpm lint`                                                                                                                                           | Pass | API tsc lint, Web eslint 통과                  |
| `pnpm typecheck`                                                                                                                                      | Pass | shared/db/api/web typecheck 통과               |
| `pnpm build`                                                                                                                                          | Pass | Next production build 성공                     |
| `pnpm db:validate`                                                                                                                                    | Pass | Prisma schema valid                            |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --project=chromium-1586 --project=chromium-1440 --project=chromium-1280 --grep "schedule"` | Pass | 3 passed                                       |
| `pnpm test:e2e:route-guards`                                                                                                                          | Pass | 12 passed                                      |
| `pnpm test:e2e:design-density`                                                                                                                        | Pass | 30 passed                                      |
| `git diff --check`                                                                                                                                    | Pass | exit 0, 기존 CRLF normalization warning만 표시 |

## Visual Result

| 항목                    | 상태         | 비고                                                   |
| ----------------------- | ------------ | ------------------------------------------------------ |
| 월간 캘린더 shell       | Partial pass | 기준 구조 반영                                         |
| 우측 다가오는 일정/알림 | Partial pass | 기준 구조 반영                                         |
| 6주 grid 한 화면 표시   | Pass         | `1586x992` screenshot 확인                             |
| 상단 업무 류 KPI 카드   | Gap          | reference의 3개 workload 카드 미반영                   |
| 캘린더 event chip 밀도  | Gap          | reference보다 card-like 표현이 남아 있음               |
| top command row         | Gap          | reference의 month pager/filter command row와 아직 다름 |

## Residual Risks

| Risk                                                           | 영향                           | 다음 대응                                     |
| -------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| schedule.png 대비 full design gate는 아직 partial              | 기준 PNG 100% 반영에는 미달    | 상단 workload KPI 카드와 flat event chip 보정 |
| 1280x800에서 실제 긴 일정명 다수 입력 시 셀 내부 clipping 가능 | 실데이터 연결 후 overflow 가능 | cell 내부 +n summary와 detail drawer 연결     |
| 정적 UI만 구현됨                                               | 일정 CRUD/DB/API 동작 없음     | API read model 단계에서 별도 구현             |

## Next Planned 3 Stages

1. `visual_ui_reviewer` + `spark_ui_iterator`: `/schedule` 상단 업무 류 KPI 3개와 reference형 month pager/filter command row를 추가한다.
2. `spark_ui_iterator` + `ui_runtime_validator`: 캘린더 이벤트를 full mini-card에서 compact colored chip/count 구조로 바꾸고 3개 viewport screenshot을 재검증한다.
3. `frontend_agent` + `backend_agent` + `qa_agent`: schedule read model/API contract 연결 전 preflight를 만들고 기능 E2E 범위를 분리한다.
