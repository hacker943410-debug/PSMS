# Admin API Contract Preflight

작성 시각: 2026-05-01 23:36 KST

## 목적

이 문서는 Admin Foundation 범위인 직원 관리, 기초정보, 정책 관리의 Fastify API 계약을 구현 전에 고정한다.

이번 작업은 preflight 문서화 단계다. `apps/api`, `packages/shared`, `packages/db` 코드는 변경하지 않는다.

## 범위

| 영역      | 포함                                                     | 제외                            |
| --------- | -------------------------------------------------------- | ------------------------------- |
| 직원 관리 | 목록, 상세, 생성, 수정, 상태 변경                        | 비밀번호 메일 발송 실제 연동    |
| 기초정보  | 매장, 통신사, 거래대리점, 색상, 기종, 요금제, 부가서비스 | 백업, 복원, 물리 삭제           |
| 정책 관리 | 목록, 상세, 생성, 수정, 상태 변경, 활성화 preflight 계약 | 전용 policy history schema 변경 |
| Web 연동  | thin adapter 경계와 URL-state 매핑 기준                  | 화면 CRUD 완성                  |

## 기준 결정

| 항목                     | 결정                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain API 소유권        | `apps/api` Fastify가 인증, 권한, 검증, 비즈니스 규칙, transaction, audit log를 소유한다.                                                               |
| Web 역할                 | Web page는 `searchParams` 파싱과 렌더링, Web action/adapter는 API 호출과 cookie/navigation/revalidation만 담당한다.                                    |
| Route prefix             | 기존 `/auth/*`와 맞춰 API 내부 경로는 `/admin/*`를 사용한다. Web 개발 URL의 `/api` Route Handler는 도메인 API로 쓰지 않는다.                           |
| Generic CRUD             | 금지한다. 화면/유스케이스 단위 route와 per-tab/per-policy allowlist를 사용한다.                                                                        |
| Auth/RBAC                | 모든 admin API route는 API route level에서 session check와 `ADMIN` role check를 반복한다. Web guard만으로는 불충분하다.                                |
| 삭제 정책                | MVP에서는 물리 삭제를 제공하지 않는다. `change-status`로 비활성화하고, 참조 데이터는 서비스에서 차단 또는 제한한다.                                    |
| Staff login identifier   | 외부 API DTO는 `loginId`를 사용한다. 현재 DB는 `User.email` 필드를 저장소로 임시 사용하며, auth와 동일하게 lowercase alphanumeric만 허용한다.          |
| Policy subscription enum | API canonical 값은 DB 기준 `NEW`, `CHANGE_DEVICE`, `NUMBER_PORTABILITY`다. 현재 Web URL의 `salesType=CHANGE`는 adapter에서 `CHANGE_DEVICE`로 매핑한다. |
| Base tabs                | `/staffs`는 별도 화면과 API로 유지한다. `base` API는 `staffs`, `backup`, `restore` 탭을 master-data CRUD에 포함하지 않는다.                            |
| Policy history           | 전용 history model이 없으므로 활성화 구현 전 `AuditLog`만으로 충분한지, dedicated model을 추가할지 DB review gate에서 확정한다.                        |

## 문서 충돌 해소

`C:\Project\PSMS_Tech\docs\08_SERVER_ACTIONS_AND_API_CONTRACTS.md`에는 Server Action 중심 CRUD, generic master-data CRUD, `deleteMasterDataAction`, base `staffs/backup/restore` 탭이 남아 있다.

2026-05-01 기준 구현 저장소의 `AGENTS.md`, `docs/00_system/development-flow.md`, 사용자 승인 계획은 Fastify API를 도메인 소스로 두고 Web은 thin adapter로 둔다. 따라서 구현 시 아래처럼 해석한다.

