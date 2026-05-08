# Manual External Attestation Evidence Helper Report

작성일: 2026-05-08

## 요약

수동/외부 릴리즈 gate인 `external-scrub-attestation`,
`webhook-receiver-log-policy`, `rollback-rehearsal`에 대해 구조화된 attestation evidence
helper를 추가했다. 이제 generic JSON writer로 임의 `PASS` artifact를 만들어도 validator가
gate-specific evidence를 요구하므로 index를 우회할 수 없다.

이번 slice는 release/security tooling이며 Auth, DB schema, Fastify API contract, UI는 변경하지
않았다.

## 작업 분해

| 단계 | 작업                                                     | 상태 |
| ---: | -------------------------------------------------------- | ---- |
|    1 | `git status --short`, MCP surface, 필수 하네스 문서 확인 | 완료 |
|    2 | DevOps/Security/QA subagent read-only 검토 위임          | 완료 |
|    3 | manual/external attestation helper 구현                  | 완료 |
|    4 | validator의 manual gate-specific schema 강화             | 완료 |
|    5 | helper/validator/index regression tests 추가             | 완료 |
|    6 | release docs 갱신                                        | 완료 |
|    7 | 검증 및 완료 보고                                        | 완료 |

## 모델 선택 이유

| 역할                  | Model / Agent                        | 이유                                                                                         |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| DevOps/release review | `devops_sre_reviewer` / GPT-5.5 high | release evidence gate, helper CLI, index/validator integration, NO-GO 조건 검토              |
| Security review       | `security_reviewer` / GPT-5.5 high   | raw token/header/body/DSN 비노출, 수동 evidence 우회 차단, reviewer/owner 분리 요구사항 검토 |
| QA review             | `qa_agent` / GPT-5.5 high            | helper success/block, generic writer bypass, latest BLOCK, secret echo tests 전략 검토       |
| Implementation        | Codex local                          | 기존 ESM release evidence writer/validator/index 패턴에 맞춘 좁은 script/test/docs 변경      |

Spark는 사용하지 않았다. 이번 작업은 frontend가 아니라 release/env/secret policy 영역이며 Spark
금지 범위에 해당한다.

## Subagent 반영

| Subagent              | 주요 피드백                                                       | 반영                                                                                     |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `devops_sre_reviewer` | 기존 required gate 유지, generic PASS 우회 차단, 전용 helper 필요 | 세 gate 유지, `release:evidence:attest` helper 추가, validator gate-specific schema 추가 |
| `security_reviewer`   | free-form evidence 금지, secret echo 금지, owner/reviewer 분리    | allowlist CLI, safe reference/path/SHA, unsafe positional arg redaction test 추가        |
| `qa_agent`            | PASS/BLOCK/index/secret regression 필요                           | `test/unit/release-evidence-attest.test.mjs` 7 tests 추가                                |

## 변경 파일

| 파일                                                                                | 변경 내용                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `scripts/release-evidence-attest.mjs`                                               | manual/external attestation evidence helper 추가                          |
| `scripts/release-evidence-validate.mjs`                                             | manual/external gates의 structured evidence schema 검증 추가              |
| `test/unit/release-evidence-attest.test.mjs`                                        | helper success/block/generic-writer-bypass/index/secret CLI tests 추가    |
| `package.json`                                                                      | `release:evidence:attest`, `test:unit:release-evidence-attest`, aggregate |
| `docs/60_release/credential-cleanup-release-evidence-template.md`                   | attestation helper 사용법과 결과 semantics 문서화                         |
| `docs/60_release/production-env-and-log-release-gate.md`                            | manual/external gate helper와 control 목록 문서화                         |
| `docs/60_release/release-evidence-index-assembler.md`                               | manual/external structured attestation 만족 조건 문서화                   |
| `docs/80_ai_harness/manual-external-attestation-evidence-helper-report-20260508.md` | 이번 slice 완료 보고서                                                    |

## 검증 결과

| 검증                                       | 결과 | 비고                 |
| ------------------------------------------ | ---: | -------------------- |
| `pnpm test:unit:release-evidence-attest`   | 통과 | 7 tests              |
| `pnpm test:unit:release-evidence-validate` | 통과 | 13 tests             |
| `pnpm test:unit:release-evidence-write`    | 통과 | 3 tests              |
| `pnpm test:unit:release-evidence-capture`  | 통과 | 12 tests             |
| `pnpm test:unit:release-evidence-index`    | 통과 | 9 tests              |
| `pnpm format:check`                        | 통과 | Prettier             |
| `pnpm lint`                                | 통과 | API/Web lint         |
| `pnpm typecheck`                           | 통과 | workspace TS         |
| `pnpm db:validate`                         | 통과 | SQLite Prisma schema |
| `pnpm build`                               | 통과 | shared/db/api/web    |
| `pnpm test`                                | 통과 | aggregate            |
| `pnpm release:gate:logs`                   | 통과 | 193 files scanned    |
| `git diff --check`                         | 통과 | whitespace           |

