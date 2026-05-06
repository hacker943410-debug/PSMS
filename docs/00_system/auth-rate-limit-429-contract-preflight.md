# Auth Rate Limit 429 Contract Preflight

작성일: 2026-05-06

## 목적

이 문서는 `/auth/login`의 로그인 실패 rate limit 차단 응답을 기존
`403 FORBIDDEN`에서 `429 RATE_LIMITED`로 전환하기 전 API 계약과 구현
경계를 고정한다.

이번 작업은 preflight 문서화 단계다. `apps/api`, `apps/web`,
`packages/shared`, `packages/db` 코드는 변경하지 않는다.

## 결론

| 항목                     | 결정                                                          |
| ------------------------ | ------------------------------------------------------------- |
| 판정                     | 조건부 진행 가능                                              |
| 실제 구현 여부           | 이번 preflight에서는 구현하지 않음                            |
| API 계약 변경 여부       | 실제 코드는 변경 없음. 후속 구현 시 Fastify API contract 변경 |
| 공통 `ActionResult` 변경 | 변경하지 않음                                                 |
| DB schema/migration 변경 | 변경하지 않음                                                 |
| Web action 변경          | 필수 아님                                                     |

후속 구현의 최소 계약은 다음과 같다.

```txt
일반 invalid credentials
-> HTTP 403
-> { ok: false, code: "FORBIDDEN", message: generic login failure }

rate-limit blocked login
-> HTTP 429
-> Retry-After: <positive integer seconds>
-> { ok: false, code: "RATE_LIMITED", message: generic rate-limit message }
```

## 현재 구현 상태

| 파일                                          | 현재 상태                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/auth/login-rate-limit.ts`       | `checkLoginRateLimit()`가 `retryAfterSeconds`를 계산하지만 `canAttemptLogin()`은 boolean만 반환한다.                |
| `apps/api/src/services/auth.service.ts`       | 로그인 초입에서 `canAttemptLogin()`을 사용하므로 재시도 시간이 버려진다. rate-limit 실패도 `code: "FORBIDDEN"`이다. |
| `apps/api/src/routes/auth.routes.ts`          | 모든 로그인 실패를 `reply.code(403)`으로 매핑한다. `Cache-Control: no-store`는 이미 설정되어 있다.                  |
| `apps/web/src/server/actions/auth.actions.ts` | API 실패 `code/message`를 그대로 전달한다. HTTP status를 별도로 분기하지 않는다.                                    |
| `packages/shared/src/action-result.ts`        | 실패 branch의 `code?: string` 구조라 `RATE_LIMITED` 문자열은 shape 변경 없이 수용 가능하다.                         |
| `test/smoke/api-auth-inject-smoke.ts`         | rate-limit 차단 케이스가 현재 `403/FORBIDDEN`을 기대한다.                                                           |

## API 계약 결정

| 항목         | 결정                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| HTTP status  | rate-limit 차단에만 `429`를 사용한다.                                                               |
| Error code   | rate-limit 차단에만 `RATE_LIMITED`를 사용한다.                                                      |
| Retry header | `Retry-After` header에 초 단위 양의 정수를 넣는다.                                                  |
| Body shape   | 기존 `ActionResult` 실패 shape를 유지하고 `retryAfterSeconds` body field는 추가하지 않는다.         |
| 일반 실패    | invalid credentials, inactive/unusable user 등은 기존 `403/FORBIDDEN`과 generic message를 유지한다. |
| Cache        | `/auth/login` 모든 응답은 기존처럼 `Cache-Control: no-store`를 유지한다.                            |
| Audit        | `AUTH_LOGIN_FAILED`와 reason `RATE_LIMITED` 기록은 유지한다.                                        |

## 구현 범위

후속 구현 시 최소 변경 후보는 아래 파일로 제한한다.

| 파일                                    | 변경 계획                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/services/auth.service.ts` | `checkLoginRateLimit()`를 직접 호출하고, 실패 타입을 `FORBIDDEN` 또는 `RATE_LIMITED` 및 선택적 `retryAfterSeconds`로 확장한다. |
| `apps/api/src/routes/auth.routes.ts`    | `result.code === "RATE_LIMITED"`이면 `429`와 `Retry-After` header를 설정한다. 그 외 실패는 `403`을 유지한다.                   |
| `test/smoke/api-auth-inject-smoke.ts`   | 6번째 차단 요청만 `429/RATE_LIMITED`와 `Retry-After`를 기대하도록 바꾼다. 앞선 일반 실패는 `403/FORBIDDEN`을 유지한다.         |

선택 변경 후보:

| 파일                                 | 조건                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `test/unit/login-rate-limit.test.ts` | `canAttemptLogin()` boolean compatibility를 명시적으로 남기고 싶을 때만 추가한다. |
| `test/e2e/auth-browser.spec.ts`      | rate-limit UX를 제품 요구로 확정할 때만 6회 실패 브라우저 시나리오를 추가한다.    |

