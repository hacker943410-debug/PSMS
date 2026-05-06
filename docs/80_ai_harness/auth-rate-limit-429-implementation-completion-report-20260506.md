# Auth Rate Limit 429 Implementation Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 작업으로 `/auth/login` rate-limit 차단 응답을
`429 RATE_LIMITED` 계약으로 실제 구현했다.

일반 로그인 실패는 기존 `403/FORBIDDEN`을 유지하고, rate-limit blocked
상태만 `429/RATE_LIMITED`와 `Retry-After` header로 분리했다. 공통
`ActionResult` shape, Web action, DB schema/migration/seed는 변경하지 않았다.

## 2. 작업 분해

| Task | 내용                                                       | 담당      | 상태 | 진행율 |
| ---- | ---------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/429 preflight 문서와 기존 구현 확인             | Codex     | 완료 |   100% |
| T2   | architecture/security/backend/QA subagent 자동 위임        | Subagents | 완료 |   100% |
| T3   | auth service `RATE_LIMITED` 결과와 retry seconds 전달 구현 | Codex     | 완료 |   100% |
| T4   | Fastify route `429`/`Retry-After` 매핑 구현                | Codex     | 완료 |   100% |
| T5   | API inject smoke status/header/body 비노출 assertion 보강  | Codex     | 완료 |   100% |
| T6   | format/lint/typecheck/db/test/build/preflight 검증         | Codex     | 완료 |   100% |
| T7   | preflight 구현 완료 기록 및 완료 보고서 작성               | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role         | Model route  | 선택 이유                                                             | 결과                                                              |
| ---------------- | -------------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Popper           | `architect_reviewer` | GPT-5.5 high | auth/session 및 Fastify API contract 변경은 하네스상 고위험 계약 판단 | 조건부 Go. `ActionResult` 유지, Web action/DB 변경 불필요 확인    |
| Hegel            | `security_reviewer`  | GPT-5.5 high | Retry header, 정보 노출, brute-force 신호, cookie/token 비노출 검토   | 조건부 Go. body 비노출과 set-cookie 없음 assertion 추가 권고      |
| Parfit           | `backend_agent`      | GPT-5.5 high | Fastify service/route 타입 경계와 최소 패치 흐름 검토                 | 구현 가능. 현재 패치가 preflight와 일치함 확인                    |
| Erdos            | `qa_agent`           | GPT-5.5 high | auth/API contract 변경의 검증 명령과 회귀 범위 산정                   | unit + API inject 중심, managed E2E는 preflight면 충분하다고 판단 |
| Codex controller | main                 | GPT-5        | 구현, 검증 실행, subagent 결과 통합, 완료 보고                        | 429 구현과 검증 완료                                              |

Spark/mini는 사용하지 않았다. 이번 작업은 auth/API contract/security 영역이라
하네스 규칙상 Spark 금지 범위이며, mini로 판단하기에는 계약 리스크가 크다.

## 4. 변경 파일

| 파일                                                                                  | 변경 내용                                                                                           | 담당  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `apps/api/src/services/auth.service.ts`                                               | `checkLoginRateLimit()` decision 사용, `RATE_LIMITED` 실패 union과 `retryAfterSeconds` 전달         | Codex |
| `apps/api/src/routes/auth.routes.ts`                                                  | `RATE_LIMITED` 실패만 `429`와 `Retry-After` header로 매핑, 일반 실패는 `403` 유지                   | Codex |
| `test/smoke/api-auth-inject-smoke.ts`                                                 | 일반 실패 `Retry-After` 없음, blocked `429/RATE_LIMITED`, `no-store`, body/token/cookie 비노출 검증 | Codex |
| `docs/00_system/auth-rate-limit-429-contract-preflight.md`                            | 구현 완료 기록 추가 및 구현 범위 테이블 포맷 보정                                                   | Codex |
| `docs/80_ai_harness/auth-rate-limit-429-implementation-completion-report-20260506.md` | 이번 작업 완료 보고서                                                                               | Codex |

## 5. 구현 결과

| 케이스               | HTTP | Code                | Header                    | Body                                                         |
| -------------------- | ---: | ------------------- | ------------------------- | ------------------------------------------------------------ |
| 입력 validation 실패 |  400 | `VALIDATION_FAILED` | `Cache-Control: no-store` | 기존 shape                                                   |
| 일반 invalid login   |  403 | `FORBIDDEN`         | `Retry-After` 없음        | `ok/code/message`, `data` 없음                               |
| rate-limit blocked   |  429 | `RATE_LIMITED`      | `Retry-After`, `no-store` | `ok/code/message`, retry seconds/body/token/user/cookie 없음 |
| 정상 로그인          |  200 | N/A                 | `Cache-Control: no-store` | 기존 success shape                                           |

## 6. 전체 진행률 요약

