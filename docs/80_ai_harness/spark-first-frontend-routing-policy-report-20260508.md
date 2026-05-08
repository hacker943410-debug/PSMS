# Spark-First Frontend Routing Policy Report

작성일: 2026-05-08

## 요약

프론트엔드 작업에서 Spark 사용률이 낮았던 문제를 반영해, DB/인증/API contract 비관련
`apps/web` 프론트엔드 작업은 `spark_ui_iterator`를 우선 사용하도록 하네스 정책을 변경했다.
Spark 한도가 소진되었거나 사용할 수 없는 경우에는 기존 `frontend_agent` 중심 라우팅으로 전환해
작업을 계속한다.

## 변경된 라우팅 원칙

| 항목                  | 변경 전                      | 변경 후                                                    |
| --------------------- | ---------------------------- | ---------------------------------------------------------- |
| Spark 기본 위치       | 순수 UI skeleton/markup 중심 | DB/인증/API contract 비관련 `apps/web` frontend 기본 1순위 |
| Route-aware frontend  | 기본 `frontend_agent`        | Spark 우선, 경계 조건 또는 한도 소진 시 `frontend_agent`   |
| API adapter/contract  | Spark 금지                   | Spark 금지 유지                                            |
| Auth/session/RBAC     | Spark 금지                   | Spark 금지 유지                                            |
| DB/Prisma             | Spark 금지                   | Spark 금지 유지                                            |
| Spark quota exhausted | 명시 없음                    | 기존 하네스 라우팅으로 fallback                            |

## Spark 우선 사용 범위

| 범위               | 예시                                                              |
| ------------------ | ----------------------------------------------------------------- |
| Page composition   | `apps/web` route/page layout, section composition                 |
| Client UI          | Drawer, Modal, Form, FilterBar, DataTable, tabs, controls         |
| UI state           | URL Search Params 기반 UI state wiring, empty/loading/error state |
| Visual iteration   | Tailwind layout, responsive state, design reference 보정          |
| API-backed display | 이미 승인된 API/read adapter를 호출하는 frontend-only 화면 연결   |
| Frontend tests     | frontend-only unit/component test scaffold                        |

## Spark 금지 및 Escalation

| 조건                                                  | 전환 대상                                  |
| ----------------------------------------------------- | ------------------------------------------ |
| auth/session/RBAC/password/cookie                     | `security_reviewer`, `frontend_agent`      |
| DB/Prisma/schema/migration/seed                       | `db_reviewer`                              |
| Fastify/shared API contract 변경                      | `architect_reviewer`, `backend_agent`      |
| Web Server Action 또는 API adapter contract 신설/변경 | `frontend_agent`, 필요 시 `backend_agent`  |
| payment/receivable/sale/policy/business transaction   | `backend_agent`, `architect_reviewer`      |
| Spark 한도 소진 또는 unavailable                      | 기존 `frontend_agent`/검증 subagent 라우팅 |

## 변경 파일

| 파일                                                                        | 변경 내용                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| `AGENTS.md`                                                                 | Spark-first frontend 원칙과 quota fallback 추가     |
| `docs/00_core/model-routing.md`                                             | Spark 우선순위와 escalation 기준 갱신               |
| `docs/00_core/approval-policy.md`                                           | Spark 허용/금지 범위 재정의                         |
| `docs/10_agents/agent-map.md`                                               | `spark_ui_iterator`/`frontend_agent` 사용 조건 갱신 |
| `docs/20_execution/task-execution-rule.md`                                  | Spark 우선 사용 범위와 fallback 명시                |
| `docs/80_ai_harness/spark-first-frontend-routing-policy-report-20260508.md` | 정책 변경 보고                                      |

## 검증

| 검증                      | 결과         |
| ------------------------- | ------------ |
| `pnpm format:check`       | 통과         |
| `git diff --check`        | 통과         |
| 최종 `git status --short` | 커밋 후 확인 |

## Background Subagent Cleanup

| 항목                       | 상태 | 비고                        |
| -------------------------- | ---- | --------------------------- |
| 이번 작업 subagent 사용    | No   | 정책 문서 변경만 수행       |
| 완료된 subagent close 여부 | N/A  | 새 background subagent 없음 |
| 잔여 활성 subagent 여부    | 없음 | 별도 실행 대상 없음         |

## Worktree Cleanup

| 항목              | 상태      | 비고                        |
| ----------------- | --------- | --------------------------- |
| 커밋 처리         | 예정      | 검증 통과 후 정책 변경 커밋 |
| 의도적 dirty 잔여 | 없음 예정 | 커밋 후 최종 status 확인    |
