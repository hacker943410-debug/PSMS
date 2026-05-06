# Login Rate Limit Persistent Store Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 작업으로 로그인 실패 rate limit을 기존 in-memory `Map`에서 파일 기반 persistent 저장소로 전환했다.

API 응답 body 계약은 유지했다. `/auth/login`의 일반 실패와 rate-limit 실패는 기존 `403 + FORBIDDEN` `ActionResult`를 유지하며, `429/RATE_LIMITED/Retry-After` 전환은 API contract 변경으로 보고 후속 architecture review 대상으로 남겼다.

추가로 인증 응답 cache 방지와 production logger redaction을 보강했다.

## 2. 작업 분해

| Task | 내용                                                       | 담당      | 상태 | 진행율 |
| ---- | ---------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/필수 문서/기존 auth rate-limit 구현 확인        | Codex     | 완료 |   100% |
| T2   | security/backend/db/QA subagent 자동 위임                  | Subagents | 완료 |   100% |
| T3   | 파일 기반 login rate-limit 저장소 구현                     | Codex     | 완료 |   100% |
| T4   | production fail-closed, HMAC key, no-store/redaction 보강  | Codex     | 완료 |   100% |
| T5   | unit/API inject smoke 테스트 추가 및 root test script 연결 | Codex     | 완료 |   100% |
| T6   | format/typecheck/lint/db/test/build 검증                   | Codex     | 완료 |   100% |
| T7   | 완료 보고서 작성                                           | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role        | Model route  | 선택 이유                                                                  | 결과                                                                       |
| ---------------- | ------------------- | ------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Sartre           | `security_reviewer` | GPT-5.5 high | auth/session, IP/loginId rate limit, 로그/토큰 노출은 보안 민감 영역       | HMAC key, production fail-closed, no-store/redaction, 429 후속 리스크 제시 |
| Boyle            | `backend_agent`     | GPT-5.5 high | Fastify auth route/service 경계와 `ActionResult` 회귀 판단 필요            | API body 계약 유지, rate-limit 모듈 중심 변경 권고                         |
| Turing           | `db_reviewer`       | GPT-5.5 high | Prisma schema/migration 추가 여부와 SQLite/Electron write 리스크 판단 필요 | DB table 없이 file store로 진행 가능, hosted/shared store는 후속 gate 필요 |
| Franklin         | `qa_agent`          | GPT-5.5 high | auth inject smoke와 window/reset/persistence 회귀 테스트 설계 필요         | loginId+IP 5/6, window reset, success clear, production guard 테스트 제안  |
| Codex controller | main                | GPT-5        | 구현, 검증 실행, subagent 결과 통합                                        | 저장소 전환과 검증 완료                                                    |

Spark/mini는 사용하지 않았다. 이번 작업은 auth/session/security/API behavior 영역이라 하네스 규칙상 Spark/mini 금지 범위다.

## 4. 변경 파일

