# Staff Create Web Drawer Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 slice인 Staff create Web drawer 연결을 완료했다.

이번 범위는 이미 완료된 `POST /admin/staffs/create` API를 Web Server Action과
drawer form에 연결하고, password/temporary/reset/secret/token 노출 없이
`INACTIVE` 직원 계정 생성이 목록과 상세 화면까지 갱신되는지 검증하는 것이다.

## 2. 작업 분해

| Task | 내용                                                  | 담당      | 상태 | 진행율 |
| ---- | ----------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 보고서 기준 Web create slice 확정     | Codex     | 완료 |   100% |
| T2   | frontend/security/UI runtime subagent 자동 위임       | Subagents | 완료 |   100% |
| T3   | `createStaffAction` 추가와 API adapter 호출 연결      | Codex     | 완료 |   100% |
| T4   | create drawer를 password-free form으로 전환           | Codex     | 완료 |   100% |
| T5   | unknown key validation message redaction 보강         | Codex     | 완료 |   100% |
| T6   | API secret scanner를 string value까지 확장            | Codex     | 완료 |   100% |
| T7   | create drawer validation/success/list/detail E2E 추가 | Codex     | 완료 |   100% |
| T8   | E2E 하네스 auth mode 정리 및 3개 viewport 검증        | Codex     | 완료 |   100% |
| T9   | 전체 type/lint/test/build/db 검증                     | Codex     | 완료 |   100% |
| T10  | 완료 보고서와 다음 3단계 상세 미리보기 작성           | Codex     | 완료 |   100% |

이번 Staff Create Web Drawer Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent      | Harness role           | Model route    | 선택 이유                                           | 결과                                                                             |
| ------------- | ---------------------- | -------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Epicurus      | `frontend_agent`       | GPT-5.5 medium | Next App Router drawer/action 연결과 form 상태 검토 | create action/form/stores 전달/E2E selector 지침 반영                            |
| Faraday       | `security_reviewer`    | GPT-5.5 high   | password/session/RBAC/field error redaction 검토    | `.strict()` unknown key가 secret key명을 노출하는 blocker 확인 및 redaction 반영 |
| Chandrasekhar | `ui_runtime_validator` | GPT-5.4-mini   | Playwright viewport/runtime guard 설계              | 1586/1440/1280 create drawer 검증 전략 반영                                      |
| Codex         | controller             | GPT-5          | 구현 통합, 검증 실행, 보고서 작성                   | Web create slice 완료                                                            |

Spark는 사용하지 않았다. 이번 작업은 Web Server Action, session cookie forwarding,
validation redaction, secret 노출 방지, admin mutation E2E를 포함하므로 하네스 기준
Spark 금지 또는 부적합 범위다.

## 4. 변경 파일

