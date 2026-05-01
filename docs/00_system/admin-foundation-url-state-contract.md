# Admin Foundation URL State Contract

작성 시각: 2026-05-01 22:15 KST

## 목적

이 문서는 Admin Foundation 화면인 `/staffs`, `/settings/base`, `/settings/policies`의 URL search params와 Drawer/Modal 상태 계약을 구현 전에 고정하기 위한 preflight 문서다.

이번 계약은 Web UI 상태 계약이며, Auth / DB / API Contract를 변경하지 않는다. 생성, 수정, 삭제, 활성화 같은 mutation은 추후 반드시 Web thin adapter -> Fastify API -> service/repository -> `ActionResult` 흐름으로 구현한다.

## 공통 원칙

- `searchParams`는 목록 필터, 페이지네이션, 선택 탭, 열려 있는 Drawer/Modal intent의 canonical state다.
- Next.js 15+/16 기준 page props의 `searchParams`는 `Promise<Record<string, string | string[] | undefined>>`로 받고 Server Component에서 `await`한다.
- Server Component는 `requireSession()`과 `requireRole(..., ["ADMIN"])` 이후 허용된 params만 파싱하고 정규화한다.
- Client Component는 URL 변경과 폼 입력 상호작용만 담당한다. 권한 판단, 비즈니스 로직, API 계약, DB 접근을 소유하지 않는다.
- 닫기 동작은 overlay params인 `detail`, `mode`, `confirm`만 제거하고 `tab`, `q`, `page`, `pageSize`, `storeId`, `status` 같은 목록 상태를 보존한다.
- 필터 또는 탭 변경 시 `page`는 `1`로 초기화하고, stale `detail`, `mode`, `confirm`은 제거한다.
- 빈 문자열, 기본값, 알 수 없는 enum 값은 canonical URL에서 제거하거나 기본값으로 보정한다.
- URL 진입 자체가 mutation을 수행하면 안 된다. `mode=delete`, `mode=activate`, `confirm=activate`는 확인 UI intent까지만 표현한다.
- 잘못된 `detail` id는 Drawer를 열지 않고 목록 상태를 유지하거나 overlay params를 제거한다. 실제 조회/검증은 추후 API 계약에서 확정한다.

## 공통 타입 형태

```ts
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type OverlayMode = "create" | "edit" | "delete";

type PageSize = 10 | 20 | 50;
```

`mode=detail`은 허용하지 않는다. 상세 조회는 기존 IA 문서와 맞춰 `detail=:id`만 사용한다.

## `/staffs`

### 허용 Search Params

| Param      | Type                            | 기본값 | 설명                           |
| ---------- | ------------------------------- | ------ | ------------------------------ |
| `role`     | `ADMIN` \| `STAFF` \| `all`     | `all`  | 직원 역할 필터                 |
| `storeId`  | `string` \| `all`               | `all`  | 매장 필터                      |
| `status`   | `ACTIVE` \| `INACTIVE` \| `all` | `all`  | 계정 상태 필터                 |
| `q`        | `string`                        | 없음   | 이름, 로그인 ID, 연락처 검색어 |
| `page`     | positive integer                | `1`    | 페이지 번호                    |
| `pageSize` | `10` \| `20` \| `50`            | `10`   | 페이지 크기                    |
| `detail`   | `userId`                        | 없음   | 직원 상세 Drawer 대상          |
| `mode`     | `create` \| `edit` \| `delete`  | 없음   | 생성/수정/비활성 확인 intent   |

### URL 상태

| 상태        | URL 예시                                  | 처리                     |
| ----------- | ----------------------------------------- | ------------------------ |
| 목록        | `/staffs?role=STAFF&status=ACTIVE&page=2` | 필터와 페이지 적용       |
| 상세        | `/staffs?detail=user_123`                 | 상세 Drawer 표시         |
| 생성        | `/staffs?mode=create`                     | 신규 직원 Drawer 표시    |
| 수정        | `/staffs?mode=edit&detail=user_123`       | 직원 수정 Drawer 표시    |
| 비활성 확인 | `/staffs?mode=delete&detail=user_123`     | 확인 Modal intent만 표시 |

### 보류/주의

- `MANAGER` 역할은 현재 공식 RBAC가 `ADMIN`/`STAFF`뿐이므로 URL 계약에 넣지 않는다.
- 삭제는 물리 삭제가 아니라 상태 변경/비활성화 흐름으로 해석한다.

