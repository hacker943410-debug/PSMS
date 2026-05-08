# Worktree Cleanup And Hygiene Report

작성일: 2026-05-08

## 요약

작업트리 dirty 원인은 generated artifact가 아니라 여러 credential/release hardening slice가 커밋 경계 없이
누적된 것이다. `.gitignore`는 `node_modules`, `.next`, `.tmp`, SQLite DB, Playwright 산출물, dev log,
TypeScript cache를 이미 차단하고 있다.

이번 정리는 기존 변경을 되돌리지 않고, 의도된 코드/문서/테스트 산출물을 검증 후 하나의 정리 커밋으로
보존해 `git status --short`가 clean이 되도록 하는 방식으로 진행한다.

## 전체 트리 점검

| 영역                        | 상태                                                          | 판단                                                  |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Root tracked files          | 388 files                                                     | 일반 source/docs/test 중심                            |
| Ignored runtime artifacts   | `.tmp`, `.next`, `node_modules`, DB, logs, Playwright outputs | `.gitignore`로 관리 중                                |
| Modified tracked files      | 13 files                                                      | credential cleanup/release evidence/harness rule 변경 |
| Untracked source/docs/tests | 30 files                                                      | 이전 연속 slice 산출물, 커밋 대상                     |
| 위험한 삭제 대상            | 없음                                                          | 삭제로 clean 처리하지 않음                            |

## Dirty 분류

| 분류                   | 파일 수 | 예시                                                                     | 처리 |
| ---------------------- | ------: | ------------------------------------------------------------------------ | ---- |
| API/repository/service |       2 | credential compensation cleanup service/repository                       | 커밋 |
| Release scripts        |       7 | release evidence validate/write/capture/index, PG preflight, cleanup CLI | 커밋 |
| DB profile scaffold    |       2 | PostgreSQL schema/config scaffold                                        | 커밋 |
| Unit/E2E tests         |      10 | release evidence, cleanup, PG preflight, artifact scan tests             | 커밋 |
| Release/harness docs   |      22 | runbooks, templates, completion reports, harness cleanup rules           | 커밋 |

## 재발 방지 규칙

| 규칙                                                       | 위치                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 완료 전 `git status --short` 확인                          | `AGENTS.md`, `docs/20_execution/task-execution-rule.md`                                            |
| 완료된 background subagent close 및 잔여 활성 확인         | `AGENTS.md`, `docs/00_core/orchestrator-rules.md`, `docs/20_execution/task-report-format.md`       |
| dirty/untracked가 남으면 커밋 대상 또는 의도적 잔여로 보고 | `AGENTS.md`, `docs/20_execution/task-execution-rule.md`, `docs/20_execution/task-report-format.md` |
| 완료 보고서에 worktree cleanup 섹션 포함                   | `docs/20_execution/task-report-format.md`                                                          |

## Cleanup 기준

| 항목                            | 결정                       |
| ------------------------------- | -------------------------- |
| 관련 없는 변경 revert           | 하지 않음                  |
| untracked source/docs/test 삭제 | 하지 않음                  |
| ignored runtime artifact 추적   | 하지 않음                  |
| 현재 dirty 정리 방식            | 검증 후 커밋               |
| 커밋 후 기대 상태               | `git status --short` clean |

## 검증 계획

| 검증                     | 목적                                 |
| ------------------------ | ------------------------------------ |
| `pnpm format:check`      | 문서/코드 포맷                       |
| `pnpm lint`              | API/Web lint 및 TS noEmit            |
| `pnpm typecheck`         | workspace type safety                |
| `pnpm db:validate`       | SQLite Prisma schema                 |
| `pnpm build`             | shared/db/api/web build              |
| `pnpm test`              | aggregate unit/API inject regression |
| `pnpm release:gate:logs` | artifact/log secret scan             |
| `git diff --check`       | whitespace/patch hygiene             |
| `git status --short`     | 최종 clean 확인                      |

## Background Subagent Cleanup

| 항목                                | 상태 |
| ----------------------------------- | ---- |
| 이번 정리 작업에서 새 subagent 사용 | No   |
| 기존 잔여 subagent 확인             | 완료 |
| 최종 정리 필요 대상                 | 없음 |
