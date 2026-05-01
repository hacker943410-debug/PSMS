# 작업 결과 보고

## 요약

- Playwright `globalSetup`을 추가해 E2E 실행 전 seed/session reset과 ADMIN/STAFF `storageState` 생성을 자동화했다.
- route guard E2E는 반복 UI 로그인 대신 role별 `storageState`를 재사용하도록 정리했다.
- E2E용 seed reset 스크립트를 추가해 seed 계정 비밀번호를 확정하고 seed user session을 정리한다.
- readOnly `TextInput`에서 Chromium hydration mismatch가 발생해 해당 입력에만 `suppressHydrationWarning`을 좁게 적용했다.
- Prisma schema, migration, Fastify API contract, RBAC 정책은 변경하지 않았다.

## 작업 분해

| 순서 | 작업                                 | 담당                  | 상태 |
| ---: | ------------------------------------ | --------------------- | ---- |
|    1 | 하네스/테스트/DB 문서 확인           | Main Codex            | 완료 |
|    2 | E2E acceptance 검토                  | QA subagent Nietzsche | 완료 |
|    3 | DB reset 안전성 검토                 | DB reviewer Gibbs     | 완료 |
|    4 | Playwright global setup 추가         | Main Codex            | 완료 |
|    5 | ADMIN/STAFF storageState 분리        | Main Codex            | 완료 |
|    6 | E2E seed/session reset 스크립트 추가 | Main Codex            | 완료 |
|    7 | hydration mismatch 수정              | Main Codex            | 완료 |
|    8 | 검증 및 완료율 산정                  | Main Codex            | 완료 |

## 모델 선택 이유

| 작업           | 모델/에이전트                      | 선택 이유                                                                          |
| -------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| 구현/통합/검증 | Main Codex                         | 파일 편집, Playwright 실행, 실패 원인 수정 루프가 필요했다.                        |
| E2E acceptance | `qa_agent` Nietzsche, GPT-5.5 high | auth/RBAC 브라우저 검증 기준과 storageState 리스크 검토가 필요했다.                |
| DB reset 검토  | `db_reviewer` Gibbs, GPT-5.5 high  | seed/session cleanup은 DB 상태와 직접 연결되므로 고신뢰 검토가 필요했다.           |
| Spark          | 미사용                             | 이번 범위는 auth/session/RBAC E2E 및 seed reset 인접 작업이라 Spark 금지 영역이다. |

## 전체 진행률 요약

| 기준               | 이전 완료율 | 현재 완료율/전체 | 변동 |
| ------------------ | ----------: | ---------------: | ---: |
| 전체 준비 포함     |         26% |       27% / 100% | +1%p |
| 실제 MVP 업무 기능 |          6% |        6% / 100% |  0%p |
| Frontend shell     |         46% |       47% / 100% | +1%p |
| Backend/domain     |         17% |       17% / 100% |  0%p |
| DB 기반 구축       |         55% |       56% / 100% | +1%p |
| Auth/RBAC 검증     |         68% |       70% / 100% | +2%p |
| QA/Validation 기반 |         20% |       24% / 100% | +4%p |

## Phase별 완료율 재산정

| Phase | 원본 목표                    | 이전 |  현재/전체 | 변동 | 근거                                                              |
| ----: | ---------------------------- | ---: | ---------: | ---: | ----------------------------------------------------------------- |
|     0 | 프로젝트 초기화/워크스페이스 |  82% | 83% / 100% | +1%p | Playwright setup/script 체계 보강                                 |
|     1 | 디자인 시스템/레이아웃       |  45% | 46% / 100% | +1%p | readOnly input hydration 안정화                                   |
|     2 | 인증/RBAC                    |  68% | 70% / 100% | +2%p | ADMIN/STAFF storageState 기반 route guard 검증 안정화             |
|     3 | 데이터 모델/Seed             |  55% | 56% / 100% | +1%p | E2E seed/session reset entrypoint 추가                            |
|     4 | 대시보드/리포트              |   8% |  8% / 100% |  0%p | 실제 기능 구현 없음                                               |
|     5 | 판매 관리/판매 등록          |   7% |  7% / 100% |  0%p | route 접근 검증만 유지                                            |
|     6 | 미수금/고객                  |   5% |  5% / 100% |  0%p | 실제 기능 구현 없음                                               |
|     7 | 일정/재고                    |   5% |  5% / 100% |  0%p | 실제 기능 구현 없음                                               |
|     8 | 관리자 설정                  |   9% |  9% / 100% |  0%p | route guard 유지                                                  |
|     9 | Export/QA/운영 보강          |  20% | 24% / 100% | +4%p | global setup, storageState, artifact ignore, runtime guard 안정화 |

