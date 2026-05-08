# Credential Route Hardening Completion Report

작성일: 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 Credential route hardening을 완료했다.

이번 범위는 직원 활성화/비밀번호 재설정 credential API 위에 admin
issue/revoke 남용 방어, delivery 원자성 보강, public complete 동시성 회귀 검증,
rate-limit 저장소 보안 보강을 추가하는 작업이다.

Web UI와 token-holder page는 아직 구현하지 않았다.

## 2. 작업 분해

| Task | 내용                                                              | 담당                           | 상태 | 진행율 |
| ---- | ----------------------------------------------------------------- | ------------------------------ | ---- | -----: |
| T1   | 중단 후 MCP/작업트리/프로세스 상태 재확인                         | Codex                          | 완료 |   100% |
| T2   | security/backend/QA 사전 분석 subagent 위임                       | Copernicus, Franklin, Herschel | 완료 |   100% |
| T3   | admin issue/revoke actor+target rate-limit 설계                   | Codex, Franklin                | 완료 |   100% |
| T4   | admin credential rate-limit helper 구현                           | Codex                          | 완료 |   100% |
| T5   | admin credential route에 guard/Zod 이후 rate-limit 연결           | Codex                          | 완료 |   100% |
| T6   | delivery를 transaction 밖으로 이동하고 pending 활성화 구조로 보강 | Codex, Newton, Raman           | 완료 |   100% |
| T7   | concurrent complete, delivery failure, revoke limiter smoke 추가  | Codex, Herschel                | 완료 |   100% |
| T8   | rate-limit file lock/MAC/malformed recovery 보강                  | Codex, Kuhn, Mencius           | 완료 |   100% |
| T9   | 최종 security/code review 지적 반영                               | Codex, Kuhn, Raman, Newton     | 완료 |   100% |
| T10  | 전체 검증 및 보고서 작성                                          | Codex                          | 완료 |   100% |

이번 Credential Route Hardening Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent   | Harness role        | Model route        | 선택 이유                                                  | 결과                                                   |
| ---------- | ------------------- | ------------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| Copernicus | `security_reviewer` | GPT-5.5 high       | auth/RBAC/token/delivery/audit 경계 보안 판단 필요         | admin rate-limit, delivery transaction blocker 제시    |
| Franklin   | `backend_agent`     | GPT-5.5 high       | Fastify route/service/repository 경계와 mutation 순서 검토 | route layer rate-limit, outbox 범위 분리 제안          |
| Herschel   | `qa_agent`          | GPT-5.5 high       | API inject smoke에서 race/abuse 회귀 설계 필요             | concurrent complete, Retry-After, spoofing 테스트 제안 |
| Mencius    | `security_reviewer` | GPT-5.5 high       | 구현 후 secret leakage, spoofing, delivery 보상 검토       | MAC/audit IP medium 지적, blocker 없음                 |
| Kuhn       | `code_reviewer`     | GPT-5.3-codex high | multi-file 동시성/race/runtime bug 리뷰 필요               | file RMW race High, revoke test gap, reissue risk 지적 |
| Raman      | `security_reviewer` | GPT-5.5 high       | review 반영 후 최종 security gate 확인                     | pending token 구조 전환 전 High 지적                   |
| Newton     | `security_reviewer` | GPT-5.5 high       | pending token/final activation 구조가 High를 닫는지 재검증 | Blocking/High 없음, 이전 High 해소 확인                |
| Codex      | controller          | GPT-5              | 구현 통합, 검증 실행, 보고서 작성                          | hardening slice 완료                                   |

Spark는 사용하지 않았다. 이번 작업은 auth, password token, RBAC, API contract,
delivery, AuditLog, rate-limit 보안 경계를 포함하므로 하네스 기준 Spark 금지
범위다.

## 4. 변경 파일

