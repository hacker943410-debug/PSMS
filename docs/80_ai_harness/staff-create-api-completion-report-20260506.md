# Staff Create API Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 slice인 `POST /admin/staffs/create` API 구현을 완료했다.

이번 범위는 API-only다. Web create drawer 연결과 Web E2E는 다음 slice로 분리했다.
직전 security preflight 기준대로 직원 생성은 `INACTIVE` 계정만 허용하며,
raw/temporary password를 요청/응답/AuditLog/UI에 노출하지 않는다.

## 2. 작업 분해

| Task | 내용                                                         | 담당      | 상태 | 진행율 |
| ---- | ------------------------------------------------------------ | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 프리플라이트 기준 Staff create API 범위 확정 | Codex     | 완료 |   100% |
| T2   | backend/security/QA subagent 자동 위임                       | Subagents | 완료 |   100% |
| T3   | shared create schema/result type 추가                        | Codex     | 완료 |   100% |
| T4   | repository loginId lookup/create helper 추가                 | Codex     | 완료 |   100% |
| T5   | service transaction, placeholder password hash, audit 구현   | Codex     | 완료 |   100% |
| T6   | Fastify `POST /admin/staffs/create` route 연결               | Codex     | 완료 |   100% |
| T7   | API inject smoke create matrix 추가                          | Codex     | 완료 |   100% |
| T8   | Web placeholder copy에서 password/temporary 표현 제거        | Codex     | 완료 |   100% |
| T9   | 전체 검증과 security review 반영                             | Codex     | 완료 |   100% |
| T10  | 완료 보고서와 다음 3단계 작성                                | Codex     | 완료 |   100% |

이번 Staff Create API Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent  | Harness role        | Model route        | 선택 이유                                                    | 결과                                                              |
| --------- | ------------------- | ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Euclid    | `backend_agent`     | GPT-5.5 high       | Fastify route/service/repository, ActionResult contract 검토 | route guard 순서, `INACTIVE` 명시, secret detector 확장 지적 반영 |
| Helmholtz | `security_reviewer` | GPT-5.5 high       | password/session/RBAC/AuditLog secret redaction 검토         | 중간 blocker 확인. route/test/UI copy 반영 후 API 보안 조건 충족  |
| James     | `qa_agent`          | GPT-5.5 high       | API inject matrix, fixture 격리, validation command 설계     | create smoke matrix와 helper 배치 반영                            |
| Jason     | `security_reviewer` | GPT-5.5 high       | 구현 후 spec/security read-only review                       | API는 compliant. Web drawer/E2E는 다음 slice 리스크로 기록        |
| Euler     | `code_reviewer`     | gpt-5.3-codex high | 구현 후 code quality review 시도                             | 시간 내 완료되지 않아 종료. 로컬 전체 검증으로 보완               |
| Codex     | controller          | GPT-5              | 구현 통합, 검증 실행, 보고서 작성                            | API slice 완료                                                    |

Spark는 사용하지 않았다. 이번 작업은 auth/password/RBAC, Fastify API contract,
Prisma 저장 정책, AuditLog를 포함하므로 하네스 기준 Spark 금지 범위다.

## 4. 변경 파일

