# Release Evidence Schema Validator Report

작성일: 2026-05-08

## Summary

cleanup release evidence template을 실제로 검증하는 fail-closed validator를 추가했다. 이제
`release-evidence` JSON artifact는 path/date/gate/result slug, 필수 필드, canonical
SHA256, PASS/BLOCK/N/A 문맥, PostgreSQL scaffold/readiness 분리, cleanup candidate
allow-list, forbidden field 패턴, retention/quarantine 필드를 자동 검증할 수 있다.

기본 `pnpm release:evidence:validate`는 artifact가 없으면 `BLOCK`으로 실패한다.
테스트 전용 또는 preflight 용도로만 `--allow-empty`를 사용할 수 있다.

## 작업 분해

| 단계 | 내용                                                     | 상태 |
| ---- | -------------------------------------------------------- | ---- |
| 1    | dirty worktree, MCP surface, evidence template 확인      | 완료 |
| 2    | devops/security/QA subagent 위임                         | 완료 |
| 3    | `scripts/release-evidence-validate.mjs` 추가             | 완료 |
| 4    | fixture 기반 unit test 추가                              | 완료 |
| 5    | `release:evidence:validate` script와 `release:gate` 연결 | 완료 |
| 6    | template/release gate 문서 갱신                          | 완료 |
| 7    | focused/aggregate 검증                                   | 완료 |

## 모델 선택 이유

| 역할                | 모델 계열    | 이유                                                                          |
| ------------------- | ------------ | ----------------------------------------------------------------------------- |
| main Codex          | GPT-5.x      | validator 구현, 테스트/문서/보고서 통합, 최종 검증                            |
| devops_sre_reviewer | GPT-5.5 high | fail-closed evidence, SHA/path/PASS/BLOCK/N/A release semantics 검토          |
| security_reviewer   | GPT-5.5 high | forbidden fields, DSN/header/cookie/token URL, secret echo 방지 검토          |
| qa_agent            | GPT-5.5 high | fixture 전략, empty root, PG readiness, candidate allow-list 테스트 범위 검토 |

Spark는 사용하지 않았다. release/security evidence gate라 Spark 금지 범위다.

## 변경 파일

| 파일                                                              | 변경                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `scripts/release-evidence-validate.mjs`                           | release evidence validator CLI/pure validation 추가                                     |
| `test/unit/release-evidence-validate.test.mjs`                    | valid/missing/N/A/PG/forbidden/candidate/path/empty-root fixture tests 추가             |
| `package.json`                                                    | `test:unit:release-evidence-validate`, `release:evidence:validate`, `release:gate` 연결 |
| `docs/60_release/credential-cleanup-release-evidence-template.md` | validator command, filename result slug, required shape 세부 필드 갱신                  |
| `docs/60_release/production-env-and-log-release-gate.md`          | release evidence validator 실행 명령과 empty evidence BLOCK 기준 추가                   |

## Subagent 결과

| Subagent            | 결과                                                                                                        | 반영                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| devops_sre_reviewer | zero artifact 통과, SHA format-only, path/gate/date 미검증, PASS exitCode 미검증 지적                       | empty root fail-closed, canonical SHA, path/date/gate/result 검증, PASS exitCode=0 반영                  |
| security_reviewer   | URL-shaped PG DSN 금지, commandTemplate placeholder 요구, candidate exact allow-list, secret echo 방지 요구 | non-URL `postgresql:<redacted>` 정책, commandTemplate 검사, forbidden pattern, candidate allow-list 반영 |
| qa_agent            | Node test style, fixture 전략, unsupported N/A, PG readiness BLOCK/PASS 분리, directory scan 테스트 권고    | 10개 unit test로 반영                                                                                    |

## Validator 주요 규칙

| 영역            | 규칙                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Path            | `release-evidence/<YYYYMMDD>/<gate>/<YYYYMMDD-HHmmss>-<artifactSlug>-<resultSlug>.json`                        |
| Result          | JSON result는 `PASS`, `BLOCK`, `NO-GO`, `N/A-SQLite-only`, `N/A-NoRows`만 허용                                 |
| Filename result | `N/A-*`는 filename에서 `NA-*` slug 사용                                                                        |
| SHA256          | `artifactSha256`을 제외한 canonical JSON SHA256과 일치해야 함                                                  |
| PASS            | `exitCode: 0`, nonempty evidence, forbidden scan pass 필요                                                     |
| N/A-NoRows      | cleanup confirm/AuditLog gate + `candidateCount = 0`일 때만 허용                                               |
| PG readiness    | `pg:profile:preflight` + readiness BLOCK은 `PASS` 불가                                                         |
| Forbidden       | full DSN, tokenHash, raw token, credential URL, password fields, session/hash, cookie/header/webhook body 차단 |
| Candidate       | `tokenId`, `userId`, `purpose`, timestamps, `createdById`, had-state booleans, detection window만 허용         |

