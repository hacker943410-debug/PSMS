# Prisma Dev DB Migration Apply Completion Report

작성일: 2026-04-30

## 요약

초기 Prisma migration `20260430030525_init`을 실제 개발 DB `dev.db`에 적용했다. 적용 전 preflight, 백업, disposable rehearsal은 이미 통과한 상태였고, 이번 작업에서 `pnpm db:migrate`를 실행했다.

전체 프로젝트 개발 예정 대비 현재 완료율은 약 20% / 100%로 조정한다. DB schema 적용은 완료되었지만 seed, auth/session, Server Action, 도메인 기능, Export, E2E는 아직 미구현이다.

## 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router, workspace route group, 정적 placeholder route, Workspace UI 1차 세트            |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories` placeholder 중심. 실제 업무 로직 미구현 |
| DB             | Prisma 7.8, SQLite 루트 `dev.db`, initial migration 적용 완료. 업무 table 22개, index 55개          |
| 인증           | Credentials + DB-backed opaque session 방향 결정. 실제 auth/session/RBAC 미구현                     |
| API 구조       | Server Actions 중심 계획. 실제 Server Action/API contract 구현 미구현                               |
| 주요 기능 상태 | 하네스, 앱 골격, Prisma schema/migration 적용 완료. 실제 업무 도메인 기능은 미구현                  |

## 작업 분해

| 단계 | 작업                                                    | 담당                 |
| ---: | ------------------------------------------------------- | -------------------- |
|    1 | 하네스/상태 문서 재확인                                 | Main                 |
|    2 | DB reviewer 자동 위임                                   | `db_reviewer`        |
|    3 | QA reviewer 자동 위임                                   | `qa_agent`           |
|    4 | apply 직전 target/hash/catalog/pending preflight 재확인 | Main                 |
|    5 | 실제 `pnpm db:migrate` 실행                             | Main                 |
|    6 | post-apply catalog/migration row/FK/JSON/runtime 검증   | Main                 |
|    7 | hash discrepancy 원인 재검증 및 DB reviewer 재판정      | Main + `db_reviewer` |
|    8 | 상태 문서와 완료 보고서 갱신                            | Main                 |

## Subagent 배정

| 세부 작업                | Subagent      | Model   | Reasoning | 권한      | 결과                                               | 배정 이유                                   |
| ------------------------ | ------------- | ------- | --------- | --------- | -------------------------------------------------- | ------------------------------------------- |
| Post-apply DB acceptance | `db_reviewer` | GPT-5.5 | high      | Read-only | 최종 PASS. post-validation hash를 새 기준으로 채택 | Prisma migration 실제 적용은 고위험 DB 영역 |
| Apply QA acceptance 기준 | `qa_agent`    | GPT-5.5 | high      | Read-only | 적용 전/후 필수 검증 기준 제공                     | 적용 증거, catalog, runtime/build 검증 분리 |

## 모델 선택 이유

| 모델    | 사용 여부 | 이유                                                                                   |
| ------- | --------- | -------------------------------------------------------------------------------------- |
| GPT-5.5 | 사용      | DB migration, target DB, backup/hash, apply/recovery gate는 하네스상 GPT-5.5 검토 대상 |
| Spark   | 미사용    | Spark는 UI/단순 작업 전용이며 Prisma/DB/migration 금지                                 |
| mini    | 미사용    | 보고 초안에는 가능하지만 이번 핵심은 실제 DB 적용 및 검증                              |

## 실행 결과

| 항목                    | 결과                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Apply command           | `pnpm db:migrate`                                                    |
| Apply result            | `20260430030525_init` applied, exit 0                                |
| Drift/reset prompt      | 없음                                                                 |
| Migration status        | schema up to date, exit 0                                            |
| Backup file             | `dev.db.pre-init-20260430132108.bak`                                 |
| Backup hash             | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`   |
| Post-validation DB hash | `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`   |
| Migration SQL hash      | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`   |
| Business tables         | `22`                                                                 |
| All non-sqlite tables   | `23`                                                                 |
| Index count             | `55`                                                                 |
| Migration row           | `20260430030525_init\|FINISHED\|NOT_ROLLED_BACK`                     |
| Integrity/FK            | `integrity_check=ok`, `foreign_key_check=0`                          |
| Core tables             | `AuditLog`, `InventoryItem`, `Receivable`, `Sale`, `Session`, `User` |
| Core unique/index       | 5개 확인                                                             |
| JSONB columns           | `6`                                                                  |
| JSON smoke              | insert/json_valid/delete 통과, test row `0`건                        |
| Business table rows     | 전체 22개 업무 table 모두 `0`건                                      |
| Prisma diff             | DB to schema, migrations to DB 모두 `No difference detected`         |

Hash note:

