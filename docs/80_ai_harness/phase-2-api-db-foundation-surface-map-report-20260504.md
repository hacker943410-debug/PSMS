# Phase 2 API/DB Foundation Surface Map Report

작성일: 2026-05-04
작업 기준: 현재 PSMS 하네스, Design Reference Match Gate 종료 직후 Phase 2 진입 전 점검

## 요약

- Design Reference Match Gate `10 / 10` 사용자 승인 완료 이후, 다음 구현 단계인 Phase 2 API/DB Foundation의 실제 코드 표면을 매핑했다.
- 이번 작업은 읽기 중심 preflight이며, Auth / DB / API contract 구현 파일은 변경하지 않았다.
- Fastify auth/session/admin read API, Web adapter, shared schema, Prisma/seed/reset/test 표면을 확인했고 Admin Foundation 전에 처리할 위험 항목을 우선순위화했다.
- 자동 subagent 4개를 병렬 위임해 architecture, security, DB, codebase map 관점의 독립 검토를 받았다.

## 작업 분해

| Task | 내용                                         | 담당               | 상태 | 산출물                                         |
| ---- | -------------------------------------------- | ------------------ | ---- | ---------------------------------------------- |
| T1   | MCP/하네스/워크트리 상태 확인                | Orchestrator       | 완료 | MCP enabled surface, dirty worktree 확인       |
| T2   | API/Auth/Shared/Web adapter 표면 매핑        | codebase_mapper    | 완료 | endpoint, file map, gap list                   |
| T3   | Phase 2 완료 기준 및 Phase 3 경계 검토       | architect_reviewer | 완료 | completion criteria, guardrail, stale-doc risk |
| T4   | Auth/session/RBAC/security preflight         | security_reviewer  | 완료 | 보안 위험 및 다음 보안 작업 3개                |
| T5   | Prisma/seed/reset/transaction readiness 검토 | db_reviewer        | 완료 | DB foundation gap 및 seed/reset 기준           |
| T6   | 통합 완료 보고 작성                          | Orchestrator       | 완료 | 본 보고서                                      |

## Subagent 위임 및 모델 선택 이유

| 세부 작업                      | Subagent                    | Model        | Reasoning | 권한      | 배정 이유                                                                              |
| ------------------------------ | --------------------------- | ------------ | --------- | --------- | -------------------------------------------------------------------------------------- |
| 코드베이스 표면 매핑           | codebase_mapper / Singer    | GPT-5.4-mini | medium    | 읽기 전용 | 넓은 파일 탐색과 구조 요약에 충분히 빠르고 비용 효율적이다.                            |
| Architecture/API contract 검토 | architect_reviewer / Hume   | GPT-5.5      | high      | 읽기 전용 | API/DB/Auth 경계와 Phase gate 판단은 고위험 계약 판단이므로 최고 추론 모델을 사용했다. |
| Auth/RBAC/security 검토        | security_reviewer / Mencius | GPT-5.5      | high      | 읽기 전용 | 세션, 쿠키, 권한, 감사 로그는 완화하면 안 되는 보안 영역이다.                          |
| Prisma/seed/reset 검토         | db_reviewer / Tesla         | GPT-5.5      | high      | 읽기 전용 | DB schema, seed, transaction, migration 판단은 프로젝트 규칙상 GPT-5.5 리뷰 대상이다.  |

## 전체 진행률 요약

| 기준                        | 현재 완료율 | 판단 근거                                                                                                                                      |
| --------------------------- | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 전체 준비 포함              |         36% | Harness, workspace, design gate는 닫혔고 API/Auth foundation 일부가 구현되어 있으나 업무 기능은 대부분 미연결이다.                             |
| Web/API MVP 업무 기능       |         14% | 로그인/session/admin read 일부만 실제 연결되어 있고 CRUD, 판매, 수납, 재고 transaction은 미구현이다.                                           |
| Design Reference Match Gate |        100% | 기준 PNG 10개 화면 사용자 승인 완료.                                                                                                           |
| Phase 2 API/DB Foundation   |         70% | health/auth/session/admin read/seed/reset/inject test 표면은 존재하나 cookie hardening, shared DTO, rate limit, acceptance seed 보강이 남았다. |
| 이번 Surface Map Task       |        100% | 4개 subagent 검토와 통합 보고 완료.                                                                                                            |

## Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                                        | 완료율 |
| ----: | ---------------------------- | ------------------------------------------------------------------------------------------------ | -----: |
|     0 | Baseline/Harness             | workspace, ports, docs, agent/routing/validation 기준 정리 완료                                  |   100% |
|     1 | Design System Gate           | 디자인 레퍼런스 10개 화면 사용자 승인 완료                                                       |   100% |
|     2 | API/DB Foundation            | Fastify auth/session/admin read, shared schema, Prisma seed/reset/test 표면 확인. 잔여 보강 필요 |    70% |
|     3 | Admin Foundation             | staffs/base/policies UI와 read API 일부 존재. CRUD/정책 활성화/감사 로그 미구현                  |    12% |
|     4 | Inventory                    | 디자인 정합성 후보 통과 이력은 있으나 기능 API/상태 전환 미구현                                  |    10% |
|     5 | Sales                        | 화면 skeleton/디자인 정합성 이력 중심. sale transaction 미구현                                   |     8% |
|     6 | Receivable/Customer/Schedule | 화면 skeleton/정합성 이력 중심. 수납/취소/잔액 재계산 미구현                                     |     8% |
|     7 | Dashboard/Report/Export      | 대시보드/리포트 화면 정합성 이력은 있으나 실제 집계/export/audit 미구현                          |     8% |
|     8 | Web MVP Gate                 | 통합 E2E, build, domain 기능 gate 대기                                                           |     5% |
|     9 | Electron Release             | Electron shell placeholder 단계                                                                  |     3% |

