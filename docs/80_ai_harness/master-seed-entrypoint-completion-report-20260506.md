# Master Seed Entrypoint Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 작업으로 master seed 별도 entrypoint와 master seed idempotency gate를 구현했다.

기존 `db:seed`는 smoke/auth 전용으로 유지했다. 신규 master seed는 관리자 read 화면을 비어 있지 않게 만들기 위한 최소 fixture만 생성하며, `Session`, `AuditLog`, `InventoryItem`, `Customer`, `Sale`, `Receivable`, `Payment`, `ManualSchedule`은 계속 제외한다.

## 2. 작업 분해

| Task | 내용                                                  | 담당                   | 상태         |
| ---- | ----------------------------------------------------- | ---------------------- | ------------ |
| T1   | MCP/하네스/필수 문서/PSMS_Tech 실제 경로 확인         | Codex                  | 완료         |
| T2   | DB/backend/QA subagent 자동 위임                      | Popper, Epicurus, Hume | 완료         |
| T3   | `master-seed.ts` 신규 entrypoint 구현                 | Codex                  | 완료         |
| T4   | `master-seed-idempotency-check.ts` isolated gate 구현 | Codex                  | 완료         |
| T5   | package scripts/env/docs 갱신                         | Codex                  | 완료         |
| T6   | 검증 명령 실행 및 회귀 확인                           | Codex                  | 완료         |
| T7   | 구현 후 final diff review 위임                        | Godel                  | 진행 후 반영 |
| T8   | 완료 보고서 작성                                      | Codex                  | 완료         |

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role    | Model route        | 선택 이유                                                                | 결과                                               |
| ---------------- | --------------- | ------------------ | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Popper           | `db_reviewer`   | GPT-5.5 high       | Prisma seed, deterministic ID, FK/unique, SQLite/Postgres 차이 판단 필요 | 관리자 read 전용 fixture 범위와 제외 테이블 확정   |
| Epicurus         | `backend_agent` | GPT-5.5 high       | admin read repository/API surface와 seed scope 연결 판단 필요            | API contract 변경 없이 DB fixture만 추가 가능 판정 |
| Hume             | `qa_agent`      | GPT-5.5 high       | isolated DB gate, dev.db hash 불변, 회귀 명령 설계 필요                  | master seed gate evidence와 회귀 포인트 제안       |
| Godel            | `code_reviewer` | gpt-5.3-codex high | 구현 후 diff 기반 버그/회귀 리뷰 필요                                    | final diff review 위임                             |
| Codex controller | main            | GPT-5              | 구현, 검증 실행, subagent 결과 통합                                      | master seed/gate 완료                              |

Spark/mini는 사용하지 않았다. 이번 작업은 `packages/db` seed, password hash, Prisma idempotency, DB safety guard 영역이라 하네스 규칙상 Spark/mini 대상이 아니다.

## 4. 변경 파일

