# Auth Browser E2E Route Guard Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 작업으로 Auth browser E2E 및 route guard 회귀를 고정했다.

기존 `route-guards.spec.ts`가 storageState 기반 ADMIN/STAFF 접근 제어를 검증하고 있었으나, 실제 브라우저 로그인 폼과 로그아웃, revoked/malformed cookie, STAFF의 backup/restore 직접 접근, STAFF admin read API 차단은 부족했다. 신규 `auth-browser.spec.ts`를 추가해 이 공백을 보강했다.

API contract, DB schema, 실제 auth/RBAC 정책은 변경하지 않았다.

## 2. 작업 분해

| Task | 내용                                               | 담당      | 상태 | 진행율 |
| ---- | -------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스 문서와 기존 E2E/auth guard 구조 확인    | Codex     | 완료 |   100% |
| T2   | security/frontend/ui-runtime/QA subagent 자동 위임 | Subagents | 완료 |   100% |
| T3   | auth browser E2E 신규 spec 구현                    | Codex     | 완료 |   100% |
| T4   | managed runner env와 rate-limit 파일 격리 보강     | Codex     | 완료 |   100% |
| T5   | E2E storageState 재생성 helper 추가                | Codex     | 완료 |   100% |
| T6   | 정적 검증, managed E2E, build/test/db 검증         | Codex     | 완료 |   100% |
| T7   | 완료 보고서 작성                                   | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent         | Harness role           | Model route    | 선택 이유                                                                                | 결과                                                                                  |
| ---------------- | ---------------------- | -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Lorentz          | `security_reviewer`    | GPT-5.5 high   | auth/session/RBAC/cookie/rate-limit/개인정보는 하네스상 보안 고위험 경계                 | backup/restore 직접 접근, STAFF admin API 403, malformed/revoked cookie 시나리오 제안 |
| Faraday          | `frontend_agent`       | GPT-5.5 medium | Next App Router route guard, Server Action, sidebar RBAC, login/logout UX 흐름 분석 필요 | 안정 locator, `PSMS_DEV_AUTH_BYPASS=false` 필요성, STAFF 금지 route 목록 확인         |
| Bacon            | `ui_runtime_validator` | GPT-5.4 mini   | 포트, managed runner, screenshot/console/network evidence처럼 좁고 구조화된 런타임 검증  | `pnpm test:e2e:managed` 중심 실행 권고, 5273/4273 포트 전제 확인                      |
| Averroes         | `qa_agent`             | GPT-5.5 high   | browser E2E는 session cookie, RBAC, seed/reset, Web/API 경계를 동시에 검증               | 최소 케이스 6개, isolated DB 전제, storageState 독립성 제안                           |
| Codex controller | main                   | GPT-5          | 구현, 검증 실행, subagent 결과 통합                                                      | auth browser E2E 고정 완료                                                            |

Spark/mini는 구현에 사용하지 않았다. 이번 작업은 auth/RBAC/browser E2E 경계라 Spark 금지 범위이며, mini는 보조 검증 관점만 적합하다.

## 4. 변경 파일

| 파일                                                                            | 변경 내용                                                                                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `test/e2e/auth-browser.spec.ts`                                                 | 브라우저 로그인/로그아웃, STAFF forbidden, invalid login, revoked/malformed cookie, authenticated `/login` redirect E2E 추가 |
| `test/e2e/support/psms-e2e.ts`                                                  | API login helper, storageState 재생성 helper, session cookie 상수 추가                                                       |
| `test/e2e/managed-runner.mjs`                                                   | managed E2E에 `auth-browser.spec.ts` 포함, `PSMS_DEV_AUTH_BYPASS=false`, 전용 rate-limit 파일 추가                           |
| `package.json`                                                                  | `test:e2e:auth-browser` script 추가                                                                                          |
| `docs/80_ai_harness/auth-browser-e2e-route-guard-completion-report-20260506.md` | 이번 완료 보고서                                                                                                             |

현재 워크트리에는 이전 완료 작업의 미커밋 변경도 함께 남아 있다. 이번 보고서는 위 파일 중 이번 Task에서 건드린 범위만 기준으로 작성했다.

