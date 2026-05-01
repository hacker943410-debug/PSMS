# Stage 1 Admin Route-Aware Controls Completion Report

작성 시각: 2026-05-01 23:17 KST

## Summary

- `/staffs`, `/settings/base`, `/settings/policies`의 필터, 페이지네이션, row detail, create/edit URL intent를 서버 생성 href와 GET form 기반으로 연결했다.
- Next.js App Router page는 Server Component로 유지했고 `useSearchParams` client 전환은 하지 않았다.
- 기초정보 `수정`은 현재 `detail`로 선택된 행만 대상으로 삼도록 변경했고, 미구현 `delete` URL intent는 만들지 않도록 비활성 버튼으로 보정했다.
- Playwright screenshot 하네스는 input caret style 주입으로 인한 hydration mismatch 오탐을 막기 위해 `caret: "initial"`을 지정했다.
- Auth / DB / API Contract 변경은 없다.

## 작업 분해 및 Task 진행율

| Task                 | 처리 내용                                                                   | 완료율 | 이번 증감 |
| -------------------- | --------------------------------------------------------------------------- | -----: | --------: |
| 하네스/기술문서 확인 | AGENTS, current-state, development-flow, routing/model/testing 문서 재확인  |   100% |     +100% |
| 자동 subagent 위임   | frontend, Spark, mapper, code reviewer 위임 및 결과 반영                    |   100% |     +100% |
| 작업 분해            | Admin URL-state control 연결 범위를 staffs/base/policies/test/report로 분리 |   100% |     +100% |
| Staff controls       | 직원 필터 GET form, pagination Link, row detail Link, create Link 연결      |   100% |     +100% |
| Base controls        | 기초정보 검색/페이지/row detail/create/edit 연결, dead delete URL 제거      |   100% |     +100% |
| Policy controls      | 정책 필터 GET form, pagination Link, row detail/edit/create 연결            |   100% |     +100% |
| E2E 확장             | filter/pagination/detail/create/edit intent를 3 viewport에서 검증           |   100% |     +100% |
| 하네스 안정화        | screenshot caret 옵션으로 hydration mismatch 오탐 제거                      |   100% |     +100% |
| 완료 보고            | Phase/Task 진행율, 모델 선택, 검증, 다음 3단계 정리                         |   100% |     +100% |

## Phase별 진행율

|                 Phase | 현재 / 전체 | 이번 증감 | 근거                                                            |
| --------------------: | ----------: | --------: | --------------------------------------------------------------- |
|               Overall |  44% / 100% |       +2% | Admin foundation route-aware control 연결 완료                  |
|    0 Baseline/Harness |  86% / 100% |       +0% | 기준 유지                                                       |
|  1 Design System Gate |  89% / 100% |       +1% | admin controls 적용 후 30개 design-density 통과                 |
|           2 Auth/RBAC |  70% / 100% |       +0% | guard 변경 없음                                                 |
|             3 DB/Seed |  59% / 100% |       +0% | schema/migration/seed 변경 없음                                 |
|    4 Dashboard/Report |   9% / 100% |       +0% | 범위 외                                                         |
|               5 Sales |   9% / 100% |       +0% | 범위 외                                                         |
| 6 Receivable/Customer |   6% / 100% |       +0% | 범위 외                                                         |
|  7 Schedule/Inventory |  18% / 100% |       +0% | 범위 외                                                         |
|      8 Admin Settings |  31% / 100% |       +4% | 직원/기초정보/정책 URL-state control 연결                       |
|       9 QA/Validation |  54% / 100% |       +3% | admin URL-state E2E 18, route guards 12, design-density 30 통과 |

## 모델 선택 이유

| 역할                | 모델           | 선택 이유                                                                    |
| ------------------- | -------------- | ---------------------------------------------------------------------------- |
| Main Codex          | GPT-5 계열     | 실제 파일 수정, 검증 실행, subagent 결과 통합                                |
| `frontend_agent`    | GPT-5.5        | Next.js App Router RSC 경계와 route-aware UI 영향 검토                       |
| `spark_ui_iterator` | Spark          | Tailwind/정적 UI 밀도와 링크형 컨트롤 스타일 조언. Auth/DB/API는 다루지 않음 |
| `codebase_mapper`   | mini           | 기존 컴포넌트/테스트 셀렉터 구조 읽기 전용 매핑                              |
| `code_reviewer`     | Codex reviewer | 회귀, dead URL intent, 테스트 공백 검토                                      |

## Subagent 결과