## Task별 완료율

| Task                    | 이전 |   현재/전체 |   변동 | 비고                                                                 |
| ----------------------- | ---: | ----------: | -----: | -------------------------------------------------------------------- |
| Playwright global setup |   0% | 100% / 100% | +100%p | E2E 전 seed reset + storageState 생성                                |
| ADMIN storageState      |   0% | 100% / 100% | +100%p | `test/.auth/admin.json` 생성, gitignore 적용                         |
| STAFF storageState      |   0% | 100% / 100% | +100%p | `test/.auth/staff.json` 생성, gitignore 적용                         |
| E2E seed/session reset  |   0% |  70% / 100% |  +70%p | dev DB 기준 seed user session cleanup. 완전 격리 test DB는 다음 단계 |
| Route guard E2E 안정화  | 100% | 100% / 100% |    0%p | 기존 matrix 유지, 12/12 통과                                         |
| Hydration runtime guard |  70% |  85% / 100% |  +15%p | 실제 warning 발견 후 readOnly input만 보정                           |
| Storage artifact 보호   |   0% | 100% / 100% | +100%p | `test/.auth`, `test-results`, `playwright-report` ignore 확인        |

## Subagent별 결과

| 세부 작업      | Subagent  | Model        | 결과                                                                 | 산출물         | 검증           |
| -------------- | --------- | ------------ | -------------------------------------------------------------------- | -------------- | -------------- |
| E2E acceptance | Nietzsche | GPT-5.5 high | global setup, role별 storageState, logout 금지, 3 viewport 유지 권고 | 읽기 전용 분석 | 파일 수정 없음 |
| DB reset 검토  | Gibbs     | GPT-5.5 high | dev DB session/audit 누적 리스크 확인, 장기적으로 별도 test DB 권고  | 읽기 전용 분석 | 파일 수정 없음 |

## 변경 파일

| 파일                                                                                                  | 변경 내용                                                 | 담당       |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `package.json`                                                                                        | `test:e2e:seed` script 추가                               | Main Codex |
| `packages/db/package.json`                                                                            | `db:e2e:reset` script 추가                                | Main Codex |
| `packages/db/prisma/seed.ts`                                                                          | seed 로직을 `runSmokeAuthSeed()`로 재사용 가능하게 분리   | Main Codex |
| `packages/db/prisma/e2e-reset.ts`                                                                     | E2E seed 계정 upsert + seed user session cleanup 추가     | Main Codex |
| `playwright.config.ts`                                                                                | `globalSetup` 연결                                        | Main Codex |
| `test/e2e/global-setup.ts`                                                                            | E2E seed reset, API health, ADMIN/STAFF storageState 생성 | Main Codex |
| `test/e2e/support/psms-e2e.ts`                                                                        | E2E 공통 env/account/route/storageState helper 추가       | Main Codex |
| `test/e2e/route-guards.spec.ts`                                                                       | 반복 UI login 제거, role별 storageState 적용              | Main Codex |
| `apps/web/src/components/workspace/form-field.tsx`                                                    | readOnly input hydration warning 억제                     | Main Codex |
| `.gitignore`                                                                                          | `test/.auth`, Playwright artifact ignore                  | Main Codex |
| `docs/80_ai_harness/stage-1-playwright-storage-state-seed-reset-completion-report-20260501-185356.md` | 이번 완료 보고서                                          | Main Codex |

## 검증 결과