| 파일                                                                      | 변경 내용                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/master-seed.ts`                                       | master read seed entrypoint 추가. Store/User/Carrier/Base/Policy read fixture를 deterministic key로 upsert      |
| `packages/db/prisma/master-seed-idempotency-check.ts`                     | `.tmp/seed-gate` isolated DB에서 migration 후 master seed 2회 실행, count/stable snapshot/dev.db hash 불변 검증 |
| `packages/db/package.json`                                                | `db:seed:master`, `db:seed:master:idempotency` 추가                                                             |
| `package.json`                                                            | root `db:seed:master`, `db:seed:master:idempotency`, `test:seed:master:idempotency` 추가                        |
| `.env.example`                                                            | `PSMS_MASTER_SEED_PASSWORD` 예시 env 추가                                                                       |
| `docs/00_system/acceptance-master-seed-gate.md`                           | master seed 구현 상태와 fixture count 추가                                                                      |
| `docs/80_ai_harness/master-seed-entrypoint-completion-report-20260506.md` | 이번 완료 보고서                                                                                                |

현재 워크트리에는 이전 완료 작업인 auth cookie hardening, admin read DTO shared contract, smoke seed idempotency gate 변경도 함께 커밋 대기 중이다.

## 5. Master Seed 범위

| 대상                  | 수량 | 비고                     |
| --------------------- | ---: | ------------------------ |
| Store                 |    3 | active 2, inactive 1     |
| User                  |    6 | ADMIN 1, STAFF 5         |
| Carrier               |    4 | SKT/KT/LGU/MVNO          |
| SalesAgency           |    8 | carrier 연결             |
| InventoryColorOption  |    6 | active/inactive mix      |
| DeviceModel           |   10 | 기본 기초정보 화면 채움  |
| RatePlan              |    8 | carrier 연결             |
| AddOnService          |    8 | carrier 연결             |
| SaleProfitPolicy      |    3 | ACTIVE/SCHEDULED/EXPIRED |
| StaffCommissionPolicy |    3 | ACTIVE/SCHEDULED/EXPIRED |
| DiscountPolicy        |    3 | ACTIVE/SCHEDULED/EXPIRED |
| CarrierActivationRule |    3 | ACTIVE/SCHEDULED/EXPIRED |

제외 유지:

| 대상                    | 이유                                    |
| ----------------------- | --------------------------------------- |
| Session                 | 실제 login flow만 생성해야 함           |
| AuditLog                | seed audit 정책 미확정                  |
| InventoryItem           | 재고 상태 전환/중복 판매 transaction 전 |
| Customer / CustomerMemo | 개인정보/업무 fixture 정책 전           |
| Sale / SaleAddOn        | 판매 transaction 전                     |
| Receivable / Payment    | 잔액 재계산/취소 transaction 전         |
| ManualSchedule          | 판매/수납 일정 규칙 전                  |

## 6. 검증 결과

| 명령                                           | 결과 | 근거                                                         |
| ---------------------------------------------- | ---- | ------------------------------------------------------------ |
| `pnpm --filter @psms/db typecheck`             | 통과 | 신규 seed TS 타입 확인                                       |
| `pnpm db:seed:master:idempotency`              | 통과 | `.tmp/seed-gate/master-seed-idempotency.db`, 2회 실행 stable |
| `pnpm db:validate`                             | 통과 | Prisma schema valid                                          |
| `pnpm db:seed:idempotency`                     | 통과 | 기존 smoke/auth seed count 유지                              |
| `pnpm --filter @psms/db db:e2e:isolated-reset` | 통과 | 기존 E2E reset `Store=1`, `User=2`, `Session=0` 유지         |
| `pnpm test`                                    | 통과 | unit/admin/API inject smoke 통과                             |
| `pnpm typecheck`                               | 통과 | shared/db/api/web typecheck 통과                             |
| `pnpm test:e2e:managed:preflight`              | 통과 | `ok:true`, 단 현재 포트 점유로 `canRunManaged:false`         |
| `pnpm lint`                                    | 통과 | API tsc lint, Web eslint 통과                                |
| `pnpm build`                                   | 통과 | shared/db/api/web build 통과                                 |
| `pnpm format:check`                            | 통과 | Prettier check 통과                                          |
| `git diff --check`                             | 통과 | whitespace 오류 없음                                         |

`pnpm db:seed:master:idempotency` 주요 evidence:

| 항목                    | 결과                                        |
| ----------------------- | ------------------------------------------- |
| Target DB               | `.tmp/seed-gate/master-seed-idempotency.db` |
| Migration               | 적용 완료, status clean                     |
| quick_check             | `ok`                                        |
| foreign_key_check       | 0건                                         |
| Stable snapshot         | 통과                                        |
| Password hash stability | 통과                                        |
| Excluded tables         | 0건 유지                                    |
| `packages/db/dev.db`    | hash 불변                                   |

## 7. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                             |
| ------------------- | --------: | ---------------------------------------------------------------- |
| Auth                |        No | 인증 로직 변경 없음. master seed password env와 hash 생성만 추가 |
| DB schema/migration |        No | Prisma schema/migration 변경 없음                                |
| DB seed             |       Yes | 별도 master seed entrypoint/gate 추가                            |
| API contract        |        No | Fastify route/shared Zod/ActionResult 변경 없음                  |
| UI                  |        No | 화면 변경 없음. screenshot gate는 후속 UI/data 연결 단계 대상    |

## 8. 진행 현황

| Phase   | 내용                                    | 진행율 | 메모                                                                     |
| ------- | --------------------------------------- | -----: | ------------------------------------------------------------------------ |
| Phase 0 | Harness, workspace, MCP, 기본 문서/흐름 |   100% | 현재 하네스 기반 작업 가능                                               |
| Phase 1 | Auth/RBAC/session 기반                  |    78% | 운영형 rate limit은 남음                                                 |
| Phase 2 | Admin foundation read/API contract      |    74% | shared read DTO와 master read seed 기반 확보                             |
| Phase 3 | DB/Seed/Acceptance gate                 |    66% | smoke gate + master read seed gate 완료. acceptance scenario seed는 남음 |
| Phase 4 | 핵심 업무 도메인                        |     8% | sale/receivable/inventory/customer transaction 구현 전                   |
| Phase 5 | E2E, Desktop, release                   |    12% | managed preflight 기반만 있음                                            |
| 전체    | Web/API/Desktop MVP                     |    36% | master read seed까지 반영한 추정                                         |

이번 Task 기준 진행율은 100%다.

## 9. 리스크 및 대응

| 리스크                                                                         | 영향도 | 대응                                                               |
| ------------------------------------------------------------------------------ | -----: | ------------------------------------------------------------------ |
| `db:seed:master`를 실제 dev DB에 실행하려면 `PSMS_MASTER_SEED_PASSWORD`가 필요 |     중 | `.env.example`에 빈 값만 두고 gate는 isolated env로 주입           |
| master policy fixture가 활성화 truth로 오해될 수 있음                          |     중 | `ruleJson.mode=read-only-fixture`, `activationBlocked=true`로 명시 |
| admin read 화면별 UI screenshot은 아직 seed row 기반으로 검증하지 않음         |     중 | 화면 데이터 연결/실행 단계에서 UI validation 수행                  |
| root `dev.db`와 `packages/db/dev.db` 혼동                                      |   낮음 | gate는 `packages/db/dev.db` hash와 `.tmp/seed-gate` target만 검증  |

## 10. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                           | Subagent                                                                               | Model route         | 상세                                                                                                       |
| ---: | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
|    1 | 운영형 login rate limit 저장소 전환 | `security_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`                     | GPT-5.5 high        | in-memory guard를 local/shared/persistent 정책으로 승격하고 production/test 분기 및 API inject 테스트 추가 |
|    2 | Web ADMIN guard 중앙화 및 route E2E | `security_reviewer` + `architect_reviewer` + `frontend_agent` + `ui_runtime_validator` | GPT-5.5/GPT-5.4 mix | staffs/base/policy 접근 guard 중복 제거, STAFF 차단 회귀, 브라우저 route guard 검증                        |
|    3 | Admin Foundation mutation preflight | `architect_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`                    | GPT-5.5 high        | staff/base/policy mutation 순서, Zod schema, transaction/audit 정책, 테스트 계획 확정                      |
