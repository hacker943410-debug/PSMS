# Prisma Schema Application Plan

작성일: 2026-04-30

## 1. 목적

`C:\Projects\PSMS_Tech\phoneshop_rebuild_docs\prisma\schema.draft.prisma`를 현재 프로젝트 `C:\Projects\Active\PSMS`에 안전하게 적용하기 위한 단계별 계획이다.

이번 문서는 계획 수립 산출물이며, 실제 Prisma 설치, `prisma/schema.prisma` 생성, migration 생성, DB 파일 생성은 수행하지 않았다.

## 2. 현재 상태 요약

| 항목          | 상태                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| App 구조      | Next.js App Router 기반. `(workspace)`와 `(auth)/login` route skeleton 존재     |
| Server 계층   | `src/server/actions`, `queries`, `services`, `repositories`는 `.gitkeep`만 있음 |
| Prisma        | `prisma/` 디렉터리 없음                                                         |
| DB 환경변수   | `.env`, `.env.local`, `.env.example` 없음                                       |
| Prisma 의존성 | `prisma`, `@prisma/client` 미설치                                               |
| Auth/RBAC     | Login UI skeleton만 존재. 실제 session/RBAC 없음                                |
| API contract  | 문서만 존재. Server Action 구현 없음                                            |

## 3. Draft Schema 모델 그룹

| 그룹            | 모델                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| 인증/RBAC/조직  | `User`, `Store`                                                                             |
| 기초정보/Master | `Carrier`, `SalesAgency`, `DeviceModel`, `InventoryColorOption`, `RatePlan`, `AddOnService` |
| 재고            | `InventoryItem`                                                                             |
| 고객/상담       | `Customer`, `CustomerMemo`                                                                  |
| 판매            | `Sale`, `SaleAddOn`                                                                         |
| 미수금/수납     | `Receivable`, `Payment`                                                                     |
| 일정            | `ManualSchedule`                                                                            |
| 정책            | `SaleProfitPolicy`, `StaffCommissionPolicy`, `DiscountPolicy`, `CarrierActivationRule`      |
| 감사            | `AuditLog`                                                                                  |

주요 unique/index 제약:

| 제약                                        | 의미                               |
| ------------------------------------------- | ---------------------------------- |
| `User.email @unique`                        | 로그인 계정 중복 방지              |
| `Store.code @unique`                        | 매장 코드 중복 방지                |
| `InventoryItem.serialNumber @unique`        | 재고 S/N 중복 방지                 |
| `Sale.orderNo @unique`                      | 판매 주문번호 중복 방지            |
| `Sale.inventoryItemId @unique`              | 하나의 재고가 하나의 판매에만 연결 |
| `Receivable.saleId @unique`                 | 판매 1건당 미수금 1건              |
| `SaleAddOn(saleId, addOnServiceId) @unique` | 판매별 부가서비스 중복 방지        |

## 4. 적용 전 의사결정 필요 항목

| 항목                     | 결정 필요 내용                                    | 이유                                                                  |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| Auth 방식                | Credentials 직접 구현 vs Auth.js 계열             | `User.passwordHash`, session, route guard, Server Action guard와 직결 |
| STAFF `storeId`          | STAFF 필수, ADMIN nullable 여부                   | STAFF 매장 범위 제한과 query filter 기준 필요                         |
| Prisma provider 전략     | 개발 SQLite 유지, 운영 PostgreSQL 전환 방식       | draft는 SQLite, 운영 문서는 PostgreSQL 권장                           |
| Prisma Client 위치       | `src/lib/prisma.ts` 또는 다른 wrapper             | repository와 transaction client 주입 방식 통일                        |
| `assignedUserId` FK 여부 | 느슨한 문자열 참조 vs `User` relation             | 고객/재고/미수금 담당자 정합성에 영향                                 |
| `Customer.status`        | 비활성/마스킹 상태 필드 추가 여부                 | 문서의 고객 보존 정책과 draft schema 간 차이                          |
| Policy history           | `AuditLog`로 충분한지 별도 history 모델 필요 여부 | 정책 활성화/버전 이력 보존 요구                                       |
| `onDelete` 정책          | relation별 Restrict/SetNull/Cascade 명시 여부     | 판매/수납/재고 물리 삭제 금지 정책과 연결                             |
| Seed 범위                | 최소 ADMIN/매장/통신사/기초정보 범위              | auth/RBAC와 화면 데이터 검증에 필요                                   |

## 5. 충돌 가능성 분석

| 영역                   | 충돌 가능성                                                | 대응 원칙                                        |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| Auth/RBAC              | `User` 모델 적용 시 로그인/세션 설계와 즉시 연결됨         | schema 적용 전 auth 방식과 session shape 확정    |
| API contract           | CRUD를 Route Handler로 만들 위험                           | 일반 CRUD는 Server Action 중심 유지              |
| Server layer           | repository에 권한/비즈니스 로직이 섞일 위험                | repository는 Prisma 접근만 담당                  |
| Sale transaction       | 판매/재고/미수금/일정/AuditLog가 한 transaction에 묶임     | schema 적용 후에도 서비스 구현 전 동작 연결 금지 |
| Receivable calculation | `paidAmount`, `balanceAmount`, `status` 저장값 불일치 가능 | 수납 등록/취소 transaction 테스트 필수           |
| Policy `ruleJson`      | DB 제약만으로 rule 구조 검증 불가                          | Zod schema와 정책 계산 테스트 선행               |
| SQLite vs PostgreSQL   | 동시성, Json, index 동작 차이                              | 개발 SQLite 적용 후 PostgreSQL 리허설 필요       |
| AuditLog               | 변경 이력 누락 가능                                        | mutation 구현 시 AuditLog 필수 체크리스트 적용   |