| 파일                                                                                 | 변경 내용                                                                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/auth/login-rate-limit.ts`                                              | file/memory store mode, HMAC bucket key, expired bucket prune, production fail-closed, test reset helper 추가 |
| `apps/api/src/app.ts`                                                                | production Fastify logger redaction 추가                                                                      |
| `apps/api/src/routes/auth.routes.ts`                                                 | auth login/session/logout `Cache-Control: no-store` 추가. 기존 malformed cookie hardening 유지                |
| `test/unit/login-rate-limit.test.ts`                                                 | 저장소 persistence, HMAC 비노출, window reset, success clear, production guard unit test 추가                 |
| `test/smoke/api-auth-inject-smoke.ts`                                                | 반복 로그인 실패 rate limit 및 성공 후 clear smoke 추가                                                       |
| `package.json`                                                                       | `test:unit:login-rate-limit`와 root `pnpm test` 연결                                                          |
| `.env.example`                                                                       | `PSMS_LOGIN_RATE_LIMIT_STORE`, production explicit file path 안내 추가                                        |
| `docs/80_ai_harness/login-rate-limit-persistent-store-completion-report-20260506.md` | 이번 완료 보고서                                                                                              |

현재 워크트리에는 이전 완료 작업의 미커밋 변경도 함께 남아 있다. 이번 보고서는 위 파일 중 이번 Task에서 건드린 범위만 기준으로 작성했다.

## 5. 구현 정책

| 항목                | 결정                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| 기본 저장소         | file store. 개발 기본 경로는 `.tmp/runtime/login-rate-limit.json`                              |
| production 조건     | `PSMS_LOGIN_RATE_LIMIT_FILE` 명시 필수, `AUTH_SECRET` 또는 `PSMS_LOGIN_RATE_LIMIT_SECRET` 필수 |
| memory store        | dev/test 전용. production에서 선택 시 fail-closed                                              |
| 저장 key            | raw loginId/IP 저장 금지. secret 기반 HMAC key만 저장                                          |
| DB schema/migration | 변경 없음                                                                                      |
| API response body   | 기존 `ActionResult` shape 유지                                                                 |
| HTTP status         | 기존 `403` 유지. `429` 전환은 후속 API contract review 대상                                    |

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                                       |
| -------------------------- | ----------: | ------------------------------------------------------------------------------- |
| 전체 준비 포함             |         38% | Auth/RBAC 보강, admin read DTO, master seed, persistent rate-limit까지 반영     |
| 실제 Web/API MVP 업무 기능 |         16% | 인증/관리 read 기반은 안정화 중이나 판매/수납/재고/정책 mutation은 미구현       |
| Phase 2 API/DB Foundation  |         82% | auth cookie hardening, shared read DTO, master seed, persistent rate limit 완료 |
| Auth/RBAC 보강 Task 묶음   |         84% | session/login/admin guard 기반 완료. 브라우저 E2E와 forced revoke 연동은 남음   |
| 이번 Login Rate Limit Task |        100% | 구현, subagent 검토, unit/smoke/full test/build 통과                            |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                                       | 완료율 |
| ----: | ---------------------------- | ----------------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 모델 라우팅, 검증 흐름 정착                                               |   100% |
|     1 | Design System Gate           | 기준 PNG 10개 화면 승인 이력 유지                                                               |   100% |
|     2 | API/DB Foundation            | auth/session, admin read, seed gate, persistent rate limit 완료. browser E2E/forced revoke 남음 |    82% |
|     3 | Admin Foundation             | staffs/base/policies read 연결 일부 완료. mutation/audit/activation 미구현                      |    14% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 등록/상태 변경 미구현                                             |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                             |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                                       |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export/audit 미구현                                                      |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                                                |     7% |
|     9 | Electron Release             | desktop placeholder 단계                                                                        |     3% |

## 8. 검증 결과

| 검증                                  | 결과 | 근거                                            |
| ------------------------------------- | ---: | ----------------------------------------------- |
| `pnpm test:unit:login-rate-limit`     | 통과 | 7개 unit test 통과                              |
| `pnpm --filter @psms/api test:inject` | 통과 | auth/admin guard/admin read inject smoke passed |
| `pnpm format:check`                   | 통과 | Prettier check passed                           |
| `pnpm typecheck`                      | 통과 | shared/db/api/web typecheck 통과                |
| `pnpm lint`                           | 통과 | API tsc lint, Web eslint 통과                   |
| `pnpm db:validate`                    | 통과 | Prisma schema valid                             |
| `pnpm test`                           | 통과 | unit + API inject smoke 전체 통과               |
| `pnpm build`                          | 통과 | shared/db/api/web build 통과                    |

## 9. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                                                            |
| ------------------- | --------: | ----------------------------------------------------------------------------------------------- |
| Auth                |       Yes | login rate-limit 저장소 persistent file store로 전환, auth 응답 no-store, logger redaction 추가 |
| DB schema/migration |        No | Prisma schema/migration/generate 변경 없음                                                      |
| DB seed             |        No | seed script 변경 없음                                                                           |
| API contract        |        No | endpoint, body shape, 기존 실패 status/code 유지                                                |
| UI                  |        No | 화면 변경 없음. screenshot gate 대상 아님                                                       |

## 10. 남은 리스크

| 리스크                                                       | 영향도 | 대응                                                              |
| ------------------------------------------------------------ | -----: | ----------------------------------------------------------------- |
| JSON file store는 다중 프로세스 atomic shared limiter가 아님 |   높음 | hosted/shared 운영 전 Redis/DB-backed gate 필요                   |
| `429/RATE_LIMITED/Retry-After` 미도입                        |   중간 | API contract review 후 별도 전환                                  |
| proxy IP 신뢰 경계                                           |   중간 | 운영 배포 시 trusted proxy 정책과 `x-forwarded-for` 검증 필요     |
| 상태 파일 손상/권한 오류 처리                                |   중간 | Electron userData/sidecar SQLite 또는 locked file store 후속 검토 |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                                     | Model route                        | 상세                                                                                                                                |
| ---: | ----------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Auth browser E2E 및 route guard 회귀 고정 | `security_reviewer` + `frontend_agent` + `ui_runtime_validator` + `qa_agent` | GPT-5.5 high/medium + GPT-5.4 mini | 실제 브라우저에서 login/logout/session, STAFF admin 차단, malformed cookie 회귀를 확인하고 screenshot/console/network evidence 확보 |
|    2 | `429 RATE_LIMITED` API contract preflight | `architect_reviewer` + `security_reviewer` + `backend_agent` + `qa_agent`    | GPT-5.5 high                       | `FORBIDDEN` 유지 vs `RATE_LIMITED` 전환 영향, Web action message 처리, `Retry-After`/`Cache-Control` 계약과 테스트 범위 확정        |
|    3 | Admin Foundation mutation preflight       | `architect_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`          | GPT-5.5 high                       | staff/base/policy mutation 순서, Zod schema, transaction/audit 정책, permission guard, 테스트 계획 확정                             |
