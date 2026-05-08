# Release Evidence Command Capture Report

작성일: 2026-05-08

## 요약

release evidence writer/validator 위에 allow-listed command capture adapter를 추가했다.
`pnpm release:evidence:capture`는 고정된 release/ops 명령만 `spawn` argv 배열로 실행하고,
stdout/stderr를 artifact 생성 전에 redaction한 뒤 per-command mapper로 `summary`와
`evidence`를 만든다. 최종 JSON write는 기존 `release-evidence-write.mjs`만 사용한다.

이 slice는 release gate evidence recorder이며 release approval engine이 아니다.
`pg:profile:preflight ok=true`라도 `readiness: "BLOCK"`이면 artifact result는 `BLOCK`이다.

## 작업 분해

| 단계 | 작업                                               | 상태 |
| ---: | -------------------------------------------------- | ---- |
|    1 | 하네스 문서, MCP surface, dirty worktree 확인      | 완료 |
|    2 | release evidence capture adapter 범위 확정         | 완료 |
|    3 | DevOps/Security/QA subagent read-only 검토         | 완료 |
|    4 | allow-list/no-shell/redaction/BLOCK semantics 구현 | 완료 |
|    5 | unit test 및 aggregate script 연결                 | 완료 |
|    6 | release evidence template 문서 갱신                | 완료 |
|    7 | 검증 실행 및 보고서 작성                           | 완료 |

## 모델 선택 이유

| 역할              | 모델/Agent                           | 이유                                                                                                 |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| DevOps/SRE review | `devops_sre_reviewer` / GPT-5.5 high | release gate, command execution, artifact lifecycle은 릴리즈 안정성 영향이 커서 강한 reviewer가 필요 |
| Security review   | `security_reviewer` / GPT-5.5 high   | stdout/stderr, DSN, token, cookie, Authorization redaction은 보안 경계라 Spark/mini 배제             |
| QA strategy       | `qa_agent` / GPT-5.5 high            | PG readiness, BLOCK/PASS, timeout, redaction regression의 테스트 전략 검토                           |
| Implementation    | Codex local                          | 기존 Node ESM script/test 패턴에 맞춘 좁은 파일 변경                                                 |

Spark는 사용하지 않았다. release/env/secret/audit-adjacent 작업이므로 하네스 정책상 Spark 대상이 아니다.

## Subagent 결과

| Subagent              | 결과                                                                                                                       | 반영                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `devops_sre_reviewer` | `release:gate`는 자기참조 validation 때문에 capture 대상에서 제외, fixed argv/no-shell, BLOCK artifact exit semantics 요구 | `COMMANDS` allow-list에서 `release:gate` 제외, CLI는 `capturedResult !== PASS` 시 exit 1 |
| `security_reviewer`   | raw output 저장 금지, DSN/token/header/cookie/webhook redaction, high-risk output은 PASS 금지                              | `redactCommandOutputWithFindings`, `redactionHighRisk` -> `BLOCK` 반영                   |
| `qa_agent`            | allow-list, no-shell, PG readiness BLOCK, timeout, cleanup candidate allow-list, secret redaction 테스트 요구              | `test/unit/release-evidence-capture.test.mjs` 8개 케이스 추가                            |

## 변경 파일

| 파일                                                                     | 변경 내용                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `scripts/release-evidence-capture.mjs`                                   | allow-listed command capture adapter 추가                                                    |
| `test/unit/release-evidence-capture.test.mjs`                            | capture/redaction/PG BLOCK/timeout/no-shell regression test 추가                             |
| `package.json`                                                           | `release:evidence:capture`, `test:unit:release-evidence-capture`, aggregate `pnpm test` 연결 |
| `docs/60_release/credential-cleanup-release-evidence-template.md`        | command capture 사용법과 allowed command key 문서화                                          |
| `docs/80_ai_harness/release-evidence-command-capture-report-20260508.md` | 이번 slice 완료 보고서                                                                       |

## 구현 세부

| 항목                | 결과                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command allow-list  | `prod-env`, `secret-scan`, `pg-profile-preflight`, `pg-profile-readiness`, `credential-cleanup-dry-run`                                                |
| 제외한 명령         | `release:gate`는 evidence validation 자기참조 때문에 제외                                                                                              |
| 실행 방식           | `spawn(executable, args, { shell: false, windowsHide: true })`                                                                                         |
| 출력 저장           | raw stdout/stderr 원문 미저장, byte count와 derived evidence만 저장                                                                                    |
| Redaction           | PostgreSQL DSN, credential URL/token query, Authorization, Cookie/Set-Cookie, X-API-Key, JSON password/token/session/webhook fields, env secret suffix |
| High-risk handling  | redaction event가 있으면 child exit 0이어도 artifact result를 `BLOCK`으로 낮춤                                                                         |
| Writer 연결         | `writeReleaseEvidenceArtifact` 호출, schema/hash/no-overwrite 재사용                                                                                   |
| API/shared contract | 변경 없음                                                                                                                                              |
| DB schema           | 변경 없음                                                                                                                                              |
| UI/design gate      | 변경 없음, CLI/release script slice라 screenshot 불필요                                                                                                |

