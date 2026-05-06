# Admin Foundation Mutation Preflight

작성일: 2026-05-06

## 목적

이 문서는 Admin Foundation의 직원 관리, 기초정보, 정책 관리 mutation을
구현하기 전 API 계약, 보안 경계, DB transaction, 감사로그, 테스트 범위를
고정한다.

이번 작업은 preflight 문서화 단계다. `apps/api`, `packages/shared`,
`packages/db`, `apps/web` 코드는 변경하지 않는다.

## 결론

| 항목           | 결정                                                          |
| -------------- | ------------------------------------------------------------- |
| 판정           | 조건부 진행 가능                                              |
| 우선순위       | `staffs` -> `base` -> `policies`                              |
| 첫 구현 slice  | 직원 `change-status` + forced session revoke                  |
| 직원 생성      | Staff create security preflight 이후 `INACTIVE` 생성부터 구현 |
| 정책 활성화    | 이번 mutation preflight 이후 별도 DB/security gate 필요       |
| DB schema 변경 | 이번 preflight에서는 없음                                     |
| Web 역할       | API 호출 adapter와 revalidation만 담당. business rule 금지    |

## 현재 기반

| 영역        | 현재 상태                                                                |
| ----------- | ------------------------------------------------------------------------ |
| Admin guard | `requireAdminSession` 기반 API-level `ADMIN` guard 구현됨                |
| Read routes | `/admin/staffs`, `/admin/base`, `/admin/policies` read-only route 구현됨 |
| Shared DTO  | read query Zod schema와 read model type 구현됨                           |
| DB schema   | `User`, master data, policy, `Session`, `AuditLog` 모델 존재             |
| Mutation    | 아직 production route 없음                                               |

## 공통 Mutation Flow

모든 Admin mutation은 아래 순서를 따른다.

```txt
request cookie read
-> session token hash 검증
-> session user ACTIVE 확인
-> ADMIN role 확인
-> Zod body validation
-> business rule validation
-> optimistic concurrency validation when expectedUpdatedAt exists
-> transaction when data + audit/session revoke must be atomic
-> AuditLog write
-> ActionResult 반환
```

공통 실패 응답:

| HTTP | Code                           | 의미                                     |
| ---: | ------------------------------ | ---------------------------------------- |
|  400 | `VALIDATION_FAILED`            | Zod body/query 검증 실패                 |
|  401 | `AUTH_REQUIRED`                | 세션 없음, 만료, 폐기, inactive user     |
|  403 | `FORBIDDEN`                    | ADMIN 권한 없음                          |
|  404 | `NOT_FOUND`                    | 대상 없음                                |
|  409 | `DUPLICATE_LOGIN_ID`           | 직원 loginId 중복                        |
|  409 | `DUPLICATE_MASTER_DATA`        | code/name/modelNo 등 중복                |
|  409 | `MASTER_DATA_IN_USE`           | 참조 중인 master data 비활성화/변경 제한 |
|  409 | `STAFF_STORE_REQUIRED`         | STAFF role에 storeId 없음                |
|  409 | `SELF_STATUS_CHANGE_FORBIDDEN` | 자기 자신 비활성화 또는 권한 약화 시도   |
|  409 | `LAST_ADMIN_FORBIDDEN`         | 마지막 active ADMIN 비활성화/강등 시도   |
|  409 | `INVALID_STATUS_TRANSITION`    | 허용되지 않은 상태 변경                  |
|  409 | `STALE_RECORD`                 | `expectedUpdatedAt` 불일치               |
|  409 | `POLICY_CONFLICT`              | 정책 기간/조건 충돌                      |
|  409 | `POLICY_NOT_ACTIVATABLE`       | 활성화 조건 미충족                       |

## 파일 소유권

| 계층              | 예정 파일                                                                   | 책임                                      |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Shared validation | `packages/shared/src/admin/*.validation.ts`                                 | mutation Zod schema, inferred type        |
| Shared models     | `packages/shared/src/admin/read-models.ts` 또는 future `mutation-models.ts` | mutation response DTO                     |
| API routes        | `apps/api/src/routes/admin/*.routes.ts`                                     | guard, body parse, status mapping         |
| API route utils   | `apps/api/src/routes/admin/route-utils.ts`                                  | `parseAdminBody`, common error helpers    |
| API services      | `apps/api/src/services/admin/*.service.ts`                                  | business rule, transaction, audit         |
| API repositories  | `apps/api/src/repositories/admin/*.repository.ts`                           | Prisma access only                        |
| Web adapter       | `apps/web/src/lib/admin-*.ts`                                               | API call, cookie forwarding, revalidation |

Repositories must not contain permission checks or business rules.

## Staff Mutation Gate

### Routes

