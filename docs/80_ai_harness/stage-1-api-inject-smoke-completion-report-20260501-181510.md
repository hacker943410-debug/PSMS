# Stage 1 API Inject Smoke Completion Report

## Summary

- 작성일: 2026-05-01 18:15:10 +09:00
- 기준 저장소: `C:\Project\Activate\PSMS`
- 기준 기술/디자인 문서: `C:\Project\PSMS_Tech`
- Web 포트: `http://127.0.0.1:5273`
- API 포트: `http://127.0.0.1:4273`
- 금지 포트: `5173`, `4173`
- 이번 작업 목표: Fastify API를 `createApiApp()` factory로 분리하고, 포트 비의존 `app.inject()` 기반 auth route smoke를 추가한다.
- 전체 프로젝트 진행율: `29% / 100%` (`+1%p`)
- Web/API MVP 업무 준비도: `16% / 100%` (`+1%p`)
- Electron release 준비도: `2% / 100%` (`+0%p`)

## Work Breakdown

| Step | 작업                                                   | 담당            | 상태 |
| ---: | ------------------------------------------------------ | --------------- | ---- |
|    1 | Must Read 하네스/기술 문서 확인                        | Main            | 완료 |
|    2 | Backend 최소 변경 설계 위임                            | `backend_agent` | 완료 |
|    3 | QA acceptance criteria와 진행율 delta 위임             | `qa_agent`      | 완료 |
|    4 | `createApiApp()` factory 추가                          | Main            | 완료 |
|    5 | `server.ts`를 env load + listen entrypoint로 축소      | Main            | 완료 |
|    6 | disposable copy DB 기반 `app.inject()` auth smoke 추가 | Main            | 완료 |
|    7 | live API env 점유 문제 정리 후 통합 smoke 재검증       | Main            | 완료 |
|    8 | 검증 실행 및 완료 보고서 작성                          | Main            | 완료 |

## Automatic Subagent Delegation

| Subagent | Agent type      | Model   | Reasoning | 위임 작업                                                        | 결과                                                                                               |
| -------- | --------------- | ------- | --------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Locke    | `backend_agent` | GPT-5.5 | high      | Fastify factory 분리, dotenv/import 순서, API contract 영향 검토 | factory 분리는 계약 변경이 아니며, `server.ts`에서 env load 후 동적 import를 유지해야 한다고 확인  |
| Banach   | `qa_agent`      | GPT-5.5 | high      | acceptance criteria, 진행율 delta, 완료 검증 목록 산정           | `/health`, invalid login, missing session, ADMIN/STAFF login/session/logout/revoked 검증 기준 제시 |

## Model Selection Reason

| 역할                | 선택 모델            | 이유                                                                                                       |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Main implementation | 현재 Codex 메인 모델 | 로컬 파일 변경, dev server 정리, 검증 실행, 보고서 작성까지 같은 컨텍스트가 필요했다.                      |
| Backend review      | GPT-5.5 high         | Fastify 조립 구조, dotenv/import 순서, Prisma singleton, auth route 테스트가 걸려 고위험 API 영역이다.     |
| QA review           | GPT-5.5 high         | auth/RBAC/API contract 행동 동일성을 테스트로 고정해야 했다.                                               |
| Spark               | 미사용               | `apps/api`, auth/session smoke, test infra는 Spark 금지 영역이다. 다음 UI 정적 게이트에서만 예정 배정한다. |

## Phase Progress Delta

| Phase | 기준 목표                    |  이전 |  현재 |   변동 |
| ----: | ---------------------------- | ----: | ----: | -----: |
|     0 | Baseline/Harness             | `86%` | `87%` | `+1%p` |
|     1 | Design System Gate           | `45%` | `45%` | `+0%p` |
|     2 | API/DB Foundation            | `58%` | `62%` | `+4%p` |
|     3 | Admin Foundation             |  `8%` |  `8%` | `+0%p` |
|     4 | Inventory                    |  `3%` |  `3%` | `+0%p` |
|     5 | Sales                        | `10%` | `10%` | `+0%p` |
|     6 | Receivable/Customer/Schedule |  `3%` |  `3%` | `+0%p` |
|     7 | Dashboard/Report/Export      |  `8%` |  `8%` | `+0%p` |
|     8 | Web MVP Gate                 |  `8%` | `10%` | `+2%p` |
|     9 | Electron Release             |  `2%` |  `2%` | `+0%p` |
|     - | Overall Project              | `28%` | `29%` | `+1%p` |
|     - | Web/API MVP readiness        | `15%` | `16%` | `+1%p` |