## `/settings/base`

### 허용 Search Params

| Param      | Type                                                                                                                               | 기본값         | 설명                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------- |
| `tab`      | `stores` \| `carriers` \| `salesAgencies` \| `colors` \| `deviceModels` \| `ratePlans` \| `addOnServices` \| `backup` \| `restore` | `deviceModels` | 기초정보 탭                  |
| `status`   | `ACTIVE` \| `INACTIVE` \| `all`                                                                                                    | `all`          | CRUD 탭 상태 필터            |
| `q`        | `string`                                                                                                                           | 없음           | 탭별 검색어                  |
| `page`     | positive integer                                                                                                                   | `1`            | 페이지 번호                  |
| `pageSize` | `10` \| `20` \| `50`                                                                                                               | `10`           | 페이지 크기                  |
| `detail`   | tab-scoped id                                                                                                                      | 없음           | 탭 안의 상세 대상            |
| `mode`     | `create` \| `edit` \| `delete`                                                                                                     | 없음           | 생성/수정/비활성 확인 intent |

### URL 상태

| 상태        | URL 예시                                                        | 처리                     |
| ----------- | --------------------------------------------------------------- | ------------------------ |
| 탭 목록     | `/settings/base?tab=deviceModels&q=Galaxy&page=1`               | 기종 탭 목록             |
| 상세        | `/settings/base?tab=deviceModels&detail=device_123`             | 기종 상세 Drawer 표시    |
| 생성        | `/settings/base?tab=deviceModels&mode=create`                   | 현재 탭 생성 Drawer      |
| 수정        | `/settings/base?tab=deviceModels&mode=edit&detail=device_123`   | 현재 탭 수정 Drawer      |
| 비활성 확인 | `/settings/base?tab=deviceModels&mode=delete&detail=device_123` | 확인 Modal intent만 표시 |

### 보류/주의

- `/staffs`가 별도 직원 관리 화면이므로 `/settings/base?tab=staffs`는 이번 공식 계약에서 제외한다.
- `backup`, `restore` 탭은 CRUD 목록이 아니므로 `q`, `page`, `detail`, `mode`는 무시한다. 백업/복원 기능은 Electron/release 단계와 권한/감사 로그 설계 후 별도 계약으로 확정한다.
- `detail`은 항상 현재 `tab` 범위 안에서만 의미가 있다. 탭 변경 시 `detail`, `mode`, `confirm`은 제거한다.

## `/settings/policies`

### 허용 Search Params

| Param       | Type                                                                | 기본값       | 설명                            |
| ----------- | ------------------------------------------------------------------- | ------------ | ------------------------------- |
| `tab`       | `saleProfit` \| `staffCommission` \| `discount` \| `activationRule` | `saleProfit` | 정책 탭                         |
| `carrierId` | `string` \| `all`                                                   | `all`        | 통신사 필터                     |
| `salesType` | `NEW` \| `CHANGE` \| `all`                                          | `all`        | 판매유형 필터 후보              |
| `status`    | `ACTIVE` \| `INACTIVE` \| `SCHEDULED` \| `EXPIRED` \| `all`         | `all`        | 정책 상태 필터                  |
| `from`      | `YYYY-MM-DD`                                                        | 없음         | 적용기간 시작                   |
| `to`        | `YYYY-MM-DD`                                                        | 없음         | 적용기간 종료                   |
| `q`         | `string`                                                            | 없음         | 정책명/조건 검색어              |
| `page`      | positive integer                                                    | `1`          | 페이지 번호                     |
| `pageSize`  | `10` \| `20` \| `50`                                                | `10`         | 페이지 크기                     |
| `detail`    | `policyId`                                                          | 없음         | 정책 상세 패널 대상             |
| `mode`      | `create` \| `edit` \| `delete`                                      | 없음         | 생성/수정/비활성 확인 intent    |
| `confirm`   | `activate`                                                          | 없음         | 정책 활성화 확인 UI intent 후보 |

### URL 상태

