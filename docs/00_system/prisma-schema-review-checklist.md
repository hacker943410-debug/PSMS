# Prisma Schema Review Checklist

작성일: 2026-04-30

## 1. 목적

`C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\prisma\schema.draft.prisma`를 실제 `prisma/schema.prisma`로 적용하기 전에 반드시 확인해야 할 승인 체크리스트다.

이번 문서는 review gate 산출물이며, 현재 Prisma 설치, schema 생성, create-only migration 생성, disposable DB apply rehearsal, backup/final preflight, 실제 `dev.db` migration apply까지 수행되었다.

Smoke/auth seed 정책은 수립했지만, seed script 실행, auth 구현, API contract 변경은 아직 수행하지 않았다.

## 2. 적용 승인 원칙

아래 항목이 정리되기 전에는 실제 schema/migration 적용을 승인하지 않는다.

| Gate              | 승인 조건                                                        |
| ----------------- | ---------------------------------------------------------------- |
| Schema Gate       | 모델, 관계, enum, index, unique, referential action 검토 완료    |
| Security Gate     | Auth 방식, session shape, STAFF 매장 범위, 고객 마스킹 정책 확정 |
| Migration Gate    | create-only migration SQL 검토 완료                              |
| Seed Gate         | smoke seed와 QA acceptance seed 범위 확정                        |
| Transaction Gate  | 판매/수납/재고/정책 핵심 transaction 테스트 후보 확정            |
| API Contract Gate | Server Action 중심 구조와 `ActionResult` shape 유지              |

## 3. 모델/관계 체크리스트

| 체크 | 항목                                                                                                           | 상태    |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------- |
| [ ]  | draft 모델 구성이 도메인 명세의 핵심 도메인과 모두 대응하는지 확인                                             | Pending |
| [x]  | `Session` 모델 추가 여부 결정: 직접 Credentials + DB-backed opaque session 기준으로 추가 승인                  | Decided |
| [ ]  | `User.storeId` 정책 확정: STAFF 필수 여부, ADMIN nullable 허용 여부                                            | Pending |
| [ ]  | `Customer.status` 또는 비활성/마스킹 필드 추가 여부 결정                                                       | Pending |
| [ ]  | `InventoryItem.assignedUserId`, `Customer.assignedUserId`, `Receivable.assignedUserId`를 `User` FK로 둘지 결정 | Pending |
| [ ]  | `Sale.inventoryItemId String? @unique`가 기기변경/무재고 판매 케이스와 충돌하지 않는지 확인                    | Pending |
| [ ]  | `Receivable.saleId String? @unique`가 수동 미수금과 판매 1건당 미수금 1건 보장을 모두 만족하는지 확인          | Pending |
| [ ]  | `Payment.cancelledAt`, `cancelReason`만으로 수납 취소 이력이 충분한지 확인                                     | Pending |
| [ ]  | 정책 모델의 `version` 보존을 `AuditLog`로 충분히 처리할지, 별도 history 모델이 필요한지 결정                   | Pending |

## 4. 인덱스/Unique 체크리스트

| 체크 | 항목                                                                                                                           | 상태    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ------- |
| [ ]  | `User.email @unique` 유지                                                                                                      | Pending |
| [x]  | `Session.sessionTokenHash @unique` 추가                                                                                        | Decided |
| [x]  | `Session` index 추가: `expiresAt`, `(userId, revokedAt)`                                                                       | Decided |
| [ ]  | `Store.code @unique`, `Carrier.code @unique` 유지                                                                              | Pending |
| [ ]  | `InventoryItem.serialNumber @unique` 유지                                                                                      | Pending |
| [ ]  | 운영상 필요 시 `serialNumber + modelNo` 복합 unique 대안 검토                                                                  | Pending |
| [ ]  | `Sale.orderNo @unique` 유지                                                                                                    | Pending |
| [ ]  | `Sale.inventoryItemId @unique`를 재고 중복 판매 방지 최후 방어선으로 유지                                                      | Pending |
| [ ]  | `Receivable.saleId @unique` 유지                                                                                               | Pending |
| [ ]  | `SaleAddOn(saleId, addOnServiceId) @unique` 유지                                                                               | Pending |
| [ ]  | 문서 권장 인덱스 대비 draft 누락 후보 확인: `Receivable.assignedUserId`, `ManualSchedule.customerId`                           | Pending |
| [ ]  | 목록 필터용 복합 인덱스 검토: `Sale(storeId, soldAt)`, `Receivable(storeId, status, dueDate)`, `Payment(receivableId, paidAt)` | Pending |
| [ ]  | 정책 충돌 검사용 인덱스 검토: `carrierId,status,effectiveFrom,effectiveTo`, `deviceModelId,status`, `subscriptionType,status`  | Pending |

