# Stage 1 Admin URL Helper Completion Report

작성 시각: 2026-05-01 22:43 KST

## 요약

- Admin Foundation 화면인 `/staffs`, `/settings/base`, `/settings/policies`의 URL search params parser/href helper를 구현했다.
- Next.js App Router 기준에 맞춰 세 페이지가 `searchParams: Promise<...>`를 받고 Server Component에서 `await`하도록 연결했다.
- Drawer/상세 패널 close href가 목록 필터를 보존하고 overlay params만 제거하도록 변경했다.
- `/settings/base` 탭 전환은 `page=1`로 초기화하고 stale overlay를 제거하되 `q`, `status`, `pageSize`는 보존하도록 맞췄다.
- Auth, DB, Fastify API contract는 변경하지 않았다.

## 작업 분해

| Task                 | 처리 내용                                                      | 완료율 |  증감 |
| -------------------- | -------------------------------------------------------------- | -----: | ----: |
| 하네스/기술문서 확인 | PSMS harness docs, PSMS_Tech IA/frontend/API 문서 확인         |   100% | +100% |
| 자동 subagent 위임   | frontend/codebase/code review 위임 및 결과 반영                |   100% | +100% |
| URL helper 구현      | route별 parser, href builder, close href helper 추가           |   100% | +100% |
| Admin page 연결      | 세 페이지 async `searchParams` 파싱 및 overlay close href 연결 |   100% | +100% |
| 회귀 테스트 추가     | Node unit test와 Playwright admin URL-state E2E 추가           |   100% | +100% |
| 리뷰 지적 수정       | overlay 조건부 렌더, base tab 상태 보존, `pnpm test` 포함 반영 |   100% | +100% |
| 완료 보고            | Phase/Task 진행율, 모델 선택, 검증, 다음 3단계 정리            |   100% | +100% |

## Phase별 진행율

|                 Phase | 현재 / 전체 | 이번 증감 | 근거                                                        |
| --------------------: | ----------: | --------: | ----------------------------------------------------------- |
|               Overall |  42% / 100% |       +2% | Admin URL-state helper와 route 연결 시작                    |
|    0 Baseline/Harness |  86% / 100% |       +0% | 기준 유지                                                   |
|  1 Design System Gate |  88% / 100% |       +1% | URL overlay 렌더가 디자인 밀도 회귀 없이 통과               |
|           2 Auth/RBAC |  70% / 100% |       +0% | guard 유지, 정책 변경 없음                                  |
|             3 DB/Seed |  59% / 100% |       +0% | DB 변경 없음                                                |
|    4 Dashboard/Report |   9% / 100% |       +0% | 범위 외                                                     |
|               5 Sales |   9% / 100% |       +0% | 범위 외                                                     |
| 6 Receivable/Customer |   6% / 100% |       +0% | 범위 외                                                     |
|  7 Schedule/Inventory |  18% / 100% |       +0% | 범위 외                                                     |
|      8 Admin Settings |  27% / 100% |       +5% | 직원/기초정보/정책 URL-state 기반 확보                      |
|       9 QA/Validation |  51% / 100% |       +3% | unit 10, admin URL-state E2E 9, 기존 route/design 회귀 통과 |

## 모델 선택 이유

| 작업                 | Subagent / Model                 | 선택 이유                                                            |
| -------------------- | -------------------------------- | -------------------------------------------------------------------- |
| App Router 구현 검토 | `frontend_agent` / GPT-5.5       | async `searchParams`, RSC/client 경계, URL-state 설계 판단 필요      |
| 구조/테스트 매핑     | `codebase_mapper` / mini         | read-only로 파일 위치와 test runner 현황을 빠르게 확인               |
| 최종 diff 리뷰       | `code_reviewer` / Codex reviewer | 구현 후 계약 위반, 회귀, 테스트 공백 확인                            |
| UI skeleton 반복     | Spark                            | 미사용. 이번 작업은 URL-state/route-aware 로직이라 Spark 범위가 아님 |

## Subagent 결과

| Subagent          | 결과                                                                                           | 반영                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `frontend_agent`  | Web-only helper를 `apps/web/src/lib`에 두고, 화면은 async `searchParams`로 파싱하라고 제안     | `admin-foundation-url.ts`와 세 페이지 연결에 반영           |
| `codebase_mapper` | 기존 테스트는 e2e/smoke 중심이며 unit runner가 없다고 확인                                     | Node 내장 test runner 기반 `test:unit:admin-url` 추가       |
| `code_reviewer`   | overlay가 항상 열리는 문제, base tab 상태 유실, 페이지 레벨 테스트 공백, `pnpm test` 누락 지적 | 조건부 렌더, 상태 보존, E2E 추가, `pnpm test` 포함으로 수정 |