## 검증 결과

| 검증                                          |          결과 | 비고                                          |
| --------------------------------------------- | ------------: | --------------------------------------------- |
| `pnpm test:unit:release-evidence-capture`     |          통과 | 8 tests                                       |
| `pnpm test:unit:release-evidence-write`       |          통과 | writer regression                             |
| `pnpm test:unit:release-evidence-validate`    |          통과 | validator regression                          |
| `pnpm test:unit:production-release-gate`      |          통과 | prod env gate regression                      |
| `pnpm test:unit:postgresql-profile-preflight` |          통과 | readiness BLOCK expected path 포함            |
| `pnpm test:unit:artifact-secret-scan`         |          통과 | release-evidence scan root                    |
| `pnpm release:gate:logs`                      |          통과 | scannedFiles 153, skipped binary-extension 65 |
| `pnpm pg:profile:preflight`                   |          통과 | `ok: true`, `readiness: "BLOCK"`              |
| `pnpm pg:profile:require-readiness`           | expected fail | exit 1, PG runtime/client/migrations absent   |
| `pnpm format:check`                           |          통과 | Prettier                                      |
| `pnpm lint`                                   |          통과 | API tsc + Web eslint                          |
| `pnpm typecheck`                              |          통과 | shared/db/api/web                             |
| `pnpm db:validate`                            |          통과 | SQLite schema                                 |
| `pnpm build`                                  |          통과 | shared/db/api/web                             |
| `pnpm test`                                   |          통과 | aggregate에 capture test 포함                 |

## 작업 전후 변동률

| 항목                                     | 작업 전 | 작업 후 |   변동 |
| ---------------------------------------- | ------: | ------: | -----: |
| Release evidence command capture         |      0% |    100% | +100%p |
| Evidence writer 자동 입력 연결           |     70% |     85% |  +15%p |
| Release evidence redaction hardening     |     65% |     78% |  +13%p |
| PostgreSQL readiness evidence separation |     70% |     78% |   +8%p |
| Release/Ops hardening aggregate          |     55% |     57% |   +2%p |

## Phase / Task 진행률

| 기준                                           | 현재 완료율 | 판단 근거                                                           |
| ---------------------------------------------- | ----------: | ------------------------------------------------------------------- |
| Phase 2 Backend/API foundation                 |       82.8% | API contract 변경 없이 기존 credential/release 테스트 유지          |
| Phase 8 Web MVP / release evidence readiness   |       70.0% | evidence validator/writer/capture chain 확보                        |
| Phase 9 Electron/operational release readiness |       57.0% | release evidence와 PG scaffold gate는 강화, PG runtime은 아직 BLOCK |
| Backend/domain aggregate                       |       42.8% | 이번 slice는 domain 기능 추가 아님                                  |
| Release/Ops hardening aggregate                |       57.0% | command capture adapter와 aggregate 검증 추가                       |
| 전체 MVP harness 기준                          |       49.5% | 릴리즈 증적 자동화가 전진했지만 주요 업무 기능은 동일               |

## 남은 리스크

| 리스크                           | 영향도 | 대응                                                                                                          |
| -------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------- |
| cleanup confirm capture 미구현   |   중간 | dry-run capture만 자동화됨. confirm은 token/admin/operator/ticket placeholder 정책 확정 후 별도 slice         |
| `release:gate` capture 제외      |   낮음 | 자기참조 evidence validation 때문에 의도적 제외. 개별 gate artifact를 capture한 뒤 release report에서 index화 |
| PG execution readiness BLOCK     |   높음 | `@prisma/adapter-pg`, `pg`, generated client, PG migrations absent. 다음 PG runtime slice 필요                |
| high-risk output BLOCK semantics |   중간 | redaction 감지 시 PASS를 BLOCK으로 낮춘다. release report에서 quarantine 판단 필요                            |

## 다음 작업 3단계 미리보기

| 순서 | 작업                                         | 세부 내용                                                                                                                          | Subagent                                                  |
| ---: | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
|    1 | Credential cleanup confirm capture           | `credential-cleanup-confirm` command key, token/admin/operator/ticket placeholder CLI 정책, N/A-NoRows confirm/audit evidence 분리 | `security_reviewer`, `backend_agent`, `qa_agent`          |
|    2 | Release evidence index/report assembler      | 개별 artifact를 읽어 release report index table을 생성하고 missing/manual gate를 `BLOCK`으로 표시                                  | `devops_sre_reviewer`, `docs_release_manager`, `qa_agent` |
|    3 | PostgreSQL dependency/client readiness spike | PG deps/client/migration rehearsal 전환 조건과 `pg:profile:require-readiness` PASS 경로 설계                                       | `db_reviewer`, `backend_agent`, `devops_sre_reviewer`     |
