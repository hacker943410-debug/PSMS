# Staff Create Security Preflight

작성일: 2026-05-06

## 목적

이 문서는 `POST /admin/staffs/create` 구현 전에 직원 생성 API 계약, password 처리,
DB 제약, AuditLog, Web drawer, 테스트 범위를 확정한다.

이번 작업은 preflight 문서화 단계다. `apps/api`, `packages/shared`,
`packages/db`, `apps/web` 구현 코드는 변경하지 않는다.

## 최종 판정

| 항목            | 결정                                                                  |
| --------------- | --------------------------------------------------------------------- |
| 구현 판정       | 조건부 Go                                                             |
| 허용 slice      | `INACTIVE` 직원 생성 + 서버 내부 placeholder password hash 저장       |
| 금지 slice      | `ACTIVE` 즉시 로그인 계정 생성, raw/temporary password 표시 또는 반환 |
| DB migration    | 없음. 현재처럼 `loginId`는 `User.email`에 저장                        |
| activation 정책 | 별도 password reset/activation gate에서 확정                          |
| Web 역할        | password 필드 없는 create drawer, API adapter, revalidation만 담당    |

현재 DB `User`에는 `passwordHash`만 있고 first-login, must-change-password,
reset-token 상태 필드가 없다. 따라서 이번 slice에서 raw temporary password를
요청/응답/UI/AuditLog에 노출하는 방식은 진행하지 않는다.

## Subagent 결론 요약

| Subagent  | Harness role        | 결론                                                                                |
| --------- | ------------------- | ----------------------------------------------------------------------------------- |
| Laplace   | `security_reviewer` | raw/temporary password 노출은 No-go. `INACTIVE` 생성 + secret redaction 권장        |
| Ramanujan | `backend_agent`     | 기존 update/status route-service-repository 패턴 확장 가능. password 정책 확정 필요 |
| Hume      | `db_reviewer`       | `loginId === User.email` 정책이면 migration 불필요. 분리하려면 DB gate 필요         |
| Banach    | `qa_agent`          | API inject matrix와 Staff 전용 Web E2E 분리 권장. secret leak 회귀 테스트 필수      |
| Codex     | controller          | 네 관점을 통합해 안전한 create contract와 다음 구현 순서를 고정                     |

## API Contract

### Route

```txt
POST /admin/staffs/create
```

`staffMutationRoutes.create`로 추가하고, 기존 `requireAdminForStaffMutation` guard를
재사용한다.

### Input

이번 slice에서는 `status`를 받지 않거나, 받더라도 `INACTIVE` literal만 허용한다.
Web은 명시적으로 active 계정을 만들 수 없다.

```ts
type AdminCreateStaffInput = {
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId?: string | null;
  phone?: string | null;
  status?: "INACTIVE";
};
```

Validation policy:

| 필드      | 정책                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `name`    | trim, whitespace collapse, 2~60자                                      |
| `loginId` | trim -> lowercase, `^[a-z0-9]{4,32}$`, DB 저장은 `User.email`          |
| `role`    | `ADMIN` 또는 `STAFF`                                                   |
| `storeId` | `STAFF`는 active store 필수. `ADMIN`은 null 허용, 값이 있으면 active만 |
| `phone`   | optional nullable, 빈 문자열은 null, max 30                            |
| `status`  | optional. 제공 시 `INACTIVE`만 허용                                    |

금지 input key:

- `password`
- `temporaryPassword`
- `initialPassword`
- `passwordHash`
- `sessionToken`
- `sessionTokenHash`
- `resetToken`
- `shouldSendInitialPassword`
- `issueTemporaryPassword`

### Result

```ts
type AdminStaffCreateResult = {
  userId: string;
  name: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  phone: string | null;
  status: "INACTIVE";
  createdAt: string;
  updatedAt: string;
};
```

성공 응답은 `201` + `ActionResult<AdminStaffCreateResult>`다.
응답에 password, hash, token, temporary password는 포함하지 않는다.

### Error Mapping

