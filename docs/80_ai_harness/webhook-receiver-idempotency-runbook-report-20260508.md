# Webhook Receiver Idempotency Runbook Report - 2026-05-08

## 1. 작업 요약

현재 하네스 기준 다음 slice인 credential delivery webhook receiver idempotency/runbook
hardening을 완료했다.

이번 작업은 외부 admin credential `ActionResult`와 shared result schema를 변경하지
않고, 내부 delivery request에만 `deliveryId`를 추가했다. Webhook 요청은
`X-PSMS-Delivery-Id`를 안정적인 dedupe key로 보내고, `X-PSMS-Delivery-Attempt`를
진단용 attempt 번호로 보낸다. Production retry는 계속 `1`로 막아 두고, receiver
idempotency contract가 security/release review에서 승인되기 전까지 retry rollout은
BLOCK으로 유지한다.

또한 release runbook에 receiver 승인 조건, manual evidence template, incident/rollback
절차를 구체화했다.

## 2. 작업 분해 및 변동률

| Task | 내용                                            | Before | After |   변동 |
| ---- | ----------------------------------------------- | -----: | ----: | -----: |
| T1   | MCP/하네스/필수 문서/이전 보고서 재확인         |     0% |  100% | +100pp |
| T2   | security/backend/devops/QA subagent 자동 위임   |     0% |  100% | +100pp |
| T3   | delivery id/attempt header 내부 contract        |    20% |  100% |  +80pp |
| T4   | 외부 API result/schema 무변경 유지              |    90% |  100% |  +10pp |
| T5   | unit/API smoke idempotency header 검증          |    45% |   96% |  +51pp |
| T6   | idempotent receiver side-effect smoke           |     0% |   92% |  +92pp |
| T7   | receiver approval/manual evidence/rollback 문서 |    25% |   95% |  +70pp |
| T8   | full quality gate 및 managed E2E 검증           |    85% |  100% |  +15pp |
| T9   | completion report 및 Phase 진행율 갱신          |     0% |  100% | +100pp |

이번 slice 구현 완료율은 97%다. 남은 3%는 실제 외부 receiver 운영 증거와
security/release reviewer의 retry rollout 승인이다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role          | Model route  | 선택 이유                                              | 결과                                                                                 |
| -------- | --------------------- | ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Newton   | `security_reviewer`   | GPT-5.5 high | raw token/Auth header/logging/idempotency 보안 검토    | `X-PSMS-Delivery-Id` dedupe, attempt 진단용, raw body/Auth 저장 금지 acceptance 제시 |
| Ampere   | `backend_agent`       | GPT-5.5 high | Fastify service 내부 contract와 ActionResult 경계 검토 | `deliveryId = userPasswordToken.id`, 외부 schema 무변경 유지 권고                    |
| Parfit   | `devops_sre_reviewer` | GPT-5.5 high | release gate/runbook/rollback 운영 기준 검토           | retry rollout BLOCK 유지, manual evidence와 stop-the-line rollback 구체화 요구       |
| Beauvoir | `qa_agent`            | GPT-5.5 high | unit/smoke/release gate/secret scan 검증 설계          | header 안정성, idempotent receiver side effect smoke 추가 제안                       |
| Codex    | controller            | GPT-5        | 구현 통합, 검증 실행, 보고서 작성                      | 패치 적용, 전체 검증, 완료 보고 작성                                                 |

Spark는 사용하지 않았다. 이번 범위는 credential token, webhook auth, release gate,
audit/log secrecy, 운영 rollback에 닿아 프로젝트 규칙상 Spark 금지 또는 부적합 범위다.
mini도 단순 요약이 아니라 보안/운영 계약 판단이 핵심이라 배정하지 않았다.

## 4. 변경 파일

