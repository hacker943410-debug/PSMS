# Credential Token API Service Completion Report

작성일: 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 직원 활성화/비밀번호 재설정 credential token API
저장소/서비스/route 구현을 완료했다.

이번 범위는 `UserPasswordToken` DB model과 shared credential token helper 위에
Fastify API service를 연결하는 작업이다. 관리자 issue/revoke route, public
token-holder verify/complete route, delivery webhook gate, public token rate limit,
password hash/update, one-time consume, session revoke, AuditLog, API inject smoke를
추가했다.

Web UI와 token-holder page는 아직 구현하지 않았다.

## 2. 작업 분해

| Task | 내용                                                       | 담당                                | 상태 | 진행율 |
| ---- | ---------------------------------------------------------- | ----------------------------------- | ---- | -----: |
| T1   | MCP/하네스/프로젝트 문서와 직전 산출물 확인                | Codex                               | 완료 |   100% |
| T2   | backend/security/db subagent 사전 위임                     | Popper, Archimedes, Halley          | 완료 |   100% |
| T3   | 기존 staff/auth/session/audit/API inject 패턴 분석         | Codex                               | 완료 |   100% |
| T4   | `UserPasswordToken` repository 구현                        | Codex                               | 완료 |   100% |
| T5   | admin issue/revoke service와 route 구현                    | Codex                               | 완료 |   100% |
| T6   | public verify/complete service와 route 구현                | Codex                               | 완료 |   100% |
| T7   | delivery webhook gate와 fail-closed 정책 구현              | Codex                               | 완료 |   100% |
| T8   | credential token rate limit 구현                           | Codex                               | 완료 |   100% |
| T9   | status/profile 변경 시 active credential token revoke 연동 | Codex                               | 완료 |   100% |
| T10  | API inject smoke와 reset/test script 연결                  | Codex                               | 완료 |   100% |
| T11  | post-review subagent 지적 반영과 재검증                    | Raman, Kepler, Mendel, Rawls, Codex | 완료 |   100% |
| T12  | 완료 보고서와 다음 3단계 미리보기 작성                     | Codex                               | 완료 |   100% |

이번 Credential Token API Service Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent   | Harness role        | Model route        | 선택 이유                                                 | 결과                                                                               |
| ---------- | ------------------- | ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Popper     | `backend_agent`     | GPT-5.5 high       | API/service/repository 경계와 transaction 구현 검토       | 파일 경계, route, helper 재사용, API contract cautions 제시                        |
| Archimedes | `security_reviewer` | GPT-5.5 high       | token/password/session/RBAC/secret leakage 검토           | delivery blocker, logger redaction, generic error, guarded consume 체크리스트 제시 |
| Halley     | `db_reviewer`       | GPT-5.5 high       | activeKey unique, consume race, reset/seed DB 정합성 검토 | expired activeKey revoke, guarded updateMany, reset token cleanup 요구             |
| Raman      | `security_reviewer` | GPT-5.5 high       | 1차 구현 후 secret leakage와 fail-closed 검토             | blocking 없음, PII preview Low risk 제시                                           |
| Kepler     | `code_reviewer`     | GPT-5.3-codex high | diff 기반 버그/회귀/테스트 공백 검토                      | delivery dead-end, public rate-limit High finding 제시                             |
| Mendel     | `security_reviewer` | GPT-5.5 high       | delivery/rate-limit 보강 후 재검토                        | X-Forwarded-For spoofing blocker 제시                                              |
| Rawls      | `security_reviewer` | GPT-5.5 high       | XFF spoofing 보강 후 focused 재검토                       | blocking 없음, prior blocker 해소 확인                                             |
| Codex      | controller          | GPT-5              | 구현 통합, 검증 실행, 보고서 작성                         | API service slice 완료                                                             |

Spark는 사용하지 않았다. 이번 작업은 auth, password, token, session revoke, DB
transaction, API contract, AuditLog를 포함하므로 하네스 기준 Spark 금지 범위다.

## 4. 변경 파일

