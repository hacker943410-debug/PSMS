# Admin Staff Update Mutation Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 slice인 `POST /admin/staffs/update`를 구현했다.

이번 작업은 직원 `name`, `phone`, `role`, `storeId` 수정만 포함한다.
`status` 변경은 기존 `POST /admin/staffs/change-status`에 계속 분리했다.

구현 범위는 API-only다. Web adapter/UI는 다음 단계로 분리한다.

## 2. 작업 분해

| Task | 내용                                             | 담당      | 상태 | 진행율 |
| ---- | ------------------------------------------------ | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 완료 보고서 기준 다음 slice 확정 | Codex     | 완료 |   100% |
| T2   | security/backend/db/QA subagent 자동 위임        | Subagents | 완료 |   100% |
| T3   | 기존 staff mutation 구조와 shared schema 분석    | Codex     | 완료 |   100% |
| T4   | Update input/result DTO 및 export 확장           | Codex     | 완료 |   100% |
| T5   | Repository helper와 service transaction 구현     | Codex     | 완료 |   100% |
| T6   | `POST /admin/staffs/update` route 연결           | Codex     | 완료 |   100% |
| T7   | API inject smoke 확장 및 전체 검증               | Codex     | 완료 |   100% |
| T8   | 완료 보고서와 다음 3단계 작성                    | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role        | Model route  | 선택 이유                                                                | 결과                                                                                            |
| -------- | ------------------- | ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Herschel | `security_reviewer` | GPT-5.5 high | auth/session/RBAC/AuditLog redaction 경계 검토                           | 조건부 Go. status 제외, STAFF forbidden audit, self/last-admin 강등 차단, secret redaction 요구 |
| Goodall  | `backend_agent`     | GPT-5.5 high | Fastify API contract, service/repository 분리, ActionResult mapping 검토 | 조건부 Go. route 연결, schema/result, no-op/unknown status/stale smoke 보강 요구                |
| Meitner  | `db_reviewer`       | GPT-5.5 high | Prisma transaction, active store, optimistic update, session revoke 검토 | 조건부 Go. schema 변경 없음, updateMany count, repository data allowlist 요구                   |
| Socrates | `qa_agent`          | GPT-5.5 high | API inject smoke, RBAC, audit, secret leak, session revoke 검증 설계     | update 전용 smoke 케이스와 검증 명령 제안                                                       |
| Codex    | controller          | GPT-5        | 구현 통합, 검증 실행, 보고서 작성                                        | 구현 완료 및 전체 검증 통과                                                                     |

Spark/mini는 사용하지 않았다. 이번 작업은 Fastify API contract, auth/RBAC,
DB transaction, session revoke, AuditLog를 다루므로 하네스 기준 GPT-5.5급
전문 검토가 필요한 범위다.

## 4. 변경 파일

