# Smoke/Auth Seed Policy Completion Report

작성일: 2026-04-30

## 요약

Prisma initial migration이 `dev.db`에 적용된 상태에서, 다음 seed 구현 전에 필요한 smoke seed/auth seed 정책을 수립했다. 이번 작업은 문서 gate이며 실제 seed script, DB row 생성, password hash 생성, session 생성은 수행하지 않았다.

전체 프로젝트 개발 예정 대비 현재 완료율은 약 20% / 100%로 유지한다. DB schema 적용은 완료되었지만 seed 실행, auth/session, Server Action, 도메인 기능, Export, E2E는 아직 미구현이다.

## 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router, workspace route group, 정적 placeholder route, Workspace UI 1차 세트            |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories` placeholder 중심. 실제 업무 로직 미구현 |
| DB             | Prisma 7.8, SQLite `dev.db`, initial migration 적용 완료. 업무 table 22개, index 55개               |
| 인증           | Credentials + DB-backed opaque session 방향 결정. 실제 auth/session/RBAC 미구현                     |
| API 구조       | Server Actions 중심 계획. 실제 Server Action/API contract 구현 미구현                               |
| 주요 기능 상태 | 하네스, 앱 골격, Prisma schema/migration 적용 완료. 실제 업무 도메인 기능은 미구현                  |

## 작업 분해

| 단계 | 작업                                           | 담당                | 결과 |
| ---: | ---------------------------------------------- | ------------------- | ---- |
|    1 | 하네스/상태/schema 문서 재확인                 | Main                | 완료 |
|    2 | backend seed scope 검토 자동 위임              | `backend_agent`     | 완료 |
|    3 | auth seed 보안 정책 검토 자동 위임             | `security_reviewer` | 완료 |
|    4 | smoke/auth seed 정책 문서 작성                 | Main                | 완료 |
|    5 | project current state 및 schema checklist 갱신 | Main                | 완료 |
|    6 | 문서 포맷/DB/schema/build 검증                 | Main                | 완료 |

## Subagent 배정

| 세부 작업                    | Subagent            | Model   | Reasoning | 권한      | 결과 요약                                          |
| ---------------------------- | ------------------- | ------- | --------- | --------- | -------------------------------------------------- |
| Smoke seed scope/idempotency | `backend_agent`     | GPT-5.5 | high      | Read-only | Store 1, ADMIN 1, STAFF 1 최소 seed와 upsert 기준  |
| Auth seed security policy    | `security_reviewer` | GPT-5.5 | high      | Read-only | plaintext/hash/session seed 금지와 env secret 원칙 |

## 모델 선택 이유

| 모델    | 사용 여부 | 이유                                                                                |
| ------- | --------- | ----------------------------------------------------------------------------------- |
| GPT-5.5 | 사용      | seed, auth, password, session, DB 정합성은 하네스상 GPT-5.5 검토 대상               |
| Spark   | 미사용    | Spark는 UI/정적 Tailwind/단순 문서 작업 전용이며 auth/DB/seed/session 수정 금지     |
| mini    | 미사용    | 문서 정리는 가능하지만 이번 결정은 password/auth/DB 정책을 포함하므로 사용하지 않음 |

## 실행 결과

| 항목             | 결과                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| Policy 문서      | `docs/00_system/smoke-auth-seed-policy.md` 생성                       |
| Smoke seed scope | `Store` 1개, `ADMIN` 1명, `STAFF` 1명으로 제한                        |
| Upsert 기준      | `Store.code`, `User.email`                                            |
| Password 정책    | 평문/정적 hash/repo 커밋 금지. 실행 시 shared hash helper 사용        |
| Session 정책     | `Session` seed 금지. login flow에서만 생성                            |
| Excluded tables  | sale, payment, receivable, inventory, customer, policy, AuditLog 제외 |
| DB 변경          | 없음                                                                  |
| Auth/API 변경    | 없음                                                                  |
| 완료율           | 약 20% / 100% 유지                                                    |

## 변경 파일

