# Credential Token DB Migration Completion Report

작성일: 2026-05-07

## 1. 작업 요약

현재 하네스 기준 다음 slice인 Credential token DB migration 구현을 완료했다.

이번 범위는 직원 활성화/비밀번호 재설정 API 구현 전 필요한 DB 기반을 추가하는
작업이다. `UserPasswordTokenPurpose` enum, `UserPasswordToken` model, Prisma
migration, generated client, seed/e2e DB 검증, DB contract unit test를 추가했다.

API issue/revoke/complete, token generation, delivery, Web UI는 이번 범위에서
구현하지 않았다.

## 2. 작업 분해

| Task | 내용                                                                    | 담당      | 상태 | 진행율 |
| ---- | ----------------------------------------------------------------------- | --------- | ---- | -----: |
| T1   | MCP/하네스/직전 preflight와 작업트리 확인                               | Codex     | 완료 |   100% |
| T2   | DB/security/backend subagent 자동 위임                                  | Subagents | 완료 |   100% |
| T3   | Prisma schema, migration, seed/e2e 검증 구조 분석                       | Codex     | 완료 |   100% |
| T4   | `UserPasswordTokenPurpose` enum과 `UserPasswordToken` model 추가        | Codex     | 완료 |   100% |
| T5   | create-only migration 생성 및 SQL review                                | Codex     | 완료 |   100% |
| T6   | Prisma generated client 갱신과 `UserPasswordToken` type export 추가     | Codex     | 완료 |   100% |
| T7   | seed/master/e2e DB 검증에 `userPasswordTokens: 0` 및 catalog count 반영 | Codex     | 완료 |   100% |
| T8   | token hash/activeKey unique DB contract test 추가                       | Codex     | 완료 |   100% |
| T9   | disposable DB rehearsal, seed idempotency, type/test/lint/build 검증    | Codex     | 완료 |   100% |
| T10  | dev DB 백업 후 migration 적용, 완료 보고서와 다음 3단계 미리보기 작성   | Codex     | 완료 |   100% |

이번 Credential Token DB Migration Task 완료율은 100%다.

## 3. Subagent 위임 및 모델 선택 이유

| Subagent  | Harness role        | Model route  | 선택 이유                                                     | 결과                                                                        |
| --------- | ------------------- | ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Kuhn      | `db_reviewer`       | GPT-5.5 high | Prisma schema, migration SQL, seed/idempotency, rollback 검토 | schema/migration 유효. migration 파일 포함과 rollback/rehearsal 기록 요구   |
| Jason     | `security_reviewer` | GPT-5.5 high | token/password/session/RBAC/AuditLog 보안 금지선 검토         | raw secret 저장 필드 없음 확인. API 전 `PASSWORD_TOKEN_SECRET` blocker 제시 |
| Aristotle | `backend_agent`     | GPT-5.5 high | DB package script, generated client, 검증 흐름 조사           | generated client 포함, seed/e2e count, 검증 순서 체크리스트 제공            |
| Codex     | controller          | GPT-5        | 구현 통합, 검증 실행, 보고서 작성                             | DB migration slice 완료                                                     |

Spark는 사용하지 않았다. 이번 작업은 DB schema/migration, auth credential token 기반,
password reset 보안 경계에 닿으므로 하네스 기준 Spark 금지 또는 부적합 범위다.

## 4. 변경 파일

| 파일/범위                                                                        | 변경 내용                                                                                         | 담당  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----- |
| `packages/db/prisma/schema.prisma`                                               | `UserPasswordTokenPurpose` enum, `UserPasswordToken` model, `User` back relation 3개 추가         | Codex |
| `packages/db/prisma/migrations/20260506233441_add_user_password_tokens/`         | 새 token table과 unique/index/FK를 생성하는 create-only migration 추가                            | Codex |
| `packages/db/src/generated/prisma/**`                                            | Prisma generated client 갱신, `UserPasswordToken` delegate/model/enum 반영                        | Codex |
| `packages/db/src/index.ts`                                                       | `UserPasswordToken` type export 추가                                                              | Codex |
| `packages/db/prisma/seed-idempotency-check.ts`                                   | smoke seed idempotency count에 `userPasswordTokens: 0` 추가                                       | Codex |
| `packages/db/prisma/master-seed.ts`                                              | master seed expected count에 `userPasswordTokens: 0` 추가                                         | Codex |
| `packages/db/prisma/master-seed-idempotency-check.ts`                            | master seed idempotency snapshot/count 검증에 token count 추가                                    | Codex |
| `packages/db/prisma/e2e-isolated-reset.ts`                                       | business table `23`, index `62`, required unique index `6`, token count `0` 검증으로 갱신         | Codex |
| `test/unit/user-password-token-db-contract.test.ts`                              | disposable DB에서 migration deploy, `tokenHash`/`activeKey` unique, active token 재발급 패턴 검증 | Codex |
| `package.json`                                                                   | `test:unit:credential-token-db` 추가 및 `pnpm test`에 연결                                        | Codex |
| `docs/80_ai_harness/credential-token-db-migration-completion-report-20260507.md` | 작업 완료 보고서 작성                                                                             | Codex |

