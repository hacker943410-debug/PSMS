# Smoke/Auth Seed Policy

작성일: 2026-04-30

## 1. 목적

초기 Prisma migration이 실제 개발 DB `dev.db`에 적용된 뒤, 실제 seed script를 만들기 전에 auth/DB/API contract를 훼손하지 않는 최소 seed 기준을 확정한다.

이번 문서는 정책 gate 산출물로 시작했고, 이후 동일 기준으로 smoke/auth seed script까지 구현했다.

## 2. 현재 기준 상태

| 항목           | 상태                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| 개발 DB        | SQLite `dev.db`에 initial migration 적용 완료                           |
| 업무 table     | 22개 생성, 현재 업무 table row는 0건                                    |
| 인증 구현      | 미구현. Credentials 직접 구현 + DB-backed opaque session 방향만 결정됨  |
| Session table  | schema에 존재하지만 활성 session row 사전 생성 금지                     |
| API 구조       | Server Actions 중심 계획. seed 작업으로 API contract를 변경하지 않음    |
| 현재 완료율    | 전체 개발 예정 대비 약 21% / 100%                                       |
| 이번 작업 범위 | smoke seed/auth seed 정책 수립 및 구현. QA/master seed는 별도 단계 대상 |

## 3. Smoke/Auth Seed 허용 범위

최소 smoke seed는 로그인/RBAC 이후 흐름을 검증하기 위한 계정과 매장만 포함한다.

| 대상    | 최소 수량 | Unique 기준 | 필수 정책                                                 |
| ------- | --------: | ----------- | --------------------------------------------------------- |
| `Store` |         1 | `code`      | `status=ACTIVE`, local/dev smoke 전용 code 사용           |
| `User`  |         1 | `email`     | `role=ADMIN`, `status=ACTIVE`, `passwordHash`만 저장      |
| `User`  |         1 | `email`     | `role=STAFF`, `status=ACTIVE`, 활성 `Store`에 반드시 연결 |
| Session |         0 | 해당 없음   | seed로 만들지 않음. 실제 login flow에서만 생성            |

권장 local-only 식별자는 `@psms.local` 도메인과 smoke 전용 store code를 사용한다. 실제 비밀번호와 실제 로그인 가능한 password hash는 repo, 문서, migration, 로그에 남기지 않는다.

## 4. Seed 제외 범위

Auth smoke seed에서는 아래 데이터를 생성하지 않는다.

