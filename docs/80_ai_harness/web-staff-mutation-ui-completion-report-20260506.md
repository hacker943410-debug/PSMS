# Web Staff Mutation UI Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 slice인 `/staffs` Web mutation 연결을 완료했다.

이미 구현되어 있던 Fastify API 계약은 변경하지 않고, Web에서 다음 두 API를 호출하도록 연결했다.

- `POST /admin/staffs/update`
- `POST /admin/staffs/change-status`

Web은 business logic을 소유하지 않는다. 이번 변경은 FormData shape 검증, same-origin guard,
`psms_session` 단일 쿠키 forwarding, API POST 호출, 성공 시 `/staffs` revalidate, drawer UI 표시만 포함한다.

## 2. 작업 분해

| Task | 내용                                                     | 담당      | 상태 | 진행율 |
| ---- | -------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 staff update 보고서 기준 다음 slice 확정 | Codex     | 완료 |   100% |
| T2   | frontend/security/UI validation subagent 자동 위임       | Subagents | 완료 |   100% |
| T3   | `/staffs` Web 구조와 read adapter/action 패턴 분석       | Codex     | 완료 |   100% |
| T4   | `admin-write-api` POST adapter 추가                      | Codex     | 완료 |   100% |
| T5   | staff update/change-status Server Action 추가            | Codex     | 완료 |   100% |
| T6   | `/staffs` drawer를 Client mutation panel로 분리 및 연결  | Codex     | 완료 |   100% |
| T7   | 1280px drawer 접근성/URL-state 보강                      | Codex     | 완료 |   100% |
| T8   | 타입/테스트/build/UI runtime validation                  | Codex     | 완료 |   100% |
| T9   | code_reviewer 지적 반영 및 재검증                        | Codex     | 완료 |   100% |
| T10  | 완료 보고서와 다음 3단계 작성                            | Codex     | 완료 |   100% |

이번 Web Staff Mutation UI Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role           | Model route         | 선택 이유                                                     | 결과                                                                            |
| -------- | ---------------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Plato    | `frontend_agent`       | GPT-5.5 medium      | Next.js App Router, URL-state, drawer/form 연결 구조 검토     | Web thin adapter + Client drawer 분리 권고                                      |
| Sartre   | `security_reviewer`    | GPT-5.5 high        | cookie forwarding, RBAC, CSRF/same-origin, 민감정보 노출 검토 | 구현 전 No-go. 필수 보안 조건 제시                                              |
| Jason    | `ui_runtime_validator` | GPT-5.4-mini medium | Playwright viewport, console/network/hydration 검증 계획      | dev server 필요 조건과 screenshot 체크리스트 제시                               |
| Planck   | `code_reviewer`        | gpt-5.3-codex high  | 구현 후 diff 기반 read-only 리뷰                              | same-origin fail-open, drawer a11y, Web mutation test 보강 지적. 모두 반영 완료 |
| Codex    | controller             | GPT-5               | 구현 통합, 검증 실행, 보고서 작성                             | Web 연결과 검증 완료                                                            |

Spark는 사용하지 않았다. 이번 작업은 Web Server Action adapter, session cookie forwarding,
same-origin guard, API mutation 연결을 포함하므로 하네스 기준 Spark 금지 범위에 가깝다.

## 4. 변경 파일

| 파일                                                                       | 변경 내용                                                                                                                             | 담당  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `apps/web/src/lib/admin-write-api.ts`                                      | server-only POST adapter 추가, `psms_session` 단일 cookie forwarding, API failure mapping                                             | Codex |
| `apps/web/src/server/actions/admin-staff.actions.ts`                       | `updateStaffAction`, `changeStaffStatusAction`, shared Zod 검증, same-origin guard, safe message mapping, `revalidatePath("/staffs")` | Codex |
| `apps/web/src/app/(workspace)/staffs/_components/staff-mutation-panel.tsx` | 직원 상세/수정/status change drawer Client Component 추가, inline field errors, reason 필수 UI, pending/success/error 상태            | Codex |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                             | 정적 drawer 제거, URL-state 기반 drawer 렌더링, 실제 row 우선 표시, 1280px overlay drawer, 조회 submit/accessibility 보강             | Codex |
| `test/e2e/admin-staff-mutation-ui.spec.ts`                                 | status reason validation과 update no-change Server Action 응답을 검증하는 Web mutation E2E 추가                                       | Codex |

## 5. 구현 상세