| 충돌 항목                                      | 구현 기준                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Server Action 중심 CRUD                        | Web Server Action은 API 호출 adapter만 담당한다. Domain CRUD는 Fastify API가 소유한다. |
| generic `create/update/deleteMasterDataAction` | generic route로 구현하지 않는다. per-tab use-case route로 분리한다.                    |
| `deleteMasterDataAction`                       | MVP에서는 물리 삭제가 아니라 status change 또는 dependency block으로 해석한다.         |
| base `staffs` 탭                               | `/staffs` 별도 staff API로 분리한다.                                                   |
| base `backup/restore` 탭                       | release/Electron 운영 API로 분리하고 이번 Admin CRUD 범위에서 제외한다.                |

이 결정은 API 구현 전 사용자 확인과 `architect_reviewer` 검토를 다시 받아야 한다. PSMS_Tech 원본 문서는 추후 별도 갱신 대상으로 둔다.

## 공통 응답

모든 route는 `packages/shared`의 `ActionResult<T>` 형태를 반환한다.

```ts
type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string; redirectTo?: string }
  | {
      ok: false;
      code?: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };
```

HTTP status와 `ActionResult.code`를 함께 사용한다.

| HTTP | Code                        | 의미                                     |
| ---: | --------------------------- | ---------------------------------------- |
|  400 | `VALIDATION_FAILED`         | Zod 입력 검증 실패                       |
|  401 | `AUTH_REQUIRED`             | 세션 없음 또는 만료                      |
|  403 | `FORBIDDEN`                 | ADMIN 권한 없음                          |
|  404 | `NOT_FOUND`                 | 대상 없음                                |
|  409 | `DUPLICATE_LOGIN_ID`        | 직원 loginId 중복                        |
|  409 | `DUPLICATE_MASTER_DATA`     | code/name/modelNo 등 중복                |
|  409 | `MASTER_DATA_IN_USE`        | 참조 중인 master data 비활성화/변경 제한 |
|  409 | `INVALID_STATUS_TRANSITION` | 허용되지 않은 상태 변경                  |
|  409 | `POLICY_CONFLICT`           | 정책 기간/조건 충돌                      |
|  409 | `POLICY_NOT_ACTIVATABLE`    | 활성화 조건 미충족                       |
|  409 | `POLICY_VERSION_STALE`      | 수정 기준 버전 충돌                      |
|  500 | `INTERNAL_SERVER_ERROR`     | 서버 오류                                |

## 공통 Guard 순서

모든 admin mutation은 아래 순서를 따른다.

```txt
session cookie read
-> session token hash 검증
-> session user ACTIVE 확인
-> ADMIN role 확인
-> Zod input validation
-> business rule validation
-> transaction when needed
-> audit log write
-> ActionResult 반환
```

Read route도 session, ACTIVE user, ADMIN role, query validation을 수행한다.

## 공통 보안 규칙

- `passwordHash`, `sessionToken`, `sessionTokenHash`는 어떤 admin API에도 반환하지 않는다.
- `beforeJson`, `afterJson` audit payload에는 secret, raw token, password, 불필요한 PII를 저장하지 않는다.
- 직원/고객 PII는 STAFF-visible API가 생기기 전까지 admin route 밖으로 확장하지 않는다.
- backup/restore/export는 이번 admin base CRUD 계약에서 제외하고 별도 권한, audit, 파일/DB safety gate를 요구한다.
- `/auth/login`은 raw `sessionToken`을 JSON으로 반환하므로 현재처럼 Web BFF/server-to-server 호출 전용으로 둔다. 브라우저 직접 API 사용으로 확장할 경우 API `Set-Cookie` 방식으로 재검토한다.

## Staff API

### Routes

| Method | Path                          | 설명                                           |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | `/admin/staffs/page-data`     | 직원 목록, 필터 옵션, 선택 상세를 한 번에 조회 |
| GET    | `/admin/staffs/detail`        | `userId` 기준 상세 조회                        |
| POST   | `/admin/staffs/create`        | 직원 생성                                      |
| POST   | `/admin/staffs/update`        | 직원 수정                                      |
| POST   | `/admin/staffs/change-status` | 직원 활성/비활성 변경                          |