## 6. 권장 적용 단계

### Phase A. Schema Review 확정

1. `schema.draft.prisma`를 기준으로 모델/관계/인덱스 리뷰를 완료한다.
2. `Customer.status`, policy history, `assignedUserId` FK, `onDelete` 정책을 확정한다.
3. SQLite 개발 DB와 PostgreSQL 운영 DB 간 차이를 문서화한다.

산출물:

- `docs/00_system/prisma-schema-application-plan.md` 갱신
- schema review 체크리스트

### Phase B. 의존성 및 환경 구성

예상 변경 파일:

| 파일                   | 작업                                               |
| ---------------------- | -------------------------------------------------- |
| `package.json`         | `prisma`, `@prisma/client` 의존성 및 script 추가   |
| `pnpm-lock.yaml`       | lockfile 갱신                                      |
| `.env.example`         | `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` 예시 추가 |
| `.env.local`           | 로컬 개발 DB 연결 문자열                           |
| `prisma/schema.prisma` | draft 기반 실제 schema 작성                        |

권장 script 후보:

```json
{
  "db:validate": "prisma validate",
  "db:generate": "prisma generate",
  "db:migrate:create": "prisma migrate dev --create-only",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

### Phase C. Read-only Prisma 검증

1. `pnpm db:validate`
2. `pnpm db:generate`
3. `pnpm format:check`
4. `pnpm lint`
5. `pnpm typecheck`

이 단계에서는 migration을 DB에 적용하지 않는다.

### Phase D. Create-only Migration 검토

1. `pnpm prisma migrate dev --create-only --name init_schema`
2. 생성된 SQL을 검토한다.
3. unique/index/relation/onDelete/Json 필드 동작을 확인한다.
4. SQLite 적용 결과와 PostgreSQL 리허설 차이를 기록한다.

### Phase E. Seed 및 Transaction 테스트 계획

최소 seed 후보:

| 그룹       | 최소 데이터                                                      |
| ---------- | ---------------------------------------------------------------- |
| User/Store | ADMIN 1명, STAFF 1명, Store 1개                                  |
| Master     | Carrier, SalesAgency, DeviceModel, Color, RatePlan, AddOnService |
| Inventory  | 판매 가능한 `InventoryItem`                                      |
| Customer   | 테스트 고객                                                      |
| Policy     | 기본 할인/수익/수수료 rule JSON                                  |

최소 테스트 후보:

| 테스트                | 목적                                              |
| --------------------- | ------------------------------------------------- |
| 로그인 계정 unique    | `User.email` 중복 방지                            |
| 판매 등록 transaction | Sale/Inventory/Receivable/Schedule/AuditLog 연동  |
| 수납 등록/취소        | Receivable 잔액/상태 재계산                       |
| 재고 중복 판매 방지   | `Sale.inventoryItemId @unique`와 transaction 검증 |
| 정책 충돌             | active policy 기간/조건 충돌 방지                 |

### Phase F. 개발 DB 적용

사용자 승인 후 개발 SQLite에만 migration을 적용한다.

권장 명령:

```bash
pnpm db:migrate
pnpm db:generate
pnpm seed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

## 7. 이번 턴에서 실제 DB 변경을 하지 않은 이유

| 이유             | 설명                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- |
| 하네스 정책      | Prisma migration은 단일 GPT-5.5/DB reviewer 경로로 보수적으로 설계해야 함                    |
| 현재 준비 상태   | Prisma 의존성, env, schema, migration, seed, 테스트가 모두 없음                              |
| contract 영향    | `User`, `Sale`, `Receivable`, `Payment`, `AuditLog`는 auth/API/transaction contract와 연결됨 |
| rollback 미정    | migration rollback/forward-only 전략이 아직 없음                                             |
| seed/테스트 미정 | 초기 데이터와 핵심 transaction 검증 없이 적용하면 위험                                       |

## 8. 다음 실제 적용 시 작업 분해

| 순서 | 작업                          | 담당 Subagent                   | 모델    |
| ---: | ----------------------------- | ------------------------------- | ------- |
|    1 | schema review 체크리스트 확정 | `db_reviewer`                   | GPT-5.5 |
|    2 | auth/session 의사결정         | `security_reviewer`             | GPT-5.5 |
|    3 | Prisma 의존성/env/schema 추가 | `backend_agent`                 | GPT-5.5 |
|    4 | create-only migration 검토    | `db_reviewer`                   | GPT-5.5 |
|    5 | seed/test 계획 작성           | `qa_agent` + `db_reviewer`      | GPT-5.5 |
|    6 | 개발 DB 적용                  | `backend_agent` + `db_reviewer` | GPT-5.5 |

## 9. 완료 기준

실제 Prisma 적용 단계는 아래를 모두 만족해야 완료로 본다.

- `pnpm db:validate` 통과
- `pnpm db:generate` 통과
- create-only migration SQL 검토 완료
- auth/session/RBAC 영향 범위 보고
- Server Action/API contract 변경 없음 또는 변경점 명시
- seed 범위 문서화
- transaction 테스트 계획 또는 테스트 추가
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과
