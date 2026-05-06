# Admin Staff Change Status Mutation Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 구현 slice인 `POST /admin/staffs/change-status`를
구현했다.

이번 작업은 직원 `ACTIVE`/`INACTIVE` 전환, 자기 자신 비활성화 차단,
마지막 active ADMIN 보호, same-status 차단, `expectedUpdatedAt` stale 방어,
비활성화 시 active session 강제 revoke, redacted AuditLog 기록까지 포함한다.

Web adapter/UI는 이번 범위에 포함하지 않았다. API-only mutation gate다.

## 2. 작업 분해

| Task | 내용                                          | 담당      | 상태 | 진행율 |
| ---- | --------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/Admin mutation preflight 재확인    | Codex     | 완료 |   100% |
| T2   | security/backend/db/QA subagent 자동 위임     | Subagents | 완료 |   100% |
| T3   | Shared Zod input/response DTO 확장            | Codex     | 완료 |   100% |
| T4   | API guard/body parse/metadata route util 확장 | Codex     | 완료 |   100% |
| T5   | Staff repository/service transaction 구현     | Codex     | 완료 |   100% |
| T6   | `POST /admin/staffs/change-status` route 연결 | Codex     | 완료 |   100% |
| T7   | API inject smoke 및 전체 검증                 | Codex     | 완료 |   100% |
| T8   | 완료 보고서와 다음 3단계 작성                 | Codex     | 완료 |   100% |

이번 Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent  | Harness role        | Model route  | 선택 이유                                                          | 결과                                                                        |
| --------- | ------------------- | ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Halley    | `security_reviewer` | GPT-5.5 high | auth/session/RBAC/AuditLog redaction 경계 검토                     | STAFF forbidden audit, self-disable, last-admin, secret redaction 요구 확인 |
| Confucius | `backend_agent`     | GPT-5.5 high | Fastify route, shared contract, service/repository 분리 검토       | 최소 패치 계획과 stale/updateMany 전략 제안                                 |
| Hooke     | `db_reviewer`       | GPT-5.5 high | Prisma transaction, session revoke, active ADMIN count 검토        | DB schema 변경 없이 Go, PostgreSQL 동시성 후속 리스크 지적                  |
| Hubble    | `qa_agent`          | GPT-5.5 high | mutation smoke, RBAC, audit, secret leak, session revoke 검증 설계 | 별도 API inject smoke와 필수 케이스 제안                                    |
| Codex     | controller          | GPT-5        | 결과 통합, 구현, 검증, 보고서 작성                                 | 구현 완료 및 전체 검증 통과                                                 |

Spark/mini는 사용하지 않았다. 이번 작업은 auth, RBAC, DB transaction,
session revoke, AuditLog를 직접 다루므로 하네스 규칙상 GPT-5.5급 검토와
controller 구현이 적절하다.

## 4. 변경 파일

| 파일                                                  | 변경 내용                                                                       | 담당  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ----- |
| `packages/shared/src/admin/staffs.validation.ts`      | `adminChangeStaffStatusInputSchema`, reason/expectedUpdatedAt 검증 추가         | Codex |
| `packages/shared/src/admin/read-models.ts`            | `AdminStaffChangeStatusResult` DTO 추가                                         | Codex |
| `packages/shared/src/admin/index.ts`                  | admin staff mutation schema/type export                                         | Codex |
| `packages/shared/src/index.ts`                        | root shared export 추가                                                         | Codex |
| `apps/api/src/auth/admin-session.guard.ts`            | authenticated STAFF forbidden audit를 위해 guard failure에 session context 노출 | Codex |
| `apps/api/src/routes/admin/route-utils.ts`            | `parseAdminBody`, request metadata helper, session helper, 409 helper 추가      | Codex |
| `apps/api/src/repositories/admin-staff.repository.ts` | status snapshot, other active admin count, optimistic status update helper 추가 | Codex |
| `apps/api/src/services/admin/staffs.service.ts`       | change-status transaction, session revoke, AuditLog, forbidden audit 구현       | Codex |
| `apps/api/src/routes/admin/staffs.routes.ts`          | `POST /admin/staffs/change-status` route 추가                                   | Codex |
| `test/smoke/api-admin-staff-mutation-inject-smoke.ts` | RBAC, validation, stale, self/last admin, revoke, audit, secret leak smoke 추가 | Codex |
| `apps/api/package.json`                               | API inject chain에 staff mutation smoke 추가                                    | Codex |

## 5. 구현된 API 계약

| 항목               | 내용                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Method/Path        | `POST /admin/staffs/change-status`                                                                  |
| Body               | `{ userId, status: "ACTIVE" \| "INACTIVE", reason, expectedUpdatedAt? }`                            |
| Success            | `200`, `ok: true`, `{ userId, status, updatedAt, revokedSessionCount }`                             |
| Guard first        | no cookie/malformed/unknown token은 body validation 전 `401 AUTH_REQUIRED`                          |
| STAFF forbidden    | authenticated STAFF는 body validation 전 `403 FORBIDDEN`, `ADMIN_MUTATION_FORBIDDEN` audit          |
| Business conflicts | `SELF_STATUS_CHANGE_FORBIDDEN`, `LAST_ADMIN_FORBIDDEN`, `INVALID_STATUS_TRANSITION`, `STALE_RECORD` |
| Atomicity          | status update, session revoke, AuditLog를 하나의 transaction으로 처리                               |

## 6. 전체 진행률 요약

