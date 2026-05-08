# Credential Token Shared Completion Report

작성일: 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 Credential token shared schema/helper 구현을 완료했다.

이번 범위는 직원 활성화/비밀번호 재설정 API 구현 전에 필요한 shared 기반이다.
`PASSWORD_TOKEN_SECRET` 전용 gate, credential token 생성/해시/검증 helper, activeKey
helper, 30분 TTL, issue/revoke/verify/complete Zod DTO, password policy helper,
unit test를 추가했다.

API issue/revoke/complete, DB repository/service, delivery, Web UI는 이번 범위에서
구현하지 않았다.

## 2. 작업 분해

| Task | 내용                                                             | 담당      | 상태 | 진행율 |
| ---- | ---------------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 산출물과 작업트리 확인                           | Codex     | 완료 |   100% |
| T2   | backend/security/QA subagent 자동 위임                           | Subagents | 완료 |   100% |
| T3   | shared auth/password/session/Zod/export 패턴 분석                | Codex     | 완료 |   100% |
| T4   | `credential-token.ts` helper와 DTO schema 구현                   | Codex     | 완료 |   100% |
| T5   | `PASSWORD_TOKEN_SECRET`, HMAC hash, activeKey, TTL helper 구현   | Codex     | 완료 |   100% |
| T6   | password policy와 context-aware complete schema factory 구현     | Codex     | 완료 |   100% |
| T7   | result schema strict redaction contract와 revoke result DTO 보강 | Codex     | 완료 |   100% |
| T8   | shared/root export와 `.env.example`, test script 연결            | Codex     | 완료 |   100% |
| T9   | unit/type/test/lint/build/format/whitespace 검증                 | Codex     | 완료 |   100% |
| T10  | 완료 보고서와 다음 3단계 상세 미리보기 작성                      | Codex     | 완료 |   100% |

이번 Credential Token Shared Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent | Harness role        | Model route  | 선택 이유                                                | 결과                                                                  |
| -------- | ------------------- | ------------ | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Averroes | `backend_agent`     | GPT-5.5 high | shared export, DTO, helper, test script 구조 검토        | 구현 체크리스트와 revoke result/context schema gap 제시               |
| Poincare | `security_reviewer` | GPT-5.5 high | token secret, hash, password policy, secret leakage 검토 | result schema strict와 context-aware password validation blocker 제시 |
| Locke    | `qa_agent`          | GPT-5.5 high | unit test matrix와 completion gate 설계                  | token/hash/secret/DTO/password policy test checklist 제공             |
| Codex    | controller          | GPT-5        | 구현 통합, 검증 실행, 보고서 작성                        | shared credential token slice 완료                                    |

Spark는 사용하지 않았다. 이번 작업은 password reset token, secret handling, password
policy, DTO redaction에 닿으므로 하네스 기준 Spark 금지 또는 부적합 범위다.

## 4. 변경 파일

| 파일/범위                                                                  | 변경 내용                                                                            | 담당  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| `packages/shared/src/credential-token.ts`                                  | token secret gate, generation/hash/verify, activeKey, TTL, DTO, password policy 추가 | Codex |
| `packages/shared/src/index.ts`                                             | credential token helper/schema/type root export 추가                                 | Codex |
| `packages/shared/package.json`                                             | `./credential-token` subpath export 추가                                             | Codex |
| `.env.example`                                                             | `PASSWORD_TOKEN_SECRET` placeholder 추가                                             | Codex |
| `test/unit/credential-token.test.ts`                                       | token helper, secret gate, strict DTO, password policy unit tests 추가               | Codex |
| `package.json`                                                             | `test:unit:credential-token` 추가 및 `pnpm test`에 연결                              | Codex |
| `docs/80_ai_harness/credential-token-shared-completion-report-20260507.md` | 작업 완료 보고서 작성                                                                | Codex |

이 작업트리에는 직전 DB migration slice와 preflight 문서 변경도 아직 커밋 전 상태로
함께 남아 있다.

## 5. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                            |
| -------------------------- | ----------: | -------------------------------------------------------------------- |
| 전체 준비 포함             |         56% | activation/reset DB 기반에 이어 shared token/schema/helper 기반 완료 |
| 실제 Web/API MVP 업무 기능 |         26% | API/UI는 아직 없음. 다음 API service 구현 준비도가 올라감            |
| Frontend shell             |         78% | UI 변경 없음. 다음 `계정 접근` section 구현 대기                     |
| Backend/domain             |         43% | API service 전 shared contract, token helper, password policy 확보   |
| DB 기반 구축               |         78% | DB migration은 직전 slice에서 완료. 이번 DB 변경 없음                |
| Phase 3 Admin Foundation   |         54% | staff credential activation/reset의 shared blocker 해소              |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                             | 완료율 |
| ----: | ---------------------------- | ------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, subagent, 검증 보고 흐름 유지                                   |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 구현 없음                                     |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 + credential DB/shared helper   |    95% |
|     3 | Admin Foundation             | staff read/update/status/create 완료, activation/reset DB/shared 기반 완료            |    54% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                         |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                   |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                             |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                                  |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E create/update/status 완료. activation/reset E2E는 API/UI 이후 대기 |    18% |
|     9 | Electron Release             | desktop placeholder 단계                                                              |     3% |

