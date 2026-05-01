# Stage 1 Remaining Screens Design Density Completion Report

## Summary

- Phase 1 디자인 밀도 게이트를 기존 3개 화면에서 디자인 기준 PNG 10개 화면 전체로 확장했다.
- 추가 대상 7개 화면은 `/receivables`, `/customers`, `/schedule`, `/inventory`, `/staffs`, `/settings/base`, `/settings/policies`다.
- `1586x992`, `1440x900`, `1280x800`에서 page-level scroll이 발생하지 않도록 정적/seed 기반 업무 화면 구조를 적용했다.
- Auth / DB / API Contract 변경 여부: `No / No / No`.

## Work Breakdown

| Task                              | 현재 / 전체 | 이번 증감 | 결과                                                               |
| --------------------------------- | ----------: | --------: | ------------------------------------------------------------------ |
| 하네스 문서/모델 라우팅 재확인    | 100% / 100% |     +100% | 보고 형식, Spark 제한, UI validation 기준 확인                     |
| 남은 7개 화면 overflow owner 매핑 | 100% / 100% |     +100% | placeholder와 내부 스크롤 필요 구간 식별                           |
| 남은 7개 화면 정적 업무 UI 적용   | 100% / 100% |     +100% | receivables/customers/schedule/inventory/staffs/base/policies 구성 |
| 디자인 밀도 E2E 대상 확장         | 100% / 100% |     +100% | 10 routes x 3 viewports = 30 cases                                 |
| 검증 및 회귀 확인                 | 100% / 100% |     +100% | format/lint/typecheck/build/db/e2e 통과                            |

## Phase Progress

|                 Phase | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 근거                                                  |
| --------------------: | ----------: | ----------: | --------: | ----------------------------------------------------- |
|               Overall |  30% / 100% |  32% / 100% |       +2% | 디자인 기준 10개 화면 density QA 범위 확보            |
|    0 Baseline/Harness |  84% / 100% |  84% / 100% |       +0% | 변경 없음                                             |
|  1 Design System Gate |  56% / 100% |  66% / 100% |      +10% | 전체 디자인 reference route가 density E2E 대상에 포함 |
|           2 Auth/RBAC |  70% / 100% |  70% / 100% |       +0% | 정책 유지, route guard 회귀 통과                      |
|             3 DB/Seed |  59% / 100% |  59% / 100% |       +0% | schema/seed 변경 없음                                 |
|    4 Dashboard/Report |   9% / 100% |   9% / 100% |       +0% | dashboard는 이전 단계 유지                            |
|               5 Sales |   9% / 100% |   9% / 100% |       +0% | sales는 이전 단계 유지                                |
| 6 Receivable/Customer |   6% / 100% |   9% / 100% |       +3% | receivables/customers 화면 밀도 구조 적용             |
|  7 Schedule/Inventory |   6% / 100% |   9% / 100% |       +3% | schedule/inventory 화면 밀도 구조 적용                |
|      8 Admin Settings |  10% / 100% |  14% / 100% |       +4% | staffs/base/policies 화면 밀도 구조 적용              |
|       9 QA/Validation |  29% / 100% |  34% / 100% |       +5% | density E2E 9 cases에서 30 cases로 확장               |

## Subagent Delegation

| 작업                       | Subagent             | Model              | 선택 이유                                                 | 결과                                                     |
| -------------------------- | -------------------- | ------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| UI 구조/스크롤 원인 매핑   | `codebase_mapper`    | mini               | 읽기 전용 구조 파악과 placeholder 위험도 식별에 적합      | remaining routes, placeholder, internal scroll risk 정리 |
| 기준 PNG 시각 기준 판정    | `visual_ui_reviewer` | GPT-5.5            | 디자인 게이트 판단과 업무 화면 구조 비교 필요             | 화면별 필수 구조 체크리스트 제공                         |
| Tailwind/정적 UI 밀도 패치 | `spark_ui_iterator`  | Spark              | presentational UI, static data, Tailwind 반복 작업에 적합 | receivables/customers/schedule/inventory 정적 UI 구성    |
| 관리자 화면 적용           | Main Codex           | GPT-5              | route-aware 권한 page와 ADMIN 화면 연결 필요              | staffs/base/policies 정적 UI 구성                        |
| 런타임 검증                | Main Codex           | GPT-5 + Playwright | 포트/라우트/검증 결과를 통합 판단해야 함                  | route guard 12 passed, density 30 passed                 |