## Task Progress Delta

| Task                                  |  이전 |  현재 |    변동 | 근거                                                        |
| ------------------------------------- | ----: | ----: | ------: | ----------------------------------------------------------- |
| Root validation scripts               | `75%` | `78%` |  `+3%p` | root `test:api:inject` 추가                                 |
| API lint gate                         | `70%` | `72%` |  `+2%p` | API script 유지, factory 분리 후 검증 통과                  |
| Fastify app factory                   |  `0%` | `70%` | `+70%p` | `createApiApp()`로 listen과 app 조립 분리                   |
| API auth inject smoke                 |  `0%` | `65%` | `+65%p` | 포트 없이 health/auth/session/logout/revoked 검증           |
| API auth smoke 전체                   | `45%` | `65%` | `+20%p` | inject smoke + live smoke 병행                              |
| API foundation                        | `42%` | `50%` |  `+8%p` | API app factory와 route-level smoke 기반 확보               |
| Automated test suite                  |  `5%` |  `8%` |  `+3%p` | 실제 실행되는 API test script 추가                          |
| Web login smoke                       | `55%` | `55%` |  `+0%p` | 기존 live smoke 유지                                        |
| ADMIN/STAFF guard smoke               | `35%` | `35%` |  `+0%p` | 기존 `/staffs` live smoke 유지, Playwright 확장은 다음 단계 |
| Auth/session scaffold                 | `58%` | `60%` |  `+2%p` | 행동 변경 없이 regression smoke 확장                        |
| DB/Prisma bootstrap                   | `60%` | `60%` |  `+0%p` | schema/migration 변경 없음                                  |
| Domain API contracts                  | `10%` | `10%` |  `+0%p` | 업무 도메인 API 계약은 미착수                               |
| Sales/Receivable/Inventory core logic |  `0%` |  `0%` |  `+0%p` | 핵심 트랜잭션 미구현                                        |
| Electron release                      |  `2%` |  `2%` |  `+0%p` | 릴리즈 단계 미착수                                          |

## Changed Files

