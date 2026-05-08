# Credential Request Revoke Semantics Report - 2026-05-08

## 1. 작업 요약

현재 하네스 기준 다음 slice인 credential request revoke semantics 정리를 완료했다.

이번 작업은 `apps/api`의 운영 로직과 외부 `ActionResult`/shared schema를 변경하지
않고, 현재 동작을 명확한 계약으로 고정했다. `revokedTokenCount`는 “현재 redeemable
token 수”가 아니라 이번 mutation이 `activeKey`가 남은 outstanding 요청을 revoked로
전환한 row 수로 정의한다. 따라서 만료되어 verify/complete는 실패하더라도 `activeKey`가
남아 있으면 admin revoke 또는 reissue cleanup에서 count에 포함된다.

## 2. 작업 분해 및 변동률

| Task | 내용                                     | Before | After |   변동 |
| ---- | ---------------------------------------- | -----: | ----: | -----: |
| T1   | MCP/하네스/이전 보고서/필수 문서 재확인  |     0% |  100% | +100pp |
| T2   | backend/db/QA subagent 자동 위임         |     0% |  100% | +100pp |
| T3   | revoke count 의미 정의                   |    45% |  100% |  +55pp |
| T4   | expired activeKey cleanup smoke          |    40% |  100% |  +60pp |
| T5   | admin revoke response/audit count smoke  |    35% |  100% |  +65pp |
| T6   | second revoke idempotency count smoke    |     0% |  100% | +100pp |
| T7   | historical/other-purpose token 제외 검증 |    20% |   95% |  +75pp |
| T8   | semantics 문서화                         |     0% |  100% | +100pp |
| T9   | full quality gate 및 managed E2E 검증    |    85% |  100% |  +15pp |
| T10  | completion report 및 다음 단계 preview   |     0% |  100% | +100pp |

이번 slice 구현 완료율은 98%다. 남은 2%는 PostgreSQL 동시성에서의 post-delivery
activation conflict와 completion expiry boundary 보강으로 분리한다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role    | Model route  | 선택 이유                                               | 결과                                                                  |
| -------- | --------------- | ------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Lovelace | `backend_agent` | GPT-5.5 high | Fastify service contract, ActionResult, audit 경계 검토 | 만료 activeKey도 revoke/count에 포함하는 semantics 권고               |
| Sartre   | `db_reviewer`   | GPT-5.5 high | `activeKey @unique`, transaction, expiry 경계 검토      | count 정의 확인, post-delivery conflict와 expiry boundary 리스크 발견 |
| Poincare | `qa_agent`      | GPT-5.5 high | smoke/aggregate test 편입 전략 검토                     | API inject smoke에 count/audit/idempotency 검증 추가 권고             |
| Codex    | controller      | GPT-5        | 구현 통합, 검증 실행, 보고서 작성                       | 테스트/문서 패치 적용, 전체 검증 완료                                 |

Spark는 사용하지 않았다. 이번 범위는 auth/password token, DB lifecycle, API contract,
AuditLog 의미에 닿아 프로젝트 규칙상 Spark 금지 또는 부적합 범위다. mini도 단순 문서
정리가 아니라 보안/DB/API 계약 판단이 핵심이라 배정하지 않았다.

## 4. 변경 파일

| 파일                                                                        | 변경 내용                                                                                                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/smoke/api-credential-token-inject-smoke.ts`                           | admin revoke 응답 `revokedTokenCount`, audit count, expired activeKey cleanup, second revoke 0-count, historical/other-purpose token 제외, secret/forbidden field 검증 추가 |
| `docs/00_system/credential-token-revoke-semantics.md`                       | active-key-pending/redeemable token 용어, count/audit/activeKey lifecycle 계약 문서화                                                                                       |
| `docs/80_ai_harness/credential-request-revoke-semantics-report-20260508.md` | 이번 완료 보고서                                                                                                                                                            |

## 5. 전체 진행률 요약

| 기준                              | Before | After | 변동 | 판단 근거                                           |
| --------------------------------- | -----: | ----: | ---: | --------------------------------------------------- |
| 전체 Web/API MVP readiness        |    73% |   74% | +1pp | full test/build, managed E2E, artifact scan 통과    |
| 실제 Web/API MVP 업무 기능        |    40% |   40% |  0pp | 신규 업무 화면/도메인 기능은 추가하지 않음          |
| Admin staff credential 운영 slice |    99% |   99% |  0pp | 동작 변경 없이 revoke semantics만 고정              |
| Credential token backend/security |    98% |   99% | +1pp | revoke count/audit/secret non-leakage coverage 강화 |
| DB lifecycle contract             |    93% |   94% | +1pp | expired activeKey cleanup 의미 문서화 및 smoke 고정 |
| Release/secret leakage gate       |    91% |   91% |  0pp | artifact scan 통과, release env contract 변경 없음  |
| Electron release readiness        |     6% |    6% |  0pp | Electron 범위 아님                                  |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                    | Before | After | 변동 |
| ----: | ---------------------------- | -------------------------------------------- | -----: | ----: | ---: |
|     0 | Baseline/Harness             | MCP 확인, subagent 위임, 보고/검증 흐름 유지 |   100% |  100% |  0pp |
|     1 | Design System Gate           | 이번 작업 범위 아님                          |   100% |  100% |  0pp |
|     2 | API/DB/Auth Foundation       | auth token revoke count/audit 계약 강화      |    99% |   99% |  0pp |
|     3 | Admin Foundation             | staff credential revoke semantics smoke 고정 |    80% |   81% | +1pp |
|     4 | Token-holder Web UX          | browser credential flow 60/60 E2E 유지       |    72% |   72% |  0pp |
|     5 | Inventory                    | 이번 작업 범위 아님                          |    10% |   10% |  0pp |
|     6 | Sales                        | 이번 작업 범위 아님                          |     8% |    8% |  0pp |
|     7 | Receivable/Customer/Schedule | 이번 작업 범위 아님                          |     8% |    8% |  0pp |
|     8 | Web MVP Gate                 | full quality gate와 managed E2E 재통과       |    42% |   43% | +1pp |
|     9 | Electron Release             | 이번 작업 범위 아님                          |     6% |    6% |  0pp |

## 7. 검증 결과

| 검증                                                                                     | 결과 | 비고                                                                |
| ---------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------- |
| `codex mcp list`                                                                         | 통과 | e2b, memory, notion, playwright, sequential_thinking, context7 확인 |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` | 통과 | credential token 단일 API smoke                                     |
| `pnpm test:api:inject`                                                                   | 통과 | auth/admin/credential API inject 전체                               |
| `pnpm test:unit:credential-token-db`                                                     | 통과 | expected unique constraint 로그 후 pass                             |
| `pnpm typecheck`                                                                         | 통과 | shared/db/api/web TypeScript                                        |
| `pnpm lint`                                                                              | 통과 | API tsc lint + Web ESLint                                           |
| `pnpm format:check`                                                                      | 통과 | 전체 Prettier check                                                 |
| `pnpm test`                                                                              | 통과 | unit + DB contract + API inject 전체                                |
| `pnpm build`                                                                             | 통과 | shared/db/api/web production build                                  |
| `pnpm test:e2e:managed:preflight`                                                        | 통과 | `canRunManaged: true`                                               |
| `pnpm test:e2e:managed`                                                                  | 통과 | Playwright 60 passed                                                |
| `pnpm test:e2e:artifact-secret-scan`                                                     | 통과 | 123 files scanned, secret leak 없음                                 |
| `pnpm db:validate`                                                                       | 통과 | Prisma schema valid                                                 |

