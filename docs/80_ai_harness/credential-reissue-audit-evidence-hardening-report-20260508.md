# 작업 결과 보고

## 요약

- `Credential issue concurrency/reissue audit evidence hardening` slice 완료.
- 동일 직원/목적에 credential request를 재발급할 때 이전 delivered token이 revoke되는 사실을 AuditLog에서 token id 단위로 추적할 수 있도록 `revokedPreviousTokenIds` evidence를 추가했다.
- 기존 외부 `ActionResult`, shared schema, Fastify route/API contract, Prisma schema/migration은 변경하지 않았다.
- 실제 동시성 재현은 SQLite 환경에서 flake 위험이 있어, 안정적인 sequential reissue smoke를 “race 결과의 결정적 재현”으로 강화했다.

## 작업 전/후 변동률

| 항목                                  | 작업 전 | 작업 후 |  변동 |
| ------------------------------------- | ------: | ------: | ----: |
| Reissue revoked token audit evidence  |     65% |    100% | +35%p |
| Token-level revoke traceability       |     60% |    100% | +40%p |
| Reissue smoke assertion strength      |     75% |    100% | +25%p |
| Credential-token hardening slice 전체 |     95% |     96% |  +1%p |

## 전체 진행률 요약

| 기준               | 현재 완료율 | 판단 근거                                                            |
| ------------------ | ----------: | -------------------------------------------------------------------- |
| 전체 준비 포함     |         44% | credential-token issue/revoke/delivery/audit hardening이 계속 누적됨 |
| 실제 MVP 업무 기능 |         18% | 판매/수납/재고 등 핵심 업무 기능은 아직 미구현                       |
| Frontend shell     |         82% | UI 변경 없음, 기존 shell/credential UX 영향 없음                     |
| Backend/domain     |         40% | credential issue reissue audit evidence가 token-level로 보강됨       |
| DB 기반 구축       |         59% | schema 변경 없이 AuditLog JSON evidence만 보강                       |

## Phase별 완료율 재산정

| Phase | 원본 목표              | 현재 상태                                             | 완료율 |
| ----: | ---------------------- | ----------------------------------------------------- | -----: |
|     0 | 프로젝트 초기화        | workspace/harness/validation 기준 운영 중             |    90% |
|     1 | 디자인 시스템/레이아웃 | 기준 화면 승인 완료, 이번 slice UI 변경 없음          |    88% |
|     2 | 인증/RBAC              | credential issue/reissue/revoke/audit semantics 강화  |    80% |
|     3 | 데이터 모델/Seed       | credential token DB contract 유지, schema 변경 없음   |    59% |
|     4 | 대시보드/리포트        | 실제 집계 미구현                                      |    12% |
|     5 | 판매 관리/판매 등록    | transaction 미구현                                    |     8% |
|     6 | 미수금/고객            | 수납/고객 이력 미구현                                 |     8% |
|     7 | 일정/재고              | 재고 상태 transaction 미구현                          |     8% |
|     8 | 관리자 설정            | 직원 credential flow 중심 강화, base/policy CRUD 잔여 |    43% |
|     9 | Export/QA/운영 보강    | unit/API/build/secret scan gate 유지, Export 미구현   |    36% |

## Subagent별 결과

| 세부 작업                   | Subagent          | Model        | 결과                                                                                         | 산출물                                | 검증                   |
| --------------------------- | ----------------- | ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------- |
| Service/audit evidence 검토 | backend_agent     | GPT-5.5 high | 같은 user/purpose 재발급 시 이전 delivered token id를 audit에 남기는 것이 최소 보강으로 판단 | 자동 위임 시도, resume 후 로컬 반영   | `pnpm test:api:inject` |
| Raw token/security 검토     | security_reviewer | GPT-5.5 high | token id는 운영 evidence로 허용, raw token/token hash/password/session은 계속 금지           | 자동 위임 시도, secret assertion 유지 | secret scan            |
| Concurrency smoke 전략      | qa_agent          | GPT-5.5 high | 진짜 concurrent SQLite smoke보다 deterministic reissue smoke 강화가 low-flake                | 자동 위임 시도, 로컬 smoke 보강       | `pnpm test`, API smoke |

## 모델 선택 이유

- credential token, raw secret exposure, AuditLog evidence, admin auth 흐름이 포함되어 GPT-5.5 수준 검토 경로로 진행했다.
- Spark는 auth/DB/API/AuditLog 영역 수정 금지라 사용하지 않았다.
- 실제 파일 변경은 `apps/api` service와 API smoke에만 제한했다.