## 금지 범위

- `packages/shared/src/action-result.ts`에 `retryAfterSeconds` field를 추가하지 않는다.
- invalid credentials를 `RATE_LIMITED`와 섞지 않는다.
- Web Server Action에 rate-limit 비즈니스 로직을 넣지 않는다.
- Prisma schema, migration, seed를 변경하지 않는다.
- auth cookie/session/RBAC 정책을 완화하지 않는다.
- 파일 기반 persistent store 정책을 이번 429 구현과 함께 바꾸지 않는다.

## 보안 요구사항

| 요구사항                                                            | 이유                                          |
| ------------------------------------------------------------------- | --------------------------------------------- |
| `Retry-After`는 초 단위 정수만 노출                                 | bucket 종류, count, reset timestamp 노출 방지 |
| 응답 body에는 session/user/token/data 미포함                        | 인증 실패 응답의 정보 노출 방지               |
| 일반 실패와 rate-limit 실패 메시지는 계정 존재 여부를 드러내지 않음 | 계정 enumeration 완화                         |
| `Cache-Control: no-store` 유지                                      | 인증 실패 응답 캐시 방지                      |
| production persistent store guard 유지                              | memory store 운영 사용 차단                   |

남은 보안 리스크:

| 리스크                                                                        | 대응                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 현재 IP 추출은 `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`를 신뢰한다. | 운영 배포 전 trusted proxy 정책과 spoofing 방어를 별도 gate로 검토한다.          |
| 파일 저장소는 다중 프로세스 원자적 increment가 아니다.                        | hosted/shared 운영 전 file lock, DB, Redis 등 원자적 저장소를 검토한다.          |
| `429`는 공격자에게 차단 상태를 더 명확히 알릴 수 있다.                        | 현재도 메시지로 차단 상태가 구분되므로 증가는 제한적이며, count/detail은 숨긴다. |

## 테스트 계획

후속 구현 완료 전 최소 검증:

| 레벨        | 검증                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit        | `pnpm test:unit:login-rate-limit`로 bucket/window/persistence/clear 유지 확인                                       |
| API inject  | 일반 실패 `403/FORBIDDEN`, rate-limit blocked `429/RATE_LIMITED`, `Retry-After`, `no-store`, `data: undefined` 확인 |
| API build   | `pnpm --filter @psms/api build`로 `LoginResult` 타입 확장 확인                                                      |
| 공통        | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`                                                     |
| Browser E2E | 기존 `pnpm test:e2e:managed`로 login/logout/RBAC 회귀 확인. UX 요구 확정 시 rate-limit browser case 추가            |

## 구현 전 Gate

1. 사용자 확인: `/auth/login` rate-limit 차단만 `429/RATE_LIMITED`로 전환하는 API contract 변경 승인.
2. `architect_reviewer`: `ActionResult` shape 유지와 status/code/header 계약 최종 확인.
3. `security_reviewer`: `Retry-After`, no-store, 정보 노출, IP 신뢰 경계 확인.
4. `backend_agent`: service/route 최소 패치 구현.
5. `qa_agent`: API inject 및 regression command 실행.

## Subagent 사전검토 결과

| Subagent             | 판정        | 핵심 결과                                                                          |
| -------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `architect_reviewer` | 조건부 Go   | `ActionResult`와 양립 가능하지만 Fastify API contract 변경이므로 승인 gate 필요    |
| `security_reviewer`  | 조건부 Go   | rate-limit 차단만 429로 분리하고 `Retry-After`, `no-store`, 정보 비노출 유지 필요  |
| `backend_agent`      | 구현 가능   | `checkLoginRateLimit()` 값을 service 결과로 전달하고 route에서 `429`/header 매핑   |
| `qa_agent`           | 준비도 높음 | 직접 영향 테스트는 API inject smoke의 blocked assertion이며 unit/E2E 영향은 제한적 |

## 구현 완료 기록

작성일: 2026-05-06

위 계약은 같은 날 실제 구현에 반영되었다.

| 파일                                    | 구현 결과                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/services/auth.service.ts` | `checkLoginRateLimit()` decision을 사용하고, rate-limit 실패를 `RATE_LIMITED`와 `retryAfterSeconds`로 반환한다.   |
| `apps/api/src/routes/auth.routes.ts`    | `RATE_LIMITED` 실패만 `429`와 `Retry-After` header로 매핑한다. 일반 실패는 `403`을 유지한다.                      |
| `test/smoke/api-auth-inject-smoke.ts`   | 일반 실패 `403/FORBIDDEN`, 차단 실패 `429/RATE_LIMITED`, `Retry-After`, `no-store`, body/token 비노출을 검증한다. |

공통 `ActionResult` shape, Web action, DB schema/migration/seed는 변경하지 않았다.
