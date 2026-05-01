# 작업 결과 보고

## 요약

- `.tmp/e2e/psms-e2e.db` 전용 SQLite reset/migrate/seed 하네스를 추가했다.
- reset은 `.tmp/e2e` 내부 경로만 허용하고 `packages/db/dev.db` hash 불변을 검증한다.
- `prisma migrate deploy`, `migrate status`, seed, `PRAGMA quick_check`, `foreign_key_check`, catalog/unique index 검증을 한 번에 수행한다.
- managed E2E runner를 추가했지만, 현재 Web `5273`과 API `4273`이 이미 점유 중이라 full managed 실행은 fail-fast 대상이다.
- Prisma schema, migration SQL, Fastify API contract, auth/RBAC 정책은 변경하지 않았다.

## 작업 분해

| 순서 | 작업                                                | 담당                      | 상태 |
| ---: | --------------------------------------------------- | ------------------------- | ---- |
|    1 | 하네스/포트/DB/E2E 상태 확인                        | Main Codex                | 완료 |
|    2 | DB 격리 reset 기준 검토                             | DB reviewer Jason         | 완료 |
|    3 | 포트/managed runner 안전성 검토                     | DevOps/SRE reviewer Godel | 완료 |
|    4 | seed guard를 dev DB + 명시 허용 DB 구조로 확장      | Main Codex                | 완료 |
|    5 | `.tmp/e2e` DB reset/migrate/seed/검증 스크립트 추가 | Main Codex                | 완료 |
|    6 | managed E2E runner와 preflight script 추가          | Main Codex                | 완료 |
|    7 | 검증 실행 및 완료율 산정                            | Main Codex                | 완료 |

## 모델 선택 이유

| 작업                     | 모델/에이전트                             | 선택 이유                                                              |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| 구현/통합/검증           | Main Codex                                | 파일 편집, Prisma/Playwright 스크립트 실행, 실패 원인 수정이 필요했다. |
| DB reset 검토            | `db_reviewer` Jason, GPT-5.5 high         | DB 파일 삭제, migration, seed는 데이터 훼손 방지가 중요하다.           |
| 포트/managed runner 검토 | `devops_sre_reviewer` Godel, GPT-5.5 high | 기존 서버 점유, 포트 정책, child process cleanup은 운영 리스크가 크다. |
| Spark                    | 미사용                                    | DB/seed/port/env/auth 인접 작업이라 Spark 금지 영역이다.               |

## 전체 진행률 요약

| 기준               | 이전 완료율 | 현재 완료율/전체 | 변동 |
| ------------------ | ----------: | ---------------: | ---: |
| 전체 준비 포함     |         27% |       28% / 100% | +1%p |
| 실제 MVP 업무 기능 |          6% |        6% / 100% |  0%p |
| Frontend shell     |         47% |       47% / 100% |  0%p |
| Backend/domain     |         17% |       17% / 100% |  0%p |
| DB 기반 구축       |         56% |       59% / 100% | +3%p |
| Auth/RBAC 검증     |         70% |       70% / 100% |  0%p |
| QA/Validation 기반 |         24% |       27% / 100% | +3%p |

## Phase별 완료율 재산정

| Phase | 원본 목표                    | 이전 |  현재/전체 | 변동 | 근거                                               |
| ----: | ---------------------------- | ---: | ---------: | ---: | -------------------------------------------------- |
|     0 | 프로젝트 초기화/워크스페이스 |  83% | 84% / 100% | +1%p | managed E2E script/preflight 추가                  |
|     1 | 디자인 시스템/레이아웃       |  46% | 46% / 100% |  0%p | 화면 구현 변경 없음                                |
|     2 | 인증/RBAC                    |  70% | 70% / 100% |  0%p | 정책/guard 변경 없음                               |
|     3 | 데이터 모델/Seed             |  56% | 59% / 100% | +3%p | `.tmp/e2e` DB migrate/seed/reset 검증 추가         |
|     4 | 대시보드/리포트              |   8% |  8% / 100% |  0%p | 실제 기능 구현 없음                                |
|     5 | 판매 관리/판매 등록          |   7% |  7% / 100% |  0%p | 실제 기능 구현 없음                                |
|     6 | 미수금/고객                  |   5% |  5% / 100% |  0%p | 실제 기능 구현 없음                                |
|     7 | 일정/재고                    |   5% |  5% / 100% |  0%p | 실제 기능 구현 없음                                |
|     8 | 관리자 설정                  |   9% |  9% / 100% |  0%p | 실제 기능 구현 없음                                |
|     9 | Export/QA/운영 보강          |  24% | 27% / 100% | +3%p | isolated DB reset, preflight, artifact ignore 검증 |

