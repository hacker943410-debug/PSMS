# PostgreSQL Prisma Profile Preflight

작성일: 2026-05-08

## 목적

PSMS의 현재 Prisma runtime은 SQLite local/Electron runtime을 기준으로 구성되어 있다.
credential compensation cleanup의 PostgreSQL rehearsal을 실행하려면 PostgreSQL provider,
generated client, driver adapter, migration rehearsal을 별도 profile로 준비해야 한다.

이 문서는 PostgreSQL profile/client를 추가하기 전 반드시 지켜야 할 분리 원칙과 PASS/BLOCK
기준을 정의한다. 현재 slice는 production PostgreSQL runtime을 구현하지 않고, preflight
gate만 고정한다.

## 현재 상태

| 항목                                    | 상태               | 근거                                                          |
| --------------------------------------- | ------------------ | ------------------------------------------------------------- |
| 기본 datasource                         | SQLite             | `packages/db/prisma/schema.prisma`의 `provider = "sqlite"`    |
| 기본 runtime adapter                    | better-sqlite3     | `packages/db/src/client.ts`의 `PrismaBetterSqlite3`           |
| 기본 generated client                   | SQLite schema 기반 | `packages/db/src/generated/prisma`                            |
| PostgreSQL schema/config scaffold       | 있음               | `schema.postgresql.prisma`, `prisma.postgresql.config.ts`     |
| PostgreSQL runtime                      | 없음               | `@prisma/adapter-pg`, `pg`, generated client, migrations 없음 |
| PostgreSQL credential cleanup readiness | BLOCK              | PG runtime/client/migration/DB evidence 없음                  |

## 설계 원칙

| 원칙                     | 내용                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| SQLite 기본 runtime 보존 | `@psms/db`의 기존 `prisma`, `createPrismaClient`, generated client export는 SQLite local runtime을 유지한다 |
| PostgreSQL profile 격리  | PG rehearsal은 별도 schema/config/generated client/runtime entrypoint를 사용한다                            |
| 도메인 schema 변경 금지  | 이 preflight는 domain model 변경, migration 변경, production client 전환을 하지 않는다                      |
| DSN redaction            | command output, release artifact, test output에 full PostgreSQL DSN을 남기지 않는다                         |
| disposable DB only       | rehearsal은 운영 DB가 아닌 disposable PostgreSQL DB에서만 수행한다                                          |
| manual approval          | DB/security/release reviewer 승인 전 PG profile은 PASS가 아니다                                             |

## 권장 파일 구조

PostgreSQL profile 구현 slice에서 아래 구조를 검토한다.