| 검증                         | 결과 | 근거                                                                        |
| ---------------------------- | ---: | --------------------------------------------------------------------------- |
| `pnpm test:e2e:seed`         | 통과 | 2회 연속 실행, 두 번째 deletedSeedSessions `0` 확인                         |
| `pnpm test:e2e:route-guards` | 통과 | 12 passed, global setup 포함                                                |
| `pnpm db:seed`               | 통과 | refactor 후 기존 seed entrypoint 정상                                       |
| `pnpm format:check`          | 통과 | All matched files use Prettier code style                                   |
| `pnpm lint`                  | 통과 | API `tsc --noEmit`, Web `eslint .`                                          |
| `pnpm typecheck`             | 통과 | shared/db/api/web `tsc --noEmit`                                            |
| `pnpm db:validate`           | 통과 | Prisma schema valid                                                         |
| `pnpm build`                 | 통과 | shared/db/api/web build, Next production build                              |
| `pnpm test:api:inject`       | 통과 | api auth inject smoke passed                                                |
| `pnpm test:smoke`            | 통과 | auth smoke, web route guard smoke passed                                    |
| `git diff --check`           | 통과 | whitespace error 없음. 기존 CRLF/LF warning만 출력                          |
| artifact ignore              | 통과 | `git check-ignore`로 `test/.auth`, `test-results`, `playwright-report` 확인 |
| 포트 확인                    | 통과 | PSMS Web `5273`, API `4273` listen. `5173/4173`은 다른 프로젝트 점유 유지   |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                             |
| ------------ | --------: | ---------------------------------------------------------------- |
| Auth         |        No | 인증 정책, cookie 옵션, session 검증 로직 변경 없음              |
| DB           | No schema | Prisma schema/migration 변경 없음. seed script entrypoint만 분리 |
| API contract |        No | Fastify route/response contract 변경 없음                        |

## 이슈/해결방법

| 이슈                              | 원인                                                                   | 해결                                                     | 재발 방지                                              |
| --------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `import.meta.url` 오류            | Playwright global setup 변환 환경과 helper의 ESM 처리 충돌             | workspace root를 `process.cwd()` 기반으로 단순화         | Playwright helper는 실행 cwd 기준으로 작성             |
| Windows `spawn EINVAL`            | `.cmd` 직접 spawn 처리 문제                                            | Windows에서 `cmd.exe /d /s /c`로 고정 명령 실행          | 동적 명령 조합 금지, seed reset 고정 명령만 실행       |
| readOnly input hydration mismatch | Chromium DOM의 `caret-color` style 차이가 React hydration warning 발생 | readOnly `TextInput`에만 `suppressHydrationWarning` 적용 | runtime guard 유지로 추가 hydration issue 발견 시 수정 |

## 남은 리스크

| 리스크                                           | 영향도 | 대응                                                             |
| ------------------------------------------------ | -----: | ---------------------------------------------------------------- |
| 완전 격리 test DB는 아직 미구현                  |   중간 | 다음 단계에서 API/Web test server를 별도 DB로 기동하는 구조 검토 |
| 현재 E2E reset은 dev DB seed user session을 삭제 |   중간 | seed user로 범위를 제한했고 schema/업무 테이블은 변경하지 않음   |
| AuditLog는 E2E/Smoke 실행 시 누적                |   낮음 | 별도 test DB 도입 시 cleanup 대상 포함                           |
| storageState에는 session cookie가 포함           |   높음 | `test/.auth` gitignore 적용 및 `git check-ignore` 확인           |
| route guard E2E는 mutation RBAC를 대체하지 않음  |   높음 | 다음 단계에서 API mutation RBAC/integration test 추가            |

## 작업 완료 보고 시 작업 예정 3단계

| 단계 | 작업                                                                           | 작업 예정자                                    | 모델/Spark                                        |
| ---: | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------- |
|    1 | API/Web test server를 `.tmp/e2e` SQLite DB로 띄우는 완전 격리 E2E harness 검토 | DB reviewer + DevOps/SRE reviewer + Main Codex | GPT-5.5, Spark 미사용                             |
|    2 | API mutation RBAC/integration test 확장: 직원/기초정보/정책 관리자 제한        | Backend subagent + Security reviewer           | GPT-5.5 backend/security, Spark 금지              |
|    3 | 디자인 gate screenshot matrix: dashboard/sales/sales-new 기준 이미지 비교 준비 | UI runtime validator + Spark UI iterator 보조  | GPT-5.4-mini runtime, Spark는 정적 UI/문서 보조만 |