## 5. 고정한 E2E 시나리오

| 시나리오                        | 기대 동작                                                                                            | 검증         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------ |
| ADMIN browser login/logout      | `/login` 로그인 후 `/`, ADMIN 메뉴 노출, logout 후 `/login`, `/` 재진입 시 `/login`                  | 3개 viewport |
| STAFF browser login/RBAC        | 일반 workspace 접근, ADMIN 메뉴 미노출, admin-only route는 `/forbidden`                              | 3개 viewport |
| STAFF backup/restore direct URL | `/settings/base?tab=backup`, `restore` 모두 `/forbidden`                                             | 3개 viewport |
| STAFF admin read API            | `/admin/staffs/page-data`, `/admin/base/page-data`, `/admin/policies/page-data` 모두 `403 FORBIDDEN` | 3개 viewport |
| invalid login                   | `/login` 유지, generic 오류 표시, session cookie 없음                                                | 3개 viewport |
| revoked cookie                  | API logout으로 폐기한 cookie로 `/` 접근 시 `/login`                                                  | 3개 viewport |
| malformed cookie                | 변조 cookie로 `/` 접근 시 `/login`                                                                   | 3개 viewport |
| authenticated `/login`          | 유효 ADMIN storageState로 `/login` 접근 시 `/` redirect                                              | 3개 viewport |

기존 `route-guards.spec.ts`의 미인증 redirect, ADMIN 전체 route 접근, STAFF 일반 route 접근 및 STAFF admin-only route 차단도 managed runner에서 함께 실행되도록 했다.

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                                  |
| -------------------------- | ----------: | -------------------------------------------------------------------------- |
| 전체 준비 포함             |         39% | Auth/RBAC 브라우저 회귀까지 Foundation 검증 폭이 늘어남                    |
| 실제 Web/API MVP 업무 기능 |         16% | 기능 구현률은 유지. 다만 auth/RBAC 회귀 안정성이 개선됨                    |
| Phase 2 API/DB Foundation  |         86% | auth cookie, persistent rate-limit, seed gate, browser E2E guard 완료      |
| Auth/RBAC 보강 Task 묶음   |         90% | login/session/guard/API inject/browser E2E 완료. forced revoke 연동은 남음 |
| 이번 Auth Browser E2E Task |        100% | 구현, subagent 검토, managed E2E 30개, 공통 검증 통과                      |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                                                       | 완료율 |
| ----: | ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 모델 라우팅, 검증 흐름 정착                                                               |   100% |
|     1 | Design System Gate           | 기준 PNG 10개 화면 승인 이력 유지                                                                               |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard, seed gate, persistent rate limit, browser E2E 완료. forced revoke/429 contract는 남음 |    86% |
|     3 | Admin Foundation             | staffs/base/policies read 연결 일부 완료. mutation/audit/activation 미구현                                      |    14% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 등록/상태 변경 미구현                                                             |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                                             |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                                                       |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export/audit 미구현                                                                      |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                                                                |     8% |
|     9 | Electron Release             | desktop placeholder 단계                                                                                        |     3% |

## 8. 검증 결과

| 검증                                                             | 결과 | 근거                                         |
| ---------------------------------------------------------------- | ---: | -------------------------------------------- |
| `pnpm exec playwright test test/e2e/auth-browser.spec.ts --list` | 통과 | 18개 auth-browser 테스트 인식                |
| `pnpm test:e2e:managed:preflight`                                | 통과 | 최종 `5273/4273` free, `canRunManaged: true` |
| `pnpm test:e2e:managed`                                          | 통과 | isolated DB reset 후 browser E2E 30 passed   |
| `pnpm format:check`                                              | 통과 | Prettier check passed                        |
| `pnpm typecheck`                                                 | 통과 | shared/db/api/web typecheck 통과             |
| `pnpm lint`                                                      | 통과 | API tsc lint, Web eslint 통과                |
| `pnpm test`                                                      | 통과 | unit + API inject smoke 전체 통과            |
| `pnpm db:validate`                                               | 통과 | Prisma schema valid                          |
| `pnpm build`                                                     | 통과 | shared/db/api/web build 통과                 |
| `git diff --check`                                               | 통과 | whitespace error 없음                        |