| 파일                                                             | 변경 내용                                 |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `docs/00_system/smoke-auth-seed-policy.md`                       | smoke/auth seed 정책 문서 신규 작성       |
| `docs/00_system/project-current-state.md`                        | seed 정책 수립 상태와 다음 단계 갱신      |
| `docs/00_system/prisma-schema-review-checklist.md`               | Seed checklist policy status 및 결과 추가 |
| `docs/80_ai_harness/smoke-auth-seed-policy-completion-report.md` | 이번 작업 완료 보고서 신규 작성           |

## 검증 결과

| 검증             | 결과 | 비고                                                                        |
| ---------------- | ---- | --------------------------------------------------------------------------- |
| 문서 포맷        | 통과 | `pnpm exec prettier --write ...`, `pnpm format:check`                       |
| Prisma schema    | 통과 | `pnpm db:validate`                                                          |
| Migration status | 통과 | `pnpm exec prisma migrate status`: database schema up to date               |
| DB row safety    | 통과 | seed 미실행. `Store`, `User`, `Session`, 핵심 업무/정책 table row count 0건 |
| Lint             | 통과 | `pnpm lint`                                                                 |
| Typecheck        | 통과 | `pnpm typecheck`                                                            |
| Build            | 통과 | `pnpm build`                                                                |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                      |
| ------------ | --------: | --------------------------------------------------------- |
| Auth         |        No | auth 구현, password helper, session/cookie 코드 변경 없음 |
| DB           |        No | seed row 생성, schema/migration 변경 없음                 |
| API contract |        No | Server Action/API contract 변경 없음                      |

## 남은 리스크

| 리스크                             | 영향도 | 대응                                                                    |
| ---------------------------------- | -----: | ----------------------------------------------------------------------- |
| password hash 알고리즘/cost 미확정 |   High | auth implementation gate에서 bcrypt cost 12 이상 또는 argon2id 확정     |
| seed password env 미구현           | Medium | seed script 구현 시 local/CI secret env와 production 차단 추가          |
| Session/login flow 미구현          |   High | auth/session 구현 preflight 후 loginAction/logoutAction 구현            |
| 업무 데이터 seed 없음              | Medium | master/inventory/customer/sale/receivable seed는 별도 phase로 분리      |
| STAFF 권한 상세 일부 미확정        |   High | STAFF 판매 취소, 수납 취소, 전체 매장 Export는 기본 ADMIN 전용으로 시작 |

## 다음 작업 3단계 상세 미리보기

| 단계 | 작업                         | Subagent                              | Model   | 상세                                                                  |
| ---: | ---------------------------- | ------------------------------------- | ------- | --------------------------------------------------------------------- |
|    1 | Seed script 구현 및 env gate | `backend_agent` + `db_reviewer`       | GPT-5.5 | Prisma seed script, Store/User upsert, transaction, production 차단   |
|    2 | Seed idempotency 검증        | `qa_agent` + `db_reviewer`            | GPT-5.5 | seed 2회 실행 count 안정성, 금지 table 0건, migrate status clean 확인 |
|    3 | Auth/session 구현 preflight  | `security_reviewer` + `backend_agent` | GPT-5.5 | password helper, cookie/session, login/logout action, RBAC guard 범위 |

## 작업 완료 보고 예시

```txt
작업명: Smoke/Auth Seed Policy
완료율: 약 20% / 100%
사용 subagent: backend_agent(GPT-5.5), security_reviewer(GPT-5.5)
변경 파일: docs/00_system/smoke-auth-seed-policy.md 외 3개
Auth/DB/API 변경: 없음
검증: format, db:validate, migrate status, lint, typecheck, build
다음 작업: seed script 구현 및 idempotency 검증
```

## 결론

Smoke/auth seed 정책은 `Store` 1개, `ADMIN` 1명, `STAFF` 1명으로 제한하는 방향으로 확정했다. 실제 seed 구현은 다음 단계에서 GPT-5.5 경로의 backend/DB/security review를 유지하며 진행한다.