| 파일/경로                                                                | 역할                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.postgresql.prisma`                            | SQLite schema와 동등한 PostgreSQL provider schema 후보                                |
| `packages/db/prisma.postgresql.config.ts`                                | `schema.postgresql.prisma`, PG migrations path, `PSMS_PG_REHEARSAL_DATABASE_URL` 사용 |
| `packages/db/src/generated/postgresql-prisma`                            | SQLite generated client와 분리된 PG generated client                                  |
| `packages/db/src/postgresql-client.ts`                                   | `@prisma/adapter-pg` 기반 disposable rehearsal client                                 |
| `packages/db/prisma/postgresql-migrations`                               | PG migration rehearsal output. domain approval 전 production migration으로 쓰지 않음  |
| `test/integration/postgresql/credential-compensation-cleanup.pg.test.ts` | env-gated PG rehearsal test 후보                                                      |

기본 `packages/db/src/index.ts`는 이 preflight 단계에서 PG client를 export하지 않는다. PG profile이
승인되기 전까지 앱 runtime이 실수로 PG client를 import할 수 없게 한다.

현재 scaffold integrity는 아래 명령으로 확인한다.

```powershell
pnpm pg:profile:preflight
pnpm db:validate:pg-schema
pnpm test:unit:postgresql-profile-preflight
```

`pnpm pg:profile:preflight`가 `ok: true`를 반환해도 `readiness: "BLOCK"`이면 PostgreSQL
execution readiness는 PASS가 아니다. 이 scaffold는 PG dependency, generated client, migrations가
없는 상태를 의도적으로 BLOCK으로 보고한다.

PostgreSQL release candidate에서는 아래 명령이 PASS해야 한다. 현재 scaffold 단계에서는
fail-closed로 실패하는 것이 정상이다.

```powershell
pnpm pg:profile:require-readiness
```

## Runtime / Dependency 후보

Prisma ORM 7 driver adapter 방식에서는 PostgreSQL runtime에 `@prisma/adapter-pg`와 `pg`
기반 adapter가 필요하다. 구현 slice에서는 다음 dependency를 별도 review 대상으로 둔다.

```json
{
  "@prisma/adapter-pg": "<same Prisma minor as @prisma/client>",
  "pg": "<approved compatible version>"
}
```

dependency 추가는 이 preflight 범위가 아니다. 추가 전에는 lockfile diff, package build,
Windows local runner, artifact secret scan을 함께 확인한다.

## Environment Naming

| 변수                                   | 용도                                         |
| -------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                         | 기존 SQLite runtime 유지                     |
| `PSMS_PG_REHEARSAL_DATABASE_URL`       | disposable PostgreSQL rehearsal 전용         |
| `PSMS_PG_REHEARSAL_ARTIFACT_DIR`       | redacted command/evidence artifact 출력 위치 |
| `PSMS_PG_REHEARSAL_ALLOW_CONFIRM=true` | destructive confirm rehearsal 명시 opt-in    |

`DATABASE_URL`에 PostgreSQL DSN을 넣어 기본 app/API runtime을 전환하지 않는다. PG rehearsal은
반드시 `PSMS_PG_REHEARSAL_DATABASE_URL` 또는 명시적 `--database-url` + PG-capable entrypoint를
사용한다.

## CLI / API 영향

| 영역                         | 원칙                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| Fastify public API           | 변경 없음                                                                   |
| shared schema / ActionResult | 변경 없음                                                                   |
| cleanup service              | `PrismaClient` compatible client를 인자로 받는 현재 형태 유지               |
| root ops command             | SQLite build에서는 non-SQLite URL fail-closed 유지                          |
| PG-capable command           | 별도 script 또는 explicit `--profile postgresql` 방식만 허용                |
| seed/reset scripts           | 기존 SQLite seed/reset을 건드리지 않음. PG seed는 disposable rehearsal 전용 |

PG generated client가 추가되면 `@psms/db`는 provider-neutral application type 후보를 검토한다.
예: `AppPrismaClient`, `AppDbClient`. 서비스/리포지토리는 direct generated-client path 대신
이 facade type을 사용하고, cleanup service처럼 root client를 주입받는 형태를 유지한다.
public API route와 shared `ActionResult` contract는 provider 전환과 무관하게 유지한다.

## Migration Rehearsal Gate

PostgreSQL profile 구현 전에는 아래가 모두 BLOCK이다.

| Gate             | PASS 조건                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ |
| schema parity    | SQLite schema와 model/enum/relation/index 동등성 diff 검토                           |
| generated client | PG generated client가 SQLite generated client를 덮어쓰지 않음                        |
| migration apply  | disposable PG DB에 clean apply                                                       |
| migration status | apply 후 clean status                                                                |
| JSON fields      | `AuditLog.beforeJson/afterJson`, policy `ruleJson` 저장/조회 검증                    |
| nullable unique  | `UserPasswordToken.activeKey`, nullable unique relation fields behavior 확인         |
| domain unique    | `InventoryItem.serialNumber`, `Sale.inventoryItemId`, `Receivable.saleId` 검증       |
| transaction      | cleanup revoke + AuditLog rollback, expected-count mismatch, concurrent confirm 검증 |
| redaction        | artifact/log secret scan 통과                                                        |

## PASS / BLOCK 판정

PASS:

- PG schema/config/generated client/runtime entrypoint가 SQLite runtime과 분리되어 있다.
- disposable PostgreSQL migration apply/status가 통과한다.
- `UserPasswordToken.activeKey`, `Sale.inventoryItemId`, `Receivable.saleId` nullable unique와
  `InventoryItem.serialNumber` global unique behavior가 PostgreSQL에서 검증된다.
- credential cleanup PG rehearsal profile의 dry-run/confirm/negative case가 통과한다.
- artifact에는 full DSN, username/password, tokenHash, raw token, URL, password, Cookie,
  Authorization이 없다.
- DB/security/release reviewer가 승인한다.

BLOCK:

- 기본 `DATABASE_URL`을 PG DSN으로 바꿔 SQLite runtime을 우회한다.
- PG generated client가 `packages/db/src/generated/prisma`를 덮어쓴다.
- `@psms/db` 기본 export가 PG client로 바뀐다.
- full PostgreSQL DSN이 output/artifact에 남는다.
- disposable PG migration/rehearsal evidence가 없다.
- cleanup command가 PG에서 자동 retry 또는 confirm-all behavior를 제공한다.

## Validation Commands

preflight 단계에서 현재 repository가 계속 통과해야 하는 명령:

```powershell
pnpm test:unit:credential-compensation-cleanup
pnpm test:unit:production-release-gate
pnpm format:check
pnpm typecheck
pnpm lint
pnpm db:validate
pnpm release:gate:logs
```

PG profile 구현 slice 후보 명령:

```powershell
pnpm pg:profile:preflight
pnpm pg:profile:require-readiness
pnpm db:validate:pg-schema
pnpm test:unit:postgresql-profile-preflight
pnpm --filter @psms/db db:generate:pg
pnpm --filter @psms/db db:migrate:deploy:pg
pnpm test:integration:credential-compensation-cleanup:pg
pnpm release:gate:logs
```

`pg:profile:preflight`, `pg:profile:require-readiness`, `db:validate:pg-schema`,
`test:unit:postgresql-profile-preflight`는 현재 존재한다. `pg:profile:require-readiness`는
PG runtime evidence가 없으면 실패해야 한다. `db:generate:pg`,
`db:migrate:deploy:pg`, `test:integration:credential-compensation-cleanup:pg`는 현재
존재하지 않으며, 구현 slice에서 추가/검증해야 한다.

## 참고

- Prisma PostgreSQL connector와 `@prisma/adapter-pg`는 공식 Prisma 문서 기준으로 검토한다.
- Prisma ORM 7은 driver adapter 기반 runtime setup을 사용하므로, connection string은 adapter
  생성 시 application code에서 제공해야 한다.