## 5. Referential Action / onDelete 체크리스트

| 체크 | 항목                                                                                                                 | 상태    |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| [ ]  | 모든 relation에 `onDelete` 기본값을 그대로 둘지 금지하고 관계별 정책 명시                                            | Pending |
| [x]  | `Session.user` relation은 `onDelete: Restrict`로 확정                                                                | Decided |
| [ ]  | 판매, 미수금, 수납, AuditLog 관련 FK는 물리 삭제 금지 원칙에 맞춰 `Restrict` 우선 검토                               | Pending |
| [ ]  | 선택 관계인 `salesAgencyId`, `ratePlanId`, `assignedUserId`, `createdById`, `actorUserId`는 `SetNull` 허용 여부 결정 | Pending |
| [ ]  | `SaleAddOn`은 판매 물리 삭제를 허용하지 않는다면 `Cascade` 대신 `Restrict` 또는 상태 전환 기준 검토                  | Pending |
| [ ]  | `Customer` 삭제 대신 비활성/마스킹 처리 원칙을 schema에 반영                                                         | Pending |
| [ ]  | `InventoryItem`이 판매 이력에 연결된 경우 삭제 차단 여부 확인                                                        | Pending |

## 6. Auth / RBAC / 보안 체크리스트

| 체크 | 항목                                                                                             | 상태    |
| ---- | ------------------------------------------------------------------------------------------------ | ------- |
| [x]  | Auth 방식 확정: MVP는 Credentials 직접 구현 + DB-backed opaque session                           | Decided |
| [x]  | session shape 확정: `sessionId`, `userId`, `role`, `storeId`, `status` 포함                      | Decided |
| [x]  | 쿠키 기본 정책 확정: `httpOnly`, production `secure`, `sameSite`                                 | Decided |
| [x]  | `User.passwordHash`는 해시 전용 필드로 유지하고 평문/초기비밀번호 저장 금지                      | Decided |
| [x]  | `Session` 모델 필드 확정: `sessionTokenHash`, `expiresAt`, `revokedAt`, `ipAddress`, `userAgent` | Decided |
| [ ]  | password hashing 알고리즘, cost, salt, 초기 비밀번호/재설정 정책 확정                            | Pending |
| [x]  | 로그인은 `User.status = ACTIVE` 계정만 허용                                                      | Decided |
| [x]  | `User.role`은 `ADMIN/STAFF`만 허용                                                               | Decided |
| [x]  | STAFF는 `/staffs`, `/settings/base`, `/settings/policies`, backup, restore 접근 불가             | Decided |
| [ ]  | STAFF 조회/수정/Export 범위는 소속 매장 기준으로 제한                                            | Pending |
| [x]  | repository 계층에는 권한 판단을 넣지 않고 action/query/service에서 처리                          | Decided |

## 7. 고객 개인정보 / 마스킹 체크리스트

