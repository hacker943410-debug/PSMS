# PostgreSQL Prisma Profile Preflight Report

작성일: 2026-05-08

## Summary

credential compensation cleanup의 PostgreSQL rehearsal을 실제 구현하기 전에 필요한 Prisma
profile/client 분리 원칙을 고정했다. 현재 repository는 SQLite provider와
`PrismaBetterSqlite3` runtime을 기본으로 유지하며, PostgreSQL execution readiness는 계속
`BLOCK`이다.

이번 slice는 domain schema, Prisma migration, runtime dependency, public API,
ActionResult/shared contract를 변경하지 않았다.

## 작업 분해

| 단계 | 내용                                                                  | 상태 |
| ---- | --------------------------------------------------------------------- | ---- |
| 1    | dirty worktree, MCP surface, PG cleanup rehearsal doc, DB client 확인 | 완료 |
| 2    | 완료된 이전 subagent 정리 후 db/backend/SRE subagent 위임             | 완료 |
| 3    | 현재 SQLite-only Prisma runtime 영향 범위 조사                        | 완료 |
| 4    | PostgreSQL Prisma profile preflight 문서 작성                         | 완료 |
| 5    | release gate/checklist/manual evidence 연결                           | 완료 |
| 6    | 관련 unit/format/type/lint/db 검증                                    | 완료 |

## 모델 선택 이유

| 역할                | 모델 계열    | 이유                                                                 |
| ------------------- | ------------ | -------------------------------------------------------------------- |
| main Codex          | GPT-5.x      | 하네스 조율, 문서/게이트 변경, 검증 통합                             |
| db_reviewer         | GPT-5.5 high | provider/client/migration/transaction 경계 검토                      |
| backend_agent       | GPT-5.5 high | `@psms/db` import surface와 API contract 영향 검토                   |
| devops_sre_reviewer | GPT-5.5 high | env naming, artifact redaction, release evidence, rollback gate 검토 |

## 변경 파일

| 파일                                                                 | 변경                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/60_release/postgresql-prisma-profile-preflight.md`             | PG profile/client 분리 원칙, env naming, PASS/BLOCK, candidate commands 정의 |
| `docs/60_release/postgresql-credential-cleanup-rehearsal-profile.md` | PG cleanup rehearsal 사전 조건에 Prisma profile preflight 연결               |
| `docs/60_release/production-env-and-log-release-gate.md`             | PostgreSQL profile manual evidence row 추가                                  |
| `docs/60_release/electron-release-checklist.md`                      | PostgreSQL profile/client preflight evidence 조건 추가                       |
| `scripts/production-release-gate.mjs`                                | manual check에 PostgreSQL Prisma profile preflight 추가                      |
| `test/unit/production-release-gate.test.mjs`                         | manual check assertion 추가                                                  |

## 주요 결정

- `DATABASE_URL`은 기존 SQLite runtime 전용으로 유지한다.
- PostgreSQL rehearsal은 `PSMS_PG_REHEARSAL_DATABASE_URL` 같은 별도 env를 사용한다.
- PG profile은 별도 schema/config/generated client/runtime entrypoint로 격리한다.
- PG generated client가 `packages/db/src/generated/prisma`를 덮어쓰면 BLOCK이다.
- `@psms/db` 기본 export를 PG client로 바꾸면 BLOCK이다.
- PG dependency와 migration은 이번 slice에서 추가하지 않는다.
- PG generated client가 도입되면 `AppPrismaClient`/`AppDbClient` 같은 provider-neutral
  facade type을 검토한다.

## Subagent 결과

| Subagent            | 결과                                                                                                 | 반영                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| devops_sre_reviewer | SQLite-only runtime 유지, PG profile 격리, redacted artifact, rollback criteria 권고                 | preflight 문서의 env/evidence/rollback 기준에 반영 |
| db_reviewer         | SQLite runtime valid, PG readiness BLOCK, nullable unique/domain unique/JSON/transaction 검증 권고   | preflight 문서의 migration rehearsal gate에 반영   |
| backend_agent       | `@psms/db` facade 유지, cleanup service의 injected client 패턴 유지, provider-neutral type 후보 권고 | preflight 문서의 CLI/API 영향에 반영               |

## 검증

| 명령                                             | 결과 |
| ------------------------------------------------ | ---- |
| `pnpm test:unit:production-release-gate`         | 통과 |
| `pnpm test:unit:credential-compensation-cleanup` | 통과 |

추가 최종 검증은 보고서 작성 후 재실행했다.

## 작업 전/후 변동률

| 항목                                 | 작업 전 | 작업 후 |       변동 |
| ------------------------------------ | ------: | ------: | ---------: |
| PostgreSQL Prisma profile preflight  |      0% |    100% |      +100% |
| SQLite runtime 보호 기준             |     60% |    100% |       +40% |
| PG env naming/evidence 기준          |     50% |    100% |       +50% |
| PostgreSQL execution readiness       |      0% |      0% | BLOCK 유지 |
| Credential-token hardening aggregate |   98.5% |     99% |      +0.5% |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                     |
| ---------------------------------- | -----: | -------------------------------------------------------- |
| Phase 2 Auth/RBAC/Credential       |    82% | credential cleanup contract 유지                         |
| Phase 8 DB/Transaction reliability |    66% | PG profile preflight 완료, 실제 PG client/migration 남음 |
| Phase 9 Release/Ops hardening      |    47% | PG profile manual evidence gate 추가                     |
| 전체 MVP 준비                      |    48% | SQLite runtime 보존과 PG 전환 경계 명확화                |
| Backend/API hardening              |    42% | public API/shared contract 변경 없음                     |

## 잔여 리스크

- 실제 PostgreSQL schema/config scaffold는 추가되었지만 generated client/runtime은 아직 없다.
- `@prisma/adapter-pg`와 `pg` dependency는 아직 추가하지 않았다.
- `InventoryItem.serialNumber`, `Sale.inventoryItemId`, `Receivable.saleId`,
  `UserPasswordToken.activeKey`의 PostgreSQL unique/nullability evidence가 아직 없다.
- disposable PostgreSQL migration apply, concurrent confirm, `P2034` rehearsal은 다음 구현 slice로 남아 있다.
- Context7 MCP는 OAuth 토큰 만료로 사용하지 못했고, Prisma 공식 문서를 fallback으로 확인했다.

## 다음 작업 3단계 미리보기

1. PostgreSQL profile implementation spike
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: `schema.postgresql.prisma`, `prisma.postgresql.config.ts`, 별도 generated client path,
     `@prisma/adapter-pg` dependency 후보를 실제 spike로 검증
   - 산출물: PG profile spike report, 기본 SQLite runtime 영향 없음 증거

2. Cleanup release evidence artifact template
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `docs_release_manager`
   - 내용: dry-run/confirm JSON artifact 저장 위치, redaction, owner/time/result template 고정
   - 산출물: release evidence template과 artifact naming rule

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` AuditLog가 user/staff timeline에서 누락되지 않는지 확인
   - 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 PostgreSQL Prisma profile/client preflight는 완료했다. 실제 PostgreSQL
execution readiness는 provider/client/migration 부재로 `BLOCK`이며, 완료로 주장하지 않는다.

## 참고 소스

- Prisma PostgreSQL connector / `@prisma/adapter-pg`: https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
- Prisma generated client output guidance: https://docs.prisma.io/docs/v6/orm/prisma-client/setup-and-configuration/generating-prisma-client