| 파일                                                                       | 변경 내용                                                                                                         | 담당  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| `packages/shared/src/admin/staffs.validation.ts`                           | `adminCreateStaffInputSchema`, `AdminCreateStaffInput` 추가. `status`는 optional `INACTIVE` literal only          | Codex |
| `packages/shared/src/admin/read-models.ts`                                 | `AdminStaffCreateResult` 추가                                                                                     | Codex |
| `packages/shared/src/admin/index.ts`                                       | create schema/type/result export 추가                                                                             | Codex |
| `packages/shared/src/index.ts`                                             | root shared barrel export 추가                                                                                    | Codex |
| `apps/api/src/repositories/admin-staff.repository.ts`                      | loginId duplicate lookup, `createAdminStaff` helper 추가                                                          | Codex |
| `apps/api/src/services/admin/staffs.service.ts`                            | `createAdminStaffUser`, placeholder password hash, active store rule, duplicate/race mapping, redacted audit 구현 | Codex |
| `apps/api/src/routes/admin/staffs.routes.ts`                               | `POST /admin/staffs/create` guard-first route 연결                                                                | Codex |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts`                      | create guard/forbidden/validation/success/duplicate/store/audit/secret/inactive-login smoke 추가                  | Codex |
| `apps/web/src/app/(workspace)/staffs/_components/staff-mutation-panel.tsx` | 다음 Web slice 전까지 password/temporary password 문구 제거                                                       | Codex |
| `docs/80_ai_harness/staff-create-api-completion-report-20260506.md`        | 작업 완료 보고서 작성                                                                                             | Codex |

## 5. 구현 상세

| 항목       | 내용                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Route      | `POST /admin/staffs/create`                                                                                         |
| Guard      | 기존 `requireAdminForStaffMutation` 재사용. guard 후 body validation                                                |
| Input      | `name`, `loginId`, `role`, `storeId`, `phone`, optional `status: "INACTIVE"`                                        |
| Status     | Prisma default `ACTIVE`를 사용하지 않고 service/repository에서 `INACTIVE` 명시                                      |
| Password   | 서버 내부 placeholder secret 생성 후 `hashPassword()` 저장, raw 값 반환 없음                                        |
| loginId    | API contract는 `loginId`, DB 저장은 기존 convention대로 `User.email`                                                |
| Store rule | `STAFF`는 active store 필수. `ADMIN`은 store null 가능, 값이 있으면 active only                                     |
| Audit      | `ADMIN_STAFF_CREATED`, `entityType=User`, `afterJson` redacted metadata only                                        |
| Error      | `401 AUTH_REQUIRED`, `403 FORBIDDEN`, `400 VALIDATION_FAILED`, `409 DUPLICATE_LOGIN_ID`, `409 STAFF_STORE_REQUIRED` |

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                         |
| -------------------------- | ----------: | ----------------------------------------------------------------- |
| 전체 준비 포함             |         49% | Staff create API 구현과 검증 완료                                 |
| 실제 Web/API MVP 업무 기능 |         22% | 직원 생성 API가 추가됨. Web 연결은 다음 slice                     |
| Frontend shell             |         76% | Web create drawer는 아직 비활성. copy 안전화만 적용               |
| Backend/domain             |         38% | Staff read/update/status/create API 완료                          |
| DB 기반 구축               |         74% | schema/migration 변경 없음. `User.email` loginId 정책 유지        |
| Phase 3 Admin Foundation   |         43% | staff mutation API 3개 완료. Web create/base/policy mutation 남음 |

## 7. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                  | 완료율 |
| ----: | ---------------------------- | ---------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                       |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 구현 변경 최소     |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 완료 |    92% |
|     3 | Admin Foundation             | staff read/update/status/create API 완료, Web create 대기  |    43% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현              |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현        |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                  |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                       |     8% |
|     8 | Web MVP Gate                 | staff 일부 E2E/UI runtime 통과. create Web E2E 대기        |    10% |
|     9 | Electron Release             | desktop placeholder 단계                                   |     3% |

## 8. 검증 결과

| 검증                                                                                         | 결과 | 근거                                                                                 |
| -------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------ |
| MCP surface check                                                                            | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 활성 확인 |
| `pnpm exec prettier --write ...`                                                             | 통과 | 변경 파일 포맷 적용                                                                  |
| `pnpm format:check`                                                                          | 통과 | 전체 workspace Prettier check 통과                                                   |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-admin-staff-mutation-inject-smoke.ts` | 통과 | Staff create 포함 API mutation smoke 통과                                            |
| `pnpm typecheck`                                                                             | 통과 | shared/db/api/web typecheck 통과                                                     |
| `pnpm lint`                                                                                  | 통과 | API tsc lint, Web ESLint 통과                                                        |
| `pnpm db:validate`                                                                           | 통과 | Prisma schema valid                                                                  |
| `pnpm test`                                                                                  | 통과 | unit + API inject 전체 통과                                                          |
| `pnpm build`                                                                                 | 통과 | shared/db/api/web production build 통과                                              |
| `git diff --check`                                                                           | 통과 | whitespace error 없음                                                                |

