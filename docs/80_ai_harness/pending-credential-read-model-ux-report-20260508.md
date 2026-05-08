# Pending Credential Read Model UX Completion Report - 2026-05-08

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 상세 Drawer의 pending credential request
read model과 상태 표시 UX를 구현했다.

이번 작업은 기존 admin credential issue/revoke mutation result shape는 유지하고,
`AdminStaffDetail` read model만 확장했다. API는 현재 유효한 active request만
`PENDING`으로 반환하며, raw token, token hash, activeKey, token URL은 Web/API
read response와 Drawer UI에 노출하지 않는다.

추가로 UI를 우회한 ADMIN 대상 credential issue/revoke 직접 POST를 서버 서비스
계층에서 차단하도록 보강했다.

## 2. 작업 분해 및 변동률

| Task | 내용                                            | Before | After |   변동 |
| ---- | ----------------------------------------------- | -----: | ----: | -----: |
| T1   | MCP/하네스/필수 문서/현재 dirty state 재확인    |     0% |  100% | +100pp |
| T2   | backend/frontend/security/QA/architecture 위임  |     0% |  100% | +100pp |
| T3   | `AdminStaffDetail` pending request read model   |     0% |  100% | +100pp |
| T4   | activeKey/expiry/used/revoked 기반 API 조회     |     0% |  100% | +100pp |
| T5   | Drawer pending/none 상태 표시 및 revoke disable |     0% |   96% |  +96pp |
| T6   | ADMIN target 직접 issue/revoke 서버 차단        |     0% |  100% | +100pp |
| T7   | API inject smoke 보강                           |     0% |  100% | +100pp |
| T8   | managed E2E reload/pending/revoke 회귀 검증     |     0% |  100% | +100pp |
| T9   | completion report 및 Phase 진행율 갱신          |     0% |  100% | +100pp |

이번 slice 구현 완료율은 97%다. 남은 3%는 운영 delivery webhook retry/monitoring과
연동되는 상위 운영 게이트이며, 이번 read model/UX acceptance 범위는 완료했다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role         | Model route    | 선택 이유                                             | 결과                                                                             |
| -------- | -------------------- | -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Hubble   | `backend_agent`      | GPT-5.5 high   | staff detail read model 위치와 API boundary 확인      | mutation service가 아니라 `staffs.query.ts` detail read model에 붙이는 방향 제시 |
| Lorentz  | `frontend_agent`     | GPT-5.5 medium | Next App Router Drawer/useActionState UX 확인         | `StaffCredentialPanel` 내부 상태 카드와 `router.refresh()` 흐름 제안             |
| Newton   | `security_reviewer`  | GPT-5.5 high   | token/hash/activeKey/ADMIN target 보안 조건 검토      | 허용 필드, pending 조건, ADMIN 직접 POST 차단 blocker 제시                       |
| Fermat   | `qa_agent`           | GPT-5.5 high   | API/E2E/secret leakage acceptance 설계                | expired/used/revoked 제외, reload 후 pending 표시, artifact scan checklist 제안  |
| Lovelace | `architect_reviewer` | GPT-5.5 high   | API contract/read model 확장과 architecture gate 검토 | mutation result shape 유지 조건으로 read model 확장 승인                         |
| Codex    | controller           | GPT-5          | 구현 통합, 검증 실행, 보고서 작성                     | 패치 적용, 전체 검증, 완료 보고 작성                                             |

Spark는 사용하지 않았다. 이번 범위가 auth/RBAC, credential token, token secrecy,
API read model contract, ADMIN target policy에 닿아 프로젝트 규칙상 Spark 금지
또는 부적합 범위다. mini도 단순 문서/스캐폴딩이 아니라 보안 회귀와 API 경계 검토가
핵심이라 사용하지 않았다.

## 4. 변경 파일