직전 preflight 문서 2개도 아직 커밋 전 작업트리에 남아 있으며, 이번 구현의 기준 문서로
유지한다.

## 5. 전체 진행률 요약

| 기준                       | 현재 완료율 | 판단 근거                                                           |
| -------------------------- | ----------: | ------------------------------------------------------------------- |
| 전체 준비 포함             |         54% | activation/reset preflight에 이어 DB 기반 migration과 검증 완료     |
| 실제 Web/API MVP 업무 기능 |         25% | runtime API/UI는 아직 없음. 다음 API service 구현 준비 완료         |
| Frontend shell             |         78% | UI 변경 없음. 다음 `계정 접근` section 구현 대기                    |
| Backend/domain             |         40% | API service 전 DB delegate와 migration 기반 확보                    |
| DB 기반 구축               |         78% | token table, unique 제약, seed/e2e DB gate 추가 및 dev DB 적용 완료 |
| Phase 3 Admin Foundation   |         52% | staff create 이후 credential activation/reset의 DB blocker 해소     |

## 6. Phase별 완료율 재산정

| Phase | 목표                         | 현재 상태                                                                             | 완료율 |
| ----: | ---------------------------- | ------------------------------------------------------------------------------------- | -----: |
|     0 | Baseline/Harness             | workspace, MCP, 문서, subagent, 검증 보고 흐름 유지                                   |   100% |
|     1 | Design System Gate           | 기준 PNG 승인 이력 유지. 이번 작업은 UI 구현 없음                                     |   100% |
|     2 | API/DB Foundation            | auth/session/admin guard/rate limit/revoke/audit 기반 + credential token DB 추가      |    94% |
|     3 | Admin Foundation             | staff read/update/status/create 완료, activation/reset DB 기반 완료                   |    52% |
|     4 | Inventory                    | 화면 skeleton 중심. 실제 재고 mutation 미구현                                         |    10% |
|     5 | Sales                        | route/skeleton 중심. sale transaction/wizard 미구현                                   |     8% |
|     6 | Receivable/Customer/Schedule | skeleton 중심. 수납/취소/잔액/이력 미구현                                             |     8% |
|     7 | Dashboard/Report/Export      | placeholder 중심. 집계/export 미구현                                                  |     8% |
|     8 | Web MVP Gate                 | staff mutation E2E create/update/status 완료. activation/reset E2E는 API/UI 이후 대기 |    17% |
|     9 | Electron Release             | desktop placeholder 단계                                                              |     3% |

## 7. 검증 결과

| 검증                                 | 결과 | 근거                                                                            |
| ------------------------------------ | ---: | ------------------------------------------------------------------------------- |
| MCP surface check                    | 통과 | `e2b`, `memory`, `notion`, `playwright`, `sequential_thinking`, `context7` 확인 |
| `pnpm db:validate`                   | 통과 | Prisma schema valid                                                             |
| `pnpm db:generate`                   | 통과 | generated Prisma client 갱신                                                    |
| `pnpm test:unit:credential-token-db` | 통과 | disposable DB migration deploy, unique 제약, activeKey 재발급 패턴 검증         |
| `pnpm --filter @psms/db build`       | 통과 | DB package typecheck 통과                                                       |
| `pnpm test:seed:idempotency`         | 통과 | smoke seed 2회 idempotency, `userPasswordTokens: 0`, dev DB unchanged           |
| `pnpm test:seed:master:idempotency`  | 통과 | master seed 2회 idempotency, `userPasswordTokens: 0`, dev DB unchanged          |
| `pnpm test:e2e:db:reset`             | 통과 | isolated DB migration/seed/catalog 검증, table 23/index 62                      |
| `pnpm typecheck`                     | 통과 | shared/db/api/web typecheck 통과                                                |
| `pnpm test`                          | 통과 | unit + API inject 전체 통과                                                     |
| `pnpm lint`                          | 통과 | API tsc lint, Web ESLint 통과                                                   |
| `pnpm format:check`                  | 통과 | 전체 workspace Prettier check 통과                                              |
| `pnpm build`                         | 통과 | shared/db/api/web production build 통과                                         |
| `pnpm db:migrate`                    | 통과 | local `packages/db/dev.db`에 pending migration 적용                             |
| `prisma migrate status`              | 통과 | local dev DB schema up to date                                                  |
| `git diff --check`                   | 통과 | whitespace error 없음                                                           |