| 체크 | 항목                                                                                                    | 상태    |
| ---- | ------------------------------------------------------------------------------------------------------- | ------- |
| [ ]  | 고객 민감 필드 식별: `name`, `phone`, `birthDate`, `email`, `address`, `identityType`, `identityMasked` | Pending |
| [ ]  | 화면, 상세 Drawer, 검색 결과, Export별 마스킹 정책 확정                                                 | Pending |
| [ ]  | 원본 신분정보 저장 금지 여부 확정. 기본 권고는 `identityMasked`만 저장                                  | Pending |
| [ ]  | 고객 삭제는 물리 삭제가 아니라 비활성/마스킹 처리로 보존                                                | Pending |
| [ ]  | `Customer.storeId` nullable이 STAFF 범위 제한을 약화시키지 않는지 확인                                  | Pending |
| [ ]  | AuditLog `beforeJson`/`afterJson`에 개인정보 원문이 저장되지 않도록 redaction 규칙 확정                 | Pending |
| [ ]  | 원문 Export가 필요하면 ADMIN 전용, 사유 필수, AuditLog 필수로 제한                                      | Pending |

## 8. AuditLog / Export 체크리스트

| 체크 | 항목                                                                                             | 상태    |
| ---- | ------------------------------------------------------------------------------------------------ | ------- |
| [ ]  | AuditLog 대상 확정: 로그인 실패, 판매/미수금/수납/재고/직원/기초정보/정책/백업/복원/Export       | Pending |
| [ ]  | 인증된 민감 작업의 `actorUserId`는 필수, 로그인 실패 같은 예외만 nullable 허용 여부 결정         | Pending |
| [ ]  | AuditLog 삭제 금지 및 장기 보존/아카이브 정책 검토                                               | Pending |
| [ ]  | `beforeJson`/`afterJson`은 전체 레코드 덤프 금지, 민감 필드 제거/마스킹                          | Pending |
| [ ]  | Export API는 세션 확인, 권한 확인, 데이터 범위 제한, AuditLog 기록 필수                          | Pending |
| [ ]  | STAFF Export는 소속 매장 범위로 제한                                                             | Pending |
| [ ]  | 직원/기초정보/정책/백업/복원 Export는 STAFF 금지                                                 | Pending |
| [ ]  | Export AuditLog 필드 확정: actor, type, filters, row count, format, ipAddress, userAgent, reason | Pending |
| [ ]  | 일반 CRUD Route Handler 생성 금지, Server Action 중심 유지                                       | Pending |

## 9. SQLite vs PostgreSQL 체크리스트

| 체크 | 항목                                                                                                   | 상태    |
| ---- | ------------------------------------------------------------------------------------------------------ | ------- |
| [ ]  | 개발 DB는 SQLite, 운영 DB는 PostgreSQL 권장 원칙 유지 여부 확정                                        | Pending |
| [ ]  | provider 전환 전략 문서화                                                                              | Pending |
| [ ]  | `Json` 필드의 SQLite/PostgreSQL 저장, 조회, 검증 차이 문서화                                           | Pending |
| [ ]  | nullable unique 동작 확인: `Sale.inventoryItemId String? @unique`, `Receivable.saleId String? @unique` | Pending |
| [ ]  | 날짜/시간 저장 기준 확정: DB `DateTime`, 화면 `YYYY-MM-DD`, timezone 처리                              | Pending |
| [ ]  | 판매 등록 inventory lock/check는 PostgreSQL transaction/격리 수준 기준으로 리허설                      | Pending |
| [ ]  | enum migration, index naming, FK constraint SQL 차이를 create-only migration 단계에서 비교             | Pending |

## 10. Migration Create-only 체크리스트