### Query DTO

```ts
type StaffListQuery = {
  role?: "ADMIN" | "STAFF" | "all";
  storeId?: string | "all";
  status?: "ACTIVE" | "INACTIVE" | "all";
  q?: string;
  page?: number;
  pageSize?: 10 | 20 | 50;
  detail?: string;
};
```

### Response DTO

```ts
type StaffPageData = {
  rows: StaffListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  filterOptions: {
    stores: Array<{ id: string; name: string; status: "ACTIVE" | "INACTIVE" }>;
  };
  detail?: StaffDetail;
};

type StaffListRow = {
  id: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  storeName: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

type StaffDetail = StaffListRow & {
  auditSummary: {
    lastStatusChangedAt: string | null;
    lastStatusChangedBy: string | null;
  };
};
```

### Mutation DTO

```ts
type CreateStaffInput = {
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
  shouldGenerateTemporaryPassword?: boolean;
};

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
};
```

### Rules

- `loginId`는 trim 후 lowercase 정규화한다.
- 현재 auth와 동일하게 `^[a-z0-9]+$`, 4~32자를 사용한다. 이메일 형식과 특수기호는 허용하지 않는다.
- `STAFF`는 `storeId`가 필요하다. `ADMIN`은 `storeId`가 없을 수 있다.
- 직원 생성 시 raw password를 입력받지 않는다. 임시 비밀번호가 필요하면 API service가 생성하고 hash한다.
- 임시 비밀번호 전달 방식은 reset UX 확정 전까지 production enable 대상이 아니다.
- raw password는 response, log, audit log에 저장하지 않는다.
- 자기 자신을 비활성화하는 동작은 별도 확인 정책 전까지 차단한다.
- 모든 create/update/status mutation은 `AuditLog`를 남긴다.

## Base Settings API

### Read Routes

| Method | Path                    | 설명                                       |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/admin/base/page-data` | `tab` 기준 목록, 필터 옵션, 선택 상세 조회 |
| GET    | `/admin/base/detail`    | `tab`, `id` 기준 상세 조회                 |

### Mutation Routes

아래 route group만 허용한다.

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

`backup`, `restore`, `staffs`는 base CRUD route에서 제외한다.

### Query DTO

```ts
type BaseTab =
  | "stores"
  | "carriers"
  | "salesAgencies"
  | "colors"
  | "deviceModels"
  | "ratePlans"
  | "addOnServices";

type BaseListQuery = {
  tab: BaseTab;
  status?: "ACTIVE" | "INACTIVE" | "all";
  q?: string;
  page?: number;
  pageSize?: 10 | 20 | 50;
  detail?: string;
};
```

### Common Response DTO

```ts
type BasePageData<TListRow, TDetail> = {
  tab: BaseTab;
  rows: TListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  detail?: TDetail;
  filterOptions: {
    carriers?: Array<{ id: string; code: string; name: string }>;
  };
};
```

### Mutation DTOs

```ts
type StoreInput = {
  code: string;
  name: string;
  phone?: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
};

