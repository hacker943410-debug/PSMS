# Admin Credential Issue/Revoke UX Completion Report - 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 관리 상세 Drawer의 계정 접근 요청
발급/회수 UX를 구현하고 검증했다.

이번 작업은 기존 Fastify admin credential API contract를 변경하지 않고, Web
Server Action adapter와 `/staffs` 상세 화면을 연결했다. 원문 token, token hash,
password 값은 화면/URL/HTML/input에 노출하지 않는 조건으로 E2E까지 보강했다.

## 2. 작업 분해 및 변동률

| Task | 내용                                            | Before | After |   변동 |
| ---- | ----------------------------------------------- | -----: | ----: | -----: |
| T1   | MCP/하네스/현재 작업트리 재확인                 |     0% |  100% | +100pp |
| T2   | backend/frontend/security/QA subagent 자동 위임 |     0% |  100% | +100pp |
| T3   | admin credential Server Action adapter 추가     |     0% |   95% |  +95pp |
| T4   | 직원 상세 Drawer issue/revoke control 연결      |     0% |   88% |  +88pp |
| T5   | STAFF/ADMIN target 보수적 UX 정책 적용          |     0% |   90% |  +90pp |
| T6   | issue/revoke 성공/실패/사유 validation UX       |     0% |   90% |  +90pp |
| T7   | managed E2E delivery webhook 및 rate-limit env  |     0% |   90% |  +90pp |
| T8   | raw token/hash/password UI 누출 회귀 검증       |    35% |   88% |  +53pp |
| T9   | completion report 및 Phase 진행율 갱신          |     0% |  100% | +100pp |

이번 slice 구현 완료율은 88%다. 발급/회수 UX와 E2E는 완료했고, active pending
request를 reload 후에도 표시하는 read model은 다음 slice로 남겼다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent   | Harness role        | Model route    | 선택 이유                                                       | 결과                                            |
| ---------- | ------------------- | -------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| McClintock | `backend_agent`     | GPT-5.5 high   | admin credential API, RBAC, ActionResult contract 확인          | endpoint/body/result/security boundary 확인     |
| Aquinas    | `frontend_agent`    | GPT-5.5 medium | Next App Router, Drawer/useActionState 연결 지점 확인           | `staff-mutation-panel.tsx` 연결 방향 제안       |
| Hooke      | `security_reviewer` | GPT-5.5 high   | raw token/hash/password, ADMIN target, delivery/audit 보안 검토 | token 미노출, ADMIN target 보수 정책, 용어 권고 |
| Parfit     | `qa_agent`          | GPT-5.5 high   | 최종 diff 기반 E2E/secret leakage/regression 검토               | webhook token 대조 및 revoke 메시지 보강점 발견 |
| Codex      | controller          | GPT-5          | 구현 통합, 검증 실행, 보고서 작성                               | 보강 패치 포함 전체 검증 완료                   |

Spark는 사용하지 않았다. 이번 범위는 auth/RBAC, credential token, password reset,
delivery webhook, secret leakage 검증에 닿아 프로젝트 규칙상 Spark 금지 또는
부적합 범위다. mini도 단순 문서 정리가 아니라 보안 회귀 검토가 핵심이라 사용하지
않았다.

## 4. 변경 파일