- 적용 직후 DB hash는 `AC6A3E50000F1033BC2573835AC5D9D56DDC80692B5E54A6CBEEBBDE04FFCF0C`로 관측되었다.
- 이후 실제 DB에서 JSON smoke insert/delete 검증을 수행하면서 SQLite 파일 hash가 `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`로 변경되었다.
- test row는 삭제되었고 모든 업무 table row count는 0이며, Prisma diff도 clean이므로 DB reviewer 재판정에 따라 `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`을 post-validation 기준 hash로 기록한다.

## 변경 파일

| 파일                                                                    | 변경 내용                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `dev.db`                                                                | 초기 migration 적용. 업무 table 22개, index 55개, migration row 1건 생성 |
| `docs/00_system/project-current-state.md`                               | 실제 DB migration 적용 완료와 완료율 20% 반영                            |
| `docs/00_system/prisma-schema-review-checklist.md`                      | actual dev DB migration apply 결과 추가                                  |
| `docs/00_system/prisma-migration-rollback-test-plan.md`                 | actual apply result와 post-validation hash 기록                          |
| `docs/80_ai_harness/prisma-dev-db-migration-apply-completion-report.md` | 이번 작업 완료 보고서 추가                                               |

## 검증 결과

| 검증               | 결과 | 근거                                                         |
| ------------------ | ---- | ------------------------------------------------------------ |
| Preflight          | 통과 | target DB, hash, backup, pending, catalog, WAL/SHM 확인      |
| Apply              | 통과 | `pnpm db:migrate` exit 0                                     |
| Migration status   | 통과 | schema up to date, exit 0                                    |
| Catalog            | 통과 | business tables 22, indexes 55                               |
| Migration row      | 통과 | `20260430030525_init\|FINISHED\|NOT_ROLLED_BACK`             |
| Integrity/FK       | 통과 | `integrity_check=ok`, `foreign_key_check=0`                  |
| JSON smoke         | 통과 | `json_valid=1`, test row 삭제 후 0건                         |
| Table row counts   | 통과 | 업무 table 22개 모두 0건                                     |
| Prisma diff        | 통과 | DB to schema, migrations to DB 모두 `No difference detected` |
| Prisma Client      | 통과 | `pnpm db:generate`                                           |
| Prisma schema      | 통과 | `pnpm db:validate`                                           |
| Runtime connect    | 통과 | `PrismaBetterSqlite3.connect()` `connect ok`                 |
| pnpm build scripts | 통과 | `pnpm ignored-builds` = `None`                               |
| Lint               | 통과 | `pnpm lint`                                                  |
| Typecheck          | 통과 | `pnpm typecheck`                                             |
| Build              | 통과 | `pnpm build`                                                 |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                             |
| ------------ | --------: | ---------------------------------------------------------------- |
| Auth         |        No | 인증/세션/RBAC 구현 변경 없음                                    |
| DB           |       Yes | 기존 승인된 초기 Prisma migration을 실제 개발 DB `dev.db`에 적용 |
| API contract |        No | Server Action/API contract 변경 없음                             |

## 남은 리스크

| 리스크                                     | 영향도 | 대응                                                               |
| ------------------------------------------ | -----: | ------------------------------------------------------------------ |
| SQLite `JSONB` type name                   | Medium | 정책/AuditLog 구현 전 Zod validation과 PostgreSQL review           |
| nullable unique의 PostgreSQL 차이          | Medium | 운영 DB 전환 전 `Sale.inventoryItemId`, `Receivable.saleId` 재검증 |
| `ON DELETE SET NULL` 이력 보존 충돌 가능성 |   High | 서비스 계층 physical delete 금지와 referential action 재검토       |
| seed/auth 미구현                           |   High | 다음 단계에서 smoke seed 및 auth seed 정책 수립                    |
| transaction test 없음                      |   High | 판매/수납/재고/정책 핵심 transaction 테스트 계획 수립              |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                             | Subagent                              | Model   | 상세                                                            |
| ---: | -------------------------------- | ------------------------------------- | ------- | --------------------------------------------------------------- |
|    1 | Smoke seed/auth seed 정책 수립   | `backend_agent` + `security_reviewer` | GPT-5.5 | ADMIN/STAFF/Store seed, password hash, 반복 실행 기준 정의      |
|    2 | Seed 구현 및 idempotency 검증    | `backend_agent` + `db_reviewer`       | GPT-5.5 | Prisma seed script, 기본 master data, 재실행 안전성 확인        |
|    3 | Auth/session 실제 구현 preflight | `security_reviewer` + `backend_agent` | GPT-5.5 | session cookie, password hash, route guard, RBAC 구현 범위 확정 |

## 결론

실제 개발 DB migration apply는 `PASS`다. DB schema는 `dev.db`에 적용되었고, post-apply catalog/runtime/build 검증도 통과했다. 다음 단계는 seed 전략과 auth seed 정책이다.
