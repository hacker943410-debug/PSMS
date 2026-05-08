# PostgreSQL Profile Implementation Spike Scaffold Report

작성일: 2026-05-08

## Summary

PostgreSQL profile implementation spike의 첫 단계로, 실제 PG runtime/dependency/migration을
추가하지 않고 정적 scaffold와 fail-closed preflight를 추가했다. 이 scaffold는 SQLite runtime
보호와 PG schema/config 분리를 자동 확인하며, PostgreSQL execution readiness는 계속
`BLOCK`으로 보고한다.

## 작업 분해

| 단계 | 내용                                      | 상태 |
| ---- | ----------------------------------------- | ---- |
| 1    | dirty worktree/MCP/PG preflight 문서 확인 | 완료 |
| 2    | db/backend/SRE subagent 위임              | 완료 |
| 3    | PostgreSQL schema/config 후보 추가        | 완료 |
| 4    | 정적 preflight script와 unit test 추가    | 완료 |
| 5    | schema parity check 추가                  | 완료 |
| 6    | 문서/보고서/검증 갱신                     | 완료 |

## 모델 선택 이유

| 역할                | 모델 계열    | 이유                                                                 |
| ------------------- | ------------ | -------------------------------------------------------------------- |
| main Codex          | GPT-5.x      | scaffold 구현, 하네스 검증, 보고서 통합                              |
| db_reviewer         | GPT-5.5 high | schema/config parity, SQLite runtime 보호, PG readiness BLOCK 검토   |
| backend_agent       | GPT-5.5 high | `@psms/db` facade와 cleanup service contract 영향 검토               |
| devops_sre_reviewer | GPT-5.5 high | release/ops evidence, fail-closed readiness, artifact redaction 검토 |

## 변경 파일