| 상태             | URL 예시                                                            | 처리                          |
| ---------------- | ------------------------------------------------------------------- | ----------------------------- |
| 목록             | `/settings/policies?tab=saleProfit&carrierId=skt&status=ACTIVE`     | 정책 목록 필터                |
| 상세             | `/settings/policies?tab=saleProfit&detail=pol_123`                  | 정책 상세 패널 표시           |
| 생성             | `/settings/policies?tab=saleProfit&mode=create`                     | 정책 생성 Drawer 표시         |
| 수정             | `/settings/policies?tab=saleProfit&mode=edit&detail=pol_123`        | 정책 수정 Drawer 표시         |
| 비활성 확인      | `/settings/policies?tab=saleProfit&mode=delete&detail=pol_123`      | 확인 Modal intent만 표시      |
| 활성화 확인 후보 | `/settings/policies?tab=saleProfit&detail=pol_123&confirm=activate` | 확인 UI만 표시, mutation 금지 |

### 보류/주의

- `salesType`은 현재 UI와 정책 문서 사이의 후보 값이다. 실제 Fastify API filter 계약에서 확정 전까지는 후보로 둔다.
- 정책 활성화는 기간/조건 충돌 검증, 기존 활성 정책 비활성화/만료, 버전 이력 기록이 필요하므로 URL state로 처리하지 않는다.
- 화면의 한국어 `예약` 상태는 URL/API 값으로 `SCHEDULED`를 사용한다.

## Parser / Href Helper 구현 원칙

다음 구현 단계에서 route별 parser와 href helper를 추가한다.

```txt
apps/web/src/features/admin/staffs/staffs-search-params.ts
apps/web/src/features/admin/base/base-search-params.ts
apps/web/src/features/admin/policies/policies-search-params.ts
apps/web/src/lib/url-search.ts
```

파서의 기본 책임:

- `string[]` 값은 첫 번째 값만 사용한다.
- enum whitelist 밖의 값은 기본값으로 보정한다.
- `page < 1`, `NaN`, 소수, 비숫자 문자열은 `1`로 보정한다.
- `pageSize`는 `10`, `20`, `50`만 허용한다.
- `q`는 trim 후 빈 문자열이면 제거한다.
- `from`, `to`는 `YYYY-MM-DD`만 허용한다. 둘 중 하나만 유효하면 유효한 값만 유지한다.
- `mode=edit` 또는 `mode=delete`에 `detail`이 없으면 `mode`를 제거한다.
- `mode=create`가 있으면 `detail`은 제거한다.
- `tab` 변경 href는 `page=1`로 초기화하고 overlay params를 제거한다.

## Server / Client 경계

### Server Component

- session/role guard
- `await searchParams`
- route별 parser 실행
- API adapter 또는 query module 호출
- selected `detail` 조회
- serializable props만 Client Component에 전달

### Client Component

- 필터 입력, 탭, pagination, row open, drawer close
- `Link`로 결정적 이동 처리
- `router.push()`로 의미 있는 navigation 처리
- `router.replace()`로 debounce search, 닫기, low-commit UI update 처리
- mutation은 Server Action thin adapter 호출만 담당

## 테스트 기준

다음 구현 단계에서 최소 검증한다.

- `/staffs?role=STAFF&page=2&detail=user_1` 직접 진입 시 필터와 Drawer 상태 보존
- `/settings/base?tab=deviceModels&mode=create` 직접 진입 시 생성 Drawer 표시
- `/settings/policies?tab=saleProfit&detail=pol_1` 직접 진입 시 상세 패널 표시
- 필터 변경 시 `page=1`, stale `detail/mode/confirm` 제거
- Drawer close 시 목록 필터 보존
- invalid params clamp: unknown enum -> default, invalid page -> `1`
- STAFF는 `/staffs`, `/settings/base`, `/settings/policies` 접근 불가
- route-guards와 design-density 회귀 통과

## 현재 구현 Gap

| Route                | Gap                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/staffs`            | `searchParams`를 아직 읽지 않고, Drawer가 항상 렌더되며 close href가 `/staffs`로 고정되어 필터 보존 규칙이 없다. |
| `/settings/base`     | `tab`, `detail`, `mode`가 URL과 연결되지 않았고 Drawer가 항상 등록 폼으로 렌더된다.                              |
| `/settings/policies` | 우측 상세 패널이 항상 `POL-001` 기준이고 `detail`과 연결되지 않았다.                                             |

## 변경 금지 범위

이번 preflight 문서만으로 다음 항목을 변경하지 않는다.

- Auth/session/RBAC
- Prisma schema/migration/seed
- Fastify API contract
- `packages/shared` Zod schema
- 정책 활성화/충돌 검증
- 직원 역할 enum 추가
- 백업/복원 Electron runtime 계약
