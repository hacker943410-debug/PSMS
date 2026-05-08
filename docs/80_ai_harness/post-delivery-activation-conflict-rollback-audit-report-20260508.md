# 작업 결과 보고

## 요약

- `post-delivery activation conflict rollback/audit hardening` slice 완료.
- credential delivery가 성공한 뒤 `activeKey` activation 단계에서 `P2002` conflict가 발생하면 delivered token을 명시 revoke하고 `ADMIN_STAFF_*_DELIVERY_ROLLED_BACK` audit evidence를 남기도록 보강했다.
- `activated.count !== 1` 분기도 delivered token revoke + rollback audit를 남기며, 같은 transaction에서 기존 active token이 revoke된 경우 만료 전이면 복구하도록 보강했다.
- 외부 `ActionResult`, shared schema, Fastify route/API contract, Prisma schema/migration은 변경하지 않았다.

## 작업 전/후 변동률

| 항목                                        | 작업 전 | 작업 후 |   변동 |
| ------------------------------------------- | ------: | ------: | -----: |
| Post-delivery activation conflict 보상 처리 |     55% |    100% |  +45%p |
| Delivered token explicit revoke evidence    |     70% |    100% |  +30%p |
| ActiveKey conflict smoke coverage           |      0% |    100% | +100%p |
| Credential-token hardening slice 전체       |     88% |     93% |   +5%p |

## 전체 진행률 요약

| 기준               | 현재 완료율 | 판단 근거                                                                                    |
| ------------------ | ----------: | -------------------------------------------------------------------------------------------- |
| 전체 준비 포함     |         43% | Web/API workspace, auth, admin staff, credential-token hardening, managed E2E가 안정화됨     |
| 실제 MVP 업무 기능 |         18% | 직원/credential foundation은 진행됐지만 판매/수납/재고 핵심 도메인은 아직 미완               |
| Frontend shell     |         82% | 디자인 게이트 10/10 승인, credential token UX/E2E 통과                                       |
| Backend/domain     |         38% | auth/admin/credential route foundation은 강화, 주요 업무 transaction은 미구현                |
| DB 기반 구축       |         58% | 초기 schema/migration/credential token contract 검증 통과, 업무 도메인 seed/transaction 잔여 |

## Phase별 완료율 재산정

| Phase | 원본 목표              | 현재 상태                                                                                  | 완료율 |
| ----: | ---------------------- | ------------------------------------------------------------------------------------------ | -----: |
|     0 | 프로젝트 초기화        | workspace, scripts, harness, validation 기준 운영 중                                       |    90% |
|     1 | 디자인 시스템/레이아웃 | 기준 화면 승인 완료, credential UX 유지                                                    |    88% |
|     2 | 인증/RBAC              | auth/session/admin guard/credential-token/revoke semantics와 rollback audit hardening 진행 |    78% |
|     3 | 데이터 모델/Seed       | credential token migration/DB contract 검증 통과, 업무 seed 잔여                           |    58% |
|     4 | 대시보드/리포트        | route/shell 중심, 실제 집계 미구현                                                         |    12% |
|     5 | 판매 관리/판매 등록    | route/shell 중심, transaction 미구현                                                       |     8% |
|     6 | 미수금/고객            | route/shell 중심, 수납/고객 이력 미구현                                                    |     8% |
|     7 | 일정/재고              | route/shell 중심, 재고 상태 transaction 미구현                                             |     8% |
|     8 | 관리자 설정            | 직원 관리와 credential flow 중심 강화, base/policy 실제 CRUD 잔여                          |    42% |
|     9 | Export/QA/운영 보강    | managed E2E, release log gate, secret scan 유지. Export 미구현                             |    35% |

## Subagent별 결과

| 세부 작업                            | Subagent          | Model        | 결과                                                                          | 산출물           | 검증                                       |
| ------------------------------------ | ----------------- | ------------ | ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| Fastify service 보상 처리 검토       | backend_agent     | GPT-5.5 high | post-delivery catch 위치와 `activated.count !== 1` 이전 토큰 복구 필요성 확인 | read-only review | `pnpm --filter @psms/api typecheck` 재통과 |
| DB unique/transaction semantics 검토 | db_reviewer       | GPT-5.5 high | `activeKey @unique` 유지, schema/API contract 변경 불필요 확인                | read-only review | `pnpm test:unit:credential-token-db`       |
| delivered raw token 보안 검토        | security_reviewer | GPT-5.5 high | raw token 미로그, delivered token revoke + rollback audit 필수 확인           | read-only review | secret scan, smoke secret assertions       |
| conflict/rollback 테스트 전략        | qa_agent          | GPT-5.5 high | SQLite trigger 기반 deterministic post-delivery conflict smoke 권장           | read-only review | `pnpm test:api:inject`, managed E2E        |

## 모델 선택 이유

- 인증/credential token/raw secret/AuditLog/DB unique conflict가 걸린 변경이라 하네스의 GPT-5.5 라우팅 대상이다.
- Spark는 auth/DB/API/AuditLog 영역 수정 금지라 사용하지 않았다.
- mini는 단순 문서 보조에 적합하지만 이번 slice는 보안/DB 보상 처리 판단이 핵심이라 사용하지 않았다.

## 변경 파일