| 파일                                                                       | 변경 내용                                                                                                                       | 담당  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `apps/web/src/server/actions/admin-staff.actions.ts`                       | `createStaffAction` 추가, same-origin guard, shared schema validation, API create 호출, `/staffs` revalidate, safe message 추가 | Codex |
| `apps/web/src/app/(workspace)/staffs/_components/staff-mutation-panel.tsx` | create drawer를 실제 form으로 전환, stores 전달, password-free copy 유지, 성공 시 refresh/reset                                 | Codex |
| `packages/shared/src/auth.validation.ts`                                   | Zod `unrecognized_keys` message를 generic redaction 문구로 변환                                                                 | Codex |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts`                      | secret detector가 응답/AuditLog string value까지 검사하도록 확장                                                                | Codex |
| `test/e2e/admin-staff-mutation-ui.spec.ts`                                 | create drawer validation/success/list/detail/no-secret E2E 추가, runtime guard 보강                                             | Codex |
| `docs/80_ai_harness/staff-create-web-drawer-completion-report-20260506.md` | 작업 완료 보고서 작성                                                                                                           | Codex |

## 5. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                |
| -------------------------- | ----------: | -------------------------------------------------------- |
| 전체 준비 포함             |         51% | Staff create API에 이어 Web drawer 연결과 E2E까지 완료   |
| 실제 Web/API MVP 업무 기능 |         24% | 직원 read/update/status/create Web/API 흐름 일부 완성    |
| Frontend shell             |         78% | staff drawer mutation UI가 create까지 확장됨             |
| Backend/domain             |         38% | 이번 slice는 API 변경 없음. 기존 create API 재사용       |
| DB 기반 구축               |         74% | schema/migration 변경 없음. seed 기반 E2E 검증 통과      |
| Phase 3 Admin Foundation   |         49% | staff read/update/status/create의 Web/API 핵심 흐름 완료 |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                    | 완료율 |
| ----: | ---------------------------- | ---------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                                         |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 기존 drawer 패턴 준수                   |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 완료                   |    92% |
|     3 | Admin Foundation             | staff read/update/status/create Web/API 핵심 완료, base/policy mutation 대기 |    49% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                          |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                    |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                         |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E가 create/update/status까지 확장                           |    16% |
|     9 | Electron Release             | desktop placeholder 단계                                                     |     3% |

## 7. 검증 결과

| 검증                                                                                                                                         | 결과 | 근거                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------ |
| MCP surface check                                                                                                                            | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 활성 확인 |
| `pnpm exec prettier --write ...`                                                                                                             | 통과 | 변경 파일 포맷 적용                                                                  |
| `pnpm --filter @psms/api exec -- tsx ../../test/smoke/api-admin-staff-mutation-inject-smoke.ts`                                              | 통과 | Staff create API mutation smoke 통과                                                 |
| `pnpm exec playwright install chromium`                                                                                                      | 통과 | Playwright 1.59.1용 Chromium 1217 설치                                               |
| `pnpm exec playwright test test/e2e/admin-staff-mutation-ui.spec.ts --project=chromium-1586 --project=chromium-1440 --project=chromium-1280` | 통과 | 9 tests passed                                                                       |
| `pnpm typecheck`                                                                                                                             | 통과 | shared/db/api/web typecheck 통과                                                     |
| `pnpm lint`                                                                                                                                  | 통과 | API tsc lint, Web ESLint 통과                                                        |
| `pnpm format:check`                                                                                                                          | 통과 | 전체 workspace Prettier check 통과                                                   |
| `pnpm db:validate`                                                                                                                           | 통과 | Prisma schema valid                                                                  |
| `pnpm test`                                                                                                                                  | 통과 | unit + API inject 전체 통과                                                          |
| `pnpm build`                                                                                                                                 | 통과 | shared/db/api/web production build 통과                                              |
| `git diff --check`                                                                                                                           | 통과 | whitespace error 없음                                                                |

E2E mutation 검증은 실제 audit actor가 필요하므로 `PSMS_DEV_AUTH_BYPASS=false`와
32바이트 이상 `AUTH_SECRET`을 주입한 서버에서 실행했다. seed reset 후 서버를 재시작하고,
Playwright 실행 시에는 `PSMS_SKIP_E2E_SEED_RESET=true`로 DB 연결 stale 이슈를 피했다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                 | 변경 여부 | 비고                                                                           |
| -------------------- | --------: | ------------------------------------------------------------------------------ |
| Auth/session         |        No | session guard/cookie/hash 로직 변경 없음. E2E 실행 env만 실제 로그인 모드 사용 |
| Validation redaction |       Yes | unknown key field error가 secret key명을 반사하지 않도록 generic message 적용  |
| DB schema/migration  |        No | Prisma schema/migration 변경 없음                                              |
| API contract shape   |        No | 기존 `POST /admin/staffs/create` contract 재사용. 응답 shape 변경 없음         |
| Web/UI               |       Yes | create drawer form과 Server Action 연결                                        |

## 9. 이슈/해결방법

| 이슈                                            | 원인                                                                                             | 해결                                                           | 재발 방지                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------- |
| STAFF/store E2E가 `STAFF_STORE_REQUIRED`로 실패 | dev auth bypass actor가 DB User FK에 없어 AuditLog FK 실패 후 service catch가 store error로 표시 | E2E를 실제 seed admin 로그인 모드로 전환                       | mutation E2E는 dev-bypass가 아니라 real seed auth로 실행 |
| login global setup 실패                         | placeholder `AUTH_SECRET`은 session hash 생성에 사용할 수 없음                                   | E2E 서버/Playwright env에 32바이트 이상 local test secret 주입 | E2E runbook에 `AUTH_SECRET` 요구사항 기록                |
| Playwright browser missing                      | local Playwright 1.59.1이 요구하는 Chromium 1217 미설치                                          | `pnpm exec playwright install chromium` 실행                   | dependency update 후 browser install 확인                |
| row link strict violation                       | 이름 링크와 상세 icon link가 같은 accessible name 계열로 잡힘                                    | row scope로 locator 축소                                       | E2E selector는 row/detail 범위로 제한                    |
| `_rsc` aborted request false positive           | App Router navigation 중 정상 취소된 RSC request                                                 | runtime guard에서 `_rsc` + `ERR_ABORTED` 제외                  | Next navigation guard 예외 유지                          |

## 10. 남은 리스크

| 리스크                                                           | 영향도 | 대응                                                                                                 |
| ---------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------- |
| dev auth bypass로 mutation을 실행하면 audit actor FK가 맞지 않음 |   중간 | mutation E2E는 real seed auth 사용. dev bypass mutation 지원 여부는 별도 auth/architecture 검토 필요 |
| 직원 활성화/초기 password 전달 정책 미정                         |   높음 | 다음 security/DB/API preflight에서 reset token/first-login 정책 확정                                 |
| base/policy mutation은 아직 Web/API 미구현                       |   중간 | Admin Foundation 다음 slice로 분리                                                                   |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                   | Model route         | 상세                                                                                                      |
| ---: | ----------------------------------------- | ---------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
|    1 | Staff activation/password reset preflight | `security_reviewer` + `db_reviewer` + `architect_reviewer` | GPT-5.5 high        | 비활성 계정 활성화, first-login/reset token, expiry, audit, delivery 금지/허용 범위 확정                  |
|    2 | Base information mutation preflight       | `backend_agent` + `db_reviewer` + `frontend_agent`         | GPT-5.5 high/medium | store/carrier/subscription plan mutation contract, URL drawer 흐름, status-change vs delete 정책 정리     |
|    3 | Admin mutation E2E runbook hardening      | `qa_agent` + `devops_sre_reviewer`                         | GPT-5.5 high        | real seed auth env, AUTH_SECRET, seed-reset/server-restart 순서, managed runner staff spec 포함 여부 정리 |