| 체크 | 항목                                                                              | 상태      |
| ---- | --------------------------------------------------------------------------------- | --------- |
| [x]  | Prisma 의존성, env, `prisma/schema.prisma` 추가 전 schema review 결론 문서화      | Completed |
| [x]  | `Session` 모델 create-only SQL에서 FK, `Restrict`, unique, index 확인             | Completed |
| [x]  | `prisma migrate dev --create-only --name init`로 SQL만 생성                       | Completed |
| [x]  | 생성 SQL에서 unique/index/relation/onDelete/Json 필드 1차 확인                    | Completed |
| [x]  | 의도치 않은 cascade, nullable FK, destructive change가 있으면 중단                | Completed |
| [x]  | 빈 DB 초기 migration 기준으로만 승인                                              | Completed |
| [ ]  | 기존 DB 대상 destructive change가 생기면 별도 migration/rollback 계획 수립        | Pending   |
| [x]  | rollback 전략 문서화: 개발 DB reset 가능 범위, 운영은 forward-only 보정 migration | Completed |
| [x]  | schema migration과 seed/data backfill 분리                                        | Completed |

## 11. Seed 체크리스트

| 체크 | 항목                                                                                                                          | 상태      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| [x]  | Smoke seed: ADMIN 1명, STAFF 1명 이상, Store 1개                                                                              | Completed |
| [ ]  | Master seed: Carrier, SalesAgency, DeviceModel, Color, RatePlan, AddOnService                                                 | Pending   |
| [ ]  | Inventory seed: 판매 가능 재고와 `IN_STOCK`, `RESERVED`, `SOLD`, `DEFECTIVE` 상태                                             | Pending   |
| [ ]  | Customer seed: 테스트 고객과 소속 매장 범위 검증 데이터                                                                       | Pending   |
| [ ]  | Receivable seed: `NORMAL`, `PARTIAL`, `OVERDUE`, `PAID` 상태별 잔액/수납 합계 일치                                            | Pending   |
| [ ]  | Policy seed: active, scheduled, expired, 충돌 시도용 데이터                                                                   | Pending   |
| [ ]  | QA acceptance seed: 직원 5명 이상, 매장 3개 이상, 통신사 4개, 기종 10개 이상, 재고 50개 이상, 고객 30명 이상, 판매 100건 이상 | Pending   |
| [x]  | 사용자 seed는 password hash만 저장하고 평문 저장 금지                                                                         | Completed |
| [x]  | seed는 반복 실행 시 unique 충돌이 없거나 명확한 초기화 전략을 가짐                                                            | Completed |

## 12. Transaction 테스트 체크리스트

| 체크 | 항목                                                                                                                       | 상태    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| [ ]  | 판매 등록 성공: customer upsert, sale, add-on, inventory status, receivable, schedule, audit log를 한 transaction으로 검증 | Pending |
| [ ]  | 판매 등록 실패 rollback: 재고 없음, 불량 재고, 통신사/요금제 불일치, 대리점 invalid, 금액 규칙 불일치                      | Pending |
| [ ]  | 같은 `inventoryItemId`로 두 판매가 생성되지 않음을 unique 제약과 service 검증으로 확인                                     | Pending |
| [ ]  | 수납 등록: `amount > 0`, `amount <= balanceAmount`, partial/paid 상태 전환, `lastPaymentAt`, audit log 검증                | Pending |
| [ ]  | 수납 취소: 재취소 실패, reason 필수, receivable 금액/상태 재계산, audit log 검증                                           | Pending |
| [ ]  | 정책 활성화: 기간/조건 충돌 차단, 기존 활성 정책 처리, version history 또는 audit 기록 검증                                | Pending |
| [ ]  | 정책 변경 후 과거 판매 금액/스냅샷이 임의 변경되지 않음                                                                    | Pending |
| [ ]  | STAFF 매장 범위 밖 판매/수납/재고 변경은 transaction 진입 전 차단                                                          | Pending |

## 13. 실제 적용 전 필수 명령

Prisma 의존성 및 schema 파일이 추가된 이후에만 실행한다.

