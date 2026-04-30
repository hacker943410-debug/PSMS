# Prisma Migration Rollback and Test Plan

작성일: 2026-04-30

## 1. 목적

`prisma/migrations/20260430030525_init/migration.sql`을 실제 개발 DB에 적용하기 전에 필요한 rollback, backup, disposable DB test, post-apply validation 절차를 정의한다.

이번 문서는 실행 계획으로 시작했으며, 2026-04-30 기준 실제 개발 DB migration 적용 결과까지 함께 기록한다.

## 2. 현재 상태

| 항목                      | 상태                                          |
| ------------------------- | --------------------------------------------- |
| Prisma                    | 7.8.0                                         |
| 개발 DB                   | SQLite `dev.db`                               |
| Migration                 | `20260430030525_init` applied                 |
| Runtime                   | `@prisma/adapter-better-sqlite3` connect 통과 |
| pnpm build script         | `pnpm ignored-builds` 기준 `None`             |
| 현재 DB table             | 업무 table 22개 + `_prisma_migrations`        |
| `_prisma_migrations` rows | `1`                                           |
| 예상 업무 테이블          | 22개                                          |
| 예상 index                | 55개                                          |
| Json SQL type name        | `JSONB` 6개                                   |
| Disposable rehearsal      | 통과. 실제 `dev.db` 미변경                    |
| Pre-apply backup          | 통과. `dev.db.pre-init-20260430132108.bak`    |
| Final preflight           | 통과. 실제 migration apply 미수행             |
| Actual apply              | 통과. `pnpm db:migrate` 완료                  |

## 3. 범위

포함:

- 개발 DB 적용 전 backup/reset 기준
- disposable SQLite DB 적용 리허설
- 실제 적용 후 catalog/status/runtime 검증
- 실패 시 복구 절차
- 운영 DB rollback 원칙

제외:

- 실제 `pnpm db:migrate` 실행
- seed 작성
- auth/session 구현
- API contract 변경
- PostgreSQL production migration 작성

## 4. Pre-apply Gate

아래 항목이 모두 통과해야 실제 개발 DB migration을 적용한다.

| Gate             | 명령/확인                                                          | 통과 기준                      |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| Target DB        | `Get-Content .env`                                                 | `DATABASE_URL="file:./dev.db"` |
| Build scripts    | `pnpm ignored-builds`                                              | `None`                         |
| Prisma schema    | `pnpm db:validate`                                                 | 통과                           |
| Prisma Client    | `pnpm db:generate`                                                 | 통과                           |
| Runtime          | `PrismaBetterSqlite3.connect()`                                    | 통과                           |
| Migration status | `pnpm exec prisma migrate status`                                  | `20260430030525_init` pending  |
| DB catalog       | `sqlite3 dev.db ".tables"`                                         | `_prisma_migrations`만 존재    |
| Migration rows   | `SELECT COUNT(*) FROM _prisma_migrations;`                         | `0`                            |
| Migration hash   | `Get-FileHash prisma\migrations\20260430030525_init\migration.sql` | disposable test 전후 동일      |
| SQL shape        | `migration.sql` 집계                                               | table 22개, index 55개         |

`migrate status`는 pending migration이 있으면 exit code 1을 반환할 수 있다. 이 단계에서는 pending 상태가 기대 결과다.

## 5. Backup Plan

개발 DB 적용 직전에 로컬 백업을 생성한다. WAL/SHM 파일이 생긴 경우 함께 보존한다.

```powershell
$stamp = Get-Date -Format "yyyyMMddHHmmss"
Copy-Item -LiteralPath ".\dev.db" -Destination ".\dev.db.pre-init-$stamp.bak" -ErrorAction Stop
if (Test-Path ".\dev.db-wal") { Copy-Item -LiteralPath ".\dev.db-wal" -Destination ".\dev.db-wal.pre-init-$stamp.bak" -ErrorAction Stop }
if (Test-Path ".\dev.db-shm") { Copy-Item -LiteralPath ".\dev.db-shm" -Destination ".\dev.db-shm.pre-init-$stamp.bak" -ErrorAction Stop }
Get-FileHash ".\dev.db", ".\dev.db.pre-init-$stamp.bak"
```

통과 기준:

- backup file exists
- source와 backup hash가 백업 시점에 일치
- 현재 상태 기록: `_prisma_migrations` only, row count 0, business table 0

백업 원칙:

- 이 백업은 개발 DB 전용이다.
- 운영 DB rollback 모델로 사용하지 않는다.
- 운영에서는 적용된 migration을 수정하지 않고 forward-only 보정 migration을 작성한다.

### 5.1 Backup Gate Result

2026-04-30에 실제 `dev.db` 적용 전 backup/hash gate를 수행했다.