| 파일/범위                                                     | 변경 내용                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/api/src/repositories/user-password-token.repository.ts` | token create/revoke/find/consume repository 추가                                 |
| `apps/api/src/repositories/user.repository.ts`                | credential password/status update helper 추가                                    |
| `apps/api/src/services/admin/staff-credentials.service.ts`    | admin activation/reset issue/revoke transaction 구현                             |
| `apps/api/src/services/credential-token.service.ts`           | public verify/complete, contextual password policy, one-time consume 구현        |
| `apps/api/src/services/credential-token-delivery.service.ts`  | delivery webhook gate와 raw token delivery adapter 추가                          |
| `apps/api/src/auth/credential-token-rate-limit.ts`            | token/IP, IP 기반 public credential rate limit 추가                              |
| `apps/api/src/routes/admin/staff-credentials.routes.ts`       | admin issue/revoke route 추가                                                    |
| `apps/api/src/routes/credential-token.routes.ts`              | public verify/complete route와 rate-limit 적용                                   |
| `apps/api/src/routes/admin/admin.routes.ts`                   | staff credential admin routes 등록                                               |
| `apps/api/src/app.ts`                                         | public credential routes 등록, logger redaction 확장                             |
| `apps/api/package.json`                                       | credential token API inject smoke 연결                                           |
| `packages/db/prisma/e2e-reset.ts`                             | seed user token cleanup 추가                                                     |
| `.env.example`                                                | credential delivery/rate-limit env 문서화                                        |
| `test/smoke/api-credential-token-inject-smoke.ts`             | delivery, issue/reissue, complete, replay, revoke, expiry, rate-limit smoke 추가 |

이 작업트리에는 직전 preflight, DB migration, shared helper slice 변경도 아직 커밋 전
상태로 함께 남아 있다.

## 5. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                  |
| -------------------------- | ----------: | ---------------------------------------------------------- |
| 전체 준비 포함             |         60% | activation/reset DB/shared/API service 기반까지 확보       |
| 실제 Web/API MVP 업무 기능 |         31% | API service는 연결됨. Web UI와 token-holder page는 미구현  |
| Frontend shell             |         78% | 이번 작업은 UI 변경 없음                                   |
| Backend/domain             |         50% | staff credential service, route, transaction, smoke 추가   |
| DB 기반 구축               |         79% | DB migration은 직전 slice에서 완료, reset cleanup 보강     |
| Phase 3 Admin Foundation   |         61% | staff create/update/status에 이어 credential API 기반 완료 |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                         | 완료율 |
| ----: | ---------------------------- | --------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, subagent, 검증 보고 흐름 유지                                     |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 없음                                      |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/audit + credential DB/shared/API service 확보 |    97% |
|     3 | Admin Foundation             | staff read/update/status/create + activation/reset API service 완료               |    61% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 mutation 미구현                                          |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                               |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                         |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                              |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E 일부 완료. credential Web/E2E는 다음 단계                      |    20% |
|     9 | Electron Release             | desktop placeholder 단계                                                          |     3% |

## 7. 검증 결과

| 검증                                                                                     | 결과 | 근거                                                                            |
| ---------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------- |
| MCP surface check                                                                        | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 확인 |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` | 통과 | credential token API smoke passed                                               |
| `pnpm --filter @psms/api test:inject`                                                    | 통과 | auth/admin/read/staff mutation/credential token inject smoke 모두 통과          |
| `pnpm test`                                                                              | 통과 | unit + DB contract + API inject 전체 통과                                       |
| `pnpm typecheck`                                                                         | 통과 | shared/db/api/web typecheck 통과                                                |
| `pnpm lint`                                                                              | 통과 | API tsc lint, Web ESLint 통과                                                   |
| `pnpm db:validate`                                                                       | 통과 | Prisma schema valid                                                             |
| `pnpm build`                                                                             | 통과 | shared/db/api/web production build 통과                                         |
| `pnpm format:check`                                                                      | 통과 | 전체 workspace Prettier check 통과                                              |
| `git diff --check`                                                                       | 통과 | whitespace error 없음                                                           |

`test:unit:credential-token-db`는 unique constraint 실패를 의도적으로 검증하므로
Prisma expected error log가 출력되지만 테스트 결과는 pass다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                          |
| --------------------- | --------: | ------------------------------------------------------------- |
| Auth/session          |       Yes | password reset/activation complete 후 active sessions revoke  |
| Password/token helper |        No | 직전 shared helper를 사용. 이번 slice는 API 연결              |
| DB schema/migration   |        No | 이번 slice DB schema 변경 없음. 기존 `UserPasswordToken` 사용 |
| DB runtime/reset      |       Yes | E2E reset에서 seed user token cleanup 추가                    |
| API contract          |       Yes | admin issue/revoke, public verify/complete route 추가         |
| Web/UI                |        No | UI 변경 없음                                                  |
| Test harness          |       Yes | credential API inject smoke를 API test chain에 추가           |

## 9. 리뷰 반영

| Finding                                           | 조치                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| issue 성공 후 raw token 전달 부재                 | delivery webhook gate 추가. delivery 성공 시에만 transaction 성공 |
| public verify/complete rate limit 부재            | credential token 전용 file/memory rate limit 추가                 |
| X-Forwarded-For spoofing으로 rate limit 우회 가능 | public credential route는 raw socket IP 기준으로 rate-limit 적용  |
| expired token activeKey가 reissue 차단 가능       | reissue 시 activeKey 점유 row를 expiresAt과 무관하게 revoke       |
| deactivation 시 active credential token 미회수    | status/profile 변경 transaction에 token revoke hook 추가          |

## 10. 남은 리스크

| 리스크                                             | 영향도 | 대응                                                          |
| -------------------------------------------------- | -----: | ------------------------------------------------------------- |
| delivery가 transaction 내부에서 실행됨             |   중간 | 다음 hardening에서 outbox/after-commit delivery pattern 검토  |
| public verify preview가 loginId/name을 그대로 반환 |   낮음 | Web token-holder UI 단계에서 masking 또는 최소 표시 정책 결정 |
| complete 동시성 전용 테스트 없음                   |   중간 | 다음 API hardening에서 concurrent double-submit test 추가     |
| admin issue/revoke rate limit은 아직 없음          |   중간 | 다음 route hardening에서 actor+target bucket 추가             |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                        | Model route         | 상세                                                                                                    |
| ---: | ----------------------------------------- | --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
|    1 | Credential route hardening                | `security_reviewer` + `backend_agent` + `qa_agent`              | GPT-5.5 high        | admin issue/revoke actor+target rate limit, delivery outbox/after-commit 검토, concurrent complete test |
|    2 | Web account access UI와 token-holder page | `frontend_agent` + `security_reviewer` + `ui_runtime_validator` | GPT-5.5 medium/high | `/staffs` detail의 `계정 접근` section, activation/reset password setup page, safe copy, API adapter    |
|    3 | Credential E2E와 screenshot QA            | `qa_agent` + `ui_runtime_validator` + `visual_ui_reviewer`      | GPT-5.5 high + mini | ADMIN issue, token-holder complete, replay failure, STAFF forbidden, 1586/1440/1280 viewport 검증       |