| 파일/범위                                                     | 변경 내용                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/api/src/auth/admin-credential-rate-limit.ts`            | admin issue/revoke 전용 actor+target/purpose/mutation/IP limiter 추가     |
| `apps/api/src/auth/admin-credential-rate-limit.ts`            | file lock, state MAC, malformed/tampered state recovery, production guard |
| `apps/api/src/routes/admin/staff-credentials.routes.ts`       | guard/Zod 이후 service 전 rate-limit, 429 Retry-After, rate-limit audit   |
| `apps/api/src/services/admin/staff-credentials.service.ts`    | delivery 성공 후 final activation transaction 구조로 변경                 |
| `apps/api/src/services/admin/staff-credentials.service.ts`    | delivery 실패 시 pending token만 revoke, 기존 active token 유지           |
| `apps/api/src/repositories/user-password-token.repository.ts` | pending create, activate by id, revoke by id helper 추가                  |
| `test/unit/admin-credential-rate-limit.test.ts`               | bucket 분리, spoof 회피 방지, MAC, 손상 복구, production guard 테스트     |
| `test/smoke/api-credential-token-inject-smoke.ts`             | concurrent complete, delivery failure/reissue, admin issue/revoke 429     |
| `package.json`                                                | admin credential rate-limit unit test를 `pnpm test` 체인에 연결           |
| `.env.example`                                                | admin credential rate-limit store/file/secret 환경값 문서화               |

이 작업트리에는 직전 preflight, DB migration, shared helper, API service slice 변경도
아직 커밋 전 상태로 함께 남아 있다.

## 5. 주요 보강 내용

| 영역                  | 보강 내용                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| Admin abuse control   | actor+target+purpose+mutation 15분 4회, actor/IP/target 보조 bucket        |
| Spoofing 방어         | admin credential limiter와 audit metadata 모두 raw socket IP 기준          |
| Rate-limit state      | HMAC bucket key, payload MAC, lock dir serialization, malformed 복구       |
| Delivery consistency  | delivery 성공 전 token은 `activeKey=null` pending 상태                     |
| Activation finalizing | delivery 성공 후 이전 token revoke + pending token activate + audit 원자화 |
| Delivery failure      | pending token revoke, 기존 active token 유지, failure audit                |
| Public complete race  | 동일 token double-submit 시 1회 성공/1회 generic invalid 검증              |
| Secret hygiene        | response/audit에 raw token/tokenHash/password/session token 미노출 검증    |

## 6. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                        |
| -------------------------- | ----------: | ---------------------------------------------------------------- |
| 전체 준비 포함             |         61% | credential DB/shared/API service에 hardening까지 반영            |
| 실제 Web/API MVP 업무 기능 |         32% | API 기반은 단단해졌으나 Web account access UI는 미구현           |
| Frontend shell             |         78% | 이번 작업은 UI 변경 없음                                         |
| Backend/domain             |         54% | staff credential route abuse/delivery/race hardening 완료        |
| DB 기반 구축               |         79% | schema 변경 없음, token repository 동작 보강                     |
| Phase 3 Admin Foundation   |         64% | staff credential API 기반과 hardening 완료, Web 연결은 다음 단계 |

## 7. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                              | 완료율 |
| ----: | ---------------------------- | ---------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | MCP, subagent, 보고/검증 흐름 유지                                     |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 없음                           |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate-limit/audit + credential hardening 확보  |    98% |
|     3 | Admin Foundation             | staff CRUD/status + activation/reset API/hardening 완료, Web 연결 대기 |    64% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 mutation 미구현                               |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                    |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                              |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                   |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E 일부 완료. credential Web/E2E는 다음 단계           |    22% |
|     9 | Electron Release             | desktop placeholder 단계                                               |     3% |

## 8. 검증 결과

| 검증                                                                                     | 결과 | 비고                                                                |
| ---------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------- |
| `codex mcp list`                                                                         | 통과 | e2b, memory, notion, playwright, sequential_thinking, context7 확인 |
| `pnpm --filter @psms/api typecheck`                                                      | 통과 | API TypeScript 통과                                                 |
| `pnpm test:unit:admin-credential-rate-limit`                                             | 통과 | 9개 test pass                                                       |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` | 통과 | credential token API smoke passed                                   |
| `pnpm --filter @psms/api test:inject`                                                    | 통과 | auth/admin/read/staff mutation/credential inject 모두 통과          |
| `pnpm lint`                                                                              | 통과 | API tsc lint, Web ESLint 통과                                       |
| `pnpm test`                                                                              | 통과 | unit + DB contract + API inject 전체 통과                           |
| `pnpm build`                                                                             | 통과 | shared/db/api/web production build 통과                             |
| `pnpm db:validate`                                                                       | 통과 | Prisma schema valid                                                 |
| `pnpm format:check`                                                                      | 통과 | 전체 workspace Prettier check 통과                                  |
| `git diff --check`                                                                       | 통과 | whitespace error 없음                                               |

