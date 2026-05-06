# Staff Create Security Preflight Completion Report

작성일: 2026-05-06

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 생성 보안 프리플라이트를 완료했다.

결론은 `POST /admin/staffs/create`를 바로 구현하되, 이번 구현 범위는
`INACTIVE` 직원 생성으로 제한한다. raw/temporary password를 입력받거나 반환하거나
화면에 표시하는 흐름은 현재 DB/auth 계약상 No-go로 고정했다.

## 2. 작업 분해

| Task | 내용                                           | 담당      | 상태 | 진행율 |
| ---- | ---------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 보고서 기준 다음 slice 확정    | Codex     | 완료 |   100% |
| T2   | security/backend/DB/QA subagent 자동 위임      | Subagents | 완료 |   100% |
| T3   | 기존 staff API/auth/password/DB/seed 계약 분석 | Codex     | 완료 |   100% |
| T4   | Staff create 허용/금지 범위 결정               | Codex     | 완료 |   100% |
| T5   | staff create security preflight 문서 작성      | Codex     | 완료 |   100% |
| T6   | 기존 admin mutation preflight와 충돌 문구 정정 | Codex     | 완료 |   100% |
| T7   | 문서 포맷/whitespace 검증                      | Codex     | 완료 |   100% |
| T8   | 완료 보고서와 다음 3단계 작성                  | Codex     | 완료 |   100% |

이번 Staff Create Security Preflight Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent  | Harness role        | Model route  | 선택 이유                                                             | 결과                                                         |
| --------- | ------------------- | ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Laplace   | `security_reviewer` | GPT-5.5 high | password, session, RBAC, AuditLog secret redaction은 보안 고위험 영역 | raw/temporary password 노출 No-go, `INACTIVE` 생성 권고      |
| Ramanujan | `backend_agent`     | GPT-5.5 high | Fastify route/service/repository와 ActionResult contract 판단 필요    | 기존 update/status 패턴 확장 가능, password 정책 확정 필요   |
| Hume      | `db_reviewer`       | GPT-5.5 high | Prisma schema, unique, migration 필요 여부 판단 필요                  | `loginId === User.email`이면 migration 불필요, 분리 시 No-go |
| Banach    | `qa_agent`          | GPT-5.5 high | API inject와 Web E2E acceptance matrix 설계 필요                      | secret leak, auth order, staff-only E2E 분리 제안            |
| Codex     | controller          | GPT-5        | 결과 통합, 문서화, 검증 실행                                          | 프리플라이트 기준과 다음 구현 순서 확정                      |

Spark는 사용하지 않았다. 이번 작업은 auth/password/RBAC, Fastify API contract,
Prisma 저장 정책, AuditLog를 다루므로 하네스 기준 Spark 금지 범위다.

## 4. 변경 파일

| 파일                                                                               | 변경 내용                                                                      | 담당  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----- |
| `docs/00_system/staff-create-security-preflight.md`                                | Staff create API 계약, 금지 secret, DB/service/audit/Web/test 기준 신규 문서화 | Codex |
| `docs/00_system/admin-foundation-mutation-preflight.md`                            | 기존 직원 생성 문구를 `INACTIVE` only, password 노출 금지 기준으로 정정        | Codex |
| `docs/80_ai_harness/staff-create-security-preflight-completion-report-20260506.md` | 하네스 완료 보고서 작성                                                        | Codex |

## 5. 최종 결정

| 항목         | 결정                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| Route        | `POST /admin/staffs/create`                                             |
| 초기 상태    | `INACTIVE` only                                                         |
| loginId 저장 | 현재 repo convention대로 `User.email`에 저장                            |
| password     | 서버 내부 placeholder secret 생성 후 `hashPassword()` 저장, raw 값 폐기 |
| response     | `AdminStaffCreateResult`에 password/hash/token/temp/reset 값 미포함     |
| AuditLog     | `ADMIN_STAFF_CREATED`, `entityType=User`, redacted `afterJson`만 기록   |
| STAFF 접근   | `403 FORBIDDEN` + `ADMIN_MUTATION_FORBIDDEN` audit                      |
| activation   | password reset/activation 별도 gate로 분리                              |

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                 |
| -------------------------- | ----------: | --------------------------------------------------------- |
| 전체 준비 포함             |         48% | Staff create 보안/API/DB/QA gate 완료                     |
| 실제 Web/API MVP 업무 기능 |         21% | 이번 작업은 docs/preflight라 업무 기능 구현률은 유지      |
| Frontend shell             |         76% | Web create drawer는 아직 비활성 상태, 다음 slice에서 연결 |
| Backend/domain             |         36% | Staff create API 구현 기준 확정으로 1%p 상승              |
| DB 기반 구축               |         74% | schema 변경 없이 구현 가능 판단                           |
| Phase 3 Admin Foundation   |         40% | staff create 구현 전 blocker 제거                         |

