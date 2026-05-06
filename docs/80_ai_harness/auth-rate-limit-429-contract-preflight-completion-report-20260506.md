# Auth Rate Limit 429 Contract Preflight Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 작업으로 `/auth/login` rate-limit 차단 응답을
`429 RATE_LIMITED`로 전환하기 위한 API contract preflight를 완료했다.

이번 작업은 구현 전 승인/설계 문서화 단계다. 실제 `apps/api`,
`apps/web`, `packages/shared`, `packages/db` 동작은 변경하지 않았다.

결론은 조건부 Go다. 후속 구현 시 일반 로그인 실패는 기존
`403/FORBIDDEN`을 유지하고, rate-limit 차단만 `429/RATE_LIMITED`와
`Retry-After` header로 분리한다.

## 2. 작업 분해

| Task | 내용                                                  | 담당      | 상태 | 진행율 |
| ---- | ----------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/필수 문서와 기존 auth rate-limit 구현 확인 | Codex     | 완료 |   100% |
| T2   | architecture/security/backend/QA subagent 자동 위임   | Subagents | 완료 |   100% |
| T3   | 현재 코드 흐름과 테스트 영향 범위 확인                | Codex     | 완료 |   100% |
| T4   | `429 RATE_LIMITED` contract preflight 문서 작성       | Codex     | 완료 |   100% |
| T5   | 문서 검증 및 diff 확인                                | Codex     | 완료 |   100% |
| T6   | 완료 보고서 작성                                      | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role         | Model route  | 선택 이유                                                            | 결과                                                                                      |
| ---------------- | -------------------- | ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Heisenberg       | `architect_reviewer` | GPT-5.5 high | Fastify API contract, `ActionResult`, Web/API 경계 판단 필요         | 조건부 Go. `ActionResult` shape 유지, rate-limit만 `429/RATE_LIMITED` 권고                |
| Nash             | `security_reviewer`  | GPT-5.5 high | auth/login, brute-force 방어, Retry header, 정보 노출 위험 검토 필요 | 조건부 Go. `Retry-After`, `no-store`, 계정 존재 정보 비노출 요구                          |
| Galileo          | `backend_agent`      | GPT-5.5 high | Fastify route/service 최소 구현 경로와 타입 영향 판단 필요           | 구현 가능. `checkLoginRateLimit()` 값을 service 결과로 전달하고 route에서 429/header 매핑 |
| Boole            | `qa_agent`           | GPT-5.5 high | auth API contract 변경의 테스트 영향 범위와 회귀 매트릭스 판단 필요  | 테스트 준비도 높음. 직접 영향은 API inject blocked assertion                              |
| Codex controller | main                 | GPT-5        | 하네스 문서 통합, 산출물 작성, 검증 실행                             | preflight 문서와 완료 보고서 작성                                                         |

Spark/mini는 사용하지 않았다. 이번 작업은 auth/API contract/security
영역이라 하네스 규칙상 Spark 금지 범위이며, mini로 판단하기엔 계약
리스크가 크다.

## 4. 변경 파일

| 파일                                                                                      | 변경 내용                                                              | 담당  |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----- |
| `docs/00_system/auth-rate-limit-429-contract-preflight.md`                                | 429 전환 계약, 구현 범위, 금지 범위, 보안 요구, 테스트 계획, gate 정리 | Codex |
| `docs/80_ai_harness/auth-rate-limit-429-contract-preflight-completion-report-20260506.md` | 이번 작업 완료 보고서                                                  | Codex |

## 5. 계약 결정 요약

| 항목               | 결정                                              |
| ------------------ | ------------------------------------------------- |
| 일반 로그인 실패   | 기존 `403/FORBIDDEN` 유지                         |
| rate-limit blocked | `429/RATE_LIMITED`로 전환                         |
| Retry 정보         | `Retry-After` header에 초 단위 정수로만 노출      |
| Response body      | 기존 `ActionResult` 실패 shape 유지               |
| Web action         | 필수 변경 없음. API 실패 `code/message` 전달 유지 |
| DB                 | 변경 없음                                         |
| API contract       | 이번 문서는 실제 변경 없음. 후속 구현 시 변경     |

## 6. 전체 진행률 요약