| 기준                          | 현재 완료율 | 판단 근거                                                                    |
| ----------------------------- | ----------: | ---------------------------------------------------------------------------- |
| 전체 준비 포함                |         44% | Admin mutation 첫 production slice 완료                                      |
| 실제 Web/API MVP 업무 기능    |         18% | API mutation은 늘었지만 Web adapter/UI와 domain 핵심 업무는 남음             |
| Phase 2 API/DB Foundation     |         90% | auth/session/admin guard/rate limit/revoke/audit 기반 강화                   |
| Phase 3 Admin Foundation      |         25% | read API + staff change-status mutation 완료, update/create/base/policy 남음 |
| 이번 Staff Change Status Task |        100% | 구현, subagent review 반영, smoke/전체 검증 완료                             |

## 7. Phase별 완료율

| Phase | 목표                         | 현재 상태                                                                     | 완료율 |
| ----: | ---------------------------- | ----------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                                          |   100% |
|     1 | Design System Gate           | 기준 PNG 기반 화면 gate 이력 유지                                             |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard, 429 rate limit, forced revoke path, audit 기반 완료 |    90% |
|     3 | Admin Foundation             | staffs/base/policies read 일부와 staff status mutation 완료                   |    25% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                 |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                           |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                     |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                          |     8% |
|     8 | Web MVP Gate                 | 통합 E2E와 domain 기능 gate 대기                                              |     8% |
|     9 | Electron Release             | desktop placeholder 단계                                                      |     3% |

## 8. 검증 결과

| 검증                                   | 결과 | 근거                                                  |
| -------------------------------------- | ---: | ----------------------------------------------------- |
| `pnpm --filter @psms/api test:inject`  | 통과 | auth/admin guard/admin read/staff mutation smoke 통과 |
| `pnpm --filter @psms/shared typecheck` | 통과 | shared typecheck 통과                                 |
| `pnpm --filter @psms/api lint`         | 통과 | API `tsc --noEmit --pretty false` 통과                |
| `pnpm --filter @psms/api build`        | 통과 | API build 통과                                        |
| `pnpm db:validate`                     | 통과 | Prisma schema valid                                   |
| `pnpm format:check`                    | 통과 | Prettier check 통과                                   |
| `pnpm typecheck`                       | 통과 | shared/db/api/web typecheck 통과                      |
| `pnpm test`                            | 통과 | unit + API inject 전체 통과                           |
| `pnpm lint`                            | 통과 | API + Web lint 통과                                   |
| `pnpm build`                           | 통과 | shared/db/api/web production build 통과               |
| `git diff --check`                     | 통과 | whitespace error 없음                                 |

## 9. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                                                       |
| ------------------- | --------: | ------------------------------------------------------------------------------------------ |
| Auth                |       Yes | guard failure에 authenticated STAFF session context를 노출해 forbidden mutation audit 가능 |
| DB schema/migration |        No | Prisma schema 변경 없음                                                                    |
| DB runtime          |       Yes | status update, session revoke, AuditLog transaction 추가                                   |
| API contract        |       Yes | `POST /admin/staffs/change-status` 추가                                                    |
| Web/UI              |        No | Web adapter와 UI는 다음 단계                                                               |

## 10. 이슈/해결방법

| 이슈                                     | 원인                                                                         | 해결                                                    | 재발 방지                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `expectedUpdatedAt` 누락 body가 400 처리 | Zod preprocess 내부 optional이 object-level optional로 표시되지 않음         | preprocess wrapper 바깥에 `.optional()` 적용            | mutation optional field는 schema 단위 smoke로 확인 |
| 초기 format check 실패                   | 신규 파일 Prettier 미적용                                                    | 변경 파일만 Prettier 적용                               | 완료 전 `pnpm format:check` 필수 유지              |
| last-admin route smoke 분리 어려움       | 정상 세션 API에서는 active ADMIN actor가 있으면 target은 마지막 ADMIN이 아님 | smoke 끝에서 dev-bypass route를 격리 사용해 branch 검증 | role update slice에서 service/unit 수준 추가 보강  |

## 11. 남은 리스크

| 리스크                                                           | 영향도 | 대응                                                                   |
| ---------------------------------------------------------------- | -----: | ---------------------------------------------------------------------- |
| PostgreSQL Read Committed에서 last-admin 동시 비활성화 race 가능 |   높음 | 운영 DB 전환 전 row lock/Serializable/conditional update 전략 재검토   |
| Web adapter/UI 미구현                                            |   중간 | 다음 단계에서 Web action/API adapter와 staffs 화면 버튼/상태 처리 연결 |
| Staff update/create는 아직 없음                                  |   중간 | role/store 변경과 임시 비밀번호 정책 gate 후 별도 구현                 |
| STAFF forbidden audit는 mutation route별 적용 필요               |   중간 | 다음 Admin mutation에서도 동일 helper/service 패턴 적용                |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                               | Subagent                                                           | Model route         | 상세                                                                                                                                |
| ---: | --------------------------------------- | ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Staff update mutation preflight/구현    | `security_reviewer` + `backend_agent` + `db_reviewer` + `qa_agent` | GPT-5.5 high        | name/phone/store/role 변경, STAFF store 필수, self role downgrade 차단, last-admin 강등 차단, stale update, unusable session revoke |
|    2 | Web staff change-status adapter/UI 연결 | `frontend_agent` + `security_reviewer` + `ui_runtime_validator`    | GPT-5.5 medium/high | `/staffs`에서 상태 변경 액션, Drawer/Modal 확인 흐름, API adapter, revalidation, ADMIN/STAFF UX 검증                                |
|    3 | Base colors mutation starter slice      | `backend_agent` + `db_reviewer` + `qa_agent`                       | GPT-5.5 high        | generic CRUD 없이 colors create/update/change-status, duplicate/reference-in-use/audit smoke 구축                                   |