## 변경 파일

| 파일                                                                               | 변경 내용                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/lib/admin-foundation-url.ts`                                         | Admin URL parser/href/close href helper 추가                    |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                     | async searchParams 파싱, 직원 Drawer URL-state 연결             |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                              | async searchParams 파싱, tab href 상태 보존, Drawer 조건부 렌더 |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                          | async searchParams 파싱, 정책 상세 패널 URL-state 연결          |
| `test/unit/admin-foundation-url.test.ts`                                           | parser/href helper unit test 10개 추가                          |
| `test/e2e/admin-url-state.spec.ts`                                                 | Admin URL-state E2E 9개 추가                                    |
| `package.json`                                                                     | `test:unit:admin-url` 추가, `pnpm test`에 unit test 포함        |
| `docs/80_ai_harness/stage-1-admin-url-helper-completion-report-20260501-224344.md` | 완료 보고서 추가                                                |

## 검증 결과

| 검증                                                         | 결과 | 근거                                   |
| ------------------------------------------------------------ | ---: | -------------------------------------- |
| `pnpm test:unit:admin-url`                                   | Pass | 10 passed                              |
| `pnpm --filter @psms/web typecheck`                          | Pass | Web typecheck 통과                     |
| `pnpm --filter @psms/web lint`                               | Pass | Web lint 통과                          |
| `pnpm exec playwright test test/e2e/admin-url-state.spec.ts` | Pass | 9 passed                               |
| `pnpm format:check`                                          | Pass | 전체 Prettier 확인                     |
| `pnpm lint`                                                  | Pass | API/Web lint 통과                      |
| `pnpm typecheck`                                             | Pass | shared/db/api/web typecheck 통과       |
| `pnpm db:validate`                                           | Pass | Prisma schema valid                    |
| `pnpm build`                                                 | Pass | 전체 build 통과                        |
| `pnpm test:e2e:route-guards`                                 | Pass | 12 passed                              |
| `pnpm test:e2e:design-density`                               | Pass | 30 passed                              |
| `pnpm test`                                                  | Pass | unit 10 + api auth inject smoke passed |
| `git diff --check`                                           | Pass | whitespace error 없음                  |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                              |
| ------------ | --------: | --------------------------------- |
| Auth         |        No | 기존 ADMIN guard 유지             |
| DB           |        No | schema/migration/seed 변경 없음   |
| API Contract |        No | Fastify/shared contract 변경 없음 |

## 남은 리스크

| 리스크                                                                | 영향 | 대응                                                                     |
| --------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------ |
| 필터 입력은 아직 실제 URL update client control이 아님                | 중간 | 다음 단계에서 route-aware client shell 또는 Link/Form 기반으로 연결      |
| `mode=delete`, 정책 create/edit Drawer는 아직 정식 UI가 아님          | 중간 | Admin CRUD API contract 이후 Modal/Drawer 구현                           |
| Node 내장 TS strip test가 `MODULE_TYPELESS_PACKAGE_JSON` warning 출력 | 낮음 | ESM 전환은 범위 외. 추후 Vitest 도입 또는 test runner 정책 확정          |
| worktree에 기존 staged/unstaged 변경이 많음                           | 중간 | 이번 작업 파일만 분리 검토하고, staging/commit은 사용자 지시 전까지 보류 |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                                         | Subagent / Model                                                      |
| ---: | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
|    1 | Admin route-aware filter/pagination client shell 연결: 입력 변경, 조회/초기화, row open href | `frontend_agent` GPT-5.5 + `spark_ui_iterator` Spark                  |
|    2 | Admin API contract preflight: 직원/기초정보/정책 list/detail DTO와 `ActionResult` 경계 확정  | `architect_reviewer` GPT-5.5 + `backend_agent` GPT-5.5                |
|    3 | Admin CRUD 기능 게이트: create/edit/delete Modal/Drawer, permission 유지, E2E 확장           | `frontend_agent` GPT-5.5 + `qa_agent` GPT-5.5 + `code_reviewer` Codex |