| 항목                      | 결과                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| 실제 migration 적용       | 미수행                                                             |
| Backup file               | `dev.db.pre-init-20260430132108.bak`                               |
| Source hash before/after  | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Backup hash               | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| Source/backup hash match  | `True`                                                             |
| Source/backup size        | `12288` bytes                                                      |
| Source LastWriteTimeUtc   | `2026-04-30T03:05:25.0512116Z` unchanged                           |
| `dev.db` catalog          | `_prisma_migrations` only                                          |
| `_prisma_migrations` rows | `0`                                                                |
| Business tables           | `0`                                                                |
| WAL/SHM                   | 없음                                                               |
| Migration SQL hash        | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452` |

이 gate는 실제 개발 DB migration 적용 직전 복구 지점을 확보하기 위한 것이다.

### 5.2 Actual Apply Final Preflight Result

2026-04-30에 실제 `dev.db` migration 적용 직전 final preflight를 수행했다. 실제 migration apply는 수행하지 않았다.

| 항목                      | 결과                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Target DB                 | `.env` 기준 `DATABASE_URL="file:./dev.db"`                                         |
| 실제 migration apply      | 미수행                                                                             |
| `dev.db` hash             | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`                 |
| Backup hash               | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`                 |
| Backup file               | `dev.db.pre-init-20260430132108.bak`                                               |
| Migration SQL hash        | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`                 |
| Prisma schema hash        | `EA2EB120E6B6930508482750E3234EFB8B40B4FCC305CD98470849AF6E19F8F5`                 |
| Migration status          | `20260430030525_init` pending. Exit code `1` is expected                           |
| `dev.db` catalog          | `_prisma_migrations` only                                                          |
| `_prisma_migrations` rows | `0`                                                                                |
| Business tables           | `0`                                                                                |
| Index count               | `0`                                                                                |
| WAL/SHM                   | 없음                                                                               |
| SQLite quick check        | `ok`                                                                               |
| Journal mode              | `delete`                                                                           |
| Page count / size         | `3` / `4096`                                                                       |
| Build scripts             | `pnpm ignored-builds` = `None`                                                     |
| Prisma schema validation  | `pnpm db:validate`, `pnpm exec prisma validate --schema prisma/schema.prisma` 통과 |
| Prisma Client generation  | `pnpm db:generate` 통과                                                            |
| Runtime connect           | `PrismaBetterSqlite3.connect()` 통과                                               |

판정:

- Final preflight는 `PASS`다.
- 다음 작업에서 실제 migration apply를 진행할 수 있다.
- 단, 실제 apply 명령 직전 같은 preflight 핵심값이 변하지 않았는지 다시 확인한다.

## 6. Disposable DB Test Plan

실제 `dev.db`에 적용하기 전에 disposable SQLite DB에서 migration을 검증한다.

### 6.1 Raw SQL Apply Test

```powershell
$tempDb = ".\tmp_migration_apply_test.db"
if (Test-Path -LiteralPath $tempDb) { Remove-Item -LiteralPath $tempDb -Force }
Get-Content -Raw ".\prisma\migrations\20260430030525_init\migration.sql" | sqlite3 $tempDb
sqlite3 $tempDb "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
sqlite3 $tempDb "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';"
Remove-Item -LiteralPath $tempDb -Force
```

통과 기준:

- table count: `22`
- index count: `55`
- sqlite error 없음

### 6.2 Prisma Apply Test With Temporary URL

```powershell
$oldDatabaseUrl = $env:DATABASE_URL
$tempDb = ".\tmp_prisma_migrate_test.db"
if (Test-Path -LiteralPath $tempDb) { Remove-Item -LiteralPath $tempDb -Force }

# Prisma 7.8 SQLite schema engine 경로에서는 임시 DB 파일을 먼저 생성한다.
sqlite3 $tempDb "VACUUM;"

$env:DATABASE_URL = "file:./tmp_prisma_migrate_test.db"
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status
sqlite3 tmp_prisma_migrate_test.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations';"
sqlite3 tmp_prisma_migrate_test.db "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';"
if ($null -eq $oldDatabaseUrl) { Remove-Item Env:\DATABASE_URL } else { $env:DATABASE_URL = $oldDatabaseUrl }
Remove-Item -LiteralPath $tempDb -Force
```

통과 기준:

- migration applied clean
- no additional migration generated
- business table count: `22`
- index count: `55`
- `migrate status` clean

`migrate deploy`를 사용한다. 이번 검증은 이미 생성된 migration 파일을 non-interactive로 적용하는 rehearsal이며, 추가 migration 생성이 목적이 아니다.

### 6.3 Disposable DB Rehearsal Result

