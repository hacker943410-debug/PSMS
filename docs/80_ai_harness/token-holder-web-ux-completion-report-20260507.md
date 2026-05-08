# Token Holder Web UX Completion Report - 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 활성화/비밀번호 재설정 token-holder Web UX를
구현했다.

이번 범위는 기존 Fastify credential token API contract를 변경하지 않고,
Next.js Web public route와 BFF adapter, Server Action, token URL cleanup, 보안
헤더, no-token 런타임 smoke까지 연결하는 작업이다.

## 2. 작업 분해 및 변동률

| Task | 내용                                             | Before | After |   변동 |
| ---- | ------------------------------------------------ | -----: | ----: | -----: |
| T1   | MCP/하네스/현재 작업트리 재확인                  |     0% |  100% | +100pp |
| T2   | frontend/security/QA subagent 자동 위임          |     0% |  100% | +100pp |
| T3   | token-holder public route 2개 추가               |     0% |  100% | +100pp |
| T4   | Web API adapter 추가                             |     0% |  100% | +100pp |
| T5   | complete Server Action + same-origin guard       |     0% |   95% |  +95pp |
| T6   | URL token cleanup + path-limited httpOnly cookie |     0% |  100% | +100pp |
| T7   | no-store/noindex/no-referrer headers             |     0% |  100% | +100pp |
| T8   | no-token UI runtime smoke                        |     0% |  100% | +100pp |
| T9   | valid-token full browser E2E                     |     0% |    0% |    0pp |
| T10  | 완료 보고서 작성                                 |     0% |  100% | +100pp |

이번 slice 구현 완료율은 86%다. Web 구현과 smoke는 완료했고, 실제 유효 token을
발급해 브라우저에서 verify/complete/success/replay까지 도는 E2E gate는 다음
작업으로 남겼다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role        | Model route    | 선택 이유                                                         | 결과                                          |
| -------- | ------------------- | -------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Banach   | `frontend_agent`    | GPT-5.5 medium | Next App Router, Server/Client 경계, public auth UX 검토          | route/file map 제안, 최종 blocking 없음       |
| Bacon    | `security_reviewer` | GPT-5.5 high   | raw token, cookie, same-origin, session clear, no-store 보안 검토 | blocking 없음, 반대 purpose cookie clear 권고 |
| Pasteur  | `qa_agent`          | GPT-5.5 high   | Web/API/DB credential 검증 범위와 남은 E2E gate 판정              | no-token smoke 인정, valid-token E2E gap 지정 |
| Codex    | controller          | GPT-5          | 구현 통합, 검증 실행, 보고서 작성                                 | Web UX slice 구현 및 검증 완료                |

Spark는 사용하지 않았다. 이번 작업은 auth token, password complete, session cookie,
public credential route, 보안 헤더에 닿으므로 프로젝트 모델 규칙상 Spark 금지 또는
부적합 범위다.

## 4. 변경 파일

