# PostgreSQL Credential Cleanup Rehearsal Profile Report

작성일: 2026-05-08

## Summary

credential compensation cleanup command의 PostgreSQL rehearsal profile을 release gate 문서에
연결했다. 현재 repository는 SQLite Prisma provider/client만 지원하므로 PostgreSQL cleanup
execution readiness는 명시적으로 `BLOCK`으로 유지했다.

이번 slice에서 full PostgreSQL DSN이 command artifact에 남지 않도록 non-SQLite
`--database-url`을 fail-closed 처리하고 redacted identifier만 error evidence에 남기도록
보강했다.

## 작업 분해

| 단계 | 내용                                           | 상태 |
| ---- | ---------------------------------------------- | ---- |
| 1    | dirty worktree/MCP/runbook/current report 확인 | 완료 |
| 2    | db_reviewer/devops_sre_reviewer subagent 위임  | 완료 |
| 3    | PostgreSQL rehearsal profile 문서 작성         | 완료 |
| 4    | release gate/manual evidence 문서 연결         | 완료 |
| 5    | CLI non-SQLite fail-closed/redaction 보강      | 완료 |
| 6    | 관련 unit/format/type/lint/db 검증             | 완료 |

## 모델 선택 이유

| 역할                | 모델 계열    | 이유                                                                    |
| ------------------- | ------------ | ----------------------------------------------------------------------- |
| main Codex          | GPT-5.x      | 하네스 조율, 문서/테스트/스크립트 통합                                  |
| db_reviewer         | GPT-5.5 high | PostgreSQL provider, transaction, SQL dialect blocker 검토              |
| devops_sre_reviewer | GPT-5.5 high | release evidence, DSN leakage, PASS/BLOCK gate 검토                     |
| qa_agent            | 미위임       | thread agent limit으로 spawn 실패. 기존 unit/release gate 검증으로 보완 |

## 변경 파일

| 파일                                                                 | 변경                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `docs/60_release/postgresql-credential-cleanup-rehearsal-profile.md` | PostgreSQL rehearsal PASS/BLOCK, dataset, dry-run/confirm/negative case evidence 정의           |
| `docs/60_release/credential-compensation-failure-cleanup-runbook.md` | PostgreSQL profile link, SQLite/PostgreSQL emergency SQL 분리, redacted DB identifier 기준 추가 |
| `docs/60_release/production-env-and-log-release-gate.md`             | PostgreSQL cleanup evidence manual gate 추가                                                    |
| `docs/60_release/electron-release-checklist.md`                      | SQLite-only N/A와 PostgreSQL PASS evidence 기준 추가                                            |
| `scripts/production-release-gate.mjs`                                | manual check에 PostgreSQL rehearsal profile 추가                                                |
| `test/unit/production-release-gate.test.mjs`                         | manual check assertion 추가                                                                     |
| `scripts/credential-compensation-cleanup.ts`                         | non-SQLite DB URL fail-closed 및 redacted identifier 출력                                       |
| `test/unit/credential-compensation-cleanup.test.ts`                  | PostgreSQL DSN credential non-leak regression test 추가                                         |

## Subagent 결과 반영

| Subagent            | 핵심 의견                                                                 | 반영                                            |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| db_reviewer         | SQLite-only schema/client로는 PG rehearsal 불가, PG SQL dialect 분리 필요 | profile을 BLOCK으로 유지, PG emergency SQL 추가 |
| devops_sre_reviewer | full DSN artifact 노출은 BLOCK, redacted DB identifier 필요               | CLI fail-closed/redaction test 추가             |

## 검증

| 명령                                             | 결과 |
| ------------------------------------------------ | ---- |
| `pnpm test:unit:credential-compensation-cleanup` | 통과 |
| `pnpm test:unit:production-release-gate`         | 통과 |
| `pnpm format:check`                              | 통과 |
| `pnpm typecheck`                                 | 통과 |
| `pnpm lint`                                      | 통과 |
| `pnpm db:validate`                               | 통과 |

## 작업 전/후 변동률

| 항목                                 | 작업 전 | 작업 후 |  변동 |
| ------------------------------------ | ------: | ------: | ----: |
| PostgreSQL cleanup rehearsal profile |      0% |    100% | +100% |
| PostgreSQL readiness 판정 명확성     |     40% |    100% |  +60% |
| DB URL artifact redaction            |     60% |    100% |  +40% |
| Release manual evidence coverage     |    100% |    100% |  유지 |
| Credential-token hardening aggregate |     98% |   98.5% | +0.5% |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                                    |
| ---------------------------------- | -----: | ----------------------------------------------------------------------- |
| Phase 2 Auth/RBAC/Credential       |    82% | cleanup command와 release evidence 유지                                 |
| Phase 8 DB/Transaction reliability |    64% | PG rehearsal profile 정의 완료, 실제 PG profile/client 남음             |
| Phase 9 Release/Ops hardening      |    45% | release manual evidence가 PostgreSQL readiness를 명확히 BLOCK/PASS 판정 |
| 전체 MVP 준비                      |    47% | credential 운영 gate 선명도 상승                                        |
| Backend/API hardening              |    42% | public API contract 변경 없음                                           |

## 잔여 리스크

- 실제 PostgreSQL Prisma profile/client는 아직 없다.
- PostgreSQL migration apply, concurrent confirm, `P2034`/deadlock rehearsal은 다음 slice로 남아 있다.
- SQLite-only Electron local release는 `N/A-SQLite-only`로 기록 가능하지만 PostgreSQL production readiness가 아니다.

## 다음 작업 3단계 미리보기

1. PostgreSQL Prisma profile/client preflight
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: SQLite build와 분리된 PostgreSQL provider/client strategy, adapter, migration rehearsal 방식 설계
   - 예상 산출물: PG profile plan/report, no-domain-schema-change 확인

2. Cleanup release evidence artifact template
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `docs_release_manager`
   - 내용: dry-run/confirm JSON artifact 저장 위치, redaction, owner/time/result template 고정
   - 예상 산출물: release report template 및 artifact naming rule

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` row가 admin staff/user timeline에서 조회되는지 확인
   - 예상 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 PostgreSQL cleanup rehearsal profile과 release BLOCK/PASS 기준 정의는 완료했다.
실제 PostgreSQL execution rehearsal은 현재 provider/client 부재로 BLOCK이며, 완료로 주장하지 않는다.
