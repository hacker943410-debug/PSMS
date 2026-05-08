# Staff Activation Password Reset Preflight Completion Report

작성일: 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 활성화/비밀번호 재설정 preflight를 완료했다.

이번 범위는 구현이 아니라 보안, DB, API, Web 경계를 확정하는 작업이다. 결론은
기존 `change-status`를 활성화로 재사용하지 않고, 전용 1회용 token model과 승인된
delivery policy가 준비된 뒤에만 구현을 진행한다는 것이다.

## 2. 작업 분해

| Task | 내용                                                          | 담당      | 상태 | 진행율 |
| ---- | ------------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 보고서 기준 다음 slice 확정                   | Codex     | 완료 |   100% |
| T2   | security/db/architecture/frontend subagent 자동 위임          | Subagents | 완료 |   100% |
| T3   | 현재 `User`, staff create, status, auth/session 구조 확인     | Codex     | 완료 |   100% |
| T4   | subagent 리뷰 결과 통합 및 blocker 판정                       | Codex     | 완료 |   100% |
| T5   | DB token model, API route, audit, UI 금지 범위 preflight 작성 | Codex     | 완료 |   100% |
| T6   | 완료 보고서와 다음 3단계 상세 미리보기 작성                   | Codex     | 완료 |   100% |
| T7   | 문서 포맷/검증 실행                                           | Codex     | 완료 |   100% |

이번 Staff Activation/Password Reset Preflight Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent  | Harness role         | Model route    | 선택 이유                                                  | 결과                                                        |
| --------- | -------------------- | -------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Nietzsche | `security_reviewer`  | GPT-5.5 high   | password, token, session revoke, RBAC, AuditLog 보안 검토  | `change-status` 재사용 No-go, dedicated token/30분 TTL 권고 |
| Pauli     | `db_reviewer`        | GPT-5.5 high   | Prisma schema, migration, seed, transaction integrity 검토 | `UserPasswordToken` + nullable unique `activeKey` 권고      |
| Carson    | `architect_reviewer` | GPT-5.5 high   | API contract, route ownership, Web/API boundary 검토       | action-specific route와 delivery 미정 blocker 확인          |
| Turing    | `frontend_agent`     | GPT-5.5 medium | staff detail drawer, URL state, copy restriction 검토      | `계정 접근` UI는 API/security gate 이후 추가 권고           |
| Codex     | controller           | GPT-5          | 리뷰 통합, 문서화, 검증, 보고서 작성                       | preflight와 완료 보고서 작성                                |

Spark는 사용하지 않았다. 이번 작업은 auth, password, session, RBAC, DB migration,
API contract, AuditLog에 닿으므로 하네스 기준 Spark 금지 또는 부적합 범위다.

## 4. 변경 파일

| 파일                                                                                | 변경 내용                                                           | 담당  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| `docs/00_system/staff-activation-reset-preflight.md`                                | 활성화/reset token model, API contract, audit, UI, test gate 문서화 | Codex |
| `docs/80_ai_harness/staff-activation-reset-preflight-completion-report-20260507.md` | 작업 완료 보고서와 진행율/다음 3단계 미리보기 작성                  | Codex |

## 5. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                               |
| -------------------------- | ----------: | ----------------------------------------------------------------------- |
| 전체 준비 포함             |         52% | Staff create 이후 activation/reset 구현 전 보안/DB/API gate가 확정됨    |
| 실제 Web/API MVP 업무 기능 |         24% | 이번 작업은 문서 gate라 runtime 기능 증가 없음                          |
| Frontend shell             |         78% | UI 변경 없음. 다음 `계정 접근` section 설계 기준만 확정                 |
| Backend/domain             |         38% | API 구현 없음. token service/route contract와 금지 경계만 확정          |
| DB 기반 구축               |         74% | schema 변경 없음. 다음 migration model과 seed 정책 확정                 |
| Phase 3 Admin Foundation   |         50% | staff create 이후 credential activation/reset 구현 전 blocker 정리 완료 |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                         | 완료율 |
| ----: | ---------------------------- | --------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, subagent, 보고 흐름 유지                                    |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 구현 없음                                 |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 완료. credential token 대기 |    92% |
|     3 | Admin Foundation             | staff read/update/status/create 완료, activation/reset preflight 완료             |    50% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                     |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                               |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                         |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                              |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E가 create/update/status까지 확장됨. reset E2E 대기              |    16% |
|     9 | Electron Release             | desktop placeholder 단계                                                          |     3% |