type CarrierInput = {
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type SalesAgencyInput = {
  name: string;
  carrierId?: string;
  contactName?: string;
  phone?: string;
  contractStatus?: string;
  status: "ACTIVE" | "INACTIVE";
};

type ColorInput = {
  name: string;
  code?: string;
  hex?: string;
  status: "ACTIVE" | "INACTIVE";
};

type DeviceModelInput = {
  name: string;
  modelNo: string;
  manufacturer: string;
  releaseDate?: string;
  supports5g: boolean;
  imageUrl?: string;
  status: "ACTIVE" | "INACTIVE";
};

type RatePlanInput = {
  carrierId: string;
  name: string;
  monthlyFee: number;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
};

type AddOnServiceInput = {
  carrierId?: string;
  name: string;
  monthlyFee: number;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
};

type BaseUpdateEnvelope<T> = {
  id: string;
  data: Partial<T>;
  expectedUpdatedAt?: string;
};

type BaseChangeStatusInput = {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  reason: string;
};
```

### Rules

- physical delete route는 만들지 않는다.
- code/name/modelNo 등 중복은 DB unique와 service validation 양쪽에서 처리한다.
- 참조 중인 master data의 비활성화는 탭별 정책을 서비스에서 결정한다.
- `monthlyFee`는 0 이상 integer 원 단위다.
- 날짜는 API 입력에서 `YYYY-MM-DD`, DB 저장은 DateTime이다.
- 모든 mutation은 `AuditLog`를 남긴다.

## Policy API

### Routes

| Method | Path                                             | 설명                                    |
| ------ | ------------------------------------------------ | --------------------------------------- |
| GET    | `/admin/policies/page-data`                      | 정책 목록, 필터 옵션, 선택 상세 조회    |
| GET    | `/admin/policies/detail`                         | `policyType`, `policyId` 기준 상세 조회 |
| POST   | `/admin/policies/sale-profit/create`             | 통신사 수익 정책 생성                   |
| POST   | `/admin/policies/sale-profit/update`             | 통신사 수익 정책 수정                   |
| POST   | `/admin/policies/sale-profit/change-status`      | 통신사 수익 정책 상태 변경              |
| POST   | `/admin/policies/sale-profit/activate`           | 통신사 수익 정책 활성화                 |
| POST   | `/admin/policies/staff-commission/create`        | 직원 수수료 정책 생성                   |
| POST   | `/admin/policies/staff-commission/update`        | 직원 수수료 정책 수정                   |
| POST   | `/admin/policies/staff-commission/change-status` | 직원 수수료 정책 상태 변경              |
| POST   | `/admin/policies/staff-commission/activate`      | 직원 수수료 정책 활성화                 |
| POST   | `/admin/policies/discount/create`                | 할인 정책 생성                          |
| POST   | `/admin/policies/discount/update`                | 할인 정책 수정                          |
| POST   | `/admin/policies/discount/change-status`         | 할인 정책 상태 변경                     |
| POST   | `/admin/policies/discount/activate`              | 할인 정책 활성화                        |
| POST   | `/admin/policies/activation-rule/create`         | 개통 규칙 생성                          |
| POST   | `/admin/policies/activation-rule/update`         | 개통 규칙 수정                          |
| POST   | `/admin/policies/activation-rule/change-status`  | 개통 규칙 상태 변경                     |
| POST   | `/admin/policies/activation-rule/activate`       | 개통 규칙 활성화                        |

### Query DTO

```ts
type PolicyType =
  | "saleProfit"
  | "staffCommission"
  | "discount"
  | "activationRule";

type PolicyListQuery = {
  policyType: PolicyType;
  carrierId?: string | "all";
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY" | "all";
  status?: "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED" | "all";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: 10 | 20 | 50;
  detail?: string;
};
```

### Response DTO

```ts
type PolicyPageData = {
  policyType: PolicyType;
  rows: PolicyListRow[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  filterOptions: {
    carriers: Array<{ id: string; code: string; name: string }>;
    subscriptionTypes: Array<"NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY">;
  };
  detail?: PolicyDetail;
};

type PolicyListRow = {
  id: string;
  policyType: PolicyType;
  name: string;
  carrierId: string | null;
  carrierName: string | null;
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY" | null;
  status: "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  updatedAt: string;
};

type PolicyDetail = PolicyListRow & {
  ruleJson: unknown;
  auditSummary: {
    createdById: string | null;
    updatedById: string | null;
    lastActivatedAt: string | null;
  };
  conflicts?: Array<{
    policyId: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
};
```

### Mutation DTO

```ts
type PolicyMutationInput = {
  policyId?: string;
  name: string;
  carrierId?: string;
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY";
  deviceModelId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status?: "INACTIVE";
  version: string;
  priority: number;
  ruleJson: unknown;
  expectedUpdatedAt?: string;
};

type PolicyChangeStatusInput = {
  policyId: string;
  status: "INACTIVE" | "EXPIRED";
  reason: string;
};

type ActivatePolicyInput = {
  policyId: string;
  reason: string;
  conflictMode: "REJECT_ON_CONFLICT" | "EXPIRE_CONFLICTS";
  expectedUpdatedAt?: string;
};
```

### Rules

- 정책 활성화는 단순 상태 변경이 아니다.
- create/update/change-status route는 `ACTIVE` 또는 `SCHEDULED`로 직접 전환할 수 없다.
- `ACTIVE`와 `SCHEDULED` 상태 진입은 `/activate` route만 허용한다.
- 활성화는 하나의 transaction에서 수행한다.

```txt
load target policy
-> validate status/effective date/ruleJson
-> detect conflicting active/scheduled policies
-> if REJECT_ON_CONFLICT and conflicts exist, return POLICY_CONFLICT
-> if EXPIRE_CONFLICTS, expire/deactivate conflicts
-> set target to ACTIVE when effective now, or SCHEDULED when effectiveFrom is future
-> write policy history or AuditLog decision
-> write AuditLog
```

- `ruleJson`은 policy type별 Zod schema를 별도로 둔다. `unknown` 그대로 service에 통과시키지 않는다.
- `effectiveFrom <= effectiveTo`를 검증한다.
- `priority`는 positive integer로 제한한다.
- policy response는 ADMIN API에서만 제공한다. STAFF-visible API나 export에는 수익/수수료 rule을 노출하지 않는다.
- Web URL의 `/settings/policies?tab=...`는 API DTO의 `policyType`으로 1:1 변환한다.

## 파일 소유권

| 계층              | 예정 파일                                               | 책임                                                  |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Shared validation | `packages/shared/src/admin/*.validation.ts`             | Zod DTO, inferred type                                |
| API routes        | `apps/api/src/routes/admin/*.routes.ts`                 | session/admin guard, parse, HTTP status, ActionResult |
| API queries       | `apps/api/src/queries/admin/*.query.ts`                 | page-data/detail 조회 조합                            |
| API services      | `apps/api/src/services/admin/*.service.ts`              | business rule, transaction, audit                     |
| API repositories  | `apps/api/src/repositories/*.repository.ts`             | Prisma 접근만                                         |
| Web adapter       | `apps/web/src/lib/api-client.ts`, future admin adapters | API 호출, cookie forwarding                           |
| Web pages         | `apps/web/src/app/(workspace)/**/page.tsx`              | searchParams, render, adapter 호출                    |

## 테스트 계획

| 영역        | 테스트                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Shared      | staff/base/policy Zod DTO unit test                                                               |
| API guard   | unauthenticated `AUTH_REQUIRED`, STAFF `FORBIDDEN`, ADMIN success                                 |
| Staff       | duplicate loginId, STAFF store required, status transition, audit log                             |
| Base        | tab allowlist, per-tab validation, duplicate master data, referenced data status rule             |
| Policy      | filter/list/detail, policy rule validation, conflict detection, activation transaction, audit log |
| Web adapter | current URL-state를 API query DTO로 변환                                                          |
| E2E         | 기존 admin URL-state test를 API-backed data로 교체해 query param behavior 유지                    |

## 구현 전 Gate

1. 사용자 확인: 이 preflight가 PSMS_Tech의 older Server Action/generic CRUD 문구보다 우선하는지 승인받는다.
2. `architect_reviewer`: route naming과 Fastify source-of-truth 결정 최종 확인.
3. `security_reviewer`: reusable Fastify session/admin guard 검토.
4. `db_reviewer`: policy history model 필요 여부와 master status dependency rule 확정.
5. `backend_agent`: shared Zod schema와 read-only page-data route부터 구현.
6. `qa_agent`: API inject test와 Web adapter regression test 정의.

## Architecture Approval Gate Result

작성 시각: 2026-05-01 23:37 KST

`architect_reviewer` 검토 결과, 이 preflight는 Admin Foundation 범위에서 older PSMS_Tech Server Action/generic CRUD 문구보다 우선하는 구현 baseline으로 조건부 승인한다.

### 승인 조건

- 적용 범위는 Admin Foundation인 `/staffs`, `/settings/base`, `/settings/policies`로 제한한다.
- PSMS_Tech 문서는 충돌하지 않는 IA/RBAC, domain model, audit expectation, business rule에는 계속 적용한다.
- 다음 구현은 read-only API scaffolding만 허용한다.
- 허용 read routes:
  - `GET /admin/staffs/page-data`
  - `GET /admin/staffs/detail`
  - `GET /admin/base/page-data`
  - `GET /admin/base/detail`
  - `GET /admin/policies/page-data`
  - `GET /admin/policies/detail`
- POST mutation, delete behavior, policy activation, export, backup, restore는 다음 구현 경계에서 제외한다.
- 모든 read route는 API-level session check, ACTIVE user check, ADMIN role check, Zod query validation을 수행한다.
- reusable admin/session guard는 auth/RBAC에 닿으므로 구현 전에 `security_reviewer` gate를 다시 통과한다.
- base `tab` dispatch는 allowlist만 허용한다. unchecked dynamic table routing은 금지한다.
- shared schema에서 query coercion/default를 먼저 고정한다.
- read scaffolding 단계에서는 Prisma schema/migration을 변경하지 않는다.
- policy history와 master-data dependency rule은 mutation 단계 전 `db_reviewer` blocker로 유지한다.

## Security Guard Gate Result

작성 시각: 2026-05-02 00:05 KST

`security_reviewer` 검토 결과, reusable Fastify admin guard는 read-only `/admin/*` scaffolding의 올바른 보안 경계로 조건부 승인한다. 단, Web route guard, sidebar filtering, redirect만으로는 API 보안을 대체할 수 없으며 모든 admin route에서 API-level guard를 먼저 수행해야 한다.

### Guard 구현 조건

1. request cookie에서 `psms_session`만 읽는다.
2. cookie가 없거나 malformed/undecodable이면 `401 AUTH_REQUIRED`를 반환한다.
3. raw session token은 `hashSessionToken`으로 해시하고, raw token 또는 hash를 log/response/audit payload에 남기지 않는다.
4. 기존 `getSessionByTokenHash`와 동등한 DB-backed session 검증 경로를 사용한다.
5. session revoked, expired, user inactive, usable role/store 조건 미충족 시 `401 AUTH_REQUIRED`를 반환한다.
6. 인증은 되었지만 `role !== "ADMIN"`이면 `403 FORBIDDEN`을 반환한다.
7. Zod query validation은 guard 성공 후 수행한다.
8. handler response는 승인된 read DTO와 `ActionResult`만 반환한다.
9. `passwordHash`, `sessionToken`, `sessionTokenHash`는 admin response에 포함하지 않는다.
10. authenticated forbidden `/admin/*` 접근은 추후 Audit Log 대상으로 검토한다. mutation/export는 별도 필수 audit gate를 둔다.

### Guard 구현 전/후 필수 테스트

- no cookie -> `401 AUTH_REQUIRED`
- malformed cookie -> `401 AUTH_REQUIRED`
- revoked/expired token -> `401 AUTH_REQUIRED`
- STAFF token -> `403 FORBIDDEN`
- ADMIN token -> `200 ok:true`
- invalid query -> ADMIN auth 이후 `400 VALIDATION_FAILED`
- base tab allowlist: `backup`, `restore`, `staffs`, unknown tab은 dispatch하지 않고 validation fail
- response shape: `passwordHash`, `sessionToken`, `sessionTokenHash` 미포함

## Admin Guard Implementation Result

작성 시각: 2026-05-01 23:58 KST

reusable Fastify admin/session guard를 `apps/api/src/auth/admin-session.guard.ts`에 구현했다. 이번 구현은 guard 모듈과 test-only probe route 기반 smoke test까지만 포함하며, production `/admin/*` route는 아직 등록하지 않았다.

### 구현 범위

- request cookie에서 `psms_session`을 읽고 malformed/empty cookie를 `401 AUTH_REQUIRED`로 처리한다.
- raw session token은 `hashSessionToken`으로 해시한 뒤 기존 `getSessionByTokenHash` 경로를 사용한다.
- missing, malformed, unknown, expired, revoked, inactive, unusable session은 `401 AUTH_REQUIRED`를 반환한다.
- authenticated `STAFF`는 `403 FORBIDDEN`을 반환한다.
- `ADMIN` session만 route handler에서 이후 Zod validation으로 진행할 수 있다.
- guard는 `reply`를 직접 쓰지 않고 typed result만 반환한다. route가 HTTP status와 `ActionResult`를 결정한다.
- test-only `/__test/admin-guard` route는 smoke test 내부에서만 등록한다.

### 구현 검증

- `pnpm test:api:inject`에 auth inject smoke와 admin guard inject smoke를 함께 연결했다.
- admin guard inject smoke는 no cookie, malformed cookie, unknown token, STAFF forbidden, STAFF without store, ADMIN success, guard-before-validation, duplicate cookie conservative handling, expired token, revoked token, inactive ADMIN, secret field leak absence를 검증한다.

## Admin Read API Scaffolding Result

작성 시각: 2026-05-02 00:10 KST

Admin Foundation read-only API scaffolding을 구현했다. 이번 구현은 기존 architecture/security gate에서 승인된 6개 GET route만 포함하며, POST mutation, delete, policy activation, export, backup, restore는 여전히 제외한다.

### 구현 route

- `GET /admin/staffs/page-data`
- `GET /admin/staffs/detail`
- `GET /admin/base/page-data`
- `GET /admin/base/detail`
- `GET /admin/policies/page-data`
- `GET /admin/policies/detail`

### 구현 범위

- 모든 route는 `requireAdminSession` guard를 먼저 수행한다.
- guard 성공 후 shared Zod query schema로 validation을 수행한다.
- validation 실패는 `400 VALIDATION_FAILED`를 반환한다.
- detail 대상이 없으면 `404 NOT_FOUND`를 반환한다.
- repository는 Prisma 접근만 담당하고, permission check와 business rule을 포함하지 않는다.
- base tab과 policy type dispatch는 exhaustive switch/allowlist로만 처리한다.
- staff response는 `User.email`을 API DTO `loginId`로 매핑하지만 `passwordHash`는 select하지 않는다.
- admin response에는 `passwordHash`, `sessionToken`, `sessionTokenHash`를 포함하지 않는다.
- policy date filter는 조회 기간과 정책 effective period의 overlap 기준으로 처리한다.
- smoke test fixture는 temp DB copy에만 삽입하며 source `dev.db`를 변경하지 않는다.

### 구현 검증

- `pnpm test:api:inject`에 real Admin read route smoke를 추가했다.
- real route smoke는 ADMIN success 6개 route, STAFF forbidden 6개 route, guard-before-validation, validation failure, not-found detail, secret field leak absence를 검증한다.

## 남은 결정 사항

| 결정                   | 현재 판단                                                 | 후속                                                      |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Policy history         | 전용 model 없음. AuditLog만으로는 기능 명세 충족이 애매함 | DB review 후 schema 변경 여부 결정                        |
| Staff loginId storage  | API는 `loginId`, DB는 임시로 `User.email`                 | 현 auth와 동일한 lowercase alphanumeric만 허용            |
| Policy URL `salesType` | Web URL은 `CHANGE`, API는 `CHANGE_DEVICE`                 | Web adapter에서 alias mapping 후 URL contract rename 검토 |
| Backup/restore         | Admin base CRUD 제외                                      | Electron/release checklist와 별도 API contract            |
| Delete                 | MVP 물리 삭제 없음                                        | 상태 변경과 dependency block만 구현                       |
