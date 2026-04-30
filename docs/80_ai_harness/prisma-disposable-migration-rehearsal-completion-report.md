# Prisma Disposable Migration Rehearsal Completion Report

작성일: 2026-04-30

## 요약

Prisma 초기 migration `20260430030525_init`을 실제 `dev.db`가 아닌 disposable SQLite DB에 적용해 rehearsal gate를 검증했다.

전체 프로젝트 개발 예정 대비 현재 완료율은 약 18% / 100%로 유지한다. 이번 작업은 실제 업무 기능이나 실제 개발 DB 적용이 아니라 migration apply 전 안전 gate 검증이다.

## 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router, workspace route group, 정적 placeholder route, 공통 Workspace UI 1차 세트                     |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories` placeholder 중심. 실제 Server Action/업무 로직 미구현 |
| DB             | Prisma 7.8, SQLite `dev.db`, create-only migration 생성. 실제 `dev.db` 업무 table 적용은 pending                  |
| 인증           | Credentials + DB-backed opaque session 방향 결정. 실제 auth/session/RBAC 구현은 미구현                            |
| API 구조       | Server Actions 중심 계획. 일반 CRUD Route Handler 금지. 실제 API contract 구현은 미구현                           |
| 주요 기능 상태 | 하네스, 초기 앱 골격, Prisma schema/migration 준비 완료. 업무 도메인 기능은 아직 시작 전                          |

## 충돌 가능성 분석

| 영역         | 충돌 가능성 | 대응                                                             |
| ------------ | ----------- | ---------------------------------------------------------------- |
| Auth         | 낮음        | auth/session/RBAC 파일 변경 없음                                 |
| DB           | 중간        | 실제 `dev.db`는 미변경, disposable DB에서만 apply rehearsal 수행 |
| API contract | 낮음        | Server Action/API contract 변경 없음                             |
| UI/라우팅    | 낮음        | UI 파일 변경 없음                                                |

## 작업 분해

| 단계 | 작업                                                           | 담당                   |
| ---: | -------------------------------------------------------------- | ---------------------- |
|    1 | 하네스/상태 문서 확인                                          | Main                   |
|    2 | DB reviewer 자동 위임                                          | `db_reviewer`          |
|    3 | QA reviewer 자동 위임                                          | `qa_agent`             |
|    4 | raw SQL disposable apply 검증                                  | Main                   |
|    5 | Prisma `migrate deploy` disposable apply 검증                  | Main                   |
|    6 | 실제 `dev.db` 미변경 증명                                      | Main + `qa_agent` 기준 |
|    7 | current-state, checklist, rollback/test plan, 완료 보고서 갱신 | Main                   |

## Subagent 배정

| 세부 작업                        | Subagent      | Model   | Reasoning | 권한      | 산출물                                    | 배정 이유                                               |
| -------------------------------- | ------------- | ------- | --------- | --------- | ----------------------------------------- | ------------------------------------------------------- |
| DB migration rehearsal 수용 기준 | `db_reviewer` | GPT-5.5 | high      | Read-only | 수용 기준, 리스크, 명령 체크              | Prisma migration은 하네스상 GPT-5.5 DB review 필수 영역 |
| QA 검증 기준 및 보고 요건        | `qa_agent`    | GPT-5.5 | high      | Read-only | 검증 체크리스트, 보고 acceptance criteria | 실제 DB 미변경 증거와 완료 보고 합격 기준 분리 검증     |

Spark는 사용하지 않았다. Prisma migration, DB catalog, migration metadata는 Spark 금지 영역이다. mini도 DB 판정에는 사용하지 않았다.

## 모델 선택 이유

| 모델    | 사용 여부 | 기준                                                               |
| ------- | --------- | ------------------------------------------------------------------ |
| GPT-5.5 | 사용      | DB migration, schema apply gate, QA 판정은 고위험 DB 영역          |
| Spark   | 미사용    | UI skeleton/단순 문서 전용이며 Prisma/DB 작업 금지                 |
| mini    | 미사용    | 보고 초안에는 가능하지만 이번 작업의 핵심 판정은 DB/QA 고위험 검증 |

## 실행 결과

| 검증               | 결과                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| Raw SQL temp apply | table 22개, index 55개, FK check empty                                                                                                                            |
| Prisma temp apply  | `pnpm exec prisma migrate deploy` exit 0                                                                                                                          |
| Prisma temp status | `pnpm exec prisma migrate status` exit 0, schema up to date                                                                                                       |
| Temp migration row | `20260430030525_init                                                                                                                                              | FINISHED | NOT_ROLLED_BACK` |
| Temp integrity     | `ok`                                                                                                                                                              |
| Temp FK check      | 결과 없음                                                                                                                                                         |
| Temp JSONB columns | 6개                                                                                                                                                               |
| Temp JSON smoke    | `json_valid = 1`, test row 삭제 후 0건                                                                                                                            |
| 핵심 unique/index  | `InventoryItem_serialNumber_key`, `Sale_inventoryItemId_key`, `Receivable_saleId_key`, `SaleAddOn_saleId_addOnServiceId_key`, `Session_sessionTokenHash_key` 확인 |
| Temp cleanup       | 임시 DB 삭제 완료                                                                                                                                                 |