2026-04-30에 disposable DB 기준 apply rehearsal을 수행했다.

| 항목               | 결과                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| 실제 `dev.db` 적용 | 미수행                                                                        |
| Raw SQL apply      | table 22개, index 55개                                                        |
| Prisma apply       | `pnpm exec prisma migrate deploy` exit 0                                      |
| Prisma status      | `pnpm exec prisma migrate status` exit 0, schema up to date                   |
| Migration row      | `20260430030525_init\|FINISHED\|NOT_ROLLED_BACK`                              |
| Integrity check    | `ok`                                                                          |
| FK check           | 결과 없음                                                                     |
| JSONB columns      | 6개                                                                           |
| JSON smoke         | `json_valid = 1`, test row 삭제 후 0건                                        |
| 핵심 unique/index  | 5개 확인                                                                      |
| Temp DB cleanup    | 삭제 완료                                                                     |
| `dev.db` hash      | 전후 동일: `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02` |
| `dev.db` row count | `_prisma_migrations` 0건 유지                                                 |
| `dev.db` WAL/SHM   | 생성 없음                                                                     |

이 결과는 실제 개발 DB 적용 전 rehearsal gate 통과를 의미한다. 실제 `dev.db` 적용은 backup/hash gate와 DB/QA 승인 후 별도 작업으로 진행한다.

## 7. Constraint Validation Plan

Disposable DB 또는 migration 적용 후 아래를 확인한다.

### 7.1 Unique / Index

```sql
PRAGMA index_list('InventoryItem');
PRAGMA index_list('Sale');
PRAGMA index_list('Receivable');
PRAGMA index_list('SaleAddOn');
PRAGMA index_list('Session');
```

통과 기준:

- `InventoryItem_serialNumber_key`
- `Sale_inventoryItemId_key`
- `Receivable_saleId_key`
- `SaleAddOn_saleId_addOnServiceId_key`
- `Session_sessionTokenHash_key`

### 7.2 Foreign Key

```sql
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_list('Sale');
PRAGMA foreign_key_list('Payment');
PRAGMA foreign_key_list('Receivable');
PRAGMA foreign_key_list('Session');
PRAGMA foreign_key_check;
```

통과 기준:

- FK list가 비어 있지 않음
- `PRAGMA foreign_key_check` 결과 없음

### 7.3 JSON Field Smoke Test

SQLite는 `JSONB` type name을 허용하지만 PostgreSQL JSONB와 같은 의미를 보장하지 않는다. 정책/AuditLog 로직 전에는 application-level Zod validation을 추가한다.

Disposable DB에서만 아래 smoke test를 수행할 수 있다.

```sql
INSERT INTO "SaleProfitPolicy" (
  "id",
  "name",
  "status",
  "version",
  "effectiveFrom",
  "priority",
  "ruleJson",
  "createdAt",
  "updatedAt"
) VALUES (
  'policy_json_test',
  'JSON Smoke Test',
  'INACTIVE',
  'test',
  CURRENT_TIMESTAMP,
  100,
  '{"ok":true}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

SELECT json_valid("ruleJson") FROM "SaleProfitPolicy" WHERE "id" = 'policy_json_test';

DELETE FROM "SaleProfitPolicy" WHERE "id" = 'policy_json_test';
```

통과 기준:

- `json_valid` returns `1`
- insert/delete smoke test 후 잔여 데이터 없음

## 8. Actual Dev Apply Plan

사전 gate와 disposable DB test가 모두 통과한 뒤에만 실제 개발 DB에 적용한다.

```powershell
pnpm db:migrate
pnpm exec prisma migrate status
pnpm db:generate
```

적용 후 catalog 검증:

```powershell
sqlite3 dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations';"
sqlite3 dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';"
sqlite3 dev.db "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations;"
```

통과 기준:

- business table count: `22`
- index count: `55`
- `_prisma_migrations`에 `20260430030525_init` 기록
- `rolled_back_at` is null

## 9. Runtime Validation After Apply

```powershell
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm build
```

Prisma adapter runtime check:

```powershell
node --input-type=module -e "import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'; const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' }); const conn = await adapter.connect(); console.log('connect ok'); if (conn.dispose) await conn.dispose();"
```

### 9.1 Actual Apply Result

2026-04-30에 실제 `dev.db` migration apply를 수행했다.