| 기준                         | 현재 완료율 | 판단 근거                                                                                   |
| ---------------------------- | ----------: | ------------------------------------------------------------------------------------------- |
| 전체 준비 포함               |         41% | Auth/RBAC Foundation의 rate-limit contract 구현까지 완료                                    |
| 실제 Web/API MVP 업무 기능   |         16% | 기능 구현률은 유지. 판매/수납/재고/정책 mutation은 미구현                                   |
| Phase 2 API/DB Foundation    |         88% | auth/session/admin guard, seed, persistent rate-limit, browser E2E, 429 implementation 완료 |
| Auth/RBAC 보강 Task 묶음     |         92% | login/session/guard/API inject/browser E2E/rate-limit 429 완료. forced revoke 연동은 남음   |
| 이번 429 Implementation Task |        100% | 구현, subagent 검토, unit/API/full validation 통과                                          |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                                                  | 완료율 |
| ----: | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 모델 라우팅, 검증 흐름 정착                                                          |   100% |
|     1 | Design System Gate           | 기준 PNG 10개 화면 승인 이력 유지                                                                          |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard, seed gate, persistent rate limit, browser E2E, 429 구현 완료. forced revoke 남음 |    88% |
|     3 | Admin Foundation             | staffs/base/policies read 연결 일부 완료. mutation/audit/activation 미구현                                 |    14% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 등록/상태 변경 미구현                                                        |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                                        |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                                                  |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export/audit 미구현                                                                 |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                                                           |     8% |
|     9 | Electron Release             | desktop placeholder 단계                                                                                   |     3% |

## 8. 검증 결과

| 검증                              | 결과 | 근거                                            |
| --------------------------------- | ---: | ----------------------------------------------- |
| `pnpm test:unit:login-rate-limit` | 통과 | login-rate-limit unit suite exit 0              |
| `pnpm test:api:inject`            | 통과 | auth/admin guard/admin read inject smoke passed |
| `pnpm --filter @psms/api build`   | 통과 | API TypeScript build exit 0                     |
| `pnpm format:check`               | 통과 | Prettier check exit 0                           |
| `pnpm lint`                       | 통과 | API tsc lint, Web eslint 통과                   |
| `pnpm typecheck`                  | 통과 | shared/db/api/web typecheck 통과                |
| `pnpm db:validate`                | 통과 | Prisma schema validation exit 0                 |
| `pnpm test`                       | 통과 | unit + API inject smoke 전체 통과               |
| `pnpm build`                      | 통과 | shared/db/api/web production build 통과         |
| `pnpm test:e2e:managed:preflight` | 통과 | managed E2E preflight exit 0                    |
| `git diff --check`                | 통과 | whitespace error 없음                           |

`pnpm test:e2e:managed` 전체 브라우저 실행은 이번 완료 gate에서 필수로 보지
않았다. QA subagent 판단상 429 동작은 API inject smoke가 직접 증명하고,
이번에는 Web action/UI를 변경하지 않았기 때문이다.

## 9. Auth / DB / API Contract 변경 여부

| 영역                 | 변경 여부 | 비고                                                            |
| -------------------- | --------: | --------------------------------------------------------------- |
| Auth logic           |       Yes | rate-limit blocked 실패 결과를 `RATE_LIMITED`로 분리            |
| API runtime behavior |       Yes | `/auth/login` rate-limit blocked가 `429`와 `Retry-After`를 반환 |
| API body shape       |        No | 공통 `ActionResult` 실패 shape 유지                             |
| Web/UI               |        No | Web action/API client/UI 변경 없음                              |
| DB schema/migration  |        No | Prisma schema/migration/seed 변경 없음                          |

## 10. 이슈/해결방법

| 이슈                                        | 원인                                       | 해결                                                                    | 재발 방지                         |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------- |
| preflight 문서의 구현 범위 테이블 포맷 깨짐 | Markdown pipe 문자                         | `FORBIDDEN` 또는 `RATE_LIMITED` 문구로 수정                             | 문서 변경 후 `pnpm format:check`  |
| body 비노출 assertion이 초기 패치에 부족    | route body는 안전했지만 테스트가 덜 명시적 | `retryAfterSeconds`, token/user/session, set-cookie 없음 assertion 추가 | security reviewer 체크리스트 반영 |

## 11. 남은 리스크

| 리스크                                                             | 영향도 | 대응                                                 |
| ------------------------------------------------------------------ | -----: | ---------------------------------------------------- |
| `x-forwarded-for` 등 IP header 신뢰 경계가 넓음                    |   중간 | 운영 배포 전 trusted proxy 정책 gate 별도 진행       |
| 파일 기반 rate-limit store는 다중 프로세스 원자적 increment가 아님 |   높음 | hosted/shared 운영 전 file lock/DB/Redis 저장소 검토 |
| Browser E2E는 429 UX를 직접 검증하지 않음                          |   낮음 | rate-limit UX 요구 확정 시 managed browser case 추가 |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                           | Subagent                                                                   | Model route         | 상세                                                                                                            |
| ---: | ----------------------------------- | -------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
|    1 | Admin Foundation mutation preflight | `architect_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`        | GPT-5.5 high        | staff/base/policy mutation 순서, Zod schema, transaction/audit, permission guard, policy activation DB gap 확정 |
|    2 | Staff management mutation 1차 구현  | `security_reviewer` + `backend_agent` + `frontend_agent` + `qa_agent`      | GPT-5.5 high/medium | 직원 생성/수정/비활성화, password hash, STAFF 차단, AuditLog, forced session revoke 테스트 구현                 |
|    3 | Trusted proxy/IP rate-limit gate    | `security_reviewer` + `backend_agent` + `devops_sre_reviewer` + `qa_agent` | GPT-5.5 high        | forwarded header 신뢰 조건, `request.ip` fallback, 운영 env 문서, spoofing regression test 확정                 |