Managed E2E 주요 evidence:

| 항목          | 결과                               |
| ------------- | ---------------------------------- |
| E2E DB        | `.tmp/e2e/psms-e2e.db`             |
| dev DB        | `packages/db/dev.db` unchanged     |
| Seed          | `Store=1`, `User=2`, `Session=0`   |
| DB health     | `quick_check=ok`, FK violation 0   |
| Browser tests | 30 passed, 3 viewports             |
| Viewports     | `1586x992`, `1440x900`, `1280x800` |

## 9. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                 |
| ------------------- | --------: | ---------------------------------------------------- |
| Auth logic          |        No | 실제 session/RBAC/auth service 정책 변경 없음        |
| Auth test           |       Yes | browser login/logout/cookie/STAFF forbidden E2E 추가 |
| DB schema/migration |        No | Prisma schema/migration 변경 없음                    |
| DB runtime          |        No | managed E2E가 isolated `.tmp/e2e` DB만 사용          |
| API contract        |        No | endpoint/status/body shape 변경 없음                 |
| UI                  |        No | 화면 markup/style 변경 없음                          |

## 10. 이슈/해결방법

| 이슈                                                   | 원인                                        | 해결                                                                | 재발 방지                                          |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| 초기 managed preflight `canRunManaged:false`           | 기존 PSMS dev 서버가 `5273/4273` 점유       | PSMS 경로의 Web/API node listener만 종료 후 재실행                  | E2E 전 `pnpm test:e2e:managed:preflight` 확인      |
| 기존 dev 서버 `/login`이 `/`로 redirect                | development 기본 dev auth bypass            | managed env에 `PSMS_DEV_AUTH_BYPASS=false` 고정                     | 브라우저 RBAC 검증은 managed runner 기준           |
| 로그인/로그아웃 테스트가 기존 storageState 무효화 가능 | 같은 user 재로그인 시 active session revoke | API login 기반 `refreshE2EStorageStates()` 추가                     | auth-flow spec 후 route-guards가 안정적으로 이어짐 |
| rate-limit 파일 상태가 E2E login에 영향 가능           | persistent limiter 도입                     | managed runner 전용 `.tmp/e2e/login-rate-limit.json`와 시작 전 삭제 | E2E 격리 파일 사용                                 |

## 11. 남은 리스크

| 리스크                                                                                   | 영향도 | 대응                                                  |
| ---------------------------------------------------------------------------------------- | -----: | ----------------------------------------------------- |
| `test:e2e:route-guards`를 기존 dev server에 직접 붙이면 dev bypass가 회귀를 가릴 수 있음 |   중간 | 공식 게이트는 `pnpm test:e2e:managed`로 유지          |
| Browser E2E가 아직 forced staff inactive/session revoke 업무 흐름까지 검증하지 않음      |   중간 | 직원 비활성화 mutation 구현 후 forced revoke E2E 추가 |
| `429 RATE_LIMITED` 전환은 아직 API contract 미결                                         |   중간 | 별도 architecture/security/backend/QA preflight 필요  |
| `test/.auth`, `test-results`, `playwright-report`는 실행 산출물                          |   낮음 | gitignore 상태 유지, 완료 보고에는 명령 결과만 기록   |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                                  | Model route         | 상세                                                                                                     |
| ---: | ----------------------------------------- | ------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
|    1 | `429 RATE_LIMITED` API contract preflight | `architect_reviewer` + `security_reviewer` + `backend_agent` + `qa_agent` | GPT-5.5 high        | 기존 `403 FORBIDDEN` 유지/전환 영향, `Retry-After`, Web action message, smoke/E2E 기대값 확정            |
|    2 | Admin Foundation mutation preflight       | `architect_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent`       | GPT-5.5 high        | staff/base/policy mutation 순서, Zod schema, transaction/audit/permission guard, rollback/test plan 확정 |
|    3 | Staff management mutation 1차 구현        | `security_reviewer` + `backend_agent` + `frontend_agent` + `qa_agent`     | GPT-5.5 high/medium | 직원 생성/수정/비활성화, password hash, STAFF 차단, AuditLog, forced session revoke 테스트 구현          |