| HTTP | Code                    | 조건                                                  |
| ---: | ----------------------- | ----------------------------------------------------- |
|  400 | `VALIDATION_FAILED`     | Zod body 검증 실패, unknown key, `status=ACTIVE` 시도 |
|  401 | `AUTH_REQUIRED`         | 세션 없음, 만료, 폐기, inactive user                  |
|  403 | `FORBIDDEN`             | authenticated STAFF 또는 ADMIN 아님                   |
|  409 | `DUPLICATE_LOGIN_ID`    | `User.email` 기준 loginId 중복                        |
|  409 | `STAFF_STORE_REQUIRED`  | STAFF 생성에 store 누락, 존재하지 않음, 또는 inactive |
|  500 | `INTERNAL_SERVER_ERROR` | 예상 밖 오류. secret 값 미포함                        |

비인증 요청은 malformed body라도 validation보다 `401 AUTH_REQUIRED`가 먼저 반환되어야 한다.

## Service / Repository 설계

### Route Flow

```txt
request cookie read
-> requireAdminForStaffMutation("ADMIN_STAFF_CREATED")
-> parseAdminBody(adminCreateStaffInputSchema)
-> createAdminStaff(session, input, requestMeta)
-> reply.code(statusCode).send(ActionResult)
```

인증된 STAFF의 create 시도는 기존 update/status와 같은 방식으로
`ADMIN_MUTATION_FORBIDDEN` AuditLog를 남긴다.

### Service Flow

```txt
generate unknown high-entropy placeholder secret
-> hashPassword(secret)
-> immediately drop raw secret reference
-> prisma.$transaction
   -> duplicate loginId check
   -> active store validation
   -> User.create({ email: loginId, passwordHash, status: INACTIVE, ... })
   -> AuditLog.create(ADMIN_STAFF_CREATED)
-> return redacted ActionResult
```

Placeholder secret은 관리자나 신규 직원에게 알려지지 않는다. 이 계정은
`INACTIVE` 상태라 로그인할 수 없고, 실제 activation/password reset은 별도 slice에서
정의한다.

### Repository Helpers

| Helper                    | 책임                                                   |
| ------------------------- | ------------------------------------------------------ |
| `findAdminStaffByLoginId` | `User.email` 기준 중복 조회                            |
| `findAdminStaffStoreById` | 기존 helper 재사용. active store 여부는 service가 판단 |
| `createAdminStaff`        | Prisma `User.create`만 담당                            |
| `createAuditLog`          | 기존 audit repository 재사용                           |

Repository에는 permission, role/store business rule, password 정책, audit payload 판단을
넣지 않는다.

### DB / Prisma Race Handling

| Prisma 오류 | 정규화 응답                                     | 이유                              |
| ----------- | ----------------------------------------------- | --------------------------------- |
| `P2002`     | `409 DUPLICATE_LOGIN_ID`                        | 사전 중복 조회와 unique race 보완 |
| `P2003`     | `409 STAFF_STORE_REQUIRED` 또는 validation 계열 | store FK race 보완                |

`loginId`와 연락용 email을 분리하는 설계는 이번 slice 범위 밖이다. 그 경우
`loginId @unique` 추가, seed/auth/query 전환, migration/rollback plan이 필요하므로
별도 DB preflight로 보낸다.

## AuditLog Policy

성공 시:

| 필드          | 값                              |
| ------------- | ------------------------------- |
| `action`      | `ADMIN_STAFF_CREATED`           |
| `entityType`  | `User`                          |
| `entityId`    | 생성된 user id                  |
| `actorUserId` | session user id                 |
| `afterJson`   | redacted created staff metadata |
| `ipAddress`   | request metadata                |
| `userAgent`   | request metadata                |

`afterJson` 허용 필드:

```ts
{
  userId: string;
  loginId: string;
  name: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  status: "INACTIVE";
  phone: string | null;
  passwordDelivery: "NONE";
  activationRequired: true;
}
```

AuditLog 금지 필드:

- raw password
- temporary password
- placeholder secret
- `passwordHash`
- session token 또는 token hash
- reset token
- request body raw dump