| 파일                                                     | 변경                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/db/prisma/schema.postgresql.prisma`            | PostgreSQL rehearsal schema candidate 추가, generated output 격리                                      |
| `packages/db/prisma.postgresql.config.ts`                | `PSMS_PG_REHEARSAL_DATABASE_URL` 기반 PG config candidate 추가                                         |
| `scripts/postgresql-profile-preflight.mjs`               | SQLite runtime 보호와 PG scaffold integrity를 확인하는 정적 preflight 추가                             |
| `test/unit/postgresql-profile-preflight.test.mjs`        | preflight가 ok=true/readiness=BLOCK을 반환하고 `--require-readiness`가 fail-closed인지 검증            |
| `packages/db/package.json`                               | `db:validate:pg-schema` script 추가                                                                    |
| `package.json`                                           | `db:validate:pg-schema`, `pg:profile:preflight`, `pg:profile:require-readiness`, unit test script 추가 |
| `docs/60_release/postgresql-prisma-profile-preflight.md` | scaffold 명령과 readiness BLOCK 의미 갱신                                                              |

## 주요 결정

- PG schema candidate는 `../src/generated/postgresql-prisma`로 generate되도록 격리했다.
- PG config는 `DATABASE_URL`이 아니라 `PSMS_PG_REHEARSAL_DATABASE_URL`을 요구한다.
- 기본 SQLite schema/config/client/index export는 변경하지 않았다.
- `@prisma/adapter-pg`, `pg`, PG generated client, PG migrations는 추가하지 않았다.
- preflight는 scaffold integrity와 execution readiness를 분리한다.
  - `ok: true`: scaffold marker가 안전함
  - `readiness: "BLOCK"`: PG runtime 실행 준비는 아직 아님
- `pg:profile:require-readiness`는 PostgreSQL release candidate 전용 gate로, 현재 scaffold에서는
  fail-closed로 실패한다.

## Subagent 결과

| Subagent            | 결과                                                                                                      | 반영                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| db_reviewer         | static scaffold는 SQLite runtime에 영향 없음. schema parity check 추가 권고                               | normalized schema parity check 추가                    |
| backend_agent       | PG scaffold 자체는 public API/ActionResult 영향 없음. cleanup mutation 변경은 별도 slice 범위로 추적 필요 | `@psms/db` facade/SQLite default export 원칙 유지      |
| devops_sre_reviewer | `ok=true`가 readiness PASS처럼 오해될 수 있음. release candidate용 fail-closed gate 필요                  | `--require-readiness` 모드와 release manual check 추가 |

## 검증

| 명령                                             | 결과                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `pnpm test:unit:postgresql-profile-preflight`    | 통과                                                   |
| `pnpm pg:profile:preflight`                      | 통과, `readiness: "BLOCK"`                             |
| `pnpm pg:profile:require-readiness`              | fail-closed 확인, 현재 PG runtime 부재로 실패가 정상값 |
| `pnpm db:validate:pg-schema`                     | 통과                                                   |
| `pnpm test:unit:production-release-gate`         | 통과                                                   |
| `pnpm test:unit:credential-compensation-cleanup` | 통과                                                   |
| `pnpm format:check`                              | 통과                                                   |
| `pnpm typecheck`                                 | 통과                                                   |
| `pnpm lint`                                      | 통과                                                   |
| `pnpm db:validate`                               | 통과                                                   |
| `pnpm release:gate:logs`                         | 통과                                                   |
| `pnpm build`                                     | 통과                                                   |
| `git diff --check`                               | 통과                                                   |

## 작업 전/후 변동률

| 항목                                 | 작업 전 | 작업 후 |       변동 |
| ------------------------------------ | ------: | ------: | ---------: |
| PostgreSQL profile scaffold          |      0% |    100% |      +100% |
| PG schema/config static validation   |      0% |    100% |      +100% |
| SQLite runtime guard automation      |     60% |    100% |       +40% |
| PostgreSQL execution readiness       |      0% |      0% | BLOCK 유지 |
| Credential-token hardening aggregate |     99% |   99.2% |      +0.2% |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                    |
| ---------------------------------- | -----: | ------------------------------------------------------- |
| Phase 2 Auth/RBAC/Credential       |    82% | cleanup contract 유지                                   |
| Phase 8 DB/Transaction reliability |    68% | PG scaffold/preflight 자동화 추가, 실제 PG runtime 남음 |
| Phase 9 Release/Ops hardening      |    48% | PG readiness BLOCK을 자동 evidence로 확인               |
| 전체 MVP 준비                      |  48.5% | SQLite runtime 보호 자동화 상승                         |
| Backend/API hardening              |    42% | public API/shared contract 변경 없음                    |

## 잔여 리스크

- 실제 PostgreSQL dependency/runtime/client/migration은 아직 없다.
- PG schema validate는 정적 schema 유효성 검증이며, migration apply 또는 DB 접속 검증이 아니다.
- disposable PostgreSQL DB에서 nullable unique, JSON, cleanup transaction, concurrent confirm을 아직 검증하지 않았다.
- PG generated client를 실제 생성하면 `packages/db/src/generated/postgresql-prisma` 산출물 관리 정책이 필요하다.

## 다음 작업 3단계 미리보기

1. Cleanup release evidence artifact template
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `docs_release_manager`
   - 내용: dry-run/confirm/preflight JSON artifact 저장 위치, redaction, owner/time/result template 고정
   - 산출물: release evidence template과 artifact naming rule

2. PostgreSQL dependency/client spike
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: `@prisma/adapter-pg`, `pg`, PG generated client, PG runtime entrypoint를 disposable branch에서 검증
   - 산출물: dependency diff, generated client isolation evidence, SQLite regression result

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` AuditLog가 user/staff timeline에서 누락되지 않는지 확인
   - 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 PostgreSQL profile implementation spike scaffold는 완료했다. PostgreSQL
execution readiness는 dependency/client/migration/DB evidence 부재로 계속 `BLOCK`이다.