## 검증

| 명령                                             | 결과                                     |
| ------------------------------------------------ | ---------------------------------------- |
| `pnpm test:unit:release-evidence-validate`       | 통과                                     |
| `pnpm test:unit:artifact-secret-scan`            | 통과                                     |
| `pnpm test:unit:production-release-gate`         | 통과                                     |
| `pnpm release:gate:logs`                         | 통과                                     |
| `pnpm release:evidence:validate --allow-empty`   | 통과                                     |
| `pnpm release:evidence:validate`                 | 실패 기대값 확인, empty evidence `BLOCK` |
| `pnpm test:unit:postgresql-profile-preflight`    | 통과                                     |
| `pnpm pg:profile:preflight`                      | 통과, `readiness: "BLOCK"`               |
| `pnpm test:unit:credential-compensation-cleanup` | 통과                                     |
| `pnpm db:validate:pg-schema`                     | 통과                                     |
| `pnpm format:check`                              | 통과                                     |
| `pnpm typecheck`                                 | 통과                                     |
| `pnpm lint`                                      | 통과                                     |
| `pnpm db:validate`                               | 통과                                     |
| `pnpm build`                                     | 통과                                     |
| `pnpm test`                                      | 통과                                     |
| `git diff --check`                               | 통과                                     |

## 작업 전/후 변동률

| 항목                                             | 작업 전 | 작업 후 |  변동 |
| ------------------------------------------------ | ------: | ------: | ----: |
| Release evidence schema validator                |      0% |    100% | +100% |
| Empty evidence fail-closed automation            |      0% |    100% | +100% |
| Evidence canonical SHA enforcement               |      0% |    100% | +100% |
| PG scaffold/readiness validator coverage         |     20% |     95% | +75%p |
| Cleanup evidence candidate allow-list automation |     60% |     95% | +35%p |
| Release/Ops hardening aggregate                  |     50% |     53% |  +3%p |

## Phase / Task 진행율

| Phase / Task                       | 진행율 | 메모                                                   |
| ---------------------------------- | -----: | ------------------------------------------------------ |
| Phase 2 Auth/RBAC/Credential       |  82.7% | cleanup evidence output 검증 자동화 추가               |
| Phase 8 DB/Transaction reliability |  68.2% | PG readiness는 BLOCK 유지, scaffold evidence 검증 강화 |
| Phase 9 Release/Ops hardening      |    53% | release evidence validator가 `release:gate`에 연결됨   |
| 전체 MVP 준비                      |    49% | release gate 자동화 증가, 업무 기능 진행률은 유지      |
| Backend/API hardening              |  42.7% | public API/shared contract 변경 없음                   |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                               |
| ------------ | --------: | -------------------------------------------------- |
| Auth         |        No | session/RBAC/auth guard 변경 없음                  |
| DB           |        No | schema/migration 변경 없음                         |
| API contract |        No | Fastify public route/shared ActionResult 변경 없음 |

## 잔여 리스크

- 실제 release evidence artifact 생성기는 아직 없다. validator는 수동/외부 생성 artifact를 검증한다.
- 외부 reverse proxy/CDN/APM/webhook receiver attestation은 여전히 사람이 evidence를 만들어야 한다.
- PostgreSQL runtime/dependency/generated client/migration은 아직 없으며 readiness는 `BLOCK`이다.
- Quarantine 이동 자동화는 아직 없다. 현재 validator는 quarantine path 공개를 금지하고 shape만 검증한다.

## 다음 작업 3단계 미리보기

1. Release evidence artifact generator
   - subagents: `devops_sre_reviewer`, `security_reviewer`, `qa_agent`
   - 내용: env/log/cleanup dry-run 결과를 template shape로 저장하고 canonical SHA를 채우는 generator 추가
   - 산출물: `scripts/release-evidence-write.mjs`, safe fixture tests, validator 통과 sample artifact

2. PostgreSQL dependency/client spike
   - subagents: `db_reviewer`, `backend_agent`, `devops_sre_reviewer`
   - 내용: `@prisma/adapter-pg`, `pg`, isolated generated client, disposable PG DB 연결 검토
   - 산출물: dependency/client isolation evidence, SQLite runtime regression result

3. Admin credential audit read-model check
   - subagents: `backend_agent`, `frontend_agent`, `security_reviewer`
   - 내용: `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` AuditLog가 admin/user timeline에서 누락되지 않는지 확인
   - 산출물: read query smoke 또는 UI evidence 보강

## 완료 판정

이번 slice 목표인 release evidence schema validator는 완료했다. `release:gate`는 이제 env/log
뿐 아니라 evidence validator도 실행하며, 실제 evidence artifact가 없으면 fail-closed로
BLOCK 처리한다.