```bash
pnpm db:validate
pnpm db:generate
pnpm prisma migrate dev --create-only --name init_schema
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

seed/test 도구가 추가된 뒤에는 아래를 추가한다.

```bash
pnpm seed
pnpm test
```

## 14. 현재 적용 상태

| 영역                                | 상태                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma/`                           | `schema.prisma`, create-only migration 생성                                                                                                                        |
| `.env.example`, `.env`              | 생성. 실제 운영 secret 없음                                                                                                                                        |
| `package.json` Prisma 의존성/script | 추가됨                                                                                                                                                             |
| `src/lib/prisma.ts`                 | Prisma Client wrapper 생성                                                                                                                                         |
| `src/server`                        | `.gitkeep` placeholder 유지                                                                                                                                        |
| `Session` 모델                      | 실제 `prisma/schema.prisma`에 반영                                                                                                                                 |
| DB migration                        | create-only migration 생성 및 실제 `dev.db` 적용 완료. runtime blocker 해소, rollback/test plan 작성, disposable rehearsal, backup/hash gate, final preflight 통과 |
| DB 파일                             | `dev.db` 생성. 업무 table 22개, index 55개, `_prisma_migrations` row 1건 적용                                                                                      |

## 15. Create-only Migration 1차 검토 결과

| 항목               | 결과                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| Migration 파일     | `prisma/migrations/20260430030525_init/migration.sql`                         |
| Migration lock     | `provider = "sqlite"`                                                         |
| 실제 적용 상태     | `pnpm exec prisma migrate status` 기준 pending                                |
| 임시 적용 검증     | 임시 SQLite DB에 raw SQL 및 Prisma `migrate deploy` 적용 성공                 |
| 생성 테이블/인덱스 | table 22개, index 55개                                                        |
| Auth 영향          | auth 구현 없음. `Session` table만 생성 대상                                   |
| API contract 영향  | 없음                                                                          |
| Seed/data backfill | 없음. schema migration과 분리                                                 |
| Rollback 원칙      | 개발 DB는 reset 가능, 운영은 적용 후 migration 수정 금지 및 forward-only 보정 |

주의:

- `Json` 필드는 SQLite migration SQL에서 `JSONB` type name으로 생성된다. 임시 SQLite 적용은 성공했지만, SQLite는 PostgreSQL과 동일한 JSON 검증/연산 의미를 보장하지 않으므로 policy/AuditLog 구현 전 추가 검증이 필요하다.
- `pnpm.onlyBuiltDependencies` 기준 `@prisma/engines`, `prisma`, `better-sqlite3` build script 허용 정책을 적용했다. `pnpm ignored-builds`는 `None`이며, Prisma SQLite adapter runtime connect는 통과한다.
- `dev.db`는 로컬 산출물이므로 `.gitignore`에서 제외한다.

## 16. Migration Apply Final Gate 결과

| 항목             | 결과                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| Gate 결론        | Historical. 이후 backup/final preflight 및 실제 apply 완료                |
| 적용 여부        | 실제 `dev.db` 업무 테이블 migration 적용 완료                             |
| QA 관점          | migration 파일, pending 상태, schema/format/lint/typecheck는 통과         |
| DB reviewer 관점 | runtime blocker는 해소. rollback/test 전략 미정으로 적용 보류             |
| Runtime 연결     | `PrismaBetterSqlite3.connect()` 통과                                      |
| Migration 상태   | `20260430030525_init` pending 유지                                        |
| 업무 테이블 상태 | `dev.db`에는 업무 테이블 없음. `_prisma_migrations` metadata table만 존재 |

적용 전 필수 조치:

1. `ON DELETE SET NULL`이 운영 이력 보존 정책과 충돌하지 않는지 최종 판단
2. SQLite `JSONB` type name은 dev-only 동작으로 기록하고 PostgreSQL 전환 전 별도 review 수행

## 17. Native Build-script Runtime 복구 결과