| 항목           | 내용                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| API adapter    | `postAdminApi()`가 API base URL로 JSON POST를 수행한다. 전체 cookie header가 아니라 `psms_session`만 전달한다.           |
| Server Action  | FormData를 shared Zod schema로 검증하고 API로 위임한다. last-admin/self/store/stale 같은 비즈니스 규칙은 API가 판단한다. |
| Update drawer  | `userId`, `expectedUpdatedAt` hidden field를 포함하고 `name`, `role`, `storeId`, `phone`만 수정한다.                     |
| Status change  | 상세 drawer에서 변경 사유를 입력해야 submit 가능하다. 빈 사유는 shared Zod field error로 표시된다.                       |
| Create drawer  | create API는 이번 scope가 아니므로 비활성 안내 상태로 유지했다.                                                          |
| Responsive     | 1400px 미만에서는 drawer를 오른쪽 fixed overlay로 표시해 `1280x800`에서도 상세/수정 접근이 가능하다.                     |
| A11y           | drawer에 `role="dialog"`, `aria-modal`, `aria-labelledby`, action link accessible name을 추가했다.                       |
| Native confirm | `alert`/`confirm`은 사용하지 않았다.                                                                                     |
| Status text    | 상태 표시는 “활성/비활성” 텍스트를 포함한다.                                                                             |

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                                |
| -------------------------- | ----------: | ------------------------------------------------------------------------ |
| 전체 준비 포함             |         47% | Staff API mutation 2개와 Web 연결 완료                                   |
| 실제 Web/API MVP 업무 기능 |         21% | Admin staff update/status가 API+Web으로 연결됨                           |
| Frontend shell             |         76% | 승인된 레이아웃에 실제 staff drawer mutation 연결 추가                   |
| Backend/domain             |         35% | Staff mutation API 완료, base/policy/domain 핵심 mutation 남음           |
| DB 기반 구축               |         74% | schema/seed/API smoke 기반 유지. 이번 DB schema 변경 없음                |
| Phase 3 Admin Foundation   |         38% | staff read/update/status Web 연결 완료. create/base/policy mutation 남음 |

## 7. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                    | 완료율 |
| ----: | ---------------------------- | ---------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                                         |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 staff 기능 연결 후 viewport 검증 추가          |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 완료                   |    91% |
|     3 | Admin Foundation             | staff read/update/status API+Web 연결 완료. create/base/policy mutation 대기 |    38% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                          |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                    |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                         |     8% |
|     8 | Web MVP Gate                 | staff 일부 E2E/UI runtime 통과. 통합 E2E와 핵심 domain 대기                  |    10% |
|     9 | Electron Release             | desktop placeholder 단계                                                     |     3% |

## 8. 검증 결과

| 검증                                                                                                | 결과 | 근거                                                                                               |
| --------------------------------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------------------------- |
| MCP surface check                                                                                   | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 활성 확인               |
| `pnpm --filter @psms/web typecheck`                                                                 | 통과 | Web TypeScript 통과                                                                                |
| `pnpm --filter @psms/web lint`                                                                      | 통과 | Web ESLint 통과                                                                                    |
| `pnpm format:check`                                                                                 | 통과 | Prettier check 통과                                                                                |
| `pnpm typecheck`                                                                                    | 통과 | shared/db/api/web typecheck 통과                                                                   |
| `pnpm test`                                                                                         | 통과 | unit + API inject smoke 전체 통과                                                                  |
| `pnpm build`                                                                                        | 통과 | shared/db/api/web production build 통과                                                            |
| `git diff --check`                                                                                  | 통과 | whitespace error 없음                                                                              |
| `pnpm exec playwright test test/e2e/admin-url-state.spec.ts --project=chromium-1586 --grep "staff"` | 통과 | staff URL-state 2개 E2E 통과                                                                       |
| `pnpm exec playwright test test/e2e/admin-staff-mutation-ui.spec.ts --project=chromium-1586`        | 통과 | reason validation, no-change update UI 통과                                                        |
| UI runtime script                                                                                   | 통과 | `1586x992`, `1440x900`, `1280x800`에서 base/detail/edit screenshot, console/network/pageerror 없음 |
| API health                                                                                          | 통과 | `http://127.0.0.1:4273/health` 200                                                                 |
| Web dev server                                                                                      | 통과 | `http://127.0.0.1:5273/staffs` 200                                                                 |

Playwright MCP `browser_navigate`는 로컬 MCP Chrome 프로필이 이미 사용 중이라 실패했다.
대신 같은 Playwright 런타임을 shell script로 실행해 screenshot/console/network 검증을 완료했다.

## 9. UI Evidence