| 파일                                                                       | 변경 내용                                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/shared/src/admin/read-models.ts`                                 | `AdminStaffDetail.credentialRequests` read model 타입 추가             |
| `packages/shared/src/admin/index.ts`                                       | 신규 credential request read model 타입 export                         |
| `packages/shared/src/index.ts`                                             | root shared export에 신규 read model 타입 연결                         |
| `apps/api/src/repositories/admin-staff.repository.ts`                      | staff detail/list raw row에 store status select 보강                   |
| `apps/api/src/repositories/user-password-token.repository.ts`              | pending token read query와 issue audit delivery mode 조회 추가         |
| `apps/api/src/queries/admin/staffs.query.ts`                               | active pending request 판정, delivery mode read, detail response 조립  |
| `apps/api/src/services/admin/staff-credentials.service.ts`                 | ADMIN target issue/revoke 직접 POST 차단                               |
| `apps/web/src/app/(workspace)/staffs/_components/staff-mutation-panel.tsx` | Drawer pending/none 상태 카드, revoke disable label, 만료/처리자 표시  |
| `test/smoke/api-admin-read-inject-smoke.ts`                                | pending/expired read model 및 secret field 미노출 검증 추가            |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts`                      | ADMIN target direct issue/revoke 차단 smoke 추가                       |
| `test/e2e/admin-staff-mutation-ui.spec.ts`                                 | pending 표시, reload 유지, revoke 후 none 상태, secret 미노출 E2E 보강 |
| `docs/80_ai_harness/pending-credential-read-model-ux-report-20260508.md`   | 이번 완료 보고서                                                       |

## 5. 전체 진행률 요약

| 기준                              | Before | After | 변동 | 판단 근거                                                        |
| --------------------------------- | -----: | ----: | ---: | ---------------------------------------------------------------- |
| 전체 Web/API MVP readiness        |    68% |   70% | +2pp | admin credential request 운영 상태가 API/UI에서 확인 가능        |
| 실제 Web/API MVP 업무 기능        |    38% |   40% | +2pp | 직원 상세에서 발급/회수뿐 아니라 현재 대기 상태까지 운영 가능    |
| Admin staff credential 운영 slice |    88% |   97% | +9pp | issue/revoke UX 이후 pending read model과 reload E2E 완료        |
| Credential token backend/security |    93% |   95% | +2pp | activeKey/expiry 조건과 ADMIN direct POST 차단 보강              |
| Browser E2E coverage              |    60% |   62% | +2pp | 테스트 수는 60개 유지, pending/reload/revoke 상태 assertion 추가 |
| Release/secret leakage gate       |    78% |   82% | +4pp | API/UI/artifact secret scan까지 통과                             |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                 | Before | After | 변동 |
| ----: | ---------------------------- | --------------------------------------------------------- | -----: | ----: | ---: |
|     0 | Baseline/Harness             | MCP 확인, subagent 위임, 보고/검증 흐름 유지              |   100% |  100% |  0pp |
|     1 | Design System Gate           | 기존 Sidebar + Drawer 구조 유지, compact status card 추가 |   100% |  100% |  0pp |
|     2 | API/DB/Auth Foundation       | DB schema/auth core 변경 없음, read model만 보수 확장     |    99% |   99% |  0pp |
|     3 | Admin Foundation             | staff credential 발급/회수/대기상태 표시 가능             |    74% |   78% | +4pp |
|     4 | Token-holder Web UX          | public token-holder 흐름 유지, 이번 범위는 admin side     |    72% |   72% |  0pp |
|     5 | Inventory                    | 이번 작업 범위 아님                                       |    10% |   10% |  0pp |
|     6 | Sales                        | 이번 작업 범위 아님                                       |     8% |    8% |  0pp |
|     7 | Receivable/Customer/Schedule | 이번 작업 범위 아님                                       |     8% |    8% |  0pp |
|     8 | Web MVP Gate                 | managed E2E 60/60, artifact secret scan 통과              |    34% |   37% | +3pp |
|     9 | Electron Release             | desktop placeholder, release gate는 아직 NO-GO            |     3% |    3% |  0pp |

## 7. 검증 결과

| 검증                                  | 결과 | 비고                                                        |
| ------------------------------------- | ---: | ----------------------------------------------------------- |
| `codex mcp list`                      | 통과 | e2b, memory, notion, playwright, sequential_thinking 확인   |
| `pnpm typecheck`                      | 통과 | shared/db/api/web 전체 TypeScript                           |
| `pnpm --filter @psms/api test:inject` | 통과 | read model, ADMIN direct block, credential token smoke 포함 |
| `pnpm lint`                           | 통과 | API tsc lint + Web ESLint                                   |
| `pnpm db:validate`                    | 통과 | Prisma schema valid                                         |
| `pnpm format:check`                   | 통과 | 전체 Prettier check                                         |
| `pnpm test`                           | 통과 | unit + DB contract + API inject 전체                        |
| `pnpm build`                          | 통과 | shared/db/api/web production build                          |
| `pnpm test:e2e:managed:preflight`     | 통과 | 4273/5273 사용 가능 확인 후 진행                            |
| `pnpm test:e2e:managed`               | 통과 | Playwright 60 passed                                        |
| `pnpm test:e2e:artifact-secret-scan`  | 통과 | 108 files scanned, secret leak 없음                         |