| 기준                             | 현재 완료율 | 판단 근거                                                                               |
| -------------------------------- | ----------: | --------------------------------------------------------------------------------------- |
| 전체 준비 포함                   |         40% | Auth/RBAC Foundation 검증과 429 contract gate가 문서화됨                                |
| 실제 Web/API MVP 업무 기능       |         16% | 기능 구현률은 유지. 실제 판매/수납/재고/정책 mutation은 미구현                          |
| Phase 2 API/DB Foundation        |         87% | auth/session/admin guard, seed, persistent rate-limit, browser E2E, 429 preflight 완료  |
| Auth/RBAC 보강 Task 묶음         |         91% | 구현된 auth flow의 회귀 검증과 rate-limit 계약 검토까지 완료. forced revoke 연동은 남음 |
| 이번 429 Contract Preflight Task |        100% | subagent 검토, preflight 문서, 완료 보고, 문서 검증 완료 기준                           |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                                                                                   | 완료율 |
| ----: | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 모델 라우팅, 검증 흐름 정착                                                                                           |   100% |
|     1 | Design System Gate           | 기준 PNG 10개 화면 승인 이력 유지                                                                                                           |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard, seed gate, persistent rate limit, browser E2E, 429 contract preflight 완료. forced revoke/429 implementation 남음 |    87% |
|     3 | Admin Foundation             | staffs/base/policies read 연결 일부 완료. mutation/audit/activation 미구현                                                                  |    14% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 등록/상태 변경 미구현                                                                                         |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                                                                         |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                                                                                   |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export/audit 미구현                                                                                                  |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                                                                                            |     8% |
|     9 | Electron Release             | desktop placeholder 단계                                                                                                                    |     3% |

## 8. 검증 결과

| 검증                              | 결과 | 근거                                           |
| --------------------------------- | ---: | ---------------------------------------------- |
| `pnpm format:check`               | 통과 | 새 Markdown 2개 파일에 Prettier 적용 후 재검증 |
| `pnpm test:e2e:managed:preflight` | 통과 | `5273/4273` free, `canRunManaged: true`        |
| `git diff --check`                | 통과 | whitespace error 없음                          |

문서-only 작업이므로 `pnpm lint`, `pnpm typecheck`, `pnpm build`,
`pnpm test:e2e:managed`는 이번 완료 gate에서 필수로 보지 않는다. 후속 실제
API 구현에서는 API build, typecheck, unit/API inject/browser E2E를 실행한다.

## 9. Auth / DB / API Contract 변경 여부

| 영역                        | 변경 여부 | 비고                                            |
| --------------------------- | --------: | ----------------------------------------------- |
| Auth logic                  |        No | 실제 로그인 로직 변경 없음                      |
| Auth/API contract preflight |       Yes | `429/RATE_LIMITED` 후속 구현 계약을 문서로 고정 |
| DB schema/migration         |        No | Prisma schema/migration/seed 변경 없음          |
| Web/UI                      |        No | 화면 및 Web action 변경 없음                    |
| API runtime behavior        |        No | 현재 `/auth/login` 응답 동작 변경 없음          |

## 10. 남은 리스크

| 리스크                                                             | 영향도 | 대응                                                 |
| ------------------------------------------------------------------ | -----: | ---------------------------------------------------- |
| 실제 429 구현은 아직 적용되지 않음                                 |   중간 | 다음 단계에서 승인 후 service/route/smoke 최소 패치  |
| `x-forwarded-for` 등 IP header 신뢰 경계가 넓음                    |   중간 | 운영 배포 전 trusted proxy 정책 gate 별도 진행       |
| 파일 기반 rate-limit store는 다중 프로세스 원자적 increment가 아님 |   높음 | hosted/shared 운영 전 file lock/DB/Redis 저장소 검토 |
| 기존 API inject smoke는 아직 `403/FORBIDDEN`을 기대                |   낮음 | 실제 구현 단계에서 blocked assertion만 갱신          |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                            | Subagent                                                                  | Model route         | 상세                                                                                                                                                                           |
| ---: | ------------------------------------ | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|    1 | `429 RATE_LIMITED` API contract 구현 | `architect_reviewer` + `security_reviewer` + `backend_agent` + `qa_agent` | GPT-5.5 high        | `auth.service.ts`가 `checkLoginRateLimit()`의 `retryAfterSeconds`를 전달하고, `auth.routes.ts`가 `429`/`Retry-After`를 매핑. `api-auth-inject-smoke`에서 blocked 케이스를 갱신 |
|    2 | Admin Foundation mutation preflight  | `architect_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`       | GPT-5.5 high        | staff/base/policy mutation 순서, Zod schema, transaction/audit, permission guard, policy activation DB gap 확정                                                                |
|    3 | Staff management mutation 1차 구현   | `security_reviewer` + `backend_agent` + `frontend_agent` + `qa_agent`     | GPT-5.5 high/medium | 직원 생성/수정/비활성화, password hash, STAFF 차단, AuditLog, forced session revoke 테스트 구현                                                                                |