## 현재 API/Auth/DB 표면

| 영역             | 현재 확인된 표면                                                                                                 | 상태                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| API health       | `GET /health`                                                                                                    | 존재                  |
| Auth API         | `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`                                                     | 존재                  |
| Admin read API   | `/admin/staffs/page-data`, `/detail`; `/admin/base/page-data`, `/detail`; `/admin/policies/page-data`, `/detail` | 존재                  |
| Web adapter      | `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/admin-read-api.ts`                                           | 존재                  |
| Shared contracts | `ActionResult`, session/auth helpers, login/admin query Zod schemas                                              | 일부 존재             |
| DB               | `User`, `Session`, `Store`, master/domain models, `AuditLog`                                                     | schema/migration 존재 |
| Seed/reset       | smoke auth seed, e2e isolated reset, Prisma validate/generate scripts                                            | 존재                  |
| Tests            | API inject smoke, route guard E2E, unit tests 일부                                                               | 존재                  |

## 주요 리스크와 대응 우선순위

| 우선순위 | 리스크                                                                                          | 영향                                   | 대응                                                             |
| -------: | ----------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
|        1 | `/auth/session`, `/auth/logout` cookie parser가 malformed percent-encoding을 보수 처리하지 않음 | 비정상 cookie가 500으로 이어질 수 있음 | cookie parsing hardening 및 malformed cookie inject test 추가    |
|        2 | Admin page-data/detail response DTO가 API/Web에 중복됨                                          | API contract drift 위험                | shared DTO promotion 및 API/Web import 단일화                    |
|        3 | login rate limit이 in-memory이며 production에서 throw                                           | production auth 사용 불가              | persistent rate-limit 설계 확정 후 구현                          |
|        4 | Seed가 smoke/auth 중심이며 acceptance/master data seed 부족                                     | Admin CRUD와 판매 선택값 검증 불안정   | acceptance seed 설계 및 idempotency gate 추가                    |
|        5 | Web ADMIN guard가 page별 산재                                                                   | 신규 admin child route guard 누락 위험 | 중앙 guard helper와 route guard 테스트 추가                      |
|        6 | 외부 기술문서 일부가 현재 Fastify workspace와 충돌                                              | 구현 판단 혼선                         | 현재 repo harness 문서를 우선하고 stale-doc conflict를 별도 기록 |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                                 |
| ------------ | --------: | -------------------------------------------------------------------- |
| Auth         |        No | 이번 작업은 읽기 중심 점검과 보고서 작성만 수행했다.                 |
| DB           |        No | Prisma schema, migration, seed 파일은 변경하지 않았다.               |
| API contract |        No | endpoint, response shape, shared schema 구현 파일은 변경하지 않았다. |

## 변경 파일

| 파일                                                                          | 변경 내용                                         | 담당         |
| ----------------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| `docs/80_ai_harness/phase-2-api-db-foundation-surface-map-report-20260504.md` | Phase 2 API/DB/Auth 표면 매핑 완료 보고 신규 작성 | Orchestrator |

## 검증 결과

| 검증                   | 결과 | 근거                                              |
| ---------------------- | ---: | ------------------------------------------------- |
| `pnpm db:validate`     | 통과 | Prisma schema valid                               |
| `pnpm test:api:inject` | 통과 | auth, admin guard, admin read inject smoke passed |
| `pnpm format:check`    | 통과 | Prettier check passed                             |
| `git diff --check`     | 통과 | whitespace error 없음                             |
| Web/API HTTP smoke     | 통과 | API `/health` 200, Web `/settings/policies` 200   |

## 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                                     | Subagent                                                       | Model                         | 완료 기준                                                                                                          |
| ---: | ------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
|    1 | Auth cookie parsing hardening 및 malformed cookie inject test | security_reviewer + backend_agent + qa_agent                   | GPT-5.5 high + GPT-5.5 high   | `/auth/session`, `/auth/logout`, admin guard가 malformed cookie를 `AUTH_REQUIRED`로 보수 처리하고 inject test 통과 |
|    2 | Admin read response DTO shared contract 승격                  | architect_reviewer + backend_agent + frontend_agent + qa_agent | GPT-5.5 high + GPT-5.5 medium | API/Web 중복 DTO 제거, `packages/shared` 단일 import, typecheck/test 통과                                          |
|    3 | Acceptance/master seed 및 idempotency gate 설계               | db_reviewer + backend_agent + qa_agent                         | GPT-5.5 high                  | Admin CRUD와 판매 선택값에 필요한 seed 범위 확정, reset/idempotency 검증 명령 추가                                 |

## 작업 완료 판단

- 이번 Surface Map Task는 완료 상태다.
- Phase 2 자체는 구현 보강이 남아 있으므로 `완료`가 아니라 `진행 중`으로 유지한다.
- 다음 구현은 보안 위험이 작고 blast radius가 제한적인 cookie parsing hardening부터 시작하는 것이 가장 안전하다.