| Method | Path                          | 구현 순서 | 비고                                                                      |
| ------ | ----------------------------- | --------: | ------------------------------------------------------------------------- |
| POST   | `/admin/staffs/change-status` |         1 | 활성/비활성 전환과 forced session revoke                                  |
| POST   | `/admin/staffs/update`        |         2 | 이름, role, store, phone 수정. role/store 변경 범위는 추가 auth/RBAC 리뷰 |
| POST   | `/admin/staffs/create`        |         3 | `INACTIVE` 생성만 허용. raw/temporary password 노출 금지                  |

### DTO

```ts
type UpdateStaffInput = {
  userId: string;
  name?: string;
  role?: "ADMIN" | "STAFF";
  storeId?: string | null;
  phone?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  expectedUpdatedAt?: string;
};

type ChangeStaffStatusInput = {
  userId: string;
  status: "ACTIVE" | "INACTIVE";
  reason: string;
  expectedUpdatedAt?: string;
};

type CreateStaffInput = {
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId?: string;
  phone?: string;
  status?: "INACTIVE";
};
```

### Rules

- `loginId`는 trim/lowercase 후 `^[a-z0-9]{4,32}$`만 허용한다.
- 현재 DB는 `User.email`을 loginId 저장소로 사용한다.
- `STAFF`는 active `storeId`가 필수다. `ADMIN`은 store 없이 허용한다.
- 자기 자신의 status를 `INACTIVE`로 바꾸거나 role을 `STAFF`로 낮추는 동작은 차단한다.
- 마지막 active `ADMIN`을 비활성화하거나 `STAFF`로 강등할 수 없다.
- status가 `INACTIVE`가 되거나 role/store 변경으로 session user가 unusable해지면 active session을 같은 transaction에서 revoke한다.
- 첫 구현 slice는 `change-status`만 포함한다. `update`와 `create`는 같은 파일/서비스 구조를 쓰되 별도 작업으로 분리한다.
- raw password를 요청 body, response, log, audit payload에 저장하지 않는다.
- 직원 생성은 `docs/00_system/staff-create-security-preflight.md`를 따른다.
- 현재 slice에서는 `INACTIVE` 계정 생성만 허용한다.
- API service는 서버 내부 placeholder secret을 생성해 hash만 저장하고 raw 값은 즉시 폐기한다.
- raw password, temporary password, reset token은 request body, response, UI, log, audit payload에 노출하지 않는다.
- `ACTIVE` 즉시 로그인 계정 또는 password reset/activation은 별도 security/DB/API gate 이후 구현한다.

### Audit

| Action                       | Entity           | 필수 payload                                                |
| ---------------------------- | ---------------- | ----------------------------------------------------------- |
| `ADMIN_STAFF_UPDATED`        | `User`           | redacted `beforeJson`, `afterJson`, changed fields          |
| `ADMIN_STAFF_STATUS_CHANGED` | `User`           | old/new status, reason, revoked session count               |
| `ADMIN_STAFF_CREATED`        | `User`           | created staff metadata, `passwordDelivery: "NONE"`          |
| `ADMIN_MUTATION_FORBIDDEN`   | route/entityType | authenticated STAFF forbidden 접근의 sanitized route/action |

`passwordHash`, raw password, raw session token, `sessionTokenHash`는 audit에 저장하지 않는다.
`401` no-cookie/malformed/unknown-token은 신뢰 가능한 actor가 없으므로 AuditLog가 아니라 보안 로그 또는 rate-limit 대상으로 분리한다.

## Base Mutation Gate

### Routes

Base mutation은 generic CRUD route를 만들지 않고 tab별 allowlist route만 허용한다.

```txt
/admin/base/stores/create
/admin/base/stores/update
/admin/base/stores/change-status
/admin/base/carriers/create
/admin/base/carriers/update
/admin/base/carriers/change-status
/admin/base/sales-agencies/create
/admin/base/sales-agencies/update
/admin/base/sales-agencies/change-status
/admin/base/colors/create
/admin/base/colors/update
/admin/base/colors/change-status
/admin/base/device-models/create
/admin/base/device-models/update
/admin/base/device-models/change-status
/admin/base/rate-plans/create
/admin/base/rate-plans/update
/admin/base/rate-plans/change-status
/admin/base/add-on-services/create
/admin/base/add-on-services/update
/admin/base/add-on-services/change-status
```

`backup`, `restore`, `staffs`는 base mutation route에서 제외한다.

### Rules

- 물리 삭제 route는 만들지 않는다.
- create/update/change-status는 모두 `AuditLog`를 남긴다.
- status 변경은 `ACTIVE` <-> `INACTIVE`만 허용한다.
- `expectedUpdatedAt`이 있으면 stale update를 `STALE_RECORD`로 반환한다.
- unique 제약 위반은 service에서 먼저 확인하고 DB conflict도 `DUPLICATE_MASTER_DATA`로 정규화한다.
- 참조 중인 master data 비활성화는 tab별 reference-in-use 검증을 통과해야 한다.

Reference-in-use gate:

| Tab           | 차단 참조                                                                              |
| ------------- | -------------------------------------------------------------------------------------- |
| stores        | `User`, `InventoryItem`, `Sale`, `Receivable`, `Payment`, `ManualSchedule`, `Customer` |
| carriers      | `SalesAgency`, `RatePlan`, `AddOnService`, `InventoryItem`, `Sale`, policy tables      |
| salesAgencies | `Sale`                                                                                 |
| colors        | `InventoryItem`                                                                        |
| deviceModels  | `InventoryItem`, `Sale`, `DiscountPolicy`                                              |
| ratePlans     | `Sale`                                                                                 |
| addOnServices | `SaleAddOn`                                                                            |

## Policy Mutation Gate

### Routes

Policy create/update/change-status route는 preflight상 허용하되, activation route는
별도 gate로 둔다.

```txt
/admin/policies/{policy-kind}/create
/admin/policies/{policy-kind}/update
/admin/policies/{policy-kind}/change-status
```

`policy-kind` allowlist:

- `sale-profit`
- `staff-commission`
- `discount`
- `activation-rule`

### Rules

- create/update는 `ACTIVE` 또는 `SCHEDULED`를 직접 만들 수 없다.
- status 변경은 `INACTIVE` 또는 `EXPIRED`로 제한한다.
- activation은 conflict detection, effective date, history/audit, conflict expiry를 함께 다루므로 별도 `policy activation DB gate` 이후 구현한다.
- `ruleJson`은 policy type별 Zod schema를 통과해야 하며 `unknown` 그대로 service에 전달하지 않는다.
- `effectiveFrom <= effectiveTo`를 검증한다.
- `priority`는 positive integer로 제한한다.
- `createdById`, `updatedById`는 session user id를 기록한다.

### Policy Activation Blocker

현재 schema에는 전용 policy history model이 없다. AuditLog만으로 충분한지,
아니면 dedicated history table이 필요한지 `db_reviewer` gate에서 확정하기 전까지
아래 route 구현은 보류한다.

```txt
/admin/policies/{policy-kind}/activate
```

## Web Boundary

- Web page는 `searchParams` 파싱과 렌더링을 담당한다.
- Web Server Action 또는 adapter는 API 호출, cookie forwarding, revalidation/navigation만 담당한다.
- 직원/기초정보/정책 business rule, permission, transaction, audit는 모두 `apps/api`가 소유한다.
- Web route guard나 sidebar filtering은 API permission check를 대체하지 않는다.

## 테스트 계획

| 구현 slice                  | 필수 테스트                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff change-status         | no cookie 401, STAFF 403, ADMIN success, validation 400, not-found 404, stale 409, same-status 차단, self-disable 차단, last-admin 차단, inactive forced session revoke, audit redaction |
| Staff update                | STAFF store required, role downgrade/self role change 차단, duplicate/stale/not-found, unusable session revoke, audit redaction                                                          |
| Staff create                | duplicate loginId, STAFF store required, `INACTIVE` only, password/hash/token/temp raw audit/log/response/UI 비노출, ADMIN-only                                                          |
| Base mutation               | tab allowlist, per-tab validation, duplicate data, reference-in-use status block, audit redaction                                                                                        |
| Policy create/update/status | policy kind allowlist, ruleJson schema, effective date, stale update, direct ACTIVE/SCHEDULED 차단, audit redaction                                                                      |
| Web adapter                 | mutation success 후 revalidation/navigation, API error pass-through                                                                                                                      |
| Browser E2E                 | Web form 연결 이후 ADMIN success/STAFF forbidden/validation UX                                                                                                                           |

이번 preflight 문서-only 작업의 최소 검증은 `pnpm format:check`와
`git diff --check`다.

## 구현 순서

1. Shared mutation Zod schema 추가: `adminChangeStaffStatusInputSchema`부터 시작한다.
2. Admin route util에 `parseAdminBody`와 common conflict helpers를 추가한다.
3. Staff repository snapshot/update helper를 추가한다.
4. Staff service에서 `change-status` transaction, active session revoke, redacted AuditLog를 구현한다.
5. `POST /admin/staffs/change-status` route를 연결한다.
6. Staff mutation API inject smoke를 추가한다.
7. Staff `update`는 role/store/status 동시 변경 범위를 재확인한 뒤 별도 slice로 구현한다.
8. Staff `create`는 `INACTIVE` only security preflight 기준으로 구현한다.
9. Base tab별 mutation은 stores/carriers처럼 의존성이 큰 tab보다 독립성이 높은 colors부터 시작한다.
10. Policy create/update/change-status는 ruleJson schema와 policy history 결정을 먼저 통과한다.

## 금지 범위

- generic CRUD route 생성 금지.
- physical delete route 생성 금지.
- Web Server Action에 business rule 추가 금지.
- STAFF 권한 완화 금지.
- raw password/session token/hash audit 저장 금지.
- policy activation route 구현 금지.
- backup/restore/export를 base mutation에 포함 금지.
- Prisma schema 변경은 별도 DB preflight 없이 금지.