## 실제 dev.db 미변경 증거

| 항목                                   | 결과                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `dev.db` SHA256 before/after           | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` 동일 |
| `dev.db` size before/after             | `12288` bytes 동일                                                      |
| `dev.db` LastWriteTimeUtc before/after | `2026-04-30T03:05:25.0512116Z` 동일                                     |
| `dev.db` catalog before/after          | `_prisma_migrations` only                                               |
| `_prisma_migrations` rows before/after | `0` 유지                                                                |
| `dev.db-wal`, `dev.db-shm`             | 생성 없음                                                               |
| Migration SQL SHA256                   | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`      |

## 최종 검증 결과

| 검증               | 결과      | 근거                                             |
| ------------------ | --------- | ------------------------------------------------ |
| Format             | 통과      | `pnpm format:check`                              |
| Prisma schema      | 통과      | `pnpm db:validate`                               |
| Migration status   | 기대 결과 | `20260430030525_init` pending, exit 1            |
| Runtime connect    | 통과      | `PrismaBetterSqlite3.connect()` `connect ok`     |
| Lint               | 통과      | `pnpm lint`                                      |
| Typecheck          | 통과      | `pnpm typecheck`                                 |
| Build              | 통과      | `pnpm build`                                     |
| pnpm build scripts | 통과      | `pnpm ignored-builds` = `None`                   |
| dev DB catalog     | 유지      | `_prisma_migrations` only, migration row count 0 |

## 변경 파일

| 파일                                                                            | 변경 내용                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/00_system/project-current-state.md`                                       | disposable DB rehearsal 통과와 실제 `dev.db` pending 상태 반영                |
| `docs/00_system/prisma-schema-review-checklist.md`                              | rehearsal 결과, hash, catalog, unique/FK/JSON smoke 결과 추가                 |
| `docs/00_system/prisma-migration-rollback-test-plan.md`                         | Prisma temp apply 절차를 `migrate deploy`로 보정하고 실제 rehearsal 결과 추가 |
| `docs/80_ai_harness/prisma-disposable-migration-rehearsal-completion-report.md` | 이번 작업 완료 보고서 추가                                                    |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                                               |
| ------------ | --------: | ---------------------------------------------------------------------------------- |
| Auth         |        No | 인증/세션/RBAC 구현 변경 없음                                                      |
| DB           |        No | 실제 schema/migration 파일과 `dev.db` 변경 없음. disposable temp DB만 생성 후 삭제 |
| API contract |        No | Server Action/API contract 변경 없음                                               |

## 남은 리스크

| 리스크                                     | 영향도 | 대응                                                                       |
| ------------------------------------------ | -----: | -------------------------------------------------------------------------- |
| 실제 `dev.db` migration 미적용             |   High | 다음 gate에서 backup 생성 후 적용                                          |
| SQLite `JSONB` type name                   | Medium | 정책/AuditLog 구현 전 Zod validation과 PostgreSQL review                   |
| `ON DELETE SET NULL` 이력 보존 충돌 가능성 |   High | 실제 도메인 service 구현 전 referential action/physical delete 정책 재확인 |
| seed 없음                                  | Medium | migration 적용 후 smoke seed 전략 수립                                     |
| transaction test 없음                      |   High | 판매/수납/재고/정책 구현 전 테스트 계획 확정                               |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                                             | Subagent                              | Model   | 상세                                                                             |
| ---: | ------------------------------------------------ | ------------------------------------- | ------- | -------------------------------------------------------------------------------- |
|    1 | 실제 `dev.db` migration 적용 전 backup/hash gate | `db_reviewer` + `qa_agent`            | GPT-5.5 | `dev.db`, WAL/SHM backup 생성, hash 기록, pending 상태 재확인                    |
|    2 | 실제 `dev.db` migration 적용 및 catalog 검증     | `db_reviewer` + `qa_agent`            | GPT-5.5 | `pnpm db:migrate`, 업무 table 22개/index 55개, migration row, runtime/build 검증 |
|    3 | smoke seed 전략 및 auth seed 정책 수립           | `backend_agent` + `security_reviewer` | GPT-5.5 | ADMIN/STAFF/Store seed 범위, password hash 정책, seed 반복 실행 기준 정의        |

## 결론

Disposable DB 기준 migration apply rehearsal은 통과했다. 실제 개발 DB는 hash, size, timestamp, catalog, migration row가 모두 리허설 전후 동일하므로 훼손되지 않았다.

다음 작업은 실제 `dev.db` 적용이 아니라 먼저 backup/hash gate를 생성하는 단계로 진행해야 한다.