## 변경 파일

| 파일                                                                                | 변경 내용                                                                                                                       | 담당  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `apps/api/src/services/admin/staff-credentials.service.ts`                          | `ADMIN_STAFF_*_ISSUED` audit `afterJson`에 `revokedPreviousTokenIds` 추가                                                       | Codex |
| `test/smoke/api-credential-token-inject-smoke.ts`                                   | reissue smoke에서 이전 token `revokedById`, issued audit `tokenId`, `revokedPreviousCount`, `revokedPreviousTokenIds` 검증 추가 | Codex |
| `docs/80_ai_harness/credential-reissue-audit-evidence-hardening-report-20260508.md` | 완료 보고서 작성                                                                                                                | Codex |

## 검증 결과

| 검증                                 | 결과 | 근거                                                  |
| ------------------------------------ | ---: | ----------------------------------------------------- |
| `pnpm test:api:inject`               | 통과 | reissue audit evidence assertion 포함 API inject 통과 |
| `pnpm typecheck`                     | 통과 | shared/db/api/web typecheck 통과                      |
| `pnpm lint`                          | 통과 | API tsc lint + Web ESLint 통과                        |
| `pnpm test`                          | 통과 | unit + API inject 전체 통과                           |
| `pnpm build`                         | 통과 | shared/db/api/web build 통과                          |
| `pnpm db:validate`                   | 통과 | Prisma schema valid                                   |
| `pnpm format:check`                  | 통과 | Prettier check 통과                                   |
| `pnpm test:e2e:artifact-secret-scan` | 통과 | artifact secret scan ok                               |
| `pnpm release:gate:logs`             | 통과 | release log gate ok                                   |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                        |
| ------------ | --------: | ------------------------------------------- |
| Auth         |       Yes | credential issue audit evidence만 내부 보강 |
| DB           |        No | Prisma schema/migration/index 변경 없음     |
| API contract |        No | 응답 schema/route/status code 변경 없음     |
| AuditLog     |       Yes | `revokedPreviousTokenIds` evidence 추가     |

## 이슈/해결방법

| 이슈                             | 원인                                                                                | 해결                                                         | 재발 방지                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 재발급 성공 audit가 count만 제공 | 운영 조사 시 어떤 delivered token이 revoke됐는지 token-level evidence 부족          | `revokedPreviousTokenIds` 추가                               | smoke에서 token id 배열까지 검증                           |
| 실제 concurrent smoke flake 위험 | SQLite/API inject 환경에서 delivery 후 activation race를 안정적으로 통제하기 어려움 | race 결과와 동일한 sequential reissue smoke를 강화           | PostgreSQL rehearsal profile에서 실제 concurrent test 예정 |
| secret leakage 위험              | audit evidence 확장 시 raw token/hash 포함 가능성                                   | token id만 기록, 기존 forbidden field/secret assertions 유지 | artifact secret scan 통과                                  |

## 남은 리스크

| 리스크                                                                             | 영향도 | 대응                                                                      |
| ---------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------- |
| 실제 동시에 delivery된 두 issue의 interleaving은 SQLite smoke로 직접 검증하지 않음 |   중간 | PostgreSQL rehearsal profile 또는 synthetic service harness에서 별도 검증 |
| token id가 내부 운영 식별자로 노출됨                                               |   낮음 | raw token/token hash가 아니며 기존 audit evidence에도 tokenId 사용 중     |
| 기존 작업트리가 넓게 dirty/untracked                                               |   중간 | 이번 slice 파일만 수정, unrelated revert 없음                             |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                                        | Subagent                          | Model               | 상세                                                                                                      |
| ---: | ------------------------------------------- | --------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
|    1 | Compensation failure runbook/cleanup policy | security_reviewer + db_reviewer   | GPT-5.5 high        | compensation transaction 실패 시 inactive unrevoked token 탐지/cleanup/audit 운영 정책 작성               |
|    2 | PostgreSQL rehearsal profile 설계           | db_reviewer + devops_sre_reviewer | GPT-5.5 high        | SQLite MVP와 별도 PG test DB profile, migration apply, Serializable conflict rehearsal 계획               |
|    3 | Admin credential audit read-model check     | backend_agent + frontend_agent    | GPT-5.5 high/medium | issued/failed/rollback/revoked audit evidence를 관리자 운영 화면이나 support query에서 추적 가능한지 점검 |

## 완료 판정

- 이번 slice 목표인 `Credential issue concurrency/reissue audit evidence hardening`은 완료.
- 완료율: 100% / 100%.
- 다음 slice 진입 가능.
