# Smoke/Auth Seed Implementation Completion Report

작성일: 2026-04-30

## 요약

현재 하네스 기준으로 smoke/auth seed script를 구현하고 실행했다. 범위는 `Store` 1개, `ADMIN` 1명, `STAFF` 1명으로 제한했다. `Session`, 거래, 수납, 재고, 고객, 정책, AuditLog seed는 생성하지 않았다.

전체 프로젝트 개발 예정 대비 현재 완료율은 **약 21% / 100%**로 재산정한다. 실제 MVP 업무 기능 기준은 여전히 약 9~10% 수준이다.

## 전체 진행률 요약

| 기준               | 현재 완료율 | 판단 근거                                                        |
| ------------------ | ----------: | ---------------------------------------------------------------- |
| 전체 준비 포함     |         21% | 하네스, 앱 골격, Prisma migration, smoke/auth seed까지 완료      |
| 실제 MVP 업무 기능 |       9~10% | 실제 login/RBAC, Server Action, 도메인 workflow는 미구현         |
| Frontend shell     |         35% | Shell/Sidebar/placeholder route는 있으나 Drawer/Form/Filter 부족 |
| Backend/domain     |          5% | Prisma wrapper와 seed만 있음. action/query/service 미구현        |
| DB 기반 구축       |         55% | schema/migration/dev DB/smoke seed 완료. master/QA seed 미구현   |

## Phase별 완료율 재산정

| Phase | 원본 목표              | 현재 상태                                                                                  | 완료율 |
| ----: | ---------------------- | ------------------------------------------------------------------------------------------ | -----: |
|     0 | 프로젝트 초기화        | Next/TS/Tailwind/Prisma/SQLite/검증 스크립트 대부분 완료. README, test script 부족         |    82% |
|     1 | 디자인 시스템/레이아웃 | Shell, Sidebar, PageIntro, Panel, MetricCard, DataTable, TonePill 완료. Drawer 등 미구현   |    35% |
|     2 | 인증/RBAC              | User/Session schema, login UI skeleton, password helper 있음. 실제 login/session/RBAC 없음 |    25% |
|     3 | 데이터 모델/Seed       | Prisma schema, migration, dev DB, smoke/auth seed 완료. master/QA seed 없음                |    55% |
|     4 | 대시보드/리포트        | route와 placeholder만 있음. query/KPI/chart/export 없음                                    |     5% |
|     5 | 판매 관리/판매 등록    | `/sales`, `/sales/new` placeholder. Wizard/transaction 없음                                |     3% |
|     6 | 미수금/고객            | route placeholder만 있음. 수납/취소/상세/이력 없음                                         |     3% |
|     7 | 일정/재고              | route placeholder만 있음. 캘린더/재고 등록/상태변경 없음                                   |     3% |
|     8 | 관리자 설정            | staffs/base/policies placeholder. CRUD/정책 활성화/백업 없음                               |     3% |
|     9 | Export/QA/운영 보강    | 운영 문서 일부와 build 검증은 있음. Export/AuditLog/test/deploy 미구현                     |     5% |

## 작업 분해

| 단계 | 작업                                         | 담당                               | 결과 |
| ---: | -------------------------------------------- | ---------------------------------- | ---- |
|    1 | 하네스/seed 정책/schema/package 재확인       | Main                               | 완료 |
|    2 | DB/security reviewer 자동 위임               | `db_reviewer`, `security_reviewer` | 완료 |
|    3 | `tsx` seed runner 및 pnpm script 추가        | Main                               | 완료 |
|    4 | password hash helper 구현                    | Main                               | 완료 |
|    5 | smoke/auth seed script 구현                  | Main                               | 완료 |
|    6 | env 미설정 실패, seed 실행, idempotency 검증 | Main                               | 완료 |
|    7 | reviewer 지적사항 반영                       | Main                               | 완료 |
|    8 | 상태 문서/checklist/완료 보고서 갱신         | Main                               | 완료 |

## Subagent별 결과

| 세부 작업                 | Subagent            | Model   | 결과                                                                          | 산출물 | 검증      |
| ------------------------- | ------------------- | ------- | ----------------------------------------------------------------------------- | ------ | --------- |
| DB/idempotency review     | `db_reviewer`       | GPT-5.5 | PASS. upsert transaction, count idempotency, schema/API 무변경 확인           | 리뷰   | read-only |
| Auth seed security review | `security_reviewer` | GPT-5.5 | PASS. env password, production 차단, Session 미생성 확인. 추가 hardening 제안 | 리뷰   | read-only |

## 모델 선택 이유

| 모델    | 사용 여부 | 이유                                                                            |
| ------- | --------- | ------------------------------------------------------------------------------- |
| GPT-5.5 | 사용      | Prisma seed, password hash, auth seed, DB idempotency는 하네스상 GPT-5.5 영역   |
| Spark   | 미사용    | Spark는 UI/단순 작업 전용이며 auth/DB/seed/password/session 수정 금지           |
| mini    | 미사용    | 문서 보조에는 가능하지만 이번 작업은 auth/DB 보안 경계가 포함되어 사용하지 않음 |

## 변경 파일

