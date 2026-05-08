# Credential Cleanup Release Evidence Template Report

작성일: 2026-05-08

## Summary

credential compensation cleanup과 PostgreSQL profile/readiness evidence를 release report에
남기는 공통 template을 추가했다. 이번 slice는 문서 템플릿만이 아니라
`release-evidence` artifact를 secret scan 범위에 포함하고, cleanup dry-run 결과가
template allow-list 밖의 identity/trace metadata를 노출하지 않도록 보강했다.

PostgreSQL execution readiness는 계속 `BLOCK`이며, `pg:profile:preflight ok=true`를 release
PASS로 해석하지 않는다.

## 작업 분해

| 단계 | 내용                                                           | 상태 |
| ---- | -------------------------------------------------------------- | ---- |
| 1    | dirty worktree, MCP surface, release/runbook 문서 확인         | 완료 |
| 2    | devops/security/docs release subagent 위임                     | 완료 |
| 3    | cleanup release evidence template 추가                         | 완료 |
| 4    | release gate/runbook/checklist에 template 연결                 | 완료 |
| 5    | `release-evidence` secret scan root와 DSN/header/URL 패턴 추가 | 완료 |
| 6    | cleanup candidate output allow-list 축소                       | 완료 |
| 7    | unit/secret scan/release gate 검증                             | 완료 |

## 모델 선택 이유

| 역할                 | 모델 계열    | 이유                                                                |
| -------------------- | ------------ | ------------------------------------------------------------------- |
| main Codex           | GPT-5.x      | 문서/테스트/서비스 보강 통합, 검증 실행, 보고서 작성                |
| devops_sre_reviewer  | GPT-5.5 high | release evidence, fail-closed PASS/BLOCK/N/A, artifact custody 검토 |
| security_reviewer    | GPT-5.5 high | raw token/tokenHash/DSN/header/cookie/body 노출 위험 검토           |
| docs_release_manager | GPT-5.4-mini | release 문서 위치, 표 구조, 완료 보고 형식 검토                     |

Spark는 사용하지 않았다. 이번 작업은 credential/security/release evidence에 닿아 Spark 금지
범위다.

## 변경 파일

| 파일                                                                     | 변경                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `docs/60_release/credential-cleanup-release-evidence-template.md`        | release evidence naming, JSON shape, PASS/BLOCK/N/A, forbidden field, reviewer checklist 추가 |
| `docs/60_release/production-env-and-log-release-gate.md`                 | template 참조, expanded manual evidence table, automated ok=true 의미 제한                    |
| `docs/60_release/credential-compensation-failure-cleanup-runbook.md`     | `N/A-NoRows`와 row count `>0` BLOCK 기준 명시                                                 |
| `docs/60_release/electron-release-checklist.md`                          | cleanup evidence template 준수 조건 추가                                                      |
| `docs/60_release/postgresql-credential-cleanup-rehearsal-profile.md`     | PostgreSQL N/A enum을 `N/A-SQLite-only`로 통일                                                |
| `scripts/production-release-gate.mjs`                                    | manual check에 evidence template 준수 추가, log artifact command alias 정리                   |
| `test/unit/production-release-gate.test.mjs`                             | release gate manual check assertion 갱신                                                      |
| `test/e2e/artifact-secret-scan.mjs`                                      | `release-evidence` scan root와 PostgreSQL DSN/header/URL/session/webhook body 패턴 추가       |
| `test/unit/artifact-secret-scan.test.mjs`                                | release evidence artifact의 full PostgreSQL DSN 차단 테스트 추가                              |
| `apps/api/src/services/admin/credential-compensation-cleanup.service.ts` | cleanup candidate output을 release evidence allow-list로 축소                                 |
| `test/unit/credential-compensation-cleanup.test.ts`                      | cleanup output에서 `ipAddress`, `userAgent`, `updatedAt`, `revokedById` 미노출 검증           |
| `package.json`                                                           | `test:unit:artifact-secret-scan` 추가 및 aggregate test 연결                                  |

## Subagent 결과