| 항목                    | 결과                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| Apply command           | `pnpm db:migrate`                                                          |
| Apply result            | `20260430030525_init` applied, exit 0                                      |
| Migration status        | schema up to date, exit 0                                                  |
| Backup file             | `dev.db.pre-init-20260430132108.bak`                                       |
| Backup hash             | `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`         |
| Post-validation DB hash | `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`         |
| Migration SQL hash      | `45A3A5AA49DD72569DC2EBE07F29FEC490B939B42CB360C7C10C71D700A0A452`         |
| Business tables         | `22`                                                                       |
| All non-sqlite tables   | `23`                                                                       |
| Index count             | `55`                                                                       |
| Migration row           | `20260430030525_init\|FINISHED\|NOT_ROLLED_BACK`                           |
| Integrity/FK            | `integrity_check=ok`, `foreign_key_check=0`                                |
| JSON smoke              | insert/json_valid/delete 통과, test row `0`건                              |
| Business table rows     | 전체 22개 업무 table 모두 `0`건                                            |
| Prisma diff             | DB to schema, migrations to DB 모두 `No difference detected`               |
| Runtime/build           | `db:generate`, `db:validate`, adapter connect, lint, typecheck, build 통과 |

Hash note:

- 적용 직후 DB hash는 `AC6A3E50000F1033BC2573835AC5D9D56DDC80692B5E54A6CBEEBBDE04FFCF0C`로 관측되었다.
- 이후 JSON smoke insert/delete 검증으로 SQLite 파일 hash가 `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`로 변경되었다.
- test row는 삭제되었고 모든 업무 table row count는 0이며, Prisma diff도 clean이므로 post-validation hash를 기준값으로 기록한다.

## 10. Failure Recovery Plan

### 적용 전 실패

- migration을 적용하지 않는다.
- 오류 로그를 `docs/80_ai_harness` 완료 보고에 기록한다.
- schema 또는 package 변경이 필요하면 별도 gate를 연다.

### disposable DB 테스트 실패

- disposable DB 파일을 삭제한다.
- 실제 `dev.db`에는 적용하지 않는다.
- migration SQL 또는 schema 문제를 DB review로 되돌린다.

### 개발 DB 적용 중 실패

1. 즉시 추가 migration 적용을 중단한다.
2. 실패한 `dev.db`를 별도 파일로 보존한다.
3. 적용 전 생성한 `dev.db.pre-init-*.bak`를 `dev.db`로 복원한다.
4. `pnpm exec prisma migrate status`로 pending 상태를 확인한다.
5. 원인 분석 후 새 계획을 작성한다.

### 개발 DB reset 허용 조건

아래 조건을 모두 만족할 때만 `prisma migrate reset`을 고려한다.

- 개발 DB에 보존해야 할 실제 운영 데이터가 없음
- 사용자 승인 또는 명시적 작업 요청이 있음
- seed 전략이 있거나 빈 DB로 재시작해도 문제가 없음

운영 DB에서는 reset을 사용하지 않는다.

## 11. Production Policy

운영 PostgreSQL 전환 전에는 별도 production migration review가 필요하다.

운영 원칙:

- 적용된 migration 파일은 수정하지 않는다.
- rollback은 DB reset이 아니라 forward-only 보정 migration으로 처리한다.
- `prisma migrate deploy`는 CI/CD에서 non-interactive로 수행한다.
- JSON, enum, FK, index, transaction 동작은 PostgreSQL 기준으로 재검토한다.

## 12. Open Risks

| 리스크                                        | 영향도 | 대응                                                             |
| --------------------------------------------- | -----: | ---------------------------------------------------------------- |
| SQLite `JSONB` type name                      | Medium | 정책/AuditLog 구현 전 Zod validation과 PostgreSQL review         |
| SQLite enum/JSON schema 미강제                | Medium | service-level Zod validation                                     |
| `ON DELETE SET NULL` operational history link |   High | physical delete 금지 service rule 또는 referential action 재검토 |
| 판매/재고 동시성                              |   High | sale transaction 테스트에서 inventory lock/check 검증            |
| 수납/미수금 잔액                              |   High | service transaction 테스트에서 재계산 검증                       |
| 아직 seed 없음                                | Medium | migration 적용 후 smoke seed 전략 작성                           |

## 13. Apply Approval Criteria

다음 조건을 모두 만족하여 실제 개발 DB migration 적용을 완료했다.

- `pnpm ignored-builds` = `None`
- Prisma adapter runtime connect 통과
- `pnpm db:validate` 통과
- migration status pending 확인
- migration file hash 기록
- DB reviewer와 QA reviewer가 apply를 승인

현재 완료:

- disposable DB raw SQL apply test 통과
- disposable DB Prisma apply test 통과
- unique/FK/JSON smoke 기준 통과
- 개발 DB backup 파일 생성 완료
- actual apply final preflight 통과

남은 다음 gate:

- smoke seed 전략 수립
- auth seed/password hash 정책 수립
- 판매/수납/재고/정책 transaction 테스트 계획 수립
