# Acceptance/Master Seed Idempotency Gate Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준의 다음 작업으로 acceptance/master seed를 바로 확장하지 않고, 먼저 seed idempotency gate를 독립 실행 가능하게 만들었다.

핵심 결정은 기존 `db:seed`와 `db:e2e:isolated-reset`의 smoke/auth 기준을 보존하는 것이다. Master/acceptance fixture는 별도 scope와 entrypoint가 준비된 뒤 구현한다.

## 2. 작업 분해

| Task | 내용                                    | 담당                  | 상태 |
| ---- | --------------------------------------- | --------------------- | ---- |
| T1   | MCP/하네스/워크트리/seed 현황 확인      | Codex                 | 완료 |
| T2   | DB/backend/QA 서브에이전트 자동 위임    | Mill, Kepler, Lorentz | 완료 |
| T3   | smoke/auth seed idempotency gate 구현   | Codex                 | 완료 |
| T4   | acceptance/master seed gate 설계 문서화 | Codex                 | 완료 |
| T5   | 검증 명령 실행 및 회귀 확인             | Codex                 | 완료 |
| T6   | 완료 보고서 작성                        | Codex                 | 완료 |

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role    | Model route  | 선택 이유                                                               | 결과                                            |
| ---------------- | --------------- | ------------ | ----------------------------------------------------------------------- | ----------------------------------------------- |
| Mill             | `db_reviewer`   | GPT-5.5 high | seed 범위, Prisma schema, FK/unique/idempotency는 DB 무결성 판단이 필요 | smoke seed 유지, master seed 별도 scope 권고    |
| Kepler           | `backend_agent` | GPT-5.5 high | seed entrypoint, package script, API read surface와의 연결 판단 필요    | master/acceptance seed 분리와 gate profile 권고 |
| Lorentz          | `qa_agent`      | GPT-5.5 high | isolated DB, 반복 실행, dev.db 불변성, 회귀 검증 범위 판단 필요         | idempotency/coverage 검증 기준 제안             |
| Codex controller | main            | GPT-5        | 다중 파일 구현, 서브에이전트 결과 통합, 검증 실행 조율                  | gate 구현 및 문서화 완료                        |

Spark/mini는 사용하지 않았다. 이번 작업은 DB seed, Prisma, idempotency, password hash 불변성 영역이라 하네스 규칙상 Spark/mini 대상이 아니다.

## 4. 변경 파일

| 파일                                                                                       | 변경 내용                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/seed-idempotency-check.ts`                                             | `.tmp/seed-gate` isolated DB에 migration 적용 후 smoke/auth seed를 2회 실행하고 count, FK, quick_check, ID/password hash 안정성, dev.db hash 불변을 검증 |
| `packages/db/package.json`                                                                 | `db:seed:idempotency` script 추가                                                                                                                        |
| `package.json`                                                                             | root `db:seed:idempotency`, `test:seed:idempotency` script 추가                                                                                          |
| `docs/00_system/acceptance-master-seed-gate.md`                                            | acceptance/master seed 범위, 제외 범위, idempotency gate 요구사항, 향후 script 방향 문서화                                                               |
| `docs/80_ai_harness/acceptance-master-seed-idempotency-gate-completion-report-20260506.md` | 이번 완료 보고서                                                                                                                                         |

현재 워크트리에는 이전 완료 작업인 auth cookie hardening과 admin read DTO shared contract 변경도 함께 커밋 대기 중이다.

## 5. 검증 결과

| 명령                                           | 결과 |
| ---------------------------------------------- | ---- |
| `pnpm db:seed:idempotency`                     | 통과 |
| `pnpm db:validate`                             | 통과 |
| `pnpm --filter @psms/db typecheck`             | 통과 |
| `pnpm --filter @psms/db db:e2e:isolated-reset` | 통과 |
| `pnpm test`                                    | 통과 |
| `pnpm typecheck`                               | 통과 |
| `pnpm lint`                                    | 통과 |
| `pnpm build`                                   | 통과 |
| `pnpm format:check`                            | 통과 |
| `git diff --check`                             | 통과 |

`pnpm db:seed:idempotency` 확인값:

| 항목                       | 결과                                       |
| -------------------------- | ------------------------------------------ |
| Target DB                  | `.tmp/seed-gate/smoke-auth-idempotency.db` |
| Migration                  | 적용 완료, schema up to date               |
| quick_check                | `ok`                                       |
| foreign_key_check          | 0건                                        |
| Store/User                 | `Store=1`, `User=2`                        |
| Session/AuditLog           | 0건                                        |
| Domain/policy tables       | 0건 유지                                   |
| Stable IDs/password hashes | 통과                                       |
| `packages/db/dev.db`       | hash 불변                                  |

## 6. 진행 현황

| Phase   | 내용                                    | 진행율 | 메모                                                                    |
| ------- | --------------------------------------- | -----: | ----------------------------------------------------------------------- |
| Phase 0 | Harness, workspace, MCP, 기본 문서/흐름 |   100% | 현재 하네스 기반 작업 가능                                              |
| Phase 1 | Auth/RBAC/session 기반                  |    78% | hardening과 smoke 검증 강화됨. 운영 rate limit은 남음                   |
| Phase 2 | Admin foundation read/API contract      |    72% | shared read DTO 승격 완료. mutation/CRUD는 남음                         |
| Phase 3 | DB/Seed/Acceptance gate                 |    58% | smoke idempotency gate 완료. master/acceptance seed 실제 fixture는 남음 |
| Phase 4 | 핵심 업무 도메인                        |     8% | sale/receivable/inventory/customer transaction 구현 전                  |
| Phase 5 | E2E, Desktop, release                   |    12% | managed preflight 기반만 있음                                           |
| 전체    | Web/API/Desktop MVP                     |    34% | 최근 hardening, DTO contract, seed gate 반영 추정                       |

이번 Task 기준 진행율은 100%다.

## 7. 리스크 및 잔여 작업

| 리스크                                                                              | 대응                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Master seed를 기존 smoke seed에 섞으면 E2E isolated reset count가 깨질 수 있음      | 별도 scope/entrypoint로만 확장                                         |
| Policy `ruleJson` fixture가 활성화 business truth로 오해될 수 있음                  | read-only fixture로 시작하고 Zod/conflict 검토 후 승격                 |
| Sale/payment/receivable/inventory fixture가 transaction service 없이 추가될 수 있음 | domain transaction gate 전까지 acceptance scenario seed에서 제외       |
| root `dev.db`와 `packages/db/dev.db`가 혼동될 수 있음                               | gate는 `packages/db/dev.db` hash 불변과 `.tmp/seed-gate` target만 허용 |

## 8. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                             | Subagent                                                                               | Model route         | 상세                                                                                                           |
| ---: | ------------------------------------- | -------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
|    1 | Master seed 별도 entrypoint 설계/구현 | `db_reviewer` + `backend_agent` + `qa_agent`                                           | GPT-5.5 high        | `master-seed.ts` 초안, seed-owned key 규칙, stores/staff/base/policy read fixture 최소 구현, profile gate 설계 |
|    2 | 운영형 login rate limit 저장소 전환   | `security_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`                     | GPT-5.5 high        | in-memory 1차 guard를 shared/persistent 정책으로 승격, production/local 분기와 테스트 추가                     |
|    3 | Web ADMIN guard 중앙화 및 route E2E   | `security_reviewer` + `architect_reviewer` + `frontend_agent` + `ui_runtime_validator` | GPT-5.5/GPT-5.4 mix | staff/base/policy 접근 guard 중복 제거, STAFF 차단 회귀, 브라우저 route guard 검증                             |