| 파일                                                                   | 변경 내용                                                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/web/next.config.ts`                                              | credential token page 보안 헤더 고정                                                                     |
| `apps/web/src/proxy.ts`                                                | `?token` 제거 redirect, path-limited httpOnly cookie 저장, 보안 헤더 적용                                |
| `apps/web/src/lib/credential-token-api.ts`                             | Web server-only public credential API adapter 추가                                                       |
| `apps/web/src/lib/credential-token-cookie.ts`                          | purpose별 cookie name/path, token normalization, cookie option helper 추가                               |
| `apps/web/src/server/actions/credential-token.actions.ts`              | complete Server Action, same-origin guard, safe message mapping, 성공 시 credential/session cookie clear |
| `apps/web/src/app/(auth)/_components/credential-token-page.tsx`        | token cookie read, verify API 호출, safe invalid state, form 연결                                        |
| `apps/web/src/app/(auth)/_components/credential-token-form.tsx`        | password/confirm form, success state, field error, accessibility status 연결                             |
| `apps/web/src/app/(auth)/staff-activation/page.tsx`                    | 직원 활성화 public route 추가                                                                            |
| `apps/web/src/app/(auth)/password-reset/page.tsx`                      | 비밀번호 재설정 public route 추가                                                                        |
| `docs/80_ai_harness/token-holder-web-ux-completion-report-20260507.md` | 이번 완료 보고서                                                                                         |

## 5. 전체 진행률 요약

| 기준                              | Before | After |  변동 | 판단 근거                                     |
| --------------------------------- | -----: | ----: | ----: | --------------------------------------------- |
| 전체 Web/API MVP readiness        |    64% |   66% |  +2pp | credential API 위에 public Web UX가 연결됨    |
| 실제 Web/API MVP 업무 기능        |    32% |   35% |  +3pp | 직원 활성화/reset 사용자가 접근할 화면이 생김 |
| Frontend shell                    |    78% |   81% |  +3pp | auth-side public form/상태 화면 추가          |
| Backend/domain                    |    54% |   54% |   0pp | API/DB contract는 변경하지 않음               |
| DB 기반 구축                      |    79% |   79% |   0pp | schema/migration 변경 없음                    |
| Credential token backend/security |    91% |   91% |   0pp | 기존 backend hardening 유지                   |
| Token-holder Web UX               |     0% |   72% | +72pp | route/form/adapter/smoke 완료, full E2E 미완  |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                               | Before | After |  변동 |
| ----: | ---------------------------- | ------------------------------------------------------- | -----: | ----: | ----: |
|     0 | Baseline/Harness             | MCP, subagent, 보고/검증 흐름 유지                      |   100% |  100% |   0pp |
|     1 | Design System Gate           | public auth card 패턴 유지, 디자인 PNG 신규 gate는 아님 |   100% |  100% |   0pp |
|     2 | API/DB/Auth Foundation       | credential backend/API/DB hardening 유지                |    99% |   99% |   0pp |
|     3 | Admin Foundation             | staff credential backend 완료, Web token-holder 연결    |    64% |   68% |  +4pp |
|     4 | Token-holder Web UX          | activation/reset public route와 complete form 구현      |     0% |   72% | +72pp |
|     5 | Inventory                    | 이번 작업 범위 아님                                     |    10% |   10% |   0pp |
|     6 | Sales                        | 이번 작업 범위 아님                                     |     8% |    8% |   0pp |
|     7 | Receivable/Customer/Schedule | 이번 작업 범위 아님                                     |     8% |    8% |   0pp |
|     8 | Web MVP Gate                 | public route smoke 추가, valid-token E2E 대기           |    22% |   28% |  +6pp |
|     9 | Electron Release             | desktop placeholder 단계                                |     3% |    3% |   0pp |

## 7. 검증 결과

| 검증                                         | 결과 | 비고                                                                            |
| -------------------------------------------- | ---: | ------------------------------------------------------------------------------- |
| `codex mcp list`                             | 통과 | e2b, memory, notion, playwright, sequential_thinking, context7 확인             |
| `pnpm --filter @psms/web typecheck`          | 통과 | Web TypeScript 통과                                                             |
| `pnpm --filter @psms/web lint`               | 통과 | Web ESLint 통과                                                                 |
| `pnpm --filter @psms/web build`              | 통과 | Next 16 production build 통과                                                   |
| `pnpm db:validate`                           | 통과 | Prisma schema valid                                                             |
| `pnpm test:unit:credential-token`            | 통과 | shared token helper/schema/policy                                               |
| `pnpm test:unit:credential-token-rate-limit` | 통과 | public credential limiter                                                       |
| `pnpm test:unit:credential-token-db`         | 통과 | DB contract, expected unique error log 포함                                     |
| `pnpm test:api:inject`                       | 통과 | auth/admin/staff/credential API inject smoke                                    |
| `pnpm typecheck`                             | 통과 | shared/db/api/web 전체                                                          |
| `pnpm lint`                                  | 통과 | API tsc lint + Web ESLint                                                       |
| `pnpm format:check`                          | 통과 | workspace Prettier                                                              |
| `pnpm test`                                  | 통과 | unit + DB contract + API inject 전체                                            |
| `pnpm build`                                 | 통과 | shared/db/api/web production build                                              |
| `git diff --check`                           | 통과 | whitespace error 없음                                                           |
| production HTTP header smoke                 | 통과 | `/staff-activation` no-store/noindex/no-referrer, `?token` redirect/cookie 확인 |
| Playwright UI smoke                          | 통과 | no-token desktop/mobile, h1 count, overflow, screenshot                         |

최종 로컬 서버 상태: API dev server `http://127.0.0.1:4273`, Web production start
`http://127.0.0.1:5273`.