| 제외 대상                                                                              | 제외 이유                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Session`                                                                              | 세션은 login flow가 생성해야 하며 DB에는 token hash만 저장 |
| `Sale`, `SaleAddOn`, `Receivable`, `Payment`                                           | 금액, 잔액, 상태 전환, transaction 정합성 영역             |
| `InventoryItem`                                                                        | 재고 상태 전환과 중복 판매 방지 검증이 필요                |
| `Customer`, `CustomerMemo`, `ManualSchedule`                                           | 개인정보/업무 데이터 seed 정책이 별도로 필요               |
| `SaleProfitPolicy`, `StaffCommissionPolicy`, `DiscountPolicy`, `CarrierActivationRule` | 정책 활성화, 기간 충돌, 이력 보존 review 필요              |
| `AuditLog`                                                                             | seed 실행 감사 정책 확정 전 임의 생성 금지                 |
| QA acceptance 대량 데이터                                                              | smoke seed 이후 별도 seed phase에서 분리                   |

## 5. Password/Auth Seed 보안 정책

| 항목              | 정책                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| 비밀번호 원문     | repo, docs, seed 파일, migration, log, AuditLog 저장 금지                                   |
| password hash     | 실제 seed 실행 시점에 shared `hashPassword()` helper로 생성. 정적 hash 커밋 금지            |
| hash 알고리즘     | 현재 seed helper는 Node `crypto.scrypt`를 사용. auth implementation gate에서 유지/교체 검토 |
| seed password env | local/CI secret env에서만 주입. 예: `PSMS_SEED_ADMIN_PASSWORD`, `PSMS_SEED_STAFF_PASSWORD`  |
| env 미설정        | 구현 시 실패 또는 1회성 랜덤 생성 정책 중 하나를 security gate에서 확정                     |
| production        | auth 계정 seed 생성 금지. `NODE_ENV`, `VERCEL_ENV`, `APP_ENV`는 trim/lowercase 후 확인      |
| 로그 출력         | email, role, store 정도만 허용. password/hash/token 출력 금지                               |
| 세션              | 활성 session seed 금지. expired/revoked session fixture는 isolated test DB에서만 허용       |

`AUTH_SECRET`, session token salt, 실제 seed password, 실제 로그인 가능한 hash는 모두 credential로 취급한다.

## 6. RBAC Seed 정책

| 항목       | 정책                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| Role       | `ADMIN`, `STAFF`만 사용                                                             |
| ADMIN      | `status=ACTIVE`. `storeId`는 nullable 가능하지만 서버 guard에서 전체 매장 권한 검증 |
| STAFF      | `status=ACTIVE`, `storeId` 필수, 활성 Store에 연결                                  |
| STAFF 금지 | 직원 관리, 기초정보, 정책 관리, 백업, 복원                                          |
| 모호 권한  | 판매 취소, 수납 취소, 재고 삭제, 전체 매장 Export는 MVP 기본값으로 `ADMIN` 전용     |
| Export     | ADMIN 전체, STAFF 소속 매장 범위 제한                                               |

STAFF 권한이 애매한 경우 더 제한적인 정책을 선택한다.

## 7. Idempotency 정책

| 항목               | 정책                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| upsert key         | `Store.code`, `User.email`                                                                               |
| 재실행 안정성      | seed 2회 이상 실행해도 `Store`와 `User` count가 계속 증가하면 안 됨                                      |
| password overwrite | 기본 금지. 기존 seeded user의 `passwordHash`를 덮어쓰지 않음                                             |
| password reset     | local/dev에서 `SEED_RESET_PASSWORDS=true`와 `SEED_RESET_PASSWORD_EMAILS` 대상 email이 명시된 경우만 허용 |
| 운영 침범 방지     | smoke 전용 email/store code 사용. 실제 운영 계정과 같은 email 사용 금지                                  |
| transaction        | Store + User seed는 하나의 transaction으로 처리해 partial seed를 방지                                    |
| DB allowlist       | `DATABASE_URL`은 local SQLite `file:./dev.db`만 허용                                                     |
| Store code         | smoke store code는 `SMOKE_` prefix 필수                                                                  |

## 8. 구현 전 Gate

실제 seed script 구현 전 아래 gate를 통과해야 한다.

| Gate              | 확인 항목                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| DB Gate           | 현재 `dev.db` migration clean, schema diff 없음, business table count 기준 확인 |
| Security Gate     | password hash helper, env secret 정책, production 차단 조건 확정                |
| Auth Gate         | `User.status=ACTIVE`, `role`, `storeId` 정책 유지                               |
| API Contract Gate | Server Action/API contract 변경 없음                                            |
| Harness Gate      | `backend_agent`, `db_reviewer`, `security_reviewer`는 GPT-5.5 경로 사용         |

Spark와 mini는 auth seed/password/session/RBAC/DB seed 구현에 사용하지 않는다.

## 9. 구현 후 검증 기준

seed 구현 단계에서는 최소 아래 검증을 수행한다.

```bash
pnpm db:validate
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm build
```

추가 검증:

| 검증            | 기준                                                                |
| --------------- | ------------------------------------------------------------------- |
| seed 1회 실행   | Store 1개 이상, ADMIN 1명, STAFF 1명 생성                           |
| seed 2회 실행   | 동일 unique key 기준 count 증가 없음                                |
| STAFF 검증      | `role=STAFF`, `status=ACTIVE`, `storeId` not null                   |
| ADMIN 검증      | `role=ADMIN`, `status=ACTIVE`                                       |
| password 검증   | `passwordHash`가 env password 원문과 다르고 로그에 출력되지 않음    |
| 금지 table 검증 | `Session`, `Sale`, `Payment`, `Receivable`, policy table은 0건 유지 |
| Prisma 상태     | `pnpm exec prisma migrate status` clean                             |

## 10. 다음 작업

| 순서 | 작업                         | Subagent                              | Model   | 범위                                                                  |
| ---: | ---------------------------- | ------------------------------------- | ------- | --------------------------------------------------------------------- |
|    1 | seed script 구현 및 env gate | `backend_agent` + `db_reviewer`       | GPT-5.5 | Prisma seed script, upsert, transaction, production 차단              |
|    2 | seed idempotency 검증        | `qa_agent` + `db_reviewer`            | GPT-5.5 | 2회 실행 count 안정성, 금지 table 0건, schema diff clean              |
|    3 | auth/session 구현 preflight  | `security_reviewer` + `backend_agent` | GPT-5.5 | password helper, cookie/session, login/logout action, RBAC guard 범위 |

## 11. 결론

Smoke/auth seed 정책은 `Store` 1개, `ADMIN` 1명, `STAFF` 1명으로 제한한다. Session, 거래, 수납, 재고, 고객, 정책, AuditLog seed는 이번 범위에서 제외한다.

이번 정책 기준으로 `prisma/seed.ts`가 구현되었다. 전체 QA/master seed는 아직 구현하지 않았다.

## 12. 구현 결과

| 항목          | 결과                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| Seed command  | `pnpm db:seed`, `pnpm seed`                                                    |
| Seed rows     | `Store=1`, smoke `User=2`                                                      |
| ADMIN         | `admin.seed@psms.local`, `role=ADMIN`, `status=ACTIVE`                         |
| STAFF         | `staff.seed@psms.local`, `role=STAFF`, `status=ACTIVE`, `storeId` 있음         |
| Password      | env password 필수, DB에는 `scrypt$...` hash만 저장                             |
| Idempotency   | 재실행 후 `Store=1`, smoke `User=2`, password hash 불변                        |
| Excluded rows | `Session`, sale/payment/receivable/inventory/customer/policy/AuditLog 0건 유지 |
| Production    | `NODE_ENV`, `VERCEL_ENV`, `APP_ENV`가 `production`이면 실행 차단               |
