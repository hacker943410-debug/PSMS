# Acceptance/Master Seed Gate

작성일: 2026-05-06

## 1. 결정

현재 `db:seed`는 계속 smoke/auth 전용으로 유지한다. 이 seed는 `Store=1`, `ADMIN=1`, `STAFF=1`, `Session=0`만 보장하며, 기존 `db:e2e:isolated-reset`의 결정적 count를 깨지 않는다.

Acceptance/master seed는 별도 scope와 별도 entrypoint로 만든다. 권장 이름은 `master-seed.ts`, `acceptance-seed.ts`, 그리고 profile 기반 gate인 `seed-idempotency-gate.ts`다.

이번 gate에서는 먼저 smoke/auth seed의 독립 idempotency 검증을 추가했다.

```bash
pnpm db:seed:idempotency
pnpm test:seed:idempotency
```

이 명령은 `.tmp/seed-gate/smoke-auth-idempotency.db`를 생성하고 migration을 적용한 뒤 smoke/auth seed를 같은 DB에 2회 실행한다. 검증 대상은 `quick_check`, `foreign_key_check`, row count 안정성, seed user/store ID 안정성, password hash 불변, `packages/db/dev.db` hash 불변이다.

## 2. 현재 Smoke Gate 기준

| 항목                                                                  | 기대값 |
| --------------------------------------------------------------------- | -----: |
| Store                                                                 |      1 |
| User                                                                  |      2 |
| Session                                                               |      0 |
| Active Session                                                        |      0 |
| AuditLog                                                              |      0 |
| Carrier / SalesAgency / DeviceModel / Color / RatePlan / AddOnService |      0 |
| Inventory / Customer / Sale / Receivable / Payment / Schedule         |      0 |
| Policy tables                                                         |      0 |

`SEED_RESET_PASSWORDS=false` 상태로 2회 실행하므로 password hash가 덮어써지면 gate가 실패한다.

## 3. Master Seed 권장 범위

Master seed는 관리자 기초정보 화면과 정책 읽기 화면을 비어 있지 않은 상태로 검증하기 위한 최소 fixture다.

| 대상                 | 기준                                                     |
| -------------------- | -------------------------------------------------------- |
| Store                | 3개 이상, active/inactive mix                            |
| User                 | ADMIN 1개 이상, STAFF 5개 이상                           |
| Carrier              | SKT, KT, LGU, MVNO 등 4개                                |
| SalesAgency          | carrier에 연결된 deterministic fixture                   |
| DeviceModel          | 10개 이상                                                |
| InventoryColorOption | 주요 색상 fixture                                        |
| RatePlan             | carrier별 active plan fixture                            |
| AddOnService         | carrier별 active add-on fixture                          |
| Policy               | 4개 policy table의 active/scheduled/expired 읽기 fixture |

Policy fixture는 활성화/충돌 business truth로 쓰지 않는다. `ruleJson`은 별도 Zod 검증과 conflict review가 끝난 뒤에만 activation scenario로 승격한다.

## 4. Acceptance Seed 제외 범위

아래 데이터는 sale/payment/receivable/inventory transaction service와 integration test가 준비되기 전까지 master seed에 넣지 않는다.

| 제외 대상                  | 이유                                                         |
| -------------------------- | ------------------------------------------------------------ |
| InventoryItem 대량 fixture | 재고 상태 전환과 중복 판매 방지 transaction이 필요           |
| Customer / CustomerMemo    | 개인정보 성격의 업무 fixture 정책 필요                       |
| Sale / SaleAddOn           | 판매 생성 transaction gate 필요                              |
| Receivable / Payment       | 잔액 재계산, 취소, 상태 전환 gate 필요                       |
| ManualSchedule             | 판매/수납 일정 생성 규칙과 연결 필요                         |
| AuditLog                   | seed audit 정책과 export/admin mutation audit 정책 확정 필요 |

Acceptance scenario seed는 위 transaction gate가 준비된 뒤 별도 `acceptance-seed.ts`로 만든다.

## 5. Idempotency Gate 요구사항

향후 master/acceptance seed gate는 아래를 모두 만족해야 한다.

| Gate        | 요구사항                                                           |
| ----------- | ------------------------------------------------------------------ |
| Target DB   | `.tmp/seed-gate` 내부 SQLite만 허용, `dev.db` 금지                 |
| Migration   | `prisma migrate deploy`, `prisma migrate status` clean             |
| Integrity   | `PRAGMA quick_check=ok`, `PRAGMA foreign_key_check` 0건            |
| Idempotency | 같은 DB에 seed 2회 실행 후 count와 business key가 증가하지 않음    |
| Ownership   | seed-owned deterministic ID 또는 natural unique key만 upsert       |
| Collision   | seed-owned이 아닌 row와 business key 충돌 시 실패                  |
| Password    | reset opt-in 유지, seed login ID 외 reset 금지                     |
| Sessions    | Session seed 금지. 필요한 경우 revoked/expired fixture는 별도 승인 |
| Dev DB      | `packages/db/dev.db` hash 불변                                     |

## 6. 향후 Script 방향

```json
{
  "db:seed:smoke": "tsx prisma/seed.ts",
  "db:seed:master": "tsx prisma/master-seed.ts",
  "db:seed:master:gate": "tsx prisma/seed-idempotency-gate.ts --profile master",
  "db:seed:acceptance": "tsx prisma/acceptance-seed.ts",
  "db:seed:acceptance:gate": "tsx prisma/seed-idempotency-gate.ts --profile acceptance"
}
```

초기 gate에서 먼저 구현된 명령은 smoke/auth 전용 `db:seed:idempotency`였다. 이후 DB/backend/QA 리뷰를 거쳐 master read seed entrypoint와 master idempotency gate를 별도 task로 추가했다. Acceptance scenario seed는 아직 구현하지 않았다.

## 7. Master Seed 구현 상태

2026-05-06 기준 master read seed entrypoint를 추가했다.

```bash
pnpm db:seed:master
pnpm db:seed:master:idempotency
pnpm test:seed:master:idempotency
```

`db:seed:master`는 `PSMS_MASTER_SEED_PASSWORD`가 설정된 local/dev DB에서만 동작한다. 이 값은 master seed user의 최초 password hash 생성에만 사용하며, 기존 master seed user password hash는 덮어쓰지 않는다.

현재 master seed fixture는 관리자 read 화면용 최소 범위만 포함한다.

| 대상                  | 수량 |
| --------------------- | ---: |
| Store                 |    3 |
| User                  |    6 |
| Carrier               |    4 |
| SalesAgency           |    8 |
| InventoryColorOption  |    6 |
| DeviceModel           |   10 |
| RatePlan              |    8 |
| AddOnService          |    8 |
| SaleProfitPolicy      |    3 |
| StaffCommissionPolicy |    3 |
| DiscountPolicy        |    3 |
| CarrierActivationRule |    3 |

계속 제외되는 대상은 `InventoryItem`, `Customer`, `Sale`, `SaleAddOn`, `Receivable`, `Payment`, `ManualSchedule`, `CustomerMemo`, `Session`, `AuditLog`다.