| Subagent            | 결과                                                                                 | 반영                                                 |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `frontend_agent`    | page를 RSC로 유지하고 서버 생성 href/GET form을 권장                                 | `Link`/GET form 기반 구현                            |
| `spark_ui_iterator` | `Button`은 button-only이므로 링크형 액션은 별도 Link 스타일이 필요하다고 제안        | page-local `LinkButton` 사용                         |
| `codebase_mapper`   | `DataTable.cell`은 ReactNode 가능, E2E는 label/aria/caption 기반이 안정적이라고 확인 | row cell Link와 aria-label 테스트 적용               |
| `code_reviewer`     | base edit/delete가 첫 행 고정, dead `mode=delete`, edit E2E 공백 지적                | selected detail 기반 edit, delete URL 제거, E2E 추가 |

## 변경 파일

| 파일                                                                                         | 변경 내용                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                               | 직원 필터 GET form, pagination Link, row detail Link, create Link 연결 |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                                        | 검색/페이지/row detail/create/edit 연결, delete URL intent 제거        |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                                    | 정책 필터/페이지/row detail/edit/create URL 연결                       |
| `test/e2e/admin-url-state.spec.ts`                                                           | Admin URL-state interaction E2E를 18개로 확장                          |
| `test/e2e/route-guards.spec.ts`                                                              | screenshot caret 옵션 지정                                             |
| `test/e2e/design-density.spec.ts`                                                            | screenshot caret 옵션 지정                                             |
| `docs/80_ai_harness/stage-1-admin-route-aware-controls-completion-report-20260501-231743.md` | 완료 보고서 추가                                                       |

## 검증 결과

| 명령                                                         | 결과 | 비고                                                                         |
| ------------------------------------------------------------ | ---: | ---------------------------------------------------------------------------- |
| `pnpm format:check`                                          | Pass | 전체 Prettier 확인                                                           |
| `pnpm lint`                                                  | Pass | API/Web lint 통과                                                            |
| `pnpm typecheck`                                             | Pass | shared/db/api/web typecheck 통과                                             |
| `pnpm db:validate`                                           | Pass | Prisma schema valid                                                          |
| `pnpm build`                                                 | Pass | shared/db/api/web build 통과                                                 |
| `pnpm test`                                                  | Pass | unit 10 + api inject smoke 통과                                              |
| `pnpm exec playwright test test/e2e/admin-url-state.spec.ts` | Pass | 18 passed                                                                    |
| `pnpm test:e2e:route-guards`                                 | Pass | 재실행 기준 12 passed. 1차는 dev chunk `ERR_CONNECTION_RESET` transient 실패 |
| `pnpm test:e2e:design-density`                               | Pass | 30 passed                                                                    |
| `git diff --check -- scoped files`                           | Pass | whitespace issue 없음                                                        |

## Contract 변경 여부

| 영역         | 변경 여부 | 비고                               |
| ------------ | --------: | ---------------------------------- |
| Auth         |        No | session/permission guard 변경 없음 |
| DB           |        No | schema/migration/seed 변경 없음    |
| API Contract |        No | Fastify/shared contract 변경 없음  |

## 남은 리스크

| 리스크                                                               | 수준 | 대응                                                 |
| -------------------------------------------------------------------- | ---: | ---------------------------------------------------- |
| Admin CRUD는 아직 정적 seed UI이며 mutation/API 미연결               | 중간 | 다음 단계에서 Admin API contract preflight 후 연결   |
| 기초정보 `삭제`는 의도적으로 비활성 상태                             | 낮음 | delete modal/API contract 확정 전 dead URL 생성 방지 |
| Node built-in TS strip test의 `MODULE_TYPELESS_PACKAGE_JSON` warning | 낮음 | 추후 Vitest 또는 ESM 정책 확정                       |
| worktree에 기존 staged/unstaged/untracked 변경 다수 존재             | 중간 | 이번 작업 범위만 수정. staging/commit은 보류         |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                                        | Subagent / Spark                                                          |
| ---: | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
|    1 | Admin API contract preflight: 직원/기초정보/정책 list/detail DTO와 `ActionResult` 경계 확정 | `architect_reviewer` GPT-5.5 + `backend_agent` GPT-5.5                    |
|    2 | Admin read API scaffolding: seed/static UI를 API query adapter로 교체 시작                  | `backend_agent` GPT-5.5 + `frontend_agent` GPT-5.5                        |
|    3 | Admin CRUD UI 게이트: create/edit/delete Drawer/Modal, permission 유지, E2E/a11y 확장       | `frontend_agent` GPT-5.5 + `spark_ui_iterator` Spark + `qa_agent` GPT-5.5 |