## 작업 전후 변동률

| 항목                                       | 작업 전 | 작업 후 |   변동 |
| ------------------------------------------ | ------: | ------: | -----: |
| Manual/external attestation helper         |      0% |    100% | +100%p |
| Manual gate generic PASS bypass resistance |     30% |     90% |  +60%p |
| Release evidence manual gate readiness     |     63% |     70% |   +7%p |
| Release/Ops hardening aggregate            |     63% |     65% |   +2%p |
| 전체 MVP harness 기준                      |   50.3% |   50.6% | +0.3%p |

## Phase / Task 진행률

| 기준                                           | 현재 완료율 | 판단 근거                                                  |
| ---------------------------------------------- | ----------: | ---------------------------------------------------------- |
| Phase 2 Backend/API foundation                 |       83.0% | Fastify/shared API contract 변경 없음                      |
| Phase 8 Web MVP / release evidence readiness   |       76.0% | manual/external release evidence validator/index 경로 강화 |
| Phase 9 Electron/operational release readiness |       65.0% | 외부 scrub/receiver/rollback attestation helper 추가       |
| Backend/domain aggregate                       |       43.0% | 업무 domain API 신규 구현 없음                             |
| Release/Ops hardening aggregate                |       65.0% | structured manual evidence와 generic PASS bypass 차단 추가 |
| 전체 MVP harness 기준                          |       50.6% | 운영 증적 자동화는 전진, 주요 업무 기능은 동일             |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                         |
| ------------ | --------: | -------------------------------------------- |
| Auth         |        No | 인증/세션/RBAC 변경 없음                     |
| DB           |        No | Prisma schema/migration 변경 없음            |
| API contract |        No | Fastify/shared `ActionResult` 변경 없음      |
| UI           |        No | CLI/docs/test slice라 screenshot gate 불필요 |

## Background Subagent Cleanup

| 항목                          | 상태 | 비고                                                              |
| ----------------------------- | ---- | ----------------------------------------------------------------- |
| 완료된 subagent close 여부    | 완료 | `devops_sre_reviewer`, `security_reviewer`, `qa_agent` close 완료 |
| 잔여 활성 subagent 여부       | 없음 | final 전 세 subagent 모두 정리                                    |
| 미종료 subagent가 있다면 사유 | N/A  | 없음                                                              |

## Worktree Cleanup

| 항목                              | 상태 | 비고                   |
| --------------------------------- | ---- | ---------------------- |
| 최종 `git status --short` 확인    | 완료 | 커밋 후 출력 없음 확인 |
| dirty/untracked 잔여 여부         | 없음 | slice 커밋으로 정리    |
| 잔여 파일이 있다면 사유/처리 계획 | N/A  | 잔여 없음              |

## 남은 리스크

| 리스크                                                                              | 영향도 | 대응                                                                   |
| ----------------------------------------------------------------------------------- | -----: | ---------------------------------------------------------------------- |
| helper는 external system 자체를 검증하지 않고 owner/reviewer attestation을 구조화함 |   중간 | support artifact path/SHA와 reviewer 확인을 release report에 함께 기록 |
| supporting evidence artifact 존재 여부는 현재 validator가 cross-check하지 않음      |   중간 | 다음 release bundle/index rehearsal에서 존재성 cross-check 검토        |
| `pnpm release:gate`는 여전히 automated env/log gate만 의미함                        |   낮음 | final release PASS는 index와 release reviewer 승인에서 별도 판단       |

## 다음 작업 3단계 미리보기

| 순서 | 작업                                         | 세부 내용                                                                                       | Subagent                                              |
| ---: | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
|    1 | Combined release gate capture artifact       | `pnpm release:gate` 결과를 self-referential validation 없이 safe summary artifact로 남기는 방식 | `devops_sre_reviewer`, `release_reviewer`, `qa_agent` |
|    2 | PostgreSQL dependency/client readiness spike | `@prisma/adapter-pg`, `pg`, generated client, migration rehearsal PASS 경로 설계                | `db_reviewer`, `backend_agent`, `devops_sre_reviewer` |
|    3 | Release evidence support-bundle check        | attestation support artifact path/SHA 존재성, index readiness rehearsal, stale support 차단     | `release_reviewer`, `security_reviewer`, `qa_agent`   |