| 파일                                                                               | 변경 내용                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/api/src/app.ts`                                                              | Fastify 생성, error handler, health/auth route 등록을 담당하는 `createApiApp()` 추가 |
| `apps/api/src/server.ts`                                                           | dotenv 로드 후 `createApiApp()`을 동적 import하고 `listen()`만 수행하도록 축소       |
| `apps/api/package.json`                                                            | `test`, `test:inject`, `test:smoke` script 정리                                      |
| `package.json`                                                                     | root `test`, `test:api:inject`, `test:smoke:auth` script 정리                        |
| `test/smoke/api-auth-inject-smoke.ts`                                              | temp DB copy 기반 `app.inject()` auth route smoke 추가                               |
| `docs/80_ai_harness/stage-1-api-inject-smoke-completion-report-20260501-181510.md` | 이번 작업 완료 보고서                                                                |

## Validation

| 검증                                  | 결과 | 비고                                                                                                  |
| ------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `pnpm exec prettier --write ...`      | 통과 | 변경 파일 포맷 정리                                                                                   |
| `pnpm format:check`                   | 통과 | 전체 Prettier check                                                                                   |
| `pnpm --filter @psms/api lint`        | 통과 | `tsc --noEmit --pretty false`                                                                         |
| `pnpm --filter @psms/api build`       | 통과 | API no-emit build                                                                                     |
| `pnpm --filter @psms/api test:inject` | 통과 | `api auth inject smoke passed`                                                                        |
| `pnpm lint`                           | 통과 | API lint + Web ESLint                                                                                 |
| `pnpm typecheck`                      | 통과 | shared/db/api/web no-emit                                                                             |
| `pnpm db:validate`                    | 통과 | Prisma schema valid                                                                                   |
| `pnpm test:smoke:auth`                | 통과 | `auth smoke passed`                                                                                   |
| `pnpm build`                          | 통과 | shared/db/api/web build                                                                               |
| `git diff --check`                    | 통과 | 기존 CRLF->LF 경고만 있음                                                                             |
| port check                            | 통과 | PSMS Web `5273`, API `4273` listen. `5173`, `4173`은 다른 프로젝트가 점유 중이며 PSMS는 사용하지 않음 |

## Auth / DB / API Contract Status

| 영역         | 변경 여부 | 비고                                                                            |
| ------------ | --------- | ------------------------------------------------------------------------------- |
| Auth         | No        | password/session/cookie/login/logout 동작 변경 없음. smoke로 행동 동일성 확인   |
| DB           | No        | schema/migration/seed 변경 없음. inject smoke는 `dev.db`를 `.tmp`로 복사해 사용 |
| API contract | No        | route path, method, status, `ActionResult`, health response shape 유지          |
| RBAC         | No        | ADMIN/STAFF 정책 변경 없음. 기존 live route guard smoke 유지                    |

## Issue / Resolution

| 이슈                                             | 원인                                                                               | 해결                                                          | 재발 방지                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| 첫 live smoke에서 ADMIN login 500                | 기존 PSMS API dev 프로세스가 `AUTH_SECRET=replace-with-local-secret`로 4273을 점유 | PSMS API 프로세스만 정리하고 올바른 `.env` 값으로 4273 재기동 | smoke 전 포트 소유 프로세스와 env 계열 확인                        |
| `@psms/shared/session-token` subpath import 실패 | root `test/smoke` 위치에서 pnpm package subpath resolution이 불안정                | smoke 파일은 repo-local source path를 import                  | 추후 테스트를 package 내부로 이동하면 package export import 재검토 |

## Risks

- inject smoke는 실제 dev DB를 직접 쓰지는 않지만, 현재 `dev.db` seed를 복사하므로 seed 계정이 바뀌면 실패할 수 있다.
- `app.inject()`는 API route behavior를 검증하지만 Web route guard는 기존 live smoke 수준이다. Playwright 기반 `/settings/base`, `/settings/policies`, sidebar visibility 검증은 다음 단계가 필요하다.
- API lint는 아직 ESLint가 아니라 TypeScript no-emit gate다. API 전용 ESLint flat config는 별도 단계로 추가한다.
- 작업 트리는 기존 대규모 dirty 상태다. 이번 작업과 무관한 변경은 되돌리지 않았다.

## Planned Three Stages

| 단계 | 목표                     | Subagent/Spark 배정                                                         | 모델                                             | 작업 범위                                                                                                 | 완료 기준                                                                    |
| ---: | ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
|    1 | Web route guard E2E 확장 | `qa_agent` + `ui_runtime_validator`                                         | GPT-5.5 high + mini validator                    | ADMIN/STAFF 로그인, `/staffs`, `/settings/base`, `/settings/policies`, sidebar visibility Playwright 검증 | route guard E2E와 live smoke 통과                                            |
|    2 | Acceptance seed 확장     | `db_reviewer` -> `backend_agent`                                            | GPT-5.5 high                                     | 직원 5명+, 매장 3개+, 통신사/기종/재고/고객/판매/미수/일정/정책 seed 준비                                 | `db:validate`, `db:seed`, seed idempotency smoke 통과                        |
|    3 | 디자인 게이트 확장       | `spark_ui_iterator` + `ui_runtime_validator` + 필요 시 `visual_ui_reviewer` | Spark for static UI, GPT-5.4-mini/GPT-5.5 for QA | 남은 7개 기준 화면의 정적 UI skeleton과 screenshot QA                                                     | `1586x992`, `1440x900`, `1280x800` screenshot/console/network 기본 검증 통과 |