| 파일                                                                     | 변경 내용                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `package.json`                                                           | `db:seed`, `seed` script 추가, `tsx` dev dependency, `esbuild` build 허용 |
| `pnpm-lock.yaml`                                                         | `tsx` dependency 반영                                                     |
| `.env.example`                                                           | seed password/reset env placeholder 추가                                  |
| `src/lib/auth/password.ts`                                               | `scrypt` 기반 password hash/verify helper 추가 및 strict parser           |
| `prisma/seed.ts`                                                         | Store/Admin/Staff smoke seed 구현, local DB allowlist, reset target guard |
| `dev.db`                                                                 | smoke `Store=1`, `User=2` row 생성                                        |
| `docs/00_system/project-current-state.md`                                | seed 구현 상태와 완료율 21% 반영                                          |
| `docs/00_system/smoke-auth-seed-policy.md`                               | 구현 결과와 hardening 정책 반영                                           |
| `docs/00_system/prisma-schema-review-checklist.md`                       | seed checklist 완료 상태와 구현 결과 추가                                 |
| `docs/80_ai_harness/smoke-auth-seed-implementation-completion-report.md` | 이번 작업 완료 보고서 추가                                                |

## 실행 결과

| 항목               | 결과                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| env 미설정 실행    | 실패 처리 정상. seed password 필수                                        |
| production guard   | `NODE_ENV`, `VERCEL_ENV`, `APP_ENV` production 값이면 실패                |
| DB allowlist       | `DATABASE_URL`은 `file:./dev.db`만 허용                                   |
| store code guard   | `PSMS_SEED_STORE_CODE`는 `SMOKE_` prefix 필수                             |
| reset target guard | `SEED_RESET_PASSWORDS=true`이면 `SEED_RESET_PASSWORD_EMAILS` 대상 필수    |
| seed 재실행        | `Store=1`, smoke `User=2` 유지                                            |
| password overwrite | reset target 없을 때 hash 불변                                            |
| password format    | `scrypt$...`                                                              |
| forbidden tables   | `Session`, sale/payment/receivable/inventory/customer/policy/AuditLog 0건 |
| build scripts      | `pnpm ignored-builds` = `None`                                            |

## 검증 결과

| 검증                | 결과 | 근거                                                     |
| ------------------- | ---: | -------------------------------------------------------- |
| Format              | 통과 | `pnpm format:check`                                      |
| Prisma schema       | 통과 | `pnpm db:validate`                                       |
| Prisma Client       | 통과 | `pnpm db:generate`                                       |
| Migration status    | 통과 | `pnpm exec prisma migrate status`: schema up to date     |
| Seed env gate       | 통과 | env password 미설정 시 실패                              |
| Seed execution      | 통과 | 임시 env password로 `pnpm db:seed` 성공                  |
| Seed idempotency    | 통과 | 재실행 후 `Store=1`, smoke `User=2`, hash 불변           |
| Password helper     | 통과 | hash format, correct password true, wrong password false |
| Hardening gates     | 통과 | production/local DB/store prefix/reset target guard      |
| Build script policy | 통과 | `pnpm ignored-builds` = `None`                           |
| Lint                | 통과 | `pnpm lint`                                              |
| Typecheck           | 통과 | `pnpm typecheck`                                         |
| Build               | 통과 | `pnpm build`                                             |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                                |
| ------------ | --------: | ------------------------------------------------------------------- |
| Auth         |       Yes | password hash helper 추가. login/session/RBAC flow 구현은 없음      |
| DB           |       Yes | schema/migration 변경 없음. smoke seed row `Store=1`, `User=2` 생성 |
| API contract |        No | Server Action/Route Handler/API contract 변경 없음                  |

## 이슈/해결방법

| 이슈                              | 원인                              | 해결                                                                  | 재발 방지                                 |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| `@prisma/client` 기본 import 실패 | Prisma custom output 사용         | `tsx`로 generated TS client 직접 실행                                 | seed runner를 `tsx prisma/seed.ts`로 고정 |
| `esbuild` ignored build           | `tsx` dependency postinstall 차단 | `pnpm.onlyBuiltDependencies`에 추가                                   | `pnpm ignored-builds` 검증 유지           |
| `scrypt` promisify 타입 오류      | Node overload type mismatch       | 명시적 Promise wrapper 구현                                           | auth helper typecheck 유지                |
| reviewer hardening 지적           | 초기 guard가 최소 수준            | env 정규화, local DB allowlist, reset target, strict hash parser 추가 | seed/security checklist 유지              |

## 남은 리스크

| 리스크                         | 영향도 | 대응                                                               |
| ------------------------------ | -----: | ------------------------------------------------------------------ |
| 실제 login/session/RBAC 미구현 |   High | 다음 단계에서 security/backend 경로로 구현                         |
| scrypt 유지 여부 최종 미확정   | Medium | auth implementation gate에서 scrypt 유지 또는 argon2/bcrypt 검토   |
| master/QA seed 미구현          | Medium | smoke seed와 별도 phase로 master/inventory/customer/sale seed 작성 |
| 테스트 스크립트 없음           | Medium | Vitest/RTL/Playwright 도입 단계에서 `pnpm test` 복구               |
| AuditLog 정책 미구현           |   High | Server Action 구현 전 audit target/redaction 정책 확정             |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                        | Subagent                               | Model   | 상세                                                                     |
| ---: | --------------------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------ |
|    1 | Auth/session 구현 preflight | `security_reviewer` + `backend_agent`  | GPT-5.5 | password helper 유지 여부, cookie/session, login/logout action 범위 확정 |
|    2 | Login/logout + session 구현 | `backend_agent` + `security_reviewer`  | GPT-5.5 | `requireSession`, `loginAction`, `logoutAction`, sessionTokenHash 저장   |
|    3 | Workspace RBAC guard 연결   | `frontend_agent` + `security_reviewer` | GPT-5.5 | layout/page guard, sidebar ADMIN/STAFF 메뉴 필터, 403 route              |

## 결론

Smoke/auth seed 구현은 통과했다. 현재 DB에는 smoke용 매장 1개와 ADMIN/STAFF 계정 2개만 추가되었고, 금지된 업무/세션/정책 데이터는 생성되지 않았다.