| 파일                                                                         | 변경 내용                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/services/credential-token-delivery.service.ts`                 | `deliveryId` 내부 request field, `X-PSMS-Delivery-Id`, `X-PSMS-Delivery-Attempt` outbound headers 추가                  |
| `apps/api/src/services/admin/staff-credentials.service.ts`                   | delivery 호출 시 committed `userPasswordToken.id`를 delivery id로 전달                                                  |
| `test/unit/credential-token-delivery.test.ts`                                | retry 시 delivery id 안정성, attempt progression, header raw token 미포함 검증                                          |
| `test/smoke/api-credential-token-inject-smoke.ts`                            | webhook receiver가 delivery id/attempt/Auth header를 캡처하고, idempotent duplicate side effect가 1회만 처리되는지 검증 |
| `scripts/production-release-gate.mjs`                                        | manual checks에 receiver `X-PSMS-Delivery-Id` dedupe 승인 항목 추가                                                     |
| `docs/60_release/production-env-and-log-release-gate.md`                     | receiver idempotency approval contract, manual evidence template, incident/rollback runbook 추가                        |
| `docs/60_release/electron-release-checklist.md`                              | Electron release runtime/manual gate에 receiver dedupe header와 duplicate success 기준 추가                             |
| `docs/80_ai_harness/webhook-receiver-idempotency-runbook-report-20260508.md` | 이번 완료 보고서                                                                                                        |

현재 작업트리는 이전 credential-token 연속 작업의 untracked/modified 파일이 많이 남아 있다.
위 목록은 이번 receiver idempotency/runbook slice에서 직접 다룬 범위다.

## 5. 전체 진행률 요약

| 기준                              | Before | After | 변동 | 판단 근거                                                     |
| --------------------------------- | -----: | ----: | ---: | ------------------------------------------------------------- |
| 전체 Web/API MVP readiness        |    72% |   73% | +1pp | managed E2E 60/60과 full gate 유지                            |
| 실제 Web/API MVP 업무 기능        |    40% |   40% |  0pp | 신규 업무 화면/도메인 기능은 추가하지 않음                    |
| Admin staff credential 운영 slice |    98% |   99% | +1pp | delivery idempotency header와 receiver smoke 추가             |
| Credential token backend/security |    97% |   98% | +1pp | raw token 없는 dedupe header와 Auth/logging runbook 강화      |
| Release/secret leakage gate       |    88% |   91% | +3pp | manual evidence template, rollback 절차, artifact scan 재검증 |
| Electron release readiness        |     5% |    6% | +1pp | Electron checklist에 receiver idempotency gate 반영           |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                        | Before | After | 변동 |
| ----: | ---------------------------- | ------------------------------------------------ | -----: | ----: | ---: |
|     0 | Baseline/Harness             | MCP 확인, subagent 위임, 보고/검증 흐름 유지     |   100% |  100% |  0pp |
|     1 | Design System Gate           | 이번 작업 범위 아님                              |   100% |  100% |  0pp |
|     2 | API/DB/Auth Foundation       | DB/Auth core 변경 없이 delivery 내부 header 추가 |    99% |   99% |  0pp |
|     3 | Admin Foundation             | staff credential delivery receiver 계약 보강     |    79% |   80% | +1pp |
|     4 | Token-holder Web UX          | browser credential flow 60/60 E2E 유지           |    72% |   72% |  0pp |
|     5 | Inventory                    | 이번 작업 범위 아님                              |    10% |   10% |  0pp |
|     6 | Sales                        | 이번 작업 범위 아님                              |     8% |    8% |  0pp |
|     7 | Receivable/Customer/Schedule | 이번 작업 범위 아님                              |     8% |    8% |  0pp |
|     8 | Web MVP Gate                 | full test/build, managed E2E, artifact scan 통과 |    40% |   42% | +2pp |
|     9 | Electron Release             | receiver idempotency/runbook/checklist 구체화    |     5% |    6% | +1pp |

## 7. 검증 결과

| 검증                                                                                     |      결과 | 비고                                                                                   |
| ---------------------------------------------------------------------------------------- | --------: | -------------------------------------------------------------------------------------- |
| `codex mcp list`                                                                         |      통과 | e2b, memory, notion, playwright, sequential_thinking, context7 확인                    |
| `pnpm test:unit:credential-delivery`                                                     |      통과 | delivery runtime unit 4/4                                                              |
| `pnpm --filter @psms/api exec tsx ../../test/smoke/api-credential-token-inject-smoke.ts` |      통과 | header/idempotent receiver smoke 포함                                                  |
| `pnpm test:unit:production-release-gate`                                                 |      통과 | release gate unit 12/12                                                                |
| `pnpm --filter @psms/api test:inject`                                                    |      통과 | auth/admin/credential API inject smoke 전체                                            |
| `pnpm db:validate`                                                                       |      통과 | Prisma schema valid                                                                    |
| `pnpm typecheck`                                                                         |      통과 | shared/db/api/web TypeScript                                                           |
| `pnpm lint`                                                                              |      통과 | API tsc lint + Web ESLint                                                              |
| `pnpm format:check`                                                                      |      통과 | 전체 Prettier check                                                                    |
| `pnpm test`                                                                              |      통과 | unit + DB contract + API inject 전체                                                   |
| `pnpm build`                                                                             |      통과 | shared/db/api/web production build                                                     |
| `pnpm test:e2e:managed:preflight`                                                        |      통과 | `canRunManaged: true`                                                                  |
| `pnpm test:e2e:managed`                                                                  |      통과 | Playwright 60 passed                                                                   |
| `pnpm test:e2e:artifact-secret-scan`                                                     |      통과 | managed E2E 후 118 files scanned, secret leak 없음                                     |
| `pnpm release:gate`                                                                      | 예상 실패 | 현재 로컬 env가 production 후보가 아님. manualChecks는 5개로 receiver dedupe 항목 포함 |

## 8. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                    |
| --------------------- | --------: | ------------------------------------------------------- |
| Auth/session core     |        No | login/session/cookie/password hash core 변경 없음       |
| DB schema/migration   |        No | Prisma schema/migration 변경 없음                       |
| API mutation contract |        No | admin issue/revoke external result shape 유지           |
| Shared schema         |        No | `AdminStaffCredentialIssueResult` 변경 없음             |
| API service behavior  |       Yes | delivery webhook outbound header 추가                   |
| Release contract      |       Yes | receiver idempotency/manual evidence/rollback gate 추가 |
| Web/UI                |        No | 화면 변경 없음                                          |

## 9. 이슈/해결방법

| 이슈                               | 원인                                     | 해결                                                            | 재발 방지                                       |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| subagent 세션 조회 실패            | 중단/재개 중 이전 agent id가 `not_found` | 동일 범위를 새 subagent 4명에게 재위임                          | final report에 실제 회수한 subagent 결과만 기록 |
| PowerShell 메모리 오류             | 큰 파일 다수를 병렬 read                 | 이후 단일/소량 read로 전환                                      | 긴 파일은 `Select-Object -First/-Skip`로 분할   |
| receiver idempotency 기준 부족     | 기존 문서는 retry/dedupe 확인만 언급     | approval contract와 manual evidence template 추가               | release gate manualChecks에도 dedupe 항목 추가  |
| true idempotent side effect 미검증 | 기존 smoke는 retry count만 확인          | duplicate delivery id가 side effect 1회만 처리되는 fixture 추가 | API smoke에 고정                                |
| `pnpm release:gate` 실패           | 현재 local env가 production 후보가 아님  | 예상 실패로 기록, unit gate와 artifact scan은 통과              | release 후보 env 주입 후 재실행 필요            |

## 10. 남은 리스크

| 리스크                                                    | 영향도 | 대응                                                                                         |
| --------------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------- |
| 실제 외부 receiver가 custom header를 보존하지 않을 가능성 |   높음 | receiver/proxy 통합 테스트에서 `X-PSMS-Delivery-Id` 보존 증거 첨부                           |
| production retry rollout 미승인                           |   중간 | max attempts `1` 유지, receiver contract evidence와 release reviewer 승인 전까지 BLOCK       |
| 외부 proxy/CDN/APM 로그는 자동 scan 밖                    |   높음 | manual evidence template에 owner/time/artifact/result 필수 기록                              |
| delivery id는 내부 operational identifier                 |   낮음 | raw token은 아니지만 user-facing 노출 금지, bounded metadata로만 사용                        |
| Electron release                                          |   높음 | Web/API MVP, production env/log gate, backup/restore/persistence gate 완료 전까지 NO-GO 유지 |

## 11. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                      | Subagent                                                             | Model route         | 상세                                                                                                             |
| ---: | ---------------------------------------------- | -------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
|    1 | credential request revoke semantics 정리       | `backend_agent` + `db_reviewer` + `qa_agent`                         | GPT-5.5 high        | expired token revoke count, activeKey lifecycle, rollback audit count 의미를 DB/API smoke로 확정                 |
|    2 | production env evidence artifact template 고정 | `devops_sre_reviewer` + `release_reviewer` + `docs_release_manager`  | GPT-5.5 high + mini | release report evidence artifact 형식, owner/time/result 필드, sample prod env file 경로를 문서/스크립트와 맞춤  |
|    3 | Electron local release preflight               | `desktop_release_agent` + `devops_sre_reviewer` + `release_reviewer` | GPT-5.5 high        | local Web/API runtime, SQLite persistence, backup/restore, port conflict, log redaction, rollback checklist 검증 |
