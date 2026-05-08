# Release Evidence Artifact Generator Report

작성일: 2026-05-08

## Summary

release evidence template과 validator 위에 안전한 artifact writer를 추가했다. 이제 operator는
`pnpm release:evidence:write`로 template-compatible JSON artifact를 만들 수 있고, writer는
canonical SHA256을 채운 뒤 validator를 통과한 경우에만 `release-evidence/<date>/<gate>/...`
아래에 파일을 쓴다.

writer는 raw shell history를 저장하지 않고 `commandTemplate`만 받으며, placeholder가 아닌
민감 인자가 들어오면 validator 단계에서 거부된다.

## 작업 분해

| 단계 | 내용                                                          | 상태 |
| ---- | ------------------------------------------------------------- | ---- |
| 1    | dirty worktree, MCP surface, evidence template/validator 확인 | 완료 |
| 2    | devops/security/QA subagent 위임                              | 완료 |
| 3    | `scripts/release-evidence-write.mjs` 추가                     | 완료 |
| 4    | writer fixture unit test 추가                                 | 완료 |
| 5    | `release:evidence:write` script와 aggregate test 연결         | 완료 |
| 6    | release evidence template 문서에 writer 사용법 추가           | 완료 |
| 7    | focused/aggregate 검증                                        | 완료 |

## 모델 선택 이유

| 역할                | 모델 계열    | 이유                                                                |
| ------------------- | ------------ | ------------------------------------------------------------------- |
| main Codex          | GPT-5.x      | writer 구현, validator 연동, 테스트/문서/보고서 통합                |
| devops_sre_reviewer | GPT-5.5 high | release artifact path/SHA/PASS-BLOCK evidence custody 검토          |
| security_reviewer   | GPT-5.5 high | command template, DSN/token/header/cookie secret echo 방지 검토     |
| qa_agent            | GPT-5.5 high | writer fixture, recursive validation, failure path 테스트 전략 검토 |

Spark는 사용하지 않았다. release/security evidence 자동화라 Spark 금지 범위다.

## 변경 파일

| 파일                                                              | 변경                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `scripts/release-evidence-write.mjs`                              | validator-compatible artifact builder/writer CLI 추가                                 |
| `test/unit/release-evidence-write.test.mjs`                       | build/write/refuse-invalid writer tests 추가                                          |
| `package.json`                                                    | `test:unit:release-evidence-write`, `release:evidence:write` 추가 및 `pnpm test` 연결 |
| `docs/60_release/credential-cleanup-release-evidence-template.md` | writer command와 validation command 갱신                                              |

## Subagent 결과

| Subagent            | 결과                                                                         | 반영                                                                          |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| devops_sre_reviewer | validator/writer는 SHA/path/result semantics를 엄격히 유지해야 함            | writer가 validator를 통과한 artifact만 write, overwrite 금지                  |
| security_reviewer   | copied command/actual token id/DSN/header/cookie가 artifact에 들어가면 안 됨 | commandTemplate placeholder 검증은 validator에 위임, invalid writer test 추가 |
| qa_agent            | writer가 생성한 artifact를 recursive validator로 검증해야 함                 | write 후 `validateReleaseEvidencePath` 통과 test 추가                         |

## Writer 주요 규칙

| 영역             | 규칙                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Path             | `release-evidence/<YYYYMMDD>/<gate>/<YYYYMMDD-HHmmss>-<gate>-<resultSlug>.json` 자동 생성 |
| SHA              | `artifactSha256`은 canonical JSON 기준으로 자동 계산                                      |
| Validation       | write 전에 `validateReleaseEvidenceArtifact`로 fail-closed 검증                           |
| Overwrite        | 기존 artifact를 덮어쓰지 않음                                                             |
| Scanner metadata | `release-evidence` 포함 scannedRoots를 표준값으로 채움                                    |
| Quarantine       | public artifact에 quarantine path를 쓰지 않음                                             |
| Command          | copied shell history가 아니라 placeholder 기반 `commandTemplate` 사용                     |

## 검증

| 명령                                           | 결과                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `pnpm test:unit:release-evidence-write`        | 통과                                     |
| `pnpm test:unit:release-evidence-validate`     | 통과                                     |
| `pnpm test:unit:artifact-secret-scan`          | 통과                                     |
| `pnpm test:unit:production-release-gate`       | 통과                                     |
| `pnpm release:gate:logs`                       | 통과                                     |
| `pnpm release:evidence:validate --allow-empty` | 통과                                     |
| `pnpm release:evidence:validate`               | 실패 기대값 확인, empty evidence `BLOCK` |
| `pnpm test`                                    | 통과                                     |
| `pnpm format:check`                            | 통과                                     |
| `pnpm typecheck`                               | 통과                                     |
| `pnpm lint`                                    | 통과                                     |
| `pnpm db:validate`                             | 통과                                     |
| `pnpm build`                                   | 통과                                     |
| `git diff --check`                             | 통과                                     |

## 작업 전/후 변동률

| 항목                              | 작업 전 | 작업 후 |  변동 |
| --------------------------------- | ------: | ------: | ----: |
| Release evidence artifact writer  |      0% |    100% | +100% |
| Canonical SHA artifact generation |      0% |    100% | +100% |
| Writer -> validator integration   |      0% |    100% | +100% |
| Manual evidence automation chain  |     45% |     70% | +25%p |
| Release/Ops hardening aggregate   |     53% |     55% |  +2%p |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                       |
| ---------------------------------- | -----: | ------------------------------------------ |
| Phase 2 Auth/RBAC/Credential       |  82.8% | credential cleanup evidence 생성 경로 추가 |
| Phase 8 DB/Transaction reliability |  68.2% | PG readiness는 BLOCK 유지                  |
| Phase 9 Release/Ops hardening      |    55% | artifact writer + validator chain 구성     |
| 전체 MVP 준비                      |  49.2% | release evidence 자동화 증가               |
| Backend/API hardening              |  42.8% | public API/shared contract 변경 없음       |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                               |
| ------------ | --------: | -------------------------------------------------- |
| Auth         |        No | session/RBAC/auth guard 변경 없음                  |
| DB           |        No | schema/migration 변경 없음                         |
| API contract |        No | Fastify public route/shared ActionResult 변경 없음 |

## 잔여 리스크

- writer는 artifact를 안전하게 생성하지만, 실제 release evidence 입력값 수집은 아직 operator/후속 자동화가 담당한다.
- `pnpm release:gate`는 real evidence artifact가 없으면 validator 단계에서 fail-closed로 실패한다.
- PostgreSQL runtime/dependency/generated client/migration은 아직 없으며 readiness는 `BLOCK`이다.
- 외부 reverse proxy/CDN/APM/webhook receiver attestation artifact 생성은 아직 자동화되지 않았다.

## 다음 작업 3단계 미리보기

1. Release evidence command capture adapters
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `qa_agent`
   - 내용: `release:gate:prod-env`, `release:gate:logs`, `pg:profile:preflight` 결과를 writer input으로 자동 변환
   - 산출물: command capture adapter tests와 validator-pass sample evidence

2. PostgreSQL dependency/client spike
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: `@prisma/adapter-pg`, `pg`, isolated generated client, disposable PG DB 연결 검토
   - 산출물: dependency/client isolation evidence, SQLite runtime regression result

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` AuditLog가 admin/user timeline에서 누락되지 않는지 확인
   - 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 release evidence artifact generator는 완료했다. writer는 validator-compatible
artifact를 만들고, invalid command template 같은 위험 입력은 write 전에 차단한다.