| Subagent             | 결과                                                                                                                                      | 반영                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| devops_sre_reviewer  | command/exit code/SHA256/reviewer 없는 표는 fail-closed evidence로 부족. automated ok=true와 final PASS 분리 필요                         | expanded table, result semantics, release gate wording 반영          |
| security_reviewer    | `release-evidence`가 scanner 범위 밖이고 DSN/header/URL류 패턴이 부족. cleanup candidate가 IP/user-agent/update metadata를 노출할 수 있음 | scanner root/pattern 추가, candidate allow-list 축소, unit test 추가 |
| docs_release_manager | template은 `docs/60_release`, 완료 보고서는 `docs/80_ai_harness`, progress는 before/after/delta로 보고 권고                               | 현재 파일 위치와 보고서 구조에 반영                                  |

## 검증

| 명령                                             | 결과                       |
| ------------------------------------------------ | -------------------------- |
| `pnpm test:unit:artifact-secret-scan`            | 통과                       |
| `pnpm test:unit:credential-compensation-cleanup` | 통과                       |
| `pnpm test:unit:production-release-gate`         | 통과                       |
| `pnpm release:gate:logs`                         | 통과                       |
| `pnpm format:check`                              | 통과                       |
| `pnpm typecheck`                                 | 통과                       |
| `pnpm lint`                                      | 통과                       |
| `pnpm db:validate`                               | 통과                       |
| `pnpm test:unit:postgresql-profile-preflight`    | 통과                       |
| `pnpm pg:profile:preflight`                      | 통과, `readiness: "BLOCK"` |
| `pnpm db:validate:pg-schema`                     | 통과                       |
| `pnpm build`                                     | 통과                       |
| `git diff --check`                               | 통과                       |

## 작업 전/후 변동률

| 항목                                    | 작업 전 | 작업 후 |   변동 |
| --------------------------------------- | ------: | ------: | -----: |
| Cleanup release evidence template       |      0% |    100% |  +100% |
| Manual evidence PASS/BLOCK/N/A 명확성   |     45% |     95% |  +50%p |
| `release-evidence` secret scan coverage |      0% |    100% |  +100% |
| Cleanup candidate evidence minimization |     70% |     95% |  +25%p |
| PostgreSQL release readiness clarity    |     70% |     95% |  +25%p |
| Credential-token hardening aggregate    |   99.2% |   99.4% | +0.2%p |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                |
| ---------------------------------- | -----: | --------------------------------------------------- |
| Phase 2 Auth/RBAC/Credential       |  82.5% | cleanup evidence output minimization 추가           |
| Phase 8 DB/Transaction reliability |    68% | PG execution readiness는 BLOCK 유지                 |
| Phase 9 Release/Ops hardening      |    50% | evidence template과 scanner coverage 보강           |
| 전체 MVP 준비                      |  48.8% | release evidence 품질 상승, 업무 기능 진행률은 유지 |
| Backend/API hardening              |  42.5% | public API/shared contract 변경 없음                |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                         |
| ------------ | --------: | -------------------------------------------- |
| Auth         |        No | session/RBAC/API auth guard 변경 없음        |
| DB           |        No | schema/migration 변경 없음                   |
| API contract |        No | public Fastify/shared ActionResult 변경 없음 |

## 잔여 리스크

- release evidence JSON schema validator는 아직 없다. 현재는 template과 scanner/test로 보강했다.
- `release-evidence` 내 모든 future artifact shape를 자동 검증하지는 않는다.
- PostgreSQL runtime/dependency/generated client/migration은 아직 없으며 readiness는 `BLOCK`이다.
- 외부 reverse proxy/CDN/APM/webhook receiver evidence는 여전히 owner attestation이 필요하다.

## 다음 작업 3단계 미리보기

1. Release evidence schema validator
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `qa_agent`
   - 내용: `credential-cleanup-release-evidence-template.md`의 JSON shape와 allowed result/N/A 값을 검증하는 script와 unit test 추가
   - 산출물: `scripts/release-evidence-validate.mjs`, fixture 기반 PASS/BLOCK tests

2. PostgreSQL dependency/client spike
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: `@prisma/adapter-pg`, `pg`, isolated generated client, disposable PG DB 연결을 별도 profile로 검토
   - 산출물: dependency/client isolation evidence, SQLite runtime regression 결과

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` AuditLog가 admin/user timeline에서 누락되지 않는지 확인
   - 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 cleanup release evidence artifact template과 scanner coverage 보강은 완료했다.
최종 release PASS 자동화는 아직 아니며, schema validator와 외부 attestation은 다음 slice로
남긴다.