## 8. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                      |
| --------------------- | --------: | --------------------------------------------------------- |
| Auth/session core     |        No | login/session/cookie/password hash core 변경 없음         |
| DB schema/migration   |        No | Prisma schema/migration 변경 없음                         |
| API mutation contract |        No | response shape/status/error code 변경 없음                |
| API service behavior  |        No | 운영 로직 변경 없음                                       |
| Test contract         |       Yes | revoke count/audit/idempotency/expired cleanup smoke 보강 |
| Docs                  |       Yes | semantics 문서와 완료 보고서 추가                         |
| Web/UI                |        No | 화면 변경 없음                                            |

## 9. 이슈/해결방법

| 이슈                                             | 원인                                                           | 해결                                                           | 재발 방지                                     |
| ------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `revokedTokenCount` 의미 혼동                    | expired token은 redeemable하지 않지만 activeKey는 남을 수 있음 | active-key-pending cleanup count로 문서화 및 smoke 고정        | semantics 문서와 API smoke 유지               |
| 한 revoke에서 count 2 이상 혼합 케이스 제안 불가 | `activeKey @unique`가 user/purpose당 1개만 허용                | 같은 목적 count 1/0, historical/other-purpose 제외로 검증 대체 | DB schema 제약을 보고서에 명시                |
| DB reviewer가 post-delivery conflict 발견        | token delivery 후 activeKey activation 단계의 P2002 경계       | 이번 slice에서는 리스크로 분리                                 | 다음 작업 1순위로 rollback/audit hardening    |
| completion expiry boundary 발견                  | preflight `now`를 hashing 뒤 transaction에서도 재사용          | 이번 slice에서는 리스크로 분리                                 | 다음 작업 2순위로 transaction-time check 보강 |

## 10. 남은 리스크

| 리스크                                                                      | 영향도 | 대응                                                                         |
| --------------------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------- |
| post-delivery activation P2002가 delivered-but-inactive token을 남길 가능성 |   높음 | activation conflict rollback/audit hardening을 다음 slice로 처리             |
| password hashing 중 expiry boundary를 지난 token consume 가능성             |   중간 | transaction 내부 fresh timestamp와 boundary test 추가                        |
| PostgreSQL 동시성 증거 부족                                                 |   중간 | SQLite smoke 외 PostgreSQL-equivalent 또는 integration concurrency test 설계 |
| 작업트리가 이전 credential-token 연속 작업으로 매우 dirty                   |   중간 | 커밋/푸시 전 변경 파일 범위 재확인 필요                                      |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                                  | Subagent                                              | Model route  | 상세                                                                                                                            |
| ---: | ---------------------------------------------------------- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
|    1 | post-delivery activation conflict rollback/audit hardening | `backend_agent` + `db_reviewer` + `security_reviewer` | GPT-5.5 high | delivery 성공 후 activeKey activation에서 conflict가 나면 새 token을 명시 revoke하고 audit을 남기는 보상 트랜잭션 및 smoke 추가 |
|    2 | credential completion expiry boundary hardening            | `backend_agent` + `qa_agent` + `security_reviewer`    | GPT-5.5 high | password hashing 이후 transaction 내부 fresh timestamp로 expiry 재검증, boundary unit/smoke 추가                                |
|    3 | PostgreSQL-style credential concurrency evidence           | `db_reviewer` + `qa_agent` + `devops_sre_reviewer`    | GPT-5.5 high | SQLite smoke 한계를 보완할 concurrent issue/revoke test 전략, release evidence, rollback 기준 정리                              |