| 파일                                                                                     | 변경 내용                                                                                                                                                                                  | 담당                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `apps/api/src/services/admin/staff-credentials.service.ts`                               | post-delivery `P2002` compensation helper 호출 추가, delivered token revoke + rollback audit 기록, `activated.count !== 1` 분기에서 delivered token revoke/audit 및 기존 active token 복구 | Codex + backend/db/security review 반영 |
| `test/smoke/api-credential-token-inject-smoke.ts`                                        | delivery 성공 후 activation unique conflict를 SQLite trigger로 재현하는 smoke 추가, delivered token revoked/audit/secret hygiene/previous token retention 검증                             | Codex + QA review 반영                  |
| `docs/80_ai_harness/post-delivery-activation-conflict-rollback-audit-report-20260508.md` | 완료 보고서 작성                                                                                                                                                                           | Codex                                   |

## 검증 결과

| 검증                                 | 결과 | 근거                                                |
| ------------------------------------ | ---: | --------------------------------------------------- |
| `pnpm test:api:inject`               | 통과 | credential conflict smoke 포함 전체 API inject 통과 |
| `pnpm test:unit:credential-token-db` | 통과 | tokenHash/activeKey unique contract 유지            |
| `pnpm typecheck`                     | 통과 | shared/db/api/web typecheck 통과                    |
| `pnpm lint`                          | 통과 | API tsc lint + Web ESLint 통과                      |
| `pnpm format:check`                  | 통과 | Prettier check 통과                                 |
| `pnpm test`                          | 통과 | unit + API inject 통합 통과                         |
| `pnpm build`                         | 통과 | shared/db/api/web build 통과                        |
| `pnpm db:validate`                   | 통과 | Prisma schema valid                                 |
| `pnpm test:e2e:managed:preflight`    | 통과 | 5273/4273 사용 가능, 5173/4173 점유 확인            |
| `pnpm test:e2e:managed`              | 통과 | Playwright 60 passed                                |
| `pnpm test:e2e:artifact-secret-scan` | 통과 | artifact secret scan ok                             |
| `pnpm release:gate:logs`             | 통과 | artifact secret scan gate ok                        |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                                            |
| ------------ | --------: | ------------------------------------------------------------------------------- |
| Auth         |       Yes | credential issue 내부 보상 처리만 변경. 외부 auth 방식/route contract 변경 없음 |
| DB           |        No | Prisma schema/migration/index 변경 없음                                         |
| API contract |        No | 기존 `409 CREDENTIAL_TOKEN_CONFLICT` 응답 유지                                  |
| AuditLog     |       Yes | post-delivery conflict rollback evidence 추가                                   |

## 이슈/해결방법

| 이슈                                                                | 원인                                                                                | 해결                                                                              | 재발 방지                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| pre-delivery catch에 compensation helper가 잘못 연결될 위험         | delivery evidence 없는 scope에서 helper를 호출하면 compile/runtime 의미가 맞지 않음 | pre-delivery `P2002`는 기존 409 유지, post-delivery catch에만 compensation 배치   | API typecheck + subagent DB/backend review |
| `activated.count !== 1` 분기에서 이전 token revoke가 커밋될 수 있음 | exception이 아니라 return failure면 transaction이 commit될 수 있음                  | delivered token revoke, rollback audit, 만료 전 previous token activeKey 복구     | smoke와 리뷰 기록으로 분기 의미 고정       |
| deterministic conflict 재현 어려움                                  | 실제 동시성 테스트는 타이밍 의존적                                                  | temp smoke DB SQLite trigger로 delivery 이후 activation update 시점 conflict 재현 | trigger는 smoke DB에서만 생성/삭제         |

## 남은 리스크

| 리스크                                                                               | 영향도 | 대응                                                     |
| ------------------------------------------------------------------------------------ | -----: | -------------------------------------------------------- |
| PostgreSQL concurrency에서 `P2034` 등 다른 transaction conflict 코드가 나타날 가능성 |   중간 | 운영 DB 전환 전 db_reviewer와 PostgreSQL rehearsal 추가  |
| compensation audit write 자체 실패 시 API가 409 대신 throw할 수 있음                 |   중간 | audit log 보존 우선 정책상 적절. 운영 관측/alerting 필요 |
| 기존 작업트리가 넓게 dirty/untracked                                                 |   중간 | 이번 slice 파일만 수정. unrelated change revert 없음     |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                                                | Subagent                           | Model               | 상세                                                                                                                                        |
| ---: | --------------------------------------------------- | ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | PostgreSQL-style transaction conflict preflight     | db_reviewer + backend_agent        | GPT-5.5 high        | SQLite smoke와 별도로 `P2034`/serialization conflict 대응 필요 여부를 repository/service contract 기준으로 검토                             |
|    2 | Credential issue concurrency smoke hardening        | qa_agent + backend_agent           | GPT-5.5 high        | 두 admin 동시 issue 시 losing delivered token revoke/audit 보장 여부를 deterministic harness 또는 direct service test로 보강                |
|    3 | Admin credential operational audit read-model check | security_reviewer + frontend_agent | GPT-5.5 high/medium | rollback/failure/issued audit evidence가 admin 운영 화면 또는 support runbook에서 추적 가능한지 확인, UI 변경 필요 시 별도 design gate 적용 |

## 완료 판정

- 이번 slice 목표인 `post-delivery activation conflict rollback/audit hardening`은 완료.
- 완료율: 100% / 100%.
- 다음 slice 진입 가능.