| Viewport   | 확인 상태                                    | Screenshot                                              |
| ---------- | -------------------------------------------- | ------------------------------------------------------- |
| `1586x992` | base/detail/edit/status validation/no-change | `test-results/staffs-mutation-ui-20260506/staffs-*.png` |
| `1440x900` | base/detail/edit                             | `test-results/staffs-mutation-ui-20260506/staffs-*.png` |
| `1280x800` | base/detail/edit overlay                     | `test-results/staffs-mutation-ui-20260506/staffs-*.png` |

## 10. Auth / DB / API Contract 변경 여부

| 영역                |        변경 여부 | 비고                                                         |
| ------------------- | ---------------: | ------------------------------------------------------------ |
| Auth                |               No | 인증 방식/RBAC 정책 변경 없음. Web route guard 유지          |
| Cookie/session      | Yes(Web adapter) | API forwarding용 `psms_session` 단일 cookie header 구성 추가 |
| DB schema/migration |               No | Prisma schema/migration 변경 없음                            |
| API contract        |               No | 기존 `update`, `change-status` API만 호출                    |
| Web/UI              |              Yes | `/staffs` mutation drawer 연결                               |

## 11. 이슈/해결방법

| 이슈                                  | 원인                                                     | 해결                                                                                     | 재발 방지                                              |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Server Action runtime 500             | `"use server"` 파일에서 async function 외 상수 export    | 초기 form state를 Client Component 내부 상수로 이동                                      | Server Action 파일은 async action과 type export만 유지 |
| 1280px drawer 미노출                  | 기존 drawer가 `max-width:1399px`에서 hidden              | URL-state drawer를 fixed overlay로 표시                                                  | UI validation에 1280 detail/edit 포함                  |
| 직원 E2E row open 실패                | 액션 link가 `getByLabel(/직원 상세 보기/)`에 잡히지 않음 | row action link에 `aria-label` 추가                                                      | icon/action link는 명시적 accessible name 유지         |
| dev seed 실패 1회                     | `.env` seed password가 12자 미만                         | `PSMS_SEED_ADMIN_PASSWORD`, `PSMS_SEED_STAFF_PASSWORD`를 명시해 seed 실행                | E2E reset은 자체 password env를 주입함                 |
| same-origin guard fail-open 리뷰 지적 | `origin`/`host` 누락 시 허용하는 초기 구현               | `sec-fetch-site` 또는 `origin+host` 근거가 없으면 403 반환, 기본 포트 normalization 보강 | security-sensitive Server Action은 fail-closed 우선    |
| Web mutation E2E 부족 리뷰 지적       | API smoke 중심 검증                                      | `admin-staff-mutation-ui.spec.ts` 추가                                                   | Web adapter/UI 연결 slice마다 최소 browser smoke 추가  |

## 12. 남은 리스크

| 리스크                                                                         | 영향도 | 대응                                                                                |
| ------------------------------------------------------------------------------ | -----: | ----------------------------------------------------------------------------------- |
| full `admin-url-state` E2E는 base/policies 기존 seed/detail 기대치로 일부 실패 |   중간 | 다음 base/policy mutation 또는 E2E fixture 정리 slice에서 처리. staff subset은 통과 |
| Staff create API 미구현                                                        |   높음 | 다음 security preflight 후 temporary password/audit 정책 확정                       |
| 실제 성공 update/status browser mutation은 no-change/validation까지만 UI 검증  |   중간 | 전용 fixture 기반 Web mutation E2E에서 실제 update/status success 추가              |
| drawer focus trap은 아직 없음                                                  |   낮음 | 공통 Drawer/Dialog primitive 개선 slice에서 focus restore/trap 추가                 |

## 13. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                  | Subagent                                                           | Model route                          | 상세                                                                                                                 |
| ---: | ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
|    1 | Staff create security preflight            | `security_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent` | GPT-5.5 high                         | 임시 비밀번호 생성/1회 노출/초기화 정책, AuditLog, STAFF store rule, seed 충돌, API contract와 smoke 범위 확정       |
|    2 | Staff create API 구현                      | `backend_agent` + `security_reviewer` + `qa_agent`                 | GPT-5.5 high                         | `POST /admin/staffs/create`, password hash, duplicate loginId, active store validation, audit, API inject smoke 구현 |
|    3 | Staff create Web drawer 연결 + browser E2E | `frontend_agent` + `ui_runtime_validator` + `code_reviewer`        | GPT-5.5 medium + mini + codex review | 현재 비활성 create drawer를 실제 Server Action으로 연결하고 3개 viewport, console/network, success/error E2E 검증    |