| 파일                                                  | 변경 내용                                                                                 | 담당  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- |
| `packages/shared/src/admin/staffs.validation.ts`      | `adminUpdateStaffInputSchema`, 최소 1개 변경 필드 검증, strict body 검증 추가             | Codex |
| `packages/shared/src/admin/read-models.ts`            | `AdminStaffUpdateResult`, `AdminStaffUpdateField` DTO 추가                                | Codex |
| `packages/shared/src/admin/index.ts`                  | update schema/type/result export 추가                                                     | Codex |
| `packages/shared/src/index.ts`                        | root shared export 추가                                                                   | Codex |
| `apps/api/src/repositories/admin-staff.repository.ts` | active store 조회, allowlist profile update helper 추가                                   | Codex |
| `apps/api/src/services/admin/staffs.service.ts`       | staff update transaction, business rule, session revoke, `ADMIN_STAFF_UPDATED` audit 구현 | Codex |
| `apps/api/src/routes/admin/staffs.routes.ts`          | `POST /admin/staffs/update` route와 shared mutation guard helper 추가                     | Codex |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts` | update mutation RBAC/validation/stale/self/last-admin/store/revoke/audit smoke 추가       | Codex |

## 5. 구현된 API 계약

| 항목               | 내용                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Method/Path        | `POST /admin/staffs/update`                                                                                 |
| Body               | `{ userId, name?, role?, storeId?, phone?, expectedUpdatedAt? }`                                            |
| Excluded           | `status`, `loginId`, password 관련 필드는 허용하지 않음                                                     |
| Success            | `200`, `{ userId, name, role, storeId, phone, updatedAt, changedFields, revokedSessionCount }`              |
| Guard first        | no cookie/malformed/unknown token은 body validation 전 `401 AUTH_REQUIRED`                                  |
| STAFF forbidden    | authenticated STAFF는 body validation 전 `403 FORBIDDEN`, `ADMIN_MUTATION_FORBIDDEN` audit                  |
| Validation         | unknown `status` field와 empty patch는 `400 VALIDATION_FAILED`                                              |
| Business conflicts | `NO_CHANGE`, `STALE_RECORD`, `SELF_STATUS_CHANGE_FORBIDDEN`, `LAST_ADMIN_FORBIDDEN`, `STAFF_STORE_REQUIRED` |
| Atomicity          | user update, role/store session revoke, AuditLog를 하나의 transaction으로 처리                              |

`NO_CHANGE`는 이번 slice에서 추가된 business conflict code다. 요청 구조는 유효하지만
DB snapshot 기준 변경 내용이 없을 때 `409 NO_CHANGE`로 반환한다.

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                                |
| -------------------------- | ----------: | ------------------------------------------------------------------------ |
| 전체 준비 포함             |         46% | Admin staff mutation 2개 slice 완료                                      |
| 실제 Web/API MVP 업무 기능 |         19% | API mutation은 진전, Web adapter/UI와 domain 핵심 업무는 남음            |
| Phase 2 API/DB Foundation  |         91% | auth/session/admin guard/rate limit/revoke/audit 기반 강화               |
| Phase 3 Admin Foundation   |         32% | staff read, change-status, update 완료. create/base/policy mutation 남음 |
| 이번 Staff Update Task     |        100% | subagent 검토, 구현, smoke/전체 검증 완료                                |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                            | 완료율 |
| ----: | ---------------------------- | -------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                                 |   100% |
|     1 | Design System Gate           | 기준 PNG 기반 화면 gate 이력 유지                                    |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard, rate limit, forced revoke, audit 기반 완료 |    91% |
|     3 | Admin Foundation             | staffs/base/policies read 일부와 staff status/update mutation 완료   |    32% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                        |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                  |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                            |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                 |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                     |     8% |
|     9 | Electron Release             | desktop placeholder 단계                                             |     3% |

## 8. 검증 결과

| 검증                                   | 결과 | 근거                                                  |
| -------------------------------------- | ---: | ----------------------------------------------------- |
| `pnpm --filter @psms/api test:inject`  | 통과 | auth/admin guard/admin read/staff mutation smoke 통과 |
| `pnpm --filter @psms/api lint`         | 통과 | API `tsc --noEmit --pretty false` 통과                |
| `pnpm --filter @psms/shared typecheck` | 통과 | shared typecheck 통과                                 |
| `pnpm format:check`                    | 통과 | Prettier check 통과                                   |
| `pnpm typecheck`                       | 통과 | shared/db/api/web typecheck 통과                      |
| `pnpm lint`                            | 통과 | API + Web lint 통과                                   |
| `pnpm db:validate`                     | 통과 | Prisma schema valid                                   |
| `pnpm test`                            | 통과 | unit + API inject 전체 통과                           |
| `pnpm build`                           | 통과 | shared/db/api/web production build 통과               |
| `git diff --check`                     | 통과 | whitespace error 없음                                 |

Browser/UI validation은 실행하지 않았다. 이번 범위가 API-only이고 Web adapter/UI를
건드리지 않았기 때문이다.

## 9. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                                   |
| ------------------- | --------: | ---------------------------------------------------------------------- |
| Auth                |       Yes | staff mutation 공통 guard에서 authenticated STAFF forbidden audit 유지 |
| DB schema/migration |        No | Prisma schema 변경 없음                                                |
| DB runtime          |       Yes | role/store update 시 session revoke와 AuditLog transaction 추가        |
| API contract        |       Yes | `POST /admin/staffs/update`, `NO_CHANGE` conflict code 추가            |
| Web/UI              |        No | Web adapter와 UI는 다음 단계                                           |

## 10. 이슈/해결방법

| 이슈                                        | 원인                                                        | 해결                                                             | 재발 방지                                              |
| ------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| role/store success smoke가 stale 409 발생   | fixture user login이 `lastLoginAt/updatedAt`을 갱신         | login 후 최신 `updatedAt` snapshot을 다시 읽어서 요청            | success smoke는 mutation 직전 snapshot 사용            |
| repository update input이 너무 넓음         | `Prisma.UserUpdateManyMutationInput` 사용 시 allowlist 약함 | `AdminStaffProfileUpdateData`로 `name/role/storeId/phone`만 허용 | mutation repository input은 tab/slice별 좁은 타입 유지 |
| ADMIN에 invalid storeId 배정 시 FK 500 가능 | STAFF store rule만 먼저 고려                                | non-null storeId는 role과 무관하게 active store 선검증           | FK 제약 전 service-level validation 유지               |

## 11. 남은 리스크

| 리스크                                                       | 영향도 | 대응                                                                     |
| ------------------------------------------------------------ | -----: | ------------------------------------------------------------------------ |
| PostgreSQL Read Committed에서 last-admin 동시 강등 race 가능 |   높음 | 운영 PG 전환 전 Serializable/retry 또는 lock 전략 검토                   |
| `NO_CHANGE`는 preflight 공통 표에 없던 신규 code             |   중간 | 다음 계약 정리 시 공통 mutation error table에 추가                       |
| Web adapter/UI 미구현                                        |   중간 | 다음 단계에서 `/staffs` update/change-status UI 연결과 browser gate 수행 |
| Staff create 임시 비밀번호 정책 미확정                       |   높음 | security_reviewer gate 후 구현                                           |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                          | Subagent                                                           | Model route         | 상세                                                                                                                                           |
| ---: | ---------------------------------- | ------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Web staff mutation adapter/UI 연결 | `frontend_agent` + `security_reviewer` + `ui_runtime_validator`    | GPT-5.5 medium/high | `/staffs`에서 update/change-status 호출 adapter, Drawer/Modal confirm, revalidation, STAFF forbidden UX, 1586x992/1440x900/1280x800 validation |
|    2 | Staff create security preflight    | `security_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent` | GPT-5.5 high        | temporary password 발급/1회 노출/감사로그/seed 충돌/role-store rule/API smoke 범위 확정                                                        |
|    3 | Base colors mutation starter slice | `backend_agent` + `db_reviewer` + `qa_agent`                       | GPT-5.5 high        | generic CRUD 없이 colors create/update/change-status, duplicate/reference-in-use/audit smoke 구축                                              |