| 항목            | 결과                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- |
| 적용 정책       | `package.json`의 `pnpm.onlyBuiltDependencies`에 `@prisma/engines`, `better-sqlite3`, `prisma` 명시 |
| Rebuild         | `pnpm rebuild better-sqlite3 --stream`, `pnpm rebuild @prisma/engines prisma --stream` 완료        |
| Ignored builds  | `pnpm ignored-builds` 기준 `None`                                                                  |
| Native binding  | `better-sqlite3/build/Release/better_sqlite3.node` 생성 확인                                       |
| Runtime connect | `@prisma/adapter-better-sqlite3`의 `PrismaBetterSqlite3.connect()` 통과                            |
| Migration 상태  | `20260430030525_init` pending 유지                                                                 |
| DB 적용 여부    | 실제 업무 테이블 migration 적용 없음                                                               |

주의:

- `better-sqlite3`는 pnpm strict dependency 구조에서 루트 직접 dependency가 아니므로 `require("better-sqlite3")` 직접 검증은 실패할 수 있다. 프로젝트 검증 기준은 `@prisma/adapter-better-sqlite3` 경유 runtime connect다.
- Node.js 버전이 바뀌면 `better-sqlite3` native binding은 다시 rebuild가 필요할 수 있다.

## 18. Migration Rollback/Test Plan 결과

| 항목                            | 결과                                                     |
| ------------------------------- | -------------------------------------------------------- |
| Plan 문서                       | `docs/00_system/prisma-migration-rollback-test-plan.md`  |
| 실제 migration 적용             | 미수행                                                   |
| Backup plan                     | `dev.db`, `dev.db-wal`, `dev.db-shm` backup 기준 정의    |
| Disposable DB raw SQL test      | table 22개, index 55개 기준 정의                         |
| Disposable DB Prisma apply test | 임시 `DATABASE_URL` 기준 정의                            |
| Unique/FK/JSON smoke            | index, FK, JSON round-trip 기준 정의                     |
| Post-apply validation           | status, catalog, migration row, runtime, build 검증 정의 |
| Failure recovery                | 적용 전/리허설/개발 DB 적용 중 실패 절차 정의            |
| Production policy               | reset 금지, forward-only 보정 migration 원칙 정의        |

다음 migration apply 전 필수 gate:

- 개발 DB backup 생성
- DB reviewer와 QA reviewer apply 승인

완료된 gate:

- migration file hash 기록
- disposable DB raw SQL apply test 통과
- disposable DB Prisma apply test 통과
- unique/FK/JSON smoke 기준 통과

## 19. Disposable DB Migration Apply Rehearsal 결과

| 항목                      | 결과                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| 수행일                    | 2026-04-30                                                                                                                                                        |
| 실제 `dev.db` 적용        | 미수행                                                                                                                                                            |
| `dev.db` hash             | 리허설 전후 `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` 동일                                                                               |
| `dev.db` size             | 리허설 전후 `12288` bytes 동일                                                                                                                                    |
| `dev.db` LastWriteTimeUtc | 리허설 전후 `2026-04-30T03:05:25.0512116Z` 동일                                                                                                                   |
| `dev.db` catalog          | `_prisma_migrations` only                                                                                                                                         |
| `_prisma_migrations` rows | 리허설 전후 `0` 유지                                                                                                                                              |
| WAL/SHM                   | 리허설 전후 없음                                                                                                                                                  |
| Migration hash            | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`                                                                                                |
| Raw SQL temp apply        | table 22개, index 55개                                                                                                                                            |
| Prisma temp apply         | `migrate deploy` exit 0                                                                                                                                           |
| Prisma temp status        | `migrate status` exit 0, schema up to date                                                                                                                        |
| Temp business tables      | 22개                                                                                                                                                              |
| Temp indexes              | 55개                                                                                                                                                              |
| Temp migration row        | `20260430030525_init                                                                                                                                              | FINISHED | NOT_ROLLED_BACK` |
| Integrity check           | `ok`                                                                                                                                                              |
| FK check                  | 결과 없음                                                                                                                                                         |
| JSONB columns             | 6개                                                                                                                                                               |
| JSON smoke                | `json_valid = 1`, test row 삭제 후 0건                                                                                                                            |
| 핵심 unique/index         | `InventoryItem_serialNumber_key`, `Sale_inventoryItemId_key`, `Receivable_saleId_key`, `SaleAddOn_saleId_addOnServiceId_key`, `Session_sessionTokenHash_key` 확인 |
| Temp DB cleanup           | 삭제 완료                                                                                                                                                         |

결론:

- disposable DB 기준 migration apply rehearsal은 통과했다.
- 실제 `dev.db`는 schema, migration metadata, hash, size, timestamp 모두 변경되지 않았다.
- 실제 개발 DB 적용은 apply 직전 hash/status 재확인 후 DB reviewer와 QA reviewer 승인 하에 진행한다.

## 20. Dev DB Pre-apply Backup/Hash Gate 결과

| 항목                      | 결과                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| 수행일                    | 2026-04-30                                                         |
| 실제 migration 적용       | 미수행                                                             |
| Backup file               | `dev.db.pre-init-20260430132108.bak`                               |
| Source hash before/after  | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Backup hash               | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Source/backup hash match  | `True`                                                             |
| Source hash unchanged     | `True`                                                             |
| Source/backup size        | `12288` bytes                                                      |
| Source LastWriteTimeUtc   | `2026-04-30T03:05:25.0512116Z` unchanged                           |
| `dev.db` catalog          | `_prisma_migrations` only                                          |
| `_prisma_migrations` rows | `0`                                                                |
| Business tables           | `0`                                                                |
| WAL/SHM                   | 없음                                                               |
| Migration SQL hash        | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452` |

