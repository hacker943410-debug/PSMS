# Stage 1 Admin API Contract Preflight Completion Report

작성 시각: 2026-05-01 23:33 KST

## Summary

- Admin Foundation의 직원, 기초정보, 정책 관리 Fastify API 계약 preflight를 작성했다.
- `apps/api`가 domain source-of-truth이고 Web은 thin adapter라는 기준을 문서에 고정했다.
- PSMS_Tech의 older Server Action/generic CRUD 문구와 로컬 하네스 기준의 충돌 해석을 명시했다.
- 정책 `ACTIVE/SCHEDULED` 우회 변경을 막고 `/activate` transaction만 허용하도록 계약을 조정했다.
- 이번 작업은 문서 preflight이며 `apps/api`, `packages/shared`, `packages/db` 코드는 변경하지 않았다.

## 작업 분해 및 Task 진행율

| Task                 | 처리 내용                                                                                | 완료율 | 이번 증감 |
| -------------------- | ---------------------------------------------------------------------------------------- | -----: | --------: |
| 하네스/기술문서 확인 | current-state, development-flow, orchestrator, model-routing, approval/testing 정책 확인 |   100% |     +100% |
| 기술문서 대조        | PSMS_Tech backend/API/IA/DB 문서와 현재 API/DB 코드 대조                                 |   100% |     +100% |
| 자동 subagent 위임   | architect, backend, security, DB, code review 위임                                       |   100% |     +100% |
| 계약 결정            | route prefix, ADMIN guard, staff/base/policy DTO, error code, ownership 경계 확정        |   100% |     +100% |
| 리뷰 지적 수정       | 문서 충돌, policy activation 우회, loginId 규칙, user gate, policyType 정합성 수정       |   100% |     +100% |
| 검증                 | format/lint/typecheck/db validate, diff check, follow-up review 통과                     |   100% |     +100% |
| 완료 보고            | Phase/Task 진행율, 모델 선택, 다음 3단계 정리                                            |   100% |     +100% |

## Phase별 진행율

|                 Phase | 현재 / 전체 | 이번 증감 | 근거                                           |
| --------------------: | ----------: | --------: | ---------------------------------------------- |
|               Overall |  45% / 100% |       +1% | Admin API 구현 전 계약 gate 확정               |
|    0 Baseline/Harness |  87% / 100% |       +1% | approval/API gate 충돌 해소 문서화             |
|  1 Design System Gate |  89% / 100% |       +0% | UI 변경 없음                                   |
|           2 Auth/RBAC |  71% / 100% |       +1% | Admin API route-level guard 요구사항 확정      |
|             3 DB/Seed |  59% / 100% |       +0% | DB 변경 없음, policy history gap만 기록        |
|    4 Dashboard/Report |   9% / 100% |       +0% | 범위 외                                        |
|               5 Sales |   9% / 100% |       +0% | 범위 외                                        |
| 6 Receivable/Customer |   6% / 100% |       +0% | 범위 외                                        |
|  7 Schedule/Inventory |  18% / 100% |       +0% | 범위 외                                        |
|      8 Admin Settings |  34% / 100% |       +3% | staff/base/policy API route/DTO preflight 완료 |
|       9 QA/Validation |  55% / 100% |       +1% | API inject/test target와 gate 기준 정리        |

## 모델 선택 이유

| 역할                 | 모델           | 선택 이유                                                       |
| -------------------- | -------------- | --------------------------------------------------------------- |
| Main Codex           | GPT-5 계열     | 문서 작성, 하네스 기준 통합, 검증 실행                          |
| `architect_reviewer` | GPT-5.5        | Fastify source-of-truth, route boundary, contract conflict 판단 |
| `backend_agent`      | GPT-5.5        | route/DTO/service/repository/test target 매핑                   |
| `security_reviewer`  | GPT-5.5        | ADMIN guard, token/PII/audit 위험 검토                          |
| `db_reviewer`        | GPT-5.5        | Prisma model mapping, policy history/conflict gap 검토          |
| `code_reviewer`      | Codex reviewer | 문서 계약 결함과 blocking issue 재검토                          |
| Spark                | N/A            | API contract 문서라 Spark 사용 금지 범위에 해당                 |