## Task별 완료율

| Task                     | 이전 |   현재/전체 |   변동 | 비고                                                 |
| ------------------------ | ---: | ----------: | -----: | ---------------------------------------------------- |
| `.tmp/e2e` DB path guard |   0% | 100% / 100% | +100%p | `.tmp/e2e` 내부만 허용, `dev.db` 금지                |
| E2E DB migrate deploy    |   0% | 100% / 100% | +100%p | 빈 DB 파일 선생성 후 deploy/status 통과              |
| E2E seed idempotency     |   0% |  90% / 100% |  +90%p | reset 2회 연속 deterministic fingerprint 확인        |
| DB integrity check       |   0% | 100% / 100% | +100%p | quick/foreign key/catalog/unique index 검증          |
| dev DB 훼손 방지         |   0% | 100% / 100% | +100%p | reset 전후 `dev.db` hash 동일 확인                   |
| Managed E2E runner       |   0% |  45% / 100% |  +45%p | script/preflight 추가. full run은 포트 점유로 미실행 |
| 기존 route guard E2E     | 100% | 100% / 100% |    0%p | 12/12 재통과                                         |

## Subagent별 결과

| 세부 작업           | Subagent | Model        | 결과                                                                      | 산출물         | 검증           |
| ------------------- | -------- | ------------ | ------------------------------------------------------------------------- | -------------- | -------------- |
| DB reset 안전성     | Jason    | GPT-5.5 high | `.tmp/e2e` allowlist, `dev.db` hash/mtime, catalog/unique index 검증 권고 | 읽기 전용 분석 | 파일 수정 없음 |
| 포트/managed runner | Godel    | GPT-5.5 high | `5273/4273` 점유 시 fail-fast, 기존 서버 자동 종료 금지 권고              | 읽기 전용 분석 | 파일 수정 없음 |

## 변경 파일

| 파일                                                                                      | 변경 내용                                                                  | 담당       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| `package.json`                                                                            | `test:e2e:db:reset`, `test:e2e:managed`, `test:e2e:managed:preflight` 추가 | Main Codex |
| `packages/db/package.json`                                                                | `db:e2e:isolated-reset` 추가                                               | Main Codex |
| `packages/db/prisma/seed.ts`                                                              | `runSmokeAuthSeed()`에 명시 허용 DB URL 옵션 추가                          | Main Codex |
| `packages/db/prisma/e2e-isolated-reset.ts`                                                | `.tmp/e2e` DB reset/migrate/seed/integrity 검증 추가                       | Main Codex |
| `test/e2e/global-setup.ts`                                                                | isolated mode와 seed reset skip env 처리                                   | Main Codex |
| `test/e2e/managed-runner.mjs`                                                             | 포트 preflight, managed API/Web/Playwright runner 추가                     | Main Codex |
| `.gitignore`                                                                              | `.tmp` ignore 추가                                                         | Main Codex |
| `docs/80_ai_harness/stage-1-isolated-e2e-db-harness-completion-report-20260501-190649.md` | 이번 완료 보고서                                                           | Main Codex |

## 검증 결과