## 7. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                    | 완료율 |
| ----: | ---------------------------- | ------------------------------------------------------------ | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, 검증 흐름 유지                         |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 변경 없음            |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 완료   |    91% |
|     3 | Admin Foundation             | staff read/update/status API+Web 완료, create preflight 완료 |    40% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현          |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                    |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                         |     8% |
|     8 | Web MVP Gate                 | staff 일부 E2E/UI runtime 통과. create Web E2E 대기          |    10% |
|     9 | Electron Release             | desktop placeholder 단계                                     |     3% |

## 8. 검증 결과

| 검증                             | 결과 | 근거                                                                                 |
| -------------------------------- | ---: | ------------------------------------------------------------------------------------ |
| MCP surface check                | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 활성 확인 |
| Subagent review                  | 통과 | security/backend/db/QA 네 관점 결과 수렴                                             |
| `pnpm exec prettier --write ...` | 통과 | 대상 문서 3개 Prettier 적용                                                          |
| `pnpm format:check`              | 통과 | 전체 workspace Prettier check 통과                                                   |
| `git diff --check`               | 통과 | whitespace error 없음                                                                |

## 9. Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                              |
| ------------ | --------: | ------------------------------------------------- |
| Auth         |        No | 구현 코드 변경 없음. auth/password 정책 문서화    |
| DB           |        No | schema/migration 변경 없음                        |
| API contract |        No | 구현 코드 변경 없음. 다음 API 계약 preflight 확정 |
| Web/UI       |        No | 구현 코드 변경 없음. create drawer 기준만 확정    |

## 10. 이슈/해결방법

| 이슈                                                       | 원인                                           | 해결                                         | 재발 방지                                               |
| ---------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| 기존 preflight에 raw temp password 1회 노출 가능 문구 존재 | 이전 gate에서는 전달 정책 미확정 상태로 열어둠 | `INACTIVE` only, raw/temp 노출 금지로 정정   | Staff create 전용 preflight를 authoritative 문서로 추가 |
| `loginId`와 `email` 용어 충돌                              | DB는 `email`, UI/API는 `loginId`를 사용        | 이번 slice는 `loginId === User.email`로 확정 | 분리 필요 시 별도 DB migration gate                     |
| activation 방식 미정                                       | first-login/reset 상태 필드 없음               | create와 activation을 분리                   | reset/activation slice에서 DB/API/security gate 진행    |

## 11. 남은 리스크

| 리스크                                                           | 영향도 | 대응                                        |
| ---------------------------------------------------------------- | -----: | ------------------------------------------- |
| 계정 생성 후 로그인 가능화 UX가 아직 없음                        |   높음 | password reset/activation 전용 slice로 분리 |
| Web create drawer는 아직 비활성                                  |   중간 | API 구현 후 password 없는 form으로 연결     |
| full `admin-url-state` E2E base/policies 실패는 여전히 별도 이슈 |   중간 | Staff create E2E는 전용 spec로 분리         |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                   | Model route                   | 상세                                                                                                                    |
| ---: | ----------------------------------------- | ---------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
|    1 | Staff create API 구현                     | `backend_agent` + `security_reviewer` + `qa_agent`         | GPT-5.5 high                  | shared create schema/result, repository helper, service transaction, `POST /admin/staffs/create`, API inject smoke 추가 |
|    2 | Staff create Web drawer 연결              | `frontend_agent` + `ui_runtime_validator`                  | GPT-5.5 medium + GPT-5.4-mini | password 없는 create form, Server Action adapter, success/list refresh, 1586/1440/1280 viewport 검증                    |
|    3 | Staff activation/password reset preflight | `security_reviewer` + `db_reviewer` + `architect_reviewer` | GPT-5.5 high                  | `ACTIVE` 로그인 가능화, reset token/first-login DB 필드 필요 여부, notification/expiry/audit 정책 확정                  |