## Subagent별 결과

| Subagent             | 주요 결과                                                                            | 반영                                           |
| -------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `architect_reviewer` | Fastify domain API 우선, generic CRUD 금지, policy enum/PSMS_Tech 충돌 지적          | 문서 충돌 해소와 route boundary에 반영         |
| `backend_agent`      | `/admin/*` root path, staff/base/policy DTO, test target 제안                        | 계약 route/DTO/test plan에 반영                |
| `security_reviewer`  | API route-level ADMIN guard, raw token/PII/audit redaction, backup/restore 분리 요구 | 보안 규칙과 Gate에 반영                        |
| `db_reviewer`        | policy history 미모델링, conflict DB constraint 부재, 물리 삭제 위험 지적            | 남은 결정 사항과 policy activation gate에 반영 |
| `code_reviewer`      | policy ACTIVE 우회, loginId ambiguity, user confirmation gate 누락 등 blocking 지적  | 수정 후 follow-up review `No blocking issues`  |

## 변경 파일

| 파일                                                                                           | 변경 내용                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `docs/00_system/admin-api-contract-preflight.md`                                               | Admin staff/base/policy API route, DTO, guard, error, test, gate 계약 추가 |
| `docs/80_ai_harness/stage-1-admin-api-contract-preflight-completion-report-20260501-233350.md` | 완료 보고서 추가                                                           |

## 검증 결과

| 명령/검토                                                            | 결과 | 비고                             |
| -------------------------------------------------------------------- | ---: | -------------------------------- |
| `pnpm format:check`                                                  | Pass | 전체 포맷 확인                   |
| `pnpm lint`                                                          | Pass | API/Web lint 통과                |
| `pnpm typecheck`                                                     | Pass | shared/db/api/web typecheck 통과 |
| `pnpm db:validate`                                                   | Pass | Prisma schema valid              |
| `git diff --check -- docs/00_system/admin-api-contract-preflight.md` | Pass | whitespace issue 없음            |
| `code_reviewer` follow-up                                            | Pass | No blocking issues               |

## Auth / DB / API Contract 변경 여부

| 영역         |               변경 여부 | 비고                                                         |
| ------------ | ----------------------: | ------------------------------------------------------------ |
| Auth         |                      No | 코드 변경 없음. Admin API guard 요구사항만 문서화            |
| DB           |                      No | schema/migration/seed 변경 없음                              |
| API Contract | No code / Yes preflight | Fastify Admin API 계약 문서만 추가. 구현 전 사용자 확인 필요 |

## 남은 리스크

| 리스크                                                                    | 수준 | 대응                                                                       |
| ------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------- |
| PSMS_Tech 원본 문서에는 older Server Action/generic CRUD 문구가 남아 있음 | 중간 | 구현 저장소 preflight를 우선하되, 다음 문서 동기화 단계에서 PSMS_Tech 갱신 |
| Policy history 전용 model 부재                                            | 높음 | `db_reviewer` gate에서 AuditLog 충분 여부 또는 schema 변경 결정            |
| Staff `loginId`가 DB `User.email`에 임시 저장됨                           | 중간 | 현 auth와 동일한 lowercase alphanumeric만 허용, 추후 schema rename 검토    |
| Admin API 구현은 아직 없음                                                | 중간 | 다음 단계에서 read-only page-data route부터 구현                           |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                                                   | Subagent / Spark                                                                                              |
| ---: | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
|    1 | 사용자 확인 + `architect_reviewer`: 이 preflight가 PSMS_Tech older API 문구보다 우선하는지 최종 승인   | `architect_reviewer` GPT-5.5                                                                                  |
|    2 | Admin read API scaffolding: shared Zod, Fastify session/admin guard, `/admin/*/page-data` inject tests | `backend_agent` GPT-5.5 + `security_reviewer` GPT-5.5                                                         |
|    3 | Web adapter 연결: static admin rows를 API-backed page data로 교체하고 기존 URL-state E2E 유지          | `frontend_agent` GPT-5.5 + `qa_agent` GPT-5.5 + `spark_ui_iterator` Spark for presentational-only adjustments |