`401`은 신뢰 가능한 actor가 없으므로 AuditLog를 남기지 않는다. `403`은 authenticated
STAFF 접근일 때만 `ADMIN_MUTATION_FORBIDDEN`을 남긴다.

## Web Boundary

Web Server Action은 아래만 수행한다.

1. FormData shape 읽기
2. shared Zod schema로 UX용 1차 validation
3. `postAdminApi<AdminStaffCreateResult>("/admin/staffs/create", parsed.data)`
4. 성공 시 `/staffs` revalidate
5. URL state에서 `mode=create` 제거 또는 상세 drawer로 이동

Web 금지 사항:

- password input 추가 금지
- temporary password 표시 금지
- password 생성/hash 금지
- duplicate loginId, active store, permission, audit 판단 금지
- browser-native `alert`/`confirm` 사용 금지

Create drawer는 생성 성공 후 “비활성 직원이 생성됨” 상태를 보여줄 수 있지만,
로그인 가능화나 초기 비밀번호 안내는 별도 activation/reset slice 전까지 제공하지 않는다.

## Test Matrix

### API Inject

| 구분       | 케이스                                                                |
| ---------- | --------------------------------------------------------------------- |
| auth order | no cookie + invalid payload -> `401 AUTH_REQUIRED`                    |
| forbidden  | STAFF session create -> `403 FORBIDDEN`, User 미생성, forbidden audit |
| validation | invalid name/loginId/role/status, unknown key -> `400`                |
| success    | ADMIN creates `STAFF` with active store -> `201`, status `INACTIVE`   |
| success    | ADMIN creates `ADMIN` without store -> `201`, status `INACTIVE`       |
| conflict   | duplicate loginId -> `409 DUPLICATE_LOGIN_ID`                         |
| conflict   | STAFF store missing/not-found/inactive -> `409 STAFF_STORE_REQUIRED`  |
| storage    | DB `passwordHash`는 `isPasswordHash()` 통과, raw secret 접근 불가     |
| audit      | `ADMIN_STAFF_CREATED`, entity `User`, redacted `afterJson`            |
| secret     | response/audit에 password/hash/token/temp/reset key 없음              |
| login      | 생성된 `INACTIVE` 계정 로그인 실패                                    |

### Web E2E

Staff create Web E2E는 base/policies URL-state 실패와 분리한다.

| 구분       | 케이스                                                           |
| ---------- | ---------------------------------------------------------------- |
| drawer     | `/staffs?mode=create` 진입 시 create drawer 열림                 |
| validation | 빈 submit, invalid loginId, STAFF store 미선택 오류 표시         |
| success    | 고유 loginId 생성, 성공 메시지, drawer close 또는 detail 이동    |
| refresh    | 생성된 loginId/name이 list에 표시되고 detail drawer로 열림       |
| secret     | 화면 visible text에 password/hash/token/temp/reset 문자열 미노출 |
| viewport   | `1586`, `1440`, `1280`에서 drawer/form/list refresh 검증         |

## 구현 순서

1. `packages/shared/src/admin/staffs.validation.ts`에 create schema 추가.
2. `packages/shared/src/admin/read-models.ts`에 `AdminStaffCreateResult` 추가.
3. `apps/api/src/repositories/admin-staff.repository.ts`에 loginId lookup/create helper 추가.
4. `apps/api/src/services/admin/staffs.service.ts`에 `createAdminStaff` service 추가.
5. `apps/api/src/routes/admin/staffs.routes.ts`에 `POST /admin/staffs/create` 연결.
6. `test/smoke/api-admin-staff-mutation-inject-smoke.ts`에 create matrix 추가.
7. Web Server Action과 create drawer를 password 없는 form으로 연결.
8. Staff create 전용 Web E2E와 3 viewport runtime validation 수행.

## 금지 범위

- 이번 slice에서 Prisma schema/migration 변경 금지.
- raw/temporary password 요청/응답/UI/AuditLog 노출 금지.
- `ACTIVE` 초기 계정 생성 금지.
- `shouldSendInitialPassword` 또는 notification channel 구현 금지.
- password reset/activation token 구현 금지.
- Web Server Action에 business rule 추가 금지.
- STAFF 권한 완화 금지.