## 7. 검증 결과

| 검증                                   | 결과 | 근거                                                                            |
| -------------------------------------- | ---: | ------------------------------------------------------------------------------- |
| MCP surface check                      | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 확인 |
| `pnpm test:unit:credential-token`      | 통과 | 9 tests passed. token/helper/DTO/password policy 검증                           |
| `pnpm --filter @psms/shared typecheck` | 통과 | shared package typecheck 통과                                                   |
| `pnpm typecheck`                       | 통과 | shared/db/api/web typecheck 통과                                                |
| `pnpm test`                            | 통과 | unit + API inject 전체 통과                                                     |
| `pnpm lint`                            | 통과 | API tsc lint, Web ESLint 통과                                                   |
| `pnpm format:check`                    | 통과 | 전체 workspace Prettier check 통과                                              |
| `pnpm build`                           | 통과 | shared/db/api/web production build 통과                                         |
| `git diff --check`                     | 통과 | whitespace error 없음                                                           |

`test:unit:credential-token-db`는 unique constraint 실패를 의도적으로 검증하므로
Prisma expected error log가 출력되지만 테스트 결과는 pass다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                                        |
| --------------------- | --------: | --------------------------------------------------------------------------- |
| Auth/session          |        No | session cookie/token runtime 변경 없음                                      |
| Password/token helper |       Yes | `PASSWORD_TOKEN_SECRET`, HMAC credential token helper, password policy 추가 |
| DB schema/migration   |        No | 이번 slice DB 변경 없음. 직전 migration 기반 사용                           |
| API contract          |       Yes | shared DTO/schema만 추가. Fastify route/service 구현 없음                   |
| Web/UI                |        No | UI 변경 없음                                                                |
| Test harness          |       Yes | `test:unit:credential-token` 추가 및 `pnpm test` 연결                       |

## 9. 보안 리뷰 반영

| Finding                                                | 조치                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Result schema가 strict하지 않아 secret field 누락 가능 | issue/revoke/preview/complete result schema를 `.strict()`로 고정하고 forbidden field test 추가 |
| complete schema가 loginId/name context를 받지 않음     | `createCredentialCompleteInputSchema(context)` factory 추가                                    |
| account-derived password separator 우회 가능           | 비교 정규화에서 whitespace, punctuation, symbol, underscore 제거                               |
| revoke result DTO 누락 가능                            | `adminStaffCredentialRevokeResultSchema`와 type/export 추가                                    |
| activeKey blank userId 가능                            | `buildCredentialTokenActiveKey`가 blank userId를 throw하도록 보강                              |

## 10. 이슈/해결방법

| 이슈                                      | 원인                                       | 해결                                                   | 재발 방지                                               |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| `.env.example`은 Prettier parser 없음     | env 파일 parser 미설정                     | TS/JSON 파일만 Prettier 실행 후 전체 format check 통과 | `.env` 계열은 수동/전체 check 기준으로 관리             |
| password context는 token lookup 이후 필요 | complete request만으로는 loginId/name 없음 | context-aware schema factory 제공                      | 다음 API service에서 token subject 조회 후 factory 사용 |
| result DTO secret leakage 위험            | Zod 기본 object는 unknown key를 strip 가능 | result schema `.strict()`와 forbidden field test 추가  | API response는 result schema parse 후 반환하도록 구현   |

## 11. 남은 리스크

| 리스크                             | 영향도 | 대응                                                                                    |
| ---------------------------------- | -----: | --------------------------------------------------------------------------------------- |
| Delivery policy 미정               |   높음 | 다음 API 구현 전 email/SMS/out-of-band 중 MVP 정책 확정. 미정이면 issue API fail-closed |
| API transaction/service 미구현     |   높음 | 다음 slice에서 DB token issue/revoke/verify/complete transaction 구현                   |
| Rate limit persistence 미구현      |   중간 | token issue/complete 전용 bucket을 다음 API slice 또는 직후 hardening으로 구현          |
| token cleanup/retention job 미구현 |   중간 | API 완료 후 운영/retention slice에서 cleanup 정책 구현                                  |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                             | Subagent                                               | Model route           | 상세                                                                                                     |
| ---: | ----------------------------------------------------- | ------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------- |
|    1 | Activation/password reset API repository/service 구현 | `backend_agent` + `security_reviewer` + `db_reviewer`  | GPT-5.5 high          | token issue/revoke/verify/complete transaction, `activeKey`, password hash, session revoke, AuditLog     |
|    2 | Fastify credential routes와 API inject smoke 구현     | `backend_agent` + `architect_reviewer` + `qa_agent`    | GPT-5.5 high          | admin guard-before-validation, token-holder unauth route, generic errors, forbidden/secret leak tests    |
|    3 | Web account access UI와 token-holder page 구현        | `frontend_agent` + `ui_runtime_validator` + `qa_agent` | GPT-5.5 medium + mini | staff detail `계정 접근` section, auth-side setup page, safe copy, 1586/1440/1280 E2E와 secret leak 검증 |