## 9. Auth / DB / API Contract 변경 여부

| 영역                |      변경 여부 | 비고                                                                             |
| ------------------- | -------------: | -------------------------------------------------------------------------------- |
| Auth                |             No | auth/session guard 자체 변경 없음. 기존 ADMIN guard 재사용                       |
| Password            |            Yes | create service에서 server-only placeholder password hash 저장                    |
| DB schema/migration |             No | Prisma schema/migration 변경 없음                                                |
| API contract        |            Yes | `POST /admin/staffs/create`, shared create schema/result 추가                    |
| AuditLog            |            Yes | `ADMIN_STAFF_CREATED` redacted audit 추가                                        |
| Web/UI              | Yes(copy only) | create drawer placeholder의 password/temporary 표현 제거. 실제 연결은 다음 slice |

## 10. 이슈/해결방법

| 이슈                                      | 원인                                   | 해결                                                                             | 재발 방지                                 |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| `User.status` 기본값이 `ACTIVE`           | Prisma default                         | create data에 `status: "INACTIVE"` 명시                                          | create smoke에서 status 확인              |
| secret detector 범위 부족                 | 기존 update/status 기준 detector       | temp/reset/initial/session/password key 확장, `passwordDelivery`는 `NONE`만 허용 | create success/audit secret smoke 추가    |
| Web copy에 password 표현 잔존             | 이전 placeholder 문구                  | “비활성 계정 생성”, “계정 로그인 가능화”로 변경                                  | Web slice 전 secret term scan 유지        |
| 구현 후 security review의 Web 미구현 지적 | 이번 작업 범위를 API-only로 제한       | 리스크와 다음 1단계로 기록                                                       | 다음 slice에서 Web drawer/action/E2E 완료 |
| code reviewer subagent timeout            | 재개 후 리뷰 에이전트가 시간 내 미완료 | 종료하고 security review + 전체 검증으로 보완                                    | 다음 slice는 리뷰 timeout을 더 길게 배정  |

## 11. 남은 리스크

| 리스크                                                           | 영향도 | 대응                                                                                |
| ---------------------------------------------------------------- | -----: | ----------------------------------------------------------------------------------- |
| Web create drawer가 아직 API에 연결되지 않음                     |   높음 | 다음 slice에서 password 없는 create form, Server Action, list refresh, Web E2E 구현 |
| activation/password reset 정책 없음                              |   높음 | 별도 security/DB/API preflight 필요                                                 |
| full `admin-url-state` E2E base/policies 실패는 여전히 별도 이슈 |   중간 | Staff create Web E2E는 전용 spec로 분리                                             |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                        | Model route                                  | 상세                                                                                                                        |
| ---: | ----------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
|    1 | Staff create Web drawer 연결              | `frontend_agent` + `security_reviewer` + `ui_runtime_validator` | GPT-5.5 medium + GPT-5.5 high + GPT-5.4-mini | password 없는 create form, Server Action, API adapter 호출, `/staffs` revalidate, success/list refresh, 1586/1440/1280 검증 |
|    2 | Staff create Web E2E + code review        | `qa_agent` + `code_reviewer`                                    | GPT-5.5 high + gpt-5.3-codex high            | create validation/success/secret visible text/list refresh 전용 E2E, diff review 반영                                       |
|    3 | Staff activation/password reset preflight | `security_reviewer` + `db_reviewer` + `architect_reviewer`      | GPT-5.5 high                                 | first-login/reset token/expiry/notification/audit/DB migration 필요 여부 확정                                               |