1차 managed E2E에서 test locator가 새 안내 문구와 충돌해 57/60으로 실패했으나,
locator를 exact match로 좁힌 뒤 재실행하여 60/60 통과했다. 기능 결함이 아니라
테스트 selector 범위 문제였다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                    | 변경 여부 | 비고                                       |
| ----------------------- | --------: | ------------------------------------------ |
| Auth/session core       |        No | login/session/cookie/hash core 변경 없음   |
| DB schema/migration     |        No | Prisma schema/migration 변경 없음          |
| API mutation contract   |        No | issue/revoke result shape 유지             |
| API read model contract |       Yes | `AdminStaffDetail.credentialRequests` 추가 |
| RBAC/security behavior  |       Yes | ADMIN target 직접 issue/revoke 서버 차단   |
| Web/UI                  |       Yes | Staff Drawer pending/none 상태 표시        |

## 9. 이슈/해결방법

| 이슈                                         | 원인                                                                   | 해결                                                                      | 재발 방지                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| managed E2E preflight `canRunManaged: false` | 기존 PSMS API dev server가 4273 점유                                   | 같은 workspace의 오래 떠 있던 `src/server.ts` node process 정리 후 재확인 | E2E 전 preflight 유지                      |
| Playwright strict locator 실패               | `계정 접근 요청` partial text가 새 안내 문구까지 매칭                  | `{ exact: true }`로 status panel 제목만 확인                              | 새 UI 문구 추가 시 exact/role locator 우선 |
| ADMIN target direct issue 가능성             | UI는 숨기지만 service validation이 ADMIN을 통과시킬 수 있었음          | issue/revoke service에서 `INVALID_ACCOUNT_STATE` 차단                     | API inject smoke로 직접 POST 회귀 고정     |
| expired token pending 오표시 가능성          | read model이 expiry 조건을 놓치면 만료 요청이 pending처럼 보일 수 있음 | `expiresAt > now`, `usedAt/revokedAt null`, exact activeKey 조건 적용     | expired fixture smoke 추가                 |

## 10. 남은 리스크

| 리스크                                                       | 영향도 | 대응                                                                   |
| ------------------------------------------------------------ | -----: | ---------------------------------------------------------------------- |
| delivery webhook retry/monitoring 미완                       |   중간 | 다음 운영 hardening slice에서 retry/failure monitor와 audit 정책 정리  |
| revoke repository는 expired token도 revoke count에 포함 가능 |   낮음 | read model은 제외 완료, 다음 payment/ops 전 revoke semantics 별도 검토 |
| ADMIN credential 전용 workflow 부재                          |   낮음 | 정책 확정 전에는 보수적으로 차단 유지                                  |
| Electron release                                             |   높음 | Web/API MVP와 backup/restore/persistence gate 완료 전까지 NO-GO 유지   |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                | Subagent                                                             | Model route  | 상세                                                                                                                 |
| ---: | ---------------------------------------- | -------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
|    1 | delivery webhook 운영 contract hardening | `security_reviewer` + `devops_sre_reviewer` + `backend_agent`        | GPT-5.5 high | HTTPS/webhook auth, retry/failure audit, secret rotation, delivery monitor, production release gate 문서/테스트 보강 |
|    2 | credential request revoke semantics 정리 | `backend_agent` + `db_reviewer` + `qa_agent`                         | GPT-5.5 high | expired token revoke count 포함 여부, activeKey unique lifecycle, audit count 의미를 DB/API smoke와 함께 확정        |
|    3 | Electron local release preflight         | `desktop_release_agent` + `devops_sre_reviewer` + `release_reviewer` | GPT-5.5 high | Web/API local runtime, SQLite persistence, backup/restore, port conflict, log redaction, rollback checklist 검증     |