## Spark Scope

| 항목                           | 값                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Spark 사용 여부                | Yes                                                                                    |
| Spark 담당 범위                | `apps/web` presentational UI, static rows, Tailwind density, table/detail panel markup |
| Spark 금지 영역 준수           | Yes                                                                                    |
| Auth/Session/RBAC 수정         | No                                                                                     |
| API/DB/Prisma/Transaction 수정 | No                                                                                     |
| Escalation                     | Not required                                                                           |

## Changed Files

| File                                                                                               | 변경 내용                                              |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/web/src/app/(workspace)/receivables/page.tsx`                                                | 미수금 관리 정적 업무 화면과 내부 스크롤 구조 적용     |
| `apps/web/src/app/(workspace)/customers/page.tsx`                                                  | 고객 관리 정적 업무 화면과 상세 패널 적용              |
| `apps/web/src/app/(workspace)/schedule/page.tsx`                                                   | 일정 관리 정적 업무 화면과 우측 패널 적용              |
| `apps/web/src/app/(workspace)/inventory/page.tsx`                                                  | 재고 관리 정적 업무 화면과 등록 패널 적용              |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                                     | 직원 관리 ADMIN 정적 화면 적용                         |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                                              | 기초정보 ADMIN 정적 화면 적용                          |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                                          | 정책 관리 ADMIN 정적 화면 적용                         |
| `test/e2e/design-density.spec.ts`                                                                  | density gate 대상을 10개 디자인 reference route로 확장 |
| `docs/80_ai_harness/stage-1-remaining-screens-design-density-completion-report-20260501-194921.md` | 이번 작업 완료 보고서                                  |

## Validation Results

| 검증                           | 결과 | 근거                                           |
| ------------------------------ | ---- | ---------------------------------------------- |
| `pnpm format:check`            | Pass | Prettier all matched files                     |
| `pnpm lint`                    | Pass | API tsc lint, Web eslint 통과                  |
| `pnpm typecheck`               | Pass | shared/db/api/web typecheck 통과               |
| `pnpm build`                   | Pass | Next production build 성공                     |
| `pnpm db:validate`             | Pass | Prisma schema valid                            |
| `pnpm test:e2e:route-guards`   | Pass | 12 passed                                      |
| `pnpm test:e2e:design-density` | Pass | 30 passed                                      |
| `git diff --check`             | Pass | exit 0, 기존 CRLF normalization warning만 표시 |

## Risks

| Risk                                                                                  | 영향                                       | 대응                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| 일부 신규 정적 화면의 문구가 아직 디자인 기준의 한국어 업무 톤과 완전히 일치하지 않음 | 시각 QA 이후 copy QA가 필요                | 다음 visual gate에서 용어/라벨 현지화               |
| 이번 작업은 page-level density와 구조 검증 중심이며 pixel-perfect 비교는 아님         | 기준 PNG 대비 세부 spacing/color 차이 가능 | visual_ui_reviewer + screenshot diff 보정 단계 수행 |
| 화면 데이터는 static/seed 기반이며 API 연결 전임                                      | 업무 기능 완료율은 제한적                  | 다음 단계에서 API contract 연결                     |

## Next Planned 3 Stages

1. `visual_ui_reviewer` + `ui_runtime_validator`: 10개 화면 screenshot을 기준 PNG와 비교하고 spacing, copy, density 차이를 보정한다.
2. `frontend_agent` + `backend_agent`: 우선 화면의 API contract 연결을 시작한다. 대상은 receivables/customers/inventory read model부터 제한한다.
3. `qa_agent` + `code_reviewer` + Spark: 기능별 E2E와 회귀 리뷰를 붙이고, Spark는 발견된 순수 UI spacing/copy 보정에만 사용한다.