결론:

- 실제 `dev.db` 적용 전 복구 지점은 확보되었다.
- `dev.db`는 여전히 metadata-only 상태이며 migration은 pending이다.
- 실제 migration apply는 별도 작업에서 DB/QA reviewer 승인 후 진행한다.

## 21. Actual Apply Final Preflight 결과

| 항목                      | 결과                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| 수행일                    | 2026-04-30                                                         |
| 실제 migration 적용       | 미수행                                                             |
| Target DB                 | `.env` 기준 `DATABASE_URL="file:./dev.db"`                         |
| `dev.db` hash             | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Backup hash               | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Backup file               | `dev.db.pre-init-20260430132108.bak`                               |
| Migration SQL hash        | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452` |
| Prisma schema hash        | `EA2EB120E6B6930508482750E3234EFB8B40B4FCC305CD98470849AF6E19F8F5` |
| Migration status          | `20260430030525_init` pending. Exit code `1` is expected           |
| `dev.db` catalog          | `_prisma_migrations` only                                          |
| `_prisma_migrations` rows | `0`                                                                |
| Business tables           | `0`                                                                |
| Index count               | `0`                                                                |
| WAL/SHM                   | 없음                                                               |
| SQLite quick check        | `ok`                                                               |
| Journal mode              | `delete`                                                           |
| Page count / size         | `3` / `4096`                                                       |
| Build scripts             | `pnpm ignored-builds` = `None`                                     |
| Schema validation         | 통과                                                               |
| Prisma Client generation  | 통과                                                               |
| Runtime connect           | 통과                                                               |

결론:

- 실제 apply 직전 final preflight는 `PASS`다.
- 실제 migration apply는 아직 수행하지 않았다.
- 다음 작업에서 같은 핵심값을 재확인한 뒤 `pnpm db:migrate`를 진행할 수 있다.

## 22. Actual Dev DB Migration Apply 결과

| 항목                    | 결과                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| 수행일                  | 2026-04-30                                                                     |
| Apply command           | `pnpm db:migrate`                                                              |
| Apply result            | `20260430030525_init` applied, exit 0                                          |
| Migration status        | schema up to date, exit 0                                                      |
| Backup file             | `dev.db.pre-init-20260430132108.bak`                                           |
| Backup hash             | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`             |
| Post-validation DB hash | `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`             |
| Migration SQL hash      | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`             |
| Business tables         | `22`                                                                           |
| All non-sqlite tables   | `23`                                                                           |
| Index count             | `55`                                                                           |
| Migration row           | `20260430030525_init\|FINISHED\|NOT_ROLLED_BACK`                               |
| Integrity / FK          | `integrity_check=ok`, `foreign_key_check=0`                                    |
| Core tables             | `AuditLog`, `InventoryItem`, `Receivable`, `Sale`, `Session`, `User`           |
| Core unique/index       | 5개 확인                                                                       |
| JSONB columns           | `6`                                                                            |
| JSON smoke              | insert/json_valid/delete 통과, test row `0`건                                  |
| Business table rows     | 전체 22개 업무 table 모두 `0`건                                                |
| Prisma diff             | DB to schema, migrations to DB 모두 `No difference detected`                   |
| Runtime/build           | Prisma Client generate, validate, adapter connect, lint, typecheck, build 통과 |

주의:

- post-apply 직후 hash `AC6A3E50000F1033BC2573835AC5D9D56DDC80692B5E54A6CBEEBBDE04FFCF0C`는 이후 JSON smoke insert/delete 검증으로 변경되었다.
- JSON smoke 후 잔여 row는 없고 schema drift도 없으므로 `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`을 post-validation 기준 hash로 기록한다.
- 이 승인 범위는 개발 SQLite 초기 migration 적용에 한정한다. 운영 PostgreSQL, seed, auth, transaction 로직 승인이 아니다.

## 23. Smoke/Auth Seed Policy 결과

| 항목            | 결과                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| 수행일          | 2026-04-30                                                                 |
| Policy 문서     | `docs/00_system/smoke-auth-seed-policy.md`                                 |
| Seed scope      | `Store` 1개, `ADMIN` 1명, `STAFF` 1명으로 제한                             |
| Upsert key      | `Store.code`, `User.email`                                                 |
| Password policy | 평문/정적 hash 저장 금지. 실행 시 shared password hash helper로 생성       |
| Session policy  | `Session` row seed 금지. 세션은 login flow에서만 생성                      |
| Excluded data   | sale, payment, receivable, inventory, customer, policy, AuditLog seed 제외 |
| DB 변경         | 당시 없음. 이후 smoke seed 구현으로 `Store=1`, `User=2` 생성 완료          |
| Auth/API 변경   | 당시 없음. 이후 password hash helper 추가, API contract 변경 없음          |
| 다음 작업       | auth/session 구현 preflight 및 실제 login/RBAC 구현 준비                   |

주의:

- 이 결과는 seed 구현 전 정책 승인으로 작성되었다. 이후 동일 정책 기준으로 smoke/auth seed script를 구현했다.
- Spark와 mini는 seed/auth/session/RBAC/password/DB 구현에 사용하지 않는다.

## 24. Smoke/Auth Seed Implementation 결과

| 항목               | 결과                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| 수행일             | 2026-04-30                                                                |
| Seed script        | `prisma/seed.ts`                                                          |
| Seed command       | `pnpm db:seed`, `pnpm seed`                                               |
| Seed runner        | `tsx`                                                                     |
| Password helper    | `src/lib/auth/password.ts`                                                |
| Password algorithm | Node `crypto.scrypt`, random salt, strict parser, timing-safe verify      |
| Seed rows          | `Store=1`, smoke `User=2`                                                 |
| Idempotency        | seed 재실행 후 `Store=1`, smoke `User=2`, password hash 불변              |
| Excluded rows      | `Session`, sale/payment/receivable/inventory/customer/policy/AuditLog 0건 |
| Schema/migration   | 변경 없음                                                                 |
| API contract       | 변경 없음                                                                 |
| Validation         | format, db validate/generate, migrate status, lint, typecheck, build 통과 |

주의:

- 이 seed는 smoke/auth 계정 확인용 최소 seed다. master data, inventory, customer, sale, receivable, policy, QA acceptance seed는 아직 구현하지 않았다.
- Password helper는 seed와 향후 auth 구현을 위한 최소 helper다. 실제 login/session/RBAC flow는 아직 구현하지 않았다.