`test:unit:credential-token-db`는 unique constraint 실패를 의도적으로 검증하므로
Prisma expected error log가 출력되지만 테스트 결과는 pass다.

## 9. 리뷰 반영

| Finding                                                  | 조치                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| admin issue/revoke rate-limit 부재                       | actor+target/purpose/mutation/IP limiter 추가                          |
| delivery 외부 I/O가 DB transaction 내부에서 실행됨       | delivery 성공 후 final transaction 구조로 변경                         |
| complete 동시성 전용 테스트 없음                         | Promise 동시 complete smoke 추가                                       |
| XFF spoofing으로 admin limiter/audit IP 무결성 약화 가능 | admin credential route metadata를 raw socket IP 기준으로 통일          |
| admin rate-limit file RMW race                           | lock dir 기반 cross-process serialization 추가                         |
| rate-limit state tamper/malformed recovery 부재          | persisted payload MAC과 손상 시 빈 상태 복구 추가                      |
| revoke route rate-limit 테스트 공백                      | unit mutation 분리 테스트와 smoke revoke 429/audit 검증 추가           |
| delivery 실패 시 새 token active 상태 잔존 가능          | delivery 전 pending token(`activeKey=null`) 생성, 성공 후에만 activate |
| delivery 실패 reissue 시 기존 token까지 소멸 가능        | 기존 active token은 final transaction 전까지 유지                      |

## 10. 남은 리스크

| 리스크                                                              | 영향도 | 대응                                                        |
| ------------------------------------------------------------------- | -----: | ----------------------------------------------------------- |
| public credential verify/complete rate-limit는 아직 lock/MAC 미적용 |   중간 | 다음 API security alignment에서 admin limiter 수준으로 정렬 |
| delivery webhook secret은 아직 production 필수 강제 아님            |   중간 | 운영 설정 단계에서 webhook secret required gate 추가        |
| Web token-holder page 미구현                                        |   중간 | 다음 frontend slice에서 `/auth/*` holder UI 연결            |
| pending token row가 delivery 실패 시 남을 수 있음                   |   낮음 | activeKey 없음 + revokedAt 기록으로 사용 불가               |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                 | Subagent                                                        | Model route         | 상세                                                                                |
| ---: | ----------------------------------------- | --------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
|    1 | Public credential rate-limit alignment    | `security_reviewer` + `backend_agent` + `qa_agent`              | GPT-5.5 high        | `/auth/\*/verify                                                                    | complete` limiter에 lock/MAC/recovery 적용, public limiter 회귀 보강 |
|    2 | Web account access UI와 token-holder page | `frontend_agent` + `security_reviewer` + `ui_runtime_validator` | GPT-5.5 medium/high | `/staffs` 계정 접근 section, activation/reset setup page, API adapter, masking 정책 |
|    3 | Credential E2E와 screenshot QA            | `qa_agent` + `ui_runtime_validator` + `visual_ui_reviewer`      | GPT-5.5 high + mini | ADMIN issue, token-holder complete, replay/forbidden/rate-limit, viewport 검증      |