`test:unit:credential-token-db`는 unique constraint 실패를 의도적으로 검증하므로
Prisma expected error log가 출력되지만 테스트 결과는 pass다.

## 8. Auth / DB / API Contract 변경 여부

| 영역                | 변경 여부 | 비고                                                                              |
| ------------------- | --------: | --------------------------------------------------------------------------------- |
| Auth/session        |        No | session, password hash, RBAC guard runtime 코드 변경 없음                         |
| DB schema/migration |       Yes | `UserPasswordTokenPurpose`, `UserPasswordToken`, migration, generated client 추가 |
| API contract        |        No | route/service 구현 없음. 다음 API slice의 DB 기반만 준비                          |
| Web/UI              |        No | UI 변경 없음                                                                      |
| Seed/test harness   |       Yes | token count `0`, catalog count, DB contract test, full test script 반영           |

## 9. Migration / Rollback 기록

| 항목         | 내용                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Migration    | `20260506233441_add_user_password_tokens`                                                                        |
| SQL 성격     | create-only. 기존 table `ALTER`, DML, backfill 없음                                                              |
| FK 정책      | `userId`, `createdById`, `revokedById` 모두 `User(id)` `ON DELETE RESTRICT`                                      |
| Local backup | `packages/db/dev.db.20260507084307.bak` 생성 후 dev DB migration 적용                                            |
| Rehearsal    | `.tmp/db-contract`, `.tmp/seed-gate`, `.tmp/e2e` disposable DB에서 migrate deploy 검증 통과                      |
| Dev 상태     | `prisma migrate status` 기준 local `dev.db` up to date                                                           |
| Rollback     | API가 token row를 쓰기 전이면 dev 환경은 백업 DB 복원 가능. 공유/운영 DB는 drop-table forward migration으로 처리 |

## 10. 이슈/해결방법

| 이슈                                      | 원인                                         | 해결                                                | 재발 방지                                                        |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| migration 파일 untracked 누락 위험        | `migrate dev --create-only`가 새 폴더를 생성 | migration 폴더를 변경 파일에 포함                   | 완료 보고와 final status에서 untracked migration 명시            |
| `.prisma`를 Prettier가 직접 처리하지 못함 | 현재 Prettier 환경에 Prisma parser 없음      | `prisma format --config prisma.config.ts` 사용      | schema 포맷은 Prisma CLI로 처리                                  |
| generated file trailing whitespace        | Prisma generated 주석 공백                   | 변경된 generated 파일의 trailing whitespace 정리    | `git diff --check`를 최종 gate로 유지                            |
| enum DB-level CHECK 없음                  | SQLite provider에서 enum이 `TEXT`로 생성됨   | Prisma enum + 다음 API Zod validation으로 방어 예정 | raw SQL write 금지, service/repository boundary 테스트 추가 예정 |

## 11. 남은 리스크

| 리스크                                    | 영향도 | 대응                                                                                      |
| ----------------------------------------- | -----: | ----------------------------------------------------------------------------------------- |
| Delivery policy 미정                      |   높음 | 다음 API 구현 전 email/SMS/out-of-band 중 MVP 정책을 확정. 미정이면 issue API fail-closed |
| `PASSWORD_TOKEN_SECRET` gate 미구현       |   높음 | 다음 shared/backend slice에서 전용 secret 없으면 issue/complete를 fail-closed 처리        |
| `activeKey` 상태 일관성은 DB만으로 불완전 |   중간 | service transaction에서 issue/revoke/consume 패턴을 강제하고 API inject로 검증            |
| token cleanup/retention job 미구현        |   중간 | API 완료 후 운영/retention slice에서 used/revoked/expired cleanup 정책 구현               |

## 12. 다음 작업 3단계 상세 미리보기

| 순서 | 다음 작업                                      | Subagent                                               | Model route           | 상세                                                                                                          |
| ---: | ---------------------------------------------- | ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------- |
|    1 | Credential token shared schema/helper 구현     | `backend_agent` + `security_reviewer` + `qa_agent`     | GPT-5.5 high          | `PASSWORD_TOKEN_SECRET`, HMAC hash helper, issue/revoke/verify/complete DTO, password policy, redaction tests |
|    2 | Activation/password reset API service 구현     | `backend_agent` + `architect_reviewer` + `db_reviewer` | GPT-5.5 high          | issue/revoke/verify/complete route, guard-before-validation, transaction, session revoke, AuditLog            |
|    3 | Web account access UI와 token-holder page 구현 | `frontend_agent` + `ui_runtime_validator` + `qa_agent` | GPT-5.5 medium + mini | staff detail `계정 접근` section, auth-side setup page, safe copy, 1586/1440/1280 E2E와 secret leak 검증      |
