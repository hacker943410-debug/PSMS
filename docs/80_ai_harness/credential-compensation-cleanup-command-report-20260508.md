# Credential Compensation Cleanup Command Report

작성일: 2026-05-08

## Summary

post-delivery compensation failure runbook을 실행 가능한 운영 command로 보강했다.
public Fastify route, shared schema, ActionResult contract는 변경하지 않았다.

이번 slice는 limbo `UserPasswordToken` dry-run 탐지와 confirmed cleanup을 지원한다.
confirmed cleanup은 explicit token id, expected count, active ADMIN actor, operator,
ticket id를 요구하며 token revoke와 `AuditLog` insert를 같은 Prisma transaction에 묶는다.

## 작업 분해

| 단계 | 내용                                            | 상태 |
| ---- | ----------------------------------------------- | ---- |
| 1    | MCP/status/harness/runbook 확인                 | 완료 |
| 2    | backend/db/security/QA subagent 위임            | 완료 |
| 3    | repository predicate와 service transaction 구현 | 완료 |
| 4    | non-public ops CLI 및 package script 추가       | 완료 |
| 5    | rollback/security-focused unit test 추가        | 완료 |
| 6    | runbook command 절차 갱신                       | 완료 |

## 모델 선택 이유

| 역할              | 모델 계열    | 이유                                                                    |
| ----------------- | ------------ | ----------------------------------------------------------------------- |
| main Codex        | GPT-5.x      | 하네스 조율, 구현, 검증, 보고서 통합                                    |
| backend_agent     | GPT-5.5 high | API service/repository layering, AuditLog pattern 검토                  |
| db_reviewer       | GPT-5.5 high | limbo predicate, transaction rollback, SQLite/PostgreSQL semantics 검토 |
| security_reviewer | GPT-5.5 high | raw secret/tokenHash 누출 방지, ADMIN actor, audit evidence 검토        |
| qa_agent          | GPT-5.5 high | dry-run/confirm/rollback 중심 테스트 전략 검토                          |

## 변경 파일

| 파일                                                                     | 변경                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/api/src/repositories/user-password-token.repository.ts`            | limbo token safe select, exact predicate find/update helper 추가  |
| `apps/api/src/services/admin/credential-compensation-cleanup.service.ts` | dry-run/confirm cleanup service 추가                              |
| `scripts/credential-compensation-cleanup.ts`                             | non-public ops CLI 추가                                           |
| `test/unit/credential-compensation-cleanup.test.ts`                      | disposable SQLite 기반 cleanup unit test 추가                     |
| `package.json`                                                           | ops script와 unit test script 연결, `pnpm test` 포함              |
| `docs/60_release/credential-compensation-failure-cleanup-runbook.md`     | command 절차, expected count, DB path 확인, cutoff SQL guard 갱신 |

## 주요 보안/DB 의미

- dry-run select는 `tokenHash`, raw token, URL, password, Cookie, Authorization을 선택하지 않는다.
- confirmed cleanup은 `activeKey IS NULL`, `usedAt IS NULL`, `revokedAt IS NULL`,
  `createdAt <= cutoff` predicate를 re-select/update에 동일하게 적용한다.
- confirmed cleanup은 `detectionWindowMinutes >= 10`을 요구해 in-flight row revoke를 막는다.
- confirmed cleanup은 active ADMIN `actorUserId`를 요구하며 STAFF/null actor는 승인하지 않는다.
- operator/ticket/reason은 길이 제한, allowlist, forbidden credential-material pattern 검사를 통과해야 한다.
- `AuditLog`는 기존 credential lifecycle과 맞춰 `entityType = User`, `entityId = userId`,
  `tokenId`는 JSON evidence에 남긴다.
- AuditLog insert 실패 시 transaction rollback으로 token revoke도 되돌아간다.

## 검증

| 명령                                                                                       | 결과 |
| ------------------------------------------------------------------------------------------ | ---- |
| `pnpm test:unit:credential-compensation-cleanup`                                           | 통과 |
| `pnpm test:unit:production-release-gate`                                                   | 통과 |
| `pnpm test:unit:credential-token-db`                                                       | 통과 |
| `pnpm --filter @psms/api typecheck`                                                        | 통과 |
| `pnpm --filter @psms/api exec tsx ../../scripts/credential-compensation-cleanup.ts --help` | 통과 |
| `pnpm ops:credential-compensation-cleanup --help`                                          | 통과 |
| `pnpm format:check`                                                                        | 통과 |
| `pnpm lint`                                                                                | 통과 |
| `pnpm typecheck`                                                                           | 통과 |
| `pnpm db:validate`                                                                         | 통과 |
| `pnpm release:gate:logs`                                                                   | 통과 |
| `pnpm test`                                                                                | 통과 |

## 작업 전/후 변동률

| 항목                                 | 작업 전 | 작업 후 |  변동 |
| ------------------------------------ | ------: | ------: | ----: |
| Compensation cleanup runbook         |    100% |    100% |  유지 |
| Audited cleanup executable preflight |      0% |    100% | +100% |
| Limbo predicate automated guard      |      0% |    100% | +100% |
| Cleanup rollback unit coverage       |      0% |    100% | +100% |
| Credential-token hardening aggregate |     97% |     98% |   +1% |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                             |
| ---------------------------------- | -----: | ---------------------------------------------------------------- |
| Phase 2 Auth/RBAC/Credential       |    82% | credential issue/cleanup audit hardening 진전                    |
| Phase 8 DB/Transaction reliability |    62% | SQLite transaction rollback test 추가, PostgreSQL rehearsal 남음 |
| Phase 9 Release/Ops hardening      |    42% | runbook이 command preflight로 승격                               |
| 전체 MVP 준비                      |    46% | credential 운영 안정성 상승                                      |
| Backend/API hardening              |    42% | public API contract 변경 없음                                    |

## 잔여 리스크

- PostgreSQL profile transaction rehearsal은 아직 별도 slice로 남아 있다.
- cleanup CLI output은 SQLite path와 DB identifier만 evidence로 남겨야 하며, PostgreSQL
  full DSN은 artifact에 남기지 않는다.
- production cleanup automation은 DB backup/restore rehearsal과 release reviewer 확인 전까지 자동 job으로 승격하지 않는다.
- 현재 command는 운영 도구이며 public API/UI 노출은 없다.

## 다음 작업 3단계 미리보기

1. PostgreSQL cleanup rehearsal profile
   - subagents: `db_reviewer`, `devops_sre_reviewer`
   - 내용: PostgreSQL datasource에서 limbo predicate, transaction rollback, affected-count mismatch behavior 재검증
   - 예상 산출물: PostgreSQL rehearsal report와 prod-readiness 조건

2. Cleanup command release gate evidence integration
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `qa_agent`
   - 내용: release report template에 `ops:credential-compensation-cleanup` dry-run JSON 첨부 기준과 PASS/BLOCK 판정 연결
   - 예상 산출물: release gate 문서/테스트 보강

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` audit row가 staff/user timeline에서 누락되지 않는지 read model과 UI 노출 정책 확인
   - 예상 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 audited cleanup command preflight는 완료했다. 외부 API contract와 shared schema 변경은 없다.