## 7. 검증 결과

| 검증                             | 결과 | 근거                                        |
| -------------------------------- | ---: | ------------------------------------------- |
| MCP surface check                | 통과 | 이전 세션 흐름에서 configured MCP 확인 완료 |
| `pnpm exec prettier --write ...` | 통과 | 추가 문서 2개 포맷 적용                     |
| `pnpm format:check`              | 통과 | 전체 workspace Prettier check 통과          |
| `git diff --check`               | 통과 | whitespace error 없음                       |
| Runtime/API/DB tests             |  N/A | 이번 범위는 구현 변경 없는 preflight 문서   |

## 8. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                                   |
| ------------------- | --------: | ---------------------------------------------------------------------- |
| Auth/session        |        No | 구현 코드 변경 없음. token-holder route와 session revoke 정책만 문서화 |
| DB schema/migration |        No | 구현 변경 없음. 다음 migration 대상 model만 문서화                     |
| API contract shape  |        No | `ActionResult` shape 변경 없음. 예정 route contract만 문서화           |
| Web/UI              |        No | 구현 변경 없음. 향후 `계정 접근` section 기준만 문서화                 |
| Harness/docs        |       Yes | preflight와 completion report 추가                                     |

## 9. 이슈/해결방법

| 이슈                                          | 원인                                                  | 해결                                                    | 재발 방지                                              |
| --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| 기존 status 활성화와 password activation 혼동 | 현재 detail drawer에 `활성 처리` status action이 존재 | `change-status`는 password activation이 아니라고 문서화 | 다음 UI에서 `계정 접근` section을 status와 분리        |
| delivery channel 미정                         | loginId가 email 형식이 아니며 email/SMS 구현도 없음   | delivery 승인 전 issue API 구현 No-go로 판정            | security/architecture gate에서 delivery mode 먼저 확정 |
| token persistence 없음                        | 현재 `User`에는 reset token lifecycle field가 없음    | dedicated `UserPasswordToken` model 필요로 확정         | DB migration preflight를 다음 1순위로 배정             |
| secret leakage 위험                           | token, URL, hash, password가 audit/UI에 섞일 수 있음  | allowlist audit와 raw secret 비노출 정책 문서화         | secret scanner/API inject/E2E를 acceptance gate에 포함 |

## 10. 남은 리스크

| 리스크                                                      | 영향도 | 대응                                                                                 |
| ----------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------ |
| Delivery policy가 정해지지 않으면 issue UX를 완성할 수 없음 |   높음 | email/SMS/out-of-band 중 MVP 정책을 명시하고 route success contract를 다시 확인      |
| DB migration은 auth/password domain에 직접 영향             |   높음 | `db_reviewer`와 `security_reviewer` 동시 리뷰 후 migration 생성                      |
| Persistent rate limit model 미정                            |   중간 | 기존 login rate limit pattern 재사용 가능성 검토 후 token issue/complete bucket 분리 |
| dev auth bypass actor FK 문제                               |   중간 | mutation E2E는 real seed auth 유지. P2003 mapping hardening 별도 처리                |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                      | Subagent                                               | Model route           | 상세                                                                                                           |
| ---: | ---------------------------------------------- | ------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------- |
|    1 | Credential token DB migration 구현             | `db_reviewer` + `security_reviewer` + `backend_agent`  | GPT-5.5 high          | `UserPasswordTokenPurpose`, `UserPasswordToken`, `User` relations, `activeKey`, migration/seed/token hash 검증 |
|    2 | Activation/password reset API service 구현     | `backend_agent` + `architect_reviewer` + `qa_agent`    | GPT-5.5 high          | issue/revoke/verify/complete route, guard-before-validation, transaction, session revoke, AuditLog, rate limit |
|    3 | Web account access UI와 token-holder page 구현 | `frontend_agent` + `ui_runtime_validator` + `qa_agent` | GPT-5.5 medium + mini | staff detail `계정 접근` section, auth-side setup page, safe copy, 1586/1440/1280 E2E와 secret leak 검증       |