| 파일                                                                       | 변경 내용                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/server/actions/admin-staff-credential.actions.ts`            | admin activation/reset issue/revoke Web Server Action adapter 추가   |
| `apps/web/src/app/(workspace)/staffs/_components/staff-mutation-panel.tsx` | 직원 상세 Drawer 계정 접근 요청 발급/회수 UI 연결                    |
| `test/e2e/admin-staff-mutation-ui.spec.ts`                                 | 발급/회수 E2E, DB active count 검증, raw token/hash 미노출 검증 추가 |
| `test/e2e/managed-runner.mjs`                                              | local delivery webhook, credential env, output redaction, spec 포함  |
| `docs/80_ai_harness/admin-credential-issue-revoke-ux-report-20260507.md`   | 이번 완료 보고서                                                     |

## 5. 전체 진행률 요약

| 기준                              | Before | After |  변동 | 판단 근거                                       |
| --------------------------------- | -----: | ----: | ----: | ----------------------------------------------- |
| 전체 Web/API MVP readiness        |    66% |   68% |  +2pp | admin credential 발급/회수 UI와 E2E 연결        |
| 실제 Web/API MVP 업무 기능        |    35% |   38% |  +3pp | 직원 관리에서 접근 요청 운영 흐름 사용 가능     |
| Admin staff credential 운영 slice |     0% |   88% | +88pp | issue/revoke UI, action, E2E, secret guard 완료 |
| Credential token backend/security |    91% |   93% |  +2pp | managed delivery secret 대조 검증 추가          |
| Browser E2E coverage              |    52% |   60% |  +8pp | managed suite 60개로 확대 및 통과               |
| Release/secret leakage gate       |    72% |   78% |  +6pp | artifact scan + live webhook token UI scan      |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                            | Before | After | 변동 |
| ----: | ---------------------------- | ---------------------------------------------------- | -----: | ----: | ---: |
|     0 | Baseline/Harness             | MCP, subagent, 보고/검증 흐름 유지                   |   100% |  100% |  0pp |
|     1 | Design System Gate           | 기존 Drawer/sidebar 구조 유지                        |   100% |  100% |  0pp |
|     2 | API/DB/Auth Foundation       | API/DB contract 변경 없음, Web adapter만 추가        |    99% |   99% |  0pp |
|     3 | Admin Foundation             | staff 관리에서 credential issue/revoke 운영 가능     |    68% |   74% | +6pp |
|     4 | Token-holder Web UX          | public token-holder E2E 유지, 이번 범위는 admin side |    72% |   72% |  0pp |
|     5 | Inventory                    | 이번 작업 범위 아님                                  |    10% |   10% |  0pp |
|     6 | Sales                        | 이번 작업 범위 아님                                  |     8% |    8% |  0pp |
|     7 | Receivable/Customer/Schedule | 이번 작업 범위 아님                                  |     8% |    8% |  0pp |
|     8 | Web MVP Gate                 | admin mutation + credential browser suite 60/60 통과 |    28% |   34% | +6pp |
|     9 | Electron Release             | desktop placeholder, release gate는 아직 NO-GO       |     3% |    3% |  0pp |

## 7. 검증 결과

| 검증                                 | 결과 | 비고                                                        |
| ------------------------------------ | ---: | ----------------------------------------------------------- |
| `codex mcp list`                     | 통과 | e2b, memory, notion, playwright, sequential_thinking 확인   |
| `pnpm --filter @psms/web typecheck`  | 통과 | Web TypeScript 통과                                         |
| `pnpm --filter @psms/web lint`       | 통과 | Web ESLint 통과                                             |
| scoped `prettier --check`            | 통과 | 변경 파일 Prettier 확인                                     |
| `pnpm test:e2e:managed`              | 통과 | Playwright 60 passed, delivery webhook token UI 미노출 포함 |
| `pnpm test:e2e:artifact-secret-scan` | 통과 | 97 files scanned, secret leak 없음                          |
| `pnpm db:validate`                   | 통과 | Prisma schema valid                                         |
| `git diff --check`                   | 통과 | whitespace error 없음                                       |
| `pnpm typecheck`                     | 통과 | shared/db/api/web 전체                                      |
| `pnpm lint`                          | 통과 | API tsc lint + Web ESLint                                   |
| `pnpm test`                          | 통과 | unit + DB contract + API inject 전체                        |
| `pnpm build`                         | 통과 | shared/db/api/web production build                          |

`pnpm test` 중 Node module type warning과 DB unique constraint error log는 기존
테스트가 의도적으로 검증하는 출력이며, 최종 exit code는 0이다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                      | 변경 여부 | 비고                                                               |
| ------------------------- | --------: | ------------------------------------------------------------------ |
| Auth/session core         |        No | login/session/RBAC core 변경 없음                                  |
| Admin credential Web flow |       Yes | Web Server Action adapter 및 staff detail issue/revoke UI 추가     |
| DB schema/migration       |        No | Prisma schema 변경 없음                                            |
| API contract shape        |        No | 기존 Fastify admin credential endpoint와 `ActionResult` shape 유지 |
| Web/UI                    |       Yes | 직원 상세 Drawer 계정 접근 요청 panel 추가                         |
| E2E harness               |       Yes | managed delivery webhook과 raw token UI 미노출 검증 추가           |

## 9. 이슈/해결방법

| 이슈                              | 원인                                                   | 해결                                                        | 재발 방지                                           |
| --------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------- |
| Next Server Action build 실패     | exported action wrapper가 `async`가 아니었음           | exported Server Action을 `async function`으로 변경          | `pnpm --filter @psms/web build` gate 유지           |
| secret text false positive        | 매장명에 `Token`이 포함되어 generic regex가 과검출     | password/token/secret input과 실제 secret value 대조로 변경 | copy text와 실제 secret leak 검증을 분리            |
| Playwright ESM/CJS import 문제    | shared password helper를 spec에서 직접 import          | E2E target은 실제 login 대상이 아니므로 dummy hash 사용     | browser spec에서 server-only helper import 최소화   |
| revoke 성공 메시지 중복/오해 가능 | issue/revoke 모두 `revokedTokenCount`를 같은 UI로 표시 | issue에는 previous revoke count만 표시하도록 state 분리     | mutation별 UI state field 의미를 명확히 분리        |
| webhook raw token 누출 검증 gap   | webhook body를 버려 실제 token과 UI를 대조하지 못함    | in-memory capture endpoint로 test가 token을 조회해 UI 대조  | raw token은 디스크에 쓰지 않고 실패 메시지에도 숨김 |

## 10. 남은 리스크

| 리스크                                                     | 영향도 | 대응                                                                       |
| ---------------------------------------------------------- | -----: | -------------------------------------------------------------------------- |
| pending credential request read model 없음                 |   중간 | 다음 slice에서 target별 active request 조회 API/adapter/UX 추가            |
| ADMIN target 접근 요청 정책은 보수적으로 숨김              |   낮음 | 별도 승인 정책이 확정되면 ADMIN 전용 workflow 추가                         |
| delivery webhook 운영 contract는 외부 승인 채널에 의존     |   중간 | production delivery 운영 문서, retry/monitoring, secret rotation gate 보강 |
| plain `pnpm test:e2e`에서는 delivery env 없으면 slice skip |   낮음 | 이 slice의 acceptance는 `pnpm test:e2e:managed`로 고정하고 문서화          |
| Electron release                                           |   높음 | Web/API MVP와 backup/restore/persistence gate 완료 전까지 NO-GO 유지       |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                  | Subagent                                                             | Model route         | 상세                                                                                                        |
| ---: | ------------------------------------------ | -------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
|    1 | pending credential request read model + UX | `backend_agent` + `frontend_agent` + `security_reviewer`             | GPT-5.5 high/medium | active request 존재/만료/회수 가능 상태를 API read model과 Drawer UI에 표시, raw token/hash 비노출 유지     |
|    2 | delivery webhook 운영 contract hardening   | `security_reviewer` + `devops_sre_reviewer` + `backend_agent`        | GPT-5.5 high        | HTTPS/webhook auth, retry/failure audit, 운영 secret rotation, delivery monitor와 production gate 정리      |
|    3 | Electron local release preflight           | `desktop_release_agent` + `devops_sre_reviewer` + `release_reviewer` | GPT-5.5 high        | Web/API local runtime, SQLite persistence, backup/restore, port conflict, log redaction, rollback checklist |
