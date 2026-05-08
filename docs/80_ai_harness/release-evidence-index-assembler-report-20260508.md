# Release Evidence Index Assembler Report

작성일: 2026-05-08

## 요약

`release:evidence:index`를 추가해 `release-evidence/**` artifacts를 release candidate 단위로
검증하고, required gate index를 JSON 또는 Markdown으로 조립할 수 있게 했다. 이 도구는 release
approval이 아니라 blocker surfacing 도구다. artifact가 없거나 manual/external gate attestation이
없으면 row result는 `BLOCK`이다.

현재 실제 `release-evidence` root에는 이 release candidate artifacts가 없으므로 CLI smoke 결과는
expected `BLOCK`이다.

## 작업 분해

| 단계 | 작업                                                | 상태 |
| ---: | --------------------------------------------------- | ---- |
|    1 | `git status --short`, MCP surface, 하네스 문서 확인 | 완료 |
|    2 | DevOps/Docs/QA subagent read-only 검토 위임         | 완료 |
|    3 | index assembler script 구현                         | 완료 |
|    4 | unit test와 package script 연결                     | 완료 |
|    5 | assembler contract/release template 문서 갱신       | 완료 |
|    6 | CLI smoke 및 검증 실행                              | 완료 |
|    7 | 완료 보고서 작성                                    | 완료 |

## 모델 선택 이유

| 역할                | Model / Agent                                | 이유                                                                   |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| DevOps/SRE review   | `devops_sre_reviewer` / GPT-5.5 high         | release gate fail-closed, required gate list, candidate filtering 판단 |
| Docs release review | `docs_release_manager` / GPT-5.4-mini medium | assembler contract와 release report 문서 구조 정리                     |
| QA review           | `qa_agent` / GPT-5.5 high                    | missing/invalid/N/A/Markdown redaction test coverage 검토              |
| Implementation      | Codex local                                  | 기존 Node ESM release tooling 패턴에 맞춘 좁은 script/test/docs 변경   |

Spark는 사용하지 않았다. release/env/secret/report tooling은 하네스상 Spark 금지 또는 부적합 영역이다.

## Subagent 반영

| Subagent               | 주요 피드백                                                                                            | 반영                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `devops_sre_reviewer`  | `--release-candidate-id` 필수, mixed candidate 금지, missing/manual gate BLOCK, approval language 금지 | CLI 필수 옵션, `overallResult: INDEX_READY/BLOCK/NO-GO`, default required gates 구현 |
| `docs_release_manager` | 별도 assembler contract 문서, output fields, completion report counters 필요                           | `docs/60_release/release-evidence-index-assembler.md`, 완료 보고서 counters 반영     |
| `qa_agent`             | empty/missing/latest/tie-break/invalid/N/A/Markdown redaction 테스트 필요                              | `test/unit/release-evidence-index.test.mjs` 7개 focused tests 추가                   |

## 변경 파일

| 파일                                                                     | 변경 내용                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `scripts/release-evidence-index.mjs`                                     | release evidence index assembler 추가                                                    |
| `test/unit/release-evidence-index.test.mjs`                              | missing gate, latest selection, N/A, invalid artifact, Markdown redaction tests 추가     |
| `package.json`                                                           | `release:evidence:index`, `test:unit:release-evidence-index`, aggregate `pnpm test` 연결 |
| `docs/60_release/release-evidence-index-assembler.md`                    | assembler contract 문서 추가                                                             |
| `docs/60_release/credential-cleanup-release-evidence-template.md`        | index assembler 사용법 cross-link 추가                                                   |
| `docs/80_ai_harness/release-evidence-index-assembler-report-20260508.md` | 이번 slice 완료 보고서                                                                   |

## Assembler Contract

| 항목                      | 결과                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| CLI                       | `pnpm release:evidence:index --release-candidate-id <id> [--path ...] [--format json\|markdown]` |
| Candidate filter          | 필수. mixed release candidate 조립 금지                                                          |
| Validation                | `validateReleaseEvidenceArtifact` 재사용                                                         |
| Gate selection            | gate별 latest `createdAt` artifact 선택, 동일 시각은 relative path로 deterministic tie-break     |
| Candidate filtering       | 발견된 JSON artifact는 먼저 schema/hash 검증 후 release candidate mismatch만 제외                |
| Missing behavior          | required gate row `BLOCK`, status `MISSING`                                                      |
| Invalid artifact behavior | invalid row `BLOCK`, status `INVALID`, failure ids만 기록                                        |
| Allowed satisfied results | `PASS`, `N/A-SQLite-only`, `N/A-NoRows`                                                          |
| Output language           | approval 금지. `overallResult`는 `INDEX_READY`, `BLOCK`, `NO-GO`만 사용                          |
| Markdown safety           | table cell 단계에서 DSN/token/header/cookie/tokenHash-looking content redaction                  |

## 검증 결과