## 8. Auth / DB / API Contract 변경 여부

| 영역                     | 변경 여부 | 비고                                                                     |
| ------------------------ | --------: | ------------------------------------------------------------------------ |
| Auth/session core        |        No | login/session/RBAC core 변경 없음                                        |
| Credential Web auth flow |       Yes | public token-holder page, cookie cleanup, same-origin Server Action 추가 |
| DB schema/migration      |        No | Prisma schema 변경 없음                                                  |
| API contract shape       |        No | 기존 Fastify credential API route와 `ActionResult` shape 변경 없음       |
| Web/UI                   |       Yes | activation/reset public route와 password form 추가                       |
| Harness/docs             |       Yes | completion report 추가                                                   |

## 9. 이슈/해결방법

| 이슈                                        | 원인                                                                | 해결                                                                                     | 재발 방지                                                      |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| raw token DOM 노출 위험                     | token을 Client prop/hidden input으로 넘기면 RSC/HTML에 남을 수 있음 | `proxy.ts`가 URL token을 httpOnly cookie로 옮기고 Server Action이 cookie에서 읽도록 변경 | token-holder page는 raw token을 Client Component prop으로 금지 |
| Next Server Action build 실패               | exported action wrapper가 `async`가 아니었음                        | exported Server Action을 `async function`으로 변경                                       | `next build`를 acceptance gate에 유지                          |
| Next 16 middleware 경고                     | `middleware.ts` convention deprecated                               | `src/proxy.ts`로 전환                                                                    | Next convention 변경 시 build warning 즉시 반영                |
| dev header smoke에서 no-store 누락처럼 보임 | dev server가 Cache-Control을 개발 모드용으로 덮어씀                 | production `next start`로 재확인하고 route headers 유지                                  | 보안 헤더는 production start 기준으로 검증                     |
| 접근성 연결 누락                            | `aria-describedby="status"` 대상 id 없음                            | live region에 `id="status"` 추가                                                         | Playwright/accessibility smoke에 h1/status 확인 포함           |
| 성공 시 반대 purpose token cookie 잔존 가능 | 현재 purpose cookie만 삭제                                          | 성공 시 activation/reset cookie 모두 만료 처리                                           | cookie cleanup은 purpose별 path를 모두 고려                    |

## 10. 남은 리스크

| 리스크                                                               | 영향도 | 대응                                                                                          |
| -------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------- |
| valid-token full browser E2E 미완                                    |   높음 | 다음 QA slice에서 issue/verify/complete/replay/rate-limit Playwright 추가                     |
| invalid/expired verify 실패 후 cookie가 TTL까지 남을 수 있음         |   낮음 | 검증 실패 cookie clear route 또는 proxy 재진입 정책을 다음 보안 보강에서 검토                 |
| Web adapter가 API 응답을 schema parse하지 않음                       |   낮음 | 다음 hardening에서 `credentialTokenPreviewSchema`/`credentialCompleteResultSchema` parse 추가 |
| BFF 호출 시 API audit/rate-limit의 IP/UA가 Web server 기준일 수 있음 |   중간 | trusted metadata forwarding 정책을 별도 security/backend gate에서 결정                        |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                       | Subagent                                                  | Model route                 | 상세                                                                                                                                                                     |
| ---: | ------------------------------- | --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|    1 | valid-token browser E2E gate    | `qa_agent` + `ui_runtime_validator` + `security_reviewer` | GPT-5.5 high + GPT-5.4-mini | admin issue 또는 seed helper로 유효 token 생성, `/staff-activation?token=...` redirect, verify success form, complete success, replay invalid, DOM/URL/trace secret scan |
|    2 | staff detail 계정 접근 UI 연결  | `frontend_agent` + `security_reviewer` + `backend_agent`  | GPT-5.5 medium/high         | `/staffs` drawer에 activation/reset issue/revoke controls, delivery mode 표시, rate-limit/forbidden/success 상태, raw token masking 정책 적용                            |
|    3 | credential Web hardening polish | `security_reviewer` + `backend_agent` + `qa_agent`        | GPT-5.5 high                | invalid verify cookie clear 전략, API response schema parse, trusted IP/UA forwarding, expired/rate-limited browser state, accessibility/viewport gate 확장              |