| 검증                               | 결과 | 근거                                                   |
| ---------------------------------- | ---: | ------------------------------------------------------ |
| `pnpm test:e2e:db:reset`           | 통과 | 2회 이상 연속 통과, `devDbUnchanged: true`             |
| `pnpm test:e2e:managed:preflight`  | 통과 | `5273/4273` 점유 확인, `canRunManaged: false`          |
| `pnpm test:e2e:route-guards`       | 통과 | 12 passed, 기존 서버 재사용 smoke                      |
| `pnpm db:seed`                     | 통과 | 기존 dev seed entrypoint 유지                          |
| `pnpm format:check`                | 통과 | All matched files use Prettier code style              |
| `pnpm db:validate`                 | 통과 | Prisma schema valid                                    |
| `pnpm --filter @psms/db typecheck` | 통과 | DB package typecheck                                   |
| `pnpm lint`                        | 통과 | API `tsc`, Web `eslint`                                |
| `pnpm typecheck`                   | 통과 | shared/db/api/web                                      |
| `pnpm build`                       | 통과 | shared/db/api/web build                                |
| `pnpm test:api:inject`             | 통과 | api auth inject smoke passed                           |
| `pnpm test:smoke`                  | 통과 | auth smoke, web route guard smoke passed               |
| `git diff --check`                 | 통과 | whitespace error 없음. 기존 CRLF/LF warning만 출력     |
| artifact ignore                    | 통과 | `.tmp`, `test/.auth`, Playwright artifacts ignore 확인 |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                           |
| ------------ | --------: | -------------------------------------------------------------- |
| Auth         |        No | 인증 방식, cookie, RBAC 정책 변경 없음                         |
| DB           | No schema | Prisma schema/migration SQL 변경 없음. E2E reset script만 추가 |
| API contract |        No | Fastify route/response contract 변경 없음                      |

## 이슈/해결방법

| 이슈                                                       | 원인                                                               | 해결                                                             | 재발 방지                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| 새 SQLite 파일에서 `migrate deploy` 빈 schema-engine error | Prisma 7.8 on Windows가 존재하지 않는 SQLite 파일에 deploy 시 실패 | 허용 경로 삭제 후 빈 DB 파일을 먼저 생성하고 deploy 실행         | reset script에 파일 선생성 고정           |
| full managed E2E 미실행                                    | 현재 `5273/4273`이 기존 PSMS 서버로 점유 중                        | 기존 프로세스 종료 없이 preflight에서 `canRunManaged:false` 보고 | full managed는 포트가 비었을 때만 실행    |
| seed guard 확장 후 typecheck 실패                          | `DATABASE_URL` 타입 narrowing 부족                                 | assertion 함수로 `assertDatabaseUrl` 보정                        | DB package typecheck를 필수 검증으로 유지 |

## 남은 리스크

| 리스크                                                | 영향도 | 대응                                                           |
| ----------------------------------------------------- | -----: | -------------------------------------------------------------- |
| full managed E2E는 아직 실제 실행 전                  |   중간 | `5273/4273`이 비어 있는 상태에서 `pnpm test:e2e:managed` 실행  |
| managed runner가 spawn한 child cleanup은 검증 전      |   중간 | full run 시 child PID tree cleanup, 로그, timeout 검증         |
| `.tmp/e2e` DB는 auth seed만 포함                      |   낮음 | acceptance seed 확장 단계에서 매장/직원/재고/판매 fixture 추가 |
| Playwright existing-server 모드와 managed 모드가 공존 |   낮음 | 보고서와 script 이름으로 isolated/non-isolated 구분 유지       |

## 작업 완료 보고 시 작업 예정 3단계

| 단계 | 작업                                                                                  | 작업 예정자                                             | 모델/Spark                                        |
| ---: | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
|    1 | 포트가 비어 있는 상태에서 `pnpm test:e2e:managed` full run 검증 및 child cleanup 보강 | DevOps/SRE reviewer + UI runtime validator + Main Codex | GPT-5.5/GPT-5.4-mini, Spark 미사용                |
|    2 | API mutation RBAC/integration test 확장: 직원/기초정보/정책 관리자 제한               | Backend subagent + Security reviewer                    | GPT-5.5 backend/security, Spark 금지              |
|    3 | 디자인 gate screenshot matrix: dashboard/sales/sales-new 기준 이미지 비교 준비        | UI runtime validator + Spark UI iterator 보조           | GPT-5.4-mini runtime, Spark는 정적 UI/문서 보조만 |