| 검증                                                                                                                  |           결과 | 비고                          |
| --------------------------------------------------------------------------------------------------------------------- | -------------: | ----------------------------- |
| `pnpm test:unit:release-evidence-index`                                                                               |           통과 | 7 tests                       |
| `pnpm test:unit:release-evidence-validate`                                                                            |           통과 | validator regression          |
| `pnpm test:unit:release-evidence-write`                                                                               |           통과 | writer regression             |
| `pnpm test:unit:release-evidence-capture`                                                                             |           통과 | capture regression            |
| `pnpm test:unit:production-release-gate`                                                                              |           통과 | release env gate regression   |
| `pnpm test:unit:artifact-secret-scan`                                                                                 |           통과 | release-evidence scan root    |
| `pnpm release:gate:logs`                                                                                              |           통과 | scannedFiles 178              |
| `pnpm release:evidence:index --release-candidate-id release-20260508-local --path release-evidence --format json`     | expected BLOCK | artifacts 0, missing gates 13 |
| `pnpm release:evidence:index --release-candidate-id release-20260508-local --path release-evidence --format markdown` | expected BLOCK | missing gate table 출력       |
| `pnpm format:check`                                                                                                   |           통과 | Prettier                      |
| `pnpm lint`                                                                                                           |           통과 | API tsc + Web eslint          |
| `pnpm typecheck`                                                                                                      |           통과 | shared/db/api/web             |
| `pnpm db:validate`                                                                                                    |           통과 | SQLite Prisma schema          |
| `pnpm build`                                                                                                          |           통과 | shared/db/api/web             |
| `pnpm test`                                                                                                           |           통과 | aggregate에 index test 포함   |

## Index Smoke Counters

| 항목                 |                       값 |
| -------------------- | -----------------------: |
| releaseCandidateId   | `release-20260508-local` |
| scannedFiles         |                        0 |
| validArtifactCount   |                        0 |
| invalidArtifactCount |                        0 |
| requiredGateCount    |                       13 |
| missingRequiredCount |                       13 |
| blockingCount        |                       13 |
| noGoCount            |                        0 |
| passLikeCount        |                        0 |
| overallResult        |                  `BLOCK` |

## 작업 전후 변동률

| 항목                                       | 작업 전 | 작업 후 |   변동 |
| ------------------------------------------ | ------: | ------: | -----: |
| Release evidence index assembler           |      0% |    100% | +100%p |
| Release report table automation            |     20% |     75% |  +55%p |
| Missing/manual gate fail-closed visibility |     35% |     85% |  +50%p |
| Markdown report redaction defense          |      0% |     80% |  +80%p |
| Release/Ops hardening aggregate            |     59% |     61% |   +2%p |

## Phase / Task 진행률

| 기준                                           | 현재 완료율 | 판단 근거                                      |
| ---------------------------------------------- | ----------: | ---------------------------------------------- |
| Phase 2 Backend/API foundation                 |       83.0% | API/DB/shared contract 변경 없음               |
| Phase 8 Web MVP / release evidence readiness   |       74.0% | capture/write/validate/index chain 확보        |
| Phase 9 Electron/operational release readiness |       61.0% | release report index와 blocker visibility 추가 |
| Backend/domain aggregate                       |       43.0% | domain API 신규 구현 없음                      |
| Release/Ops hardening aggregate                |       61.0% | evidence index assembler와 docs/tests 추가     |
| 전체 MVP harness 기준                          |       50.1% | 운영 증적 자동화는 전진, 주요 업무 기능은 동일 |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                    |
| ------------ | --------: | --------------------------------------- |
| Auth         |        No | 인증/세션/RBAC 변경 없음                |
| DB           |        No | Prisma schema/migration 변경 없음       |
| API contract |        No | Fastify/shared `ActionResult` 변경 없음 |
| UI           |        No | CLI/docs slice라 screenshot gate 불필요 |

## 남은 리스크

| 리스크                                                                     | 영향도 | 대응                                            |
| -------------------------------------------------------------------------- | -----: | ----------------------------------------------- |
| 실제 release artifacts가 없어 index는 expected BLOCK                       |   중간 | capture/write로 artifacts 생성 후 index 재실행  |
| `combined-release-gate`, external/manual gates는 attestation artifact 필요 |   중간 | no-row/manual attestation writer helper 필요    |
| PG runtime readiness는 여전히 BLOCK                                        |   높음 | PG dependency/client readiness slice 필요       |
| Markdown redaction은 방어막일 뿐 schema validation 대체 아님               |   중간 | validator와 secret scan을 계속 필수 gate로 유지 |

## 다음 작업 3단계 미리보기

| 순서 | 작업                                                | 세부 내용                                                                                                              | Subagent                                                           |
| ---: | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
|    1 | Cleanup no-row confirm/audit evidence writer helper | dry-run candidateCount 0일 때 `credential-cleanup-confirm`/`credential-cleanup-auditlog` `N/A-NoRows` artifacts 생성   | `security_reviewer`, `backend_agent`, `qa_agent`                   |
|    2 | Manual/external attestation artifact helper         | reverse proxy/CDN/APM, webhook receiver, rollback rehearsal attestation을 schema-valid artifact로 남기는 helper        | `devops_sre_reviewer`, `security_reviewer`, `docs_release_manager` |
|    3 | PostgreSQL dependency/client readiness spike        | `@prisma/adapter-pg`, `pg`, generated client, migration rehearsal 조건과 `pg:profile:require-readiness` PASS 경로 설계 | `db_reviewer`, `backend_agent`, `devops_sre_reviewer`              |
