# Staff Activation Password Reset Preflight

작성일: 2026-05-07

## 목적

이 문서는 직원 계정 활성화와 비밀번호 재설정 구현 전에 보안, DB, API, Web
경계를 확정한다.

이번 작업은 preflight 문서화 단계다. `apps/api`, `packages/shared`,
`packages/db`, `apps/web` 구현 코드는 변경하지 않는다.

## 최종 판정

| 항목                  | 결정                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| 구현 판정             | 조건부 Go                                                                                     |
| 허용 slice            | 전용 token model, API contract, delivery policy가 승인된 뒤 구현                              |
| 금지 slice            | 기존 `/admin/staffs/change-status`를 계정 활성화로 재사용                                     |
| DB migration          | 필요. 별도 `UserPasswordToken` model과 enum 추가                                              |
| delivery policy       | 미정. 안전한 전달 채널 승인 전에는 issue API 구현 No-go                                       |
| raw secret 노출       | No-go. raw token, reset URL, temporary password, password hash를 응답/UI/AuditLog에 노출 금지 |
| Web 역할              | 관리자 drawer는 발급/회수 요청 adapter만 담당. password/hash/token 생성 또는 판단 금지        |
| token-holder endpoint | 비인증 route 허용. 권한은 유효한 1회용 token 소유로 판단                                      |

현재 `User` model은 `passwordHash`, `status`, `sessions`, `auditLogs`만 갖고 있다.
따라서 만료, 1회 사용, 회수, replay 방지, 감사 추적을 만족하는 활성화/재설정을
`User` nullable field만으로 구현하지 않는다.

## Subagent 결론 요약

| Subagent  | Harness role         | Model route    | 결론                                                                                        |
| --------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Nietzsche | `security_reviewer`  | GPT-5.5 high   | `change-status` 활성화는 No-go. dedicated token, 30분 TTL, raw secret 완전 비노출 필요      |
| Pauli     | `db_reviewer`        | GPT-5.5 high   | `UserPasswordToken` 별도 model과 `activeKey @unique`로 SQLite/PostgreSQL portable 제약 권장 |
| Carson    | `architect_reviewer` | GPT-5.5 high   | route는 action-specific로 분리하고 delivery 미정이면 issue 구현도 보류                      |
| Turing    | `frontend_agent`     | GPT-5.5 medium | staff detail drawer의 별도 `계정 접근` section은 API/security gate 이후에만 추가            |
| Codex     | controller           | GPT-5          | 리뷰 결과를 통합해 구현 전 gate, 금지 범위, 다음 구현 순서를 고정                           |

Spark는 사용하지 않는다. 이 범위는 auth, password, session revoke, RBAC, AuditLog,
DB migration, API contract를 포함하므로 하네스 기준 Spark 금지 또는 부적합 범위다.

## 현재 구현 사실

| 영역          | 현재 상태                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `User` schema | `email`을 loginId 저장소로 사용, `passwordHash`, `role`, `status`, `storeId`, `sessions` 보유       |
| Staff create  | `INACTIVE` 사용자 생성, 서버 내부 placeholder secret을 hash 후 저장, raw secret은 반환하지 않음     |
| Staff status  | `/admin/staffs/change-status`는 `ACTIVE`/`INACTIVE` 상태만 변경하고 비활성화 시 session revoke 수행 |
| Login         | `ACTIVE` user만 사용 가능. `STAFF`는 store 배정도 필요                                              |
| Delivery      | email/SMS/local out-of-band 전달 정책 없음. loginId도 email 형식이 아님                             |
| AuditLog      | schemaless JSON이므로 service allowlist로 secret redaction을 강제해야 함                            |

## DB Contract

전용 token model을 추가한다. `User`에 nullable reset field를 직접 추가하지 않는다.

```prisma
enum UserPasswordTokenPurpose {
  STAFF_ACTIVATION
  PASSWORD_RESET
}

model User {
  // existing fields...
  passwordTokensCreated UserPasswordToken[] @relation("PasswordTokenCreator")
  passwordTokensRevoked UserPasswordToken[] @relation("PasswordTokenRevoker")
  passwordTokens        UserPasswordToken[] @relation("PasswordTokenSubject")
}

model UserPasswordToken {
  id     String @id @default(cuid())
  userId String
  user   User   @relation("PasswordTokenSubject", fields: [userId], references: [id], onDelete: Restrict)

  purpose   UserPasswordTokenPurpose
  tokenHash String                   @unique
  activeKey String?                  @unique

  expiresAt DateTime
  usedAt    DateTime?
  revokedAt DateTime?

  createdById String?
  createdBy   User?   @relation("PasswordTokenCreator", fields: [createdById], references: [id], onDelete: Restrict)
  revokedById String?
  revokedBy   User?   @relation("PasswordTokenRevoker", fields: [revokedById], references: [id], onDelete: Restrict)

  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, purpose, expiresAt])
  @@index([userId, purpose, usedAt, revokedAt])
  @@index([purpose, expiresAt])
  @@index([createdById])
  @@index([revokedById])
}
```

`activeKey`는 활성 token일 때만 `${userId}:${purpose}`를 저장하고, 사용 또는 회수 시
`null`로 변경한다. SQLite와 PostgreSQL 양쪽에서 provider-specific partial unique
index 없이 “사용자/목적별 활성 token 1개”를 강제하기 위한 MVP 전략이다.

### Migration / Seed

| 항목        | 정책                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| Backfill    | 기존 row backfill 없음. required column을 기존 table에 추가하지 않음                   |
| Seed        | seed script는 activation/reset token을 생성하지 않음                                   |
| Token count | 기본 seed 후 token count는 `0`이어야 함                                                |
| Retention   | AuditLog는 삭제 금지. used/revoked/expired token은 보존 기간 이후 cleanup job에서 삭제 |

## Token Security Policy

| 항목          | 정책                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Raw token     | `randomBytes(32+)` base64url. 생성 직후 1회 전달 channel에만 사용하고 저장하지 않음        |
| Token hash    | raw token을 HMAC-SHA256으로 hash. `PASSWORD_TOKEN_SECRET` 권장, 없으면 gate 실패           |
| Hash prefix   | 예: `v1:hmac-sha256:<digest>`                                                              |
| Expiry        | MVP 기본 30분. 연장 필요 시 별도 보안 승인 필요                                            |
| One-time      | `usedAt`, `revokedAt`, `expiresAt` 조건을 transaction에서 확인하고 1회만 consume           |
| Reissue       | 같은 user/purpose의 기존 활성 token을 먼저 revoke 후 새 token 생성                         |
| Session       | activation/reset 완료 시 대상 user의 active session을 모두 revoke하고 자동 로그인하지 않음 |
| Status        | activation purpose 완료 시에만 `INACTIVE -> ACTIVE` 전환                                   |
| Generic error | invalid, expired, used, revoked, wrong-purpose token은 같은 generic error 반환             |
| Rate limit    | ADMIN issue는 actor+target bucket, complete는 token/IP와 IP bucket을 분리                  |

비밀번호 정책은 shared schema로 분리한다. MVP 기준은 최소 12자, 최대 128 또는 256자,
혼합 문자군, loginId/name 기반 약한 값 거부를 목표로 한다.

## API Contract

모든 route는 기존 `ActionResult<T>` shape를 유지한다. generic CRUD route를 만들지
않고 화면/행동 단위 route로 분리한다.

### Admin Issue / Revoke Routes

| Method | Path                                  | 설명                                  |
| ------ | ------------------------------------- | ------------------------------------- |
| POST   | `/admin/staffs/activation/issue`      | 비활성 직원 활성화 요청 발급          |
| POST   | `/admin/staffs/activation/revoke`     | 활성화 요청 회수                      |
| POST   | `/admin/staffs/password-reset/issue`  | 활성 사용자 비밀번호 재설정 요청 발급 |
| POST   | `/admin/staffs/password-reset/revoke` | 비밀번호 재설정 요청 회수             |

Admin route guard 순서:

```txt
session cookie read
-> session token hash 검증
-> session user ACTIVE 확인
-> ADMIN role 확인
-> Zod input validation
-> target business rule validation
-> transaction
-> AuditLog
-> ActionResult 반환
```

인증된 `STAFF` 요청은 `403 FORBIDDEN`과 `ADMIN_MUTATION_FORBIDDEN` AuditLog를
남긴다. 비인증 요청은 malformed body라도 validation보다 `401 AUTH_REQUIRED`가
먼저 반환되어야 한다.

### Admin Issue Input

```ts
type AdminStaffCredentialIssueInput = {
  userId: string;
  expectedUpdatedAt?: string;
  reason?: string;
};
```

### Admin Issue Result

```ts
type AdminStaffCredentialIssueResult = {
  userId: string;
  purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET";
  expiresAt: string;
  delivery: {
    mode: "EMAIL_QUEUED" | "SMS_QUEUED" | "OUT_OF_BAND_APPROVED";
  };
  revokedTokenCount: number;
};
```

응답에는 raw token, reset URL, token hash, password, password hash, temporary
password를 포함하지 않는다. 승인된 delivery channel이 없으면 성공 응답 대신
`503 DELIVERY_UNAVAILABLE`을 반환한다.

### Token-holder Routes

| Method | Path                              | 설명                           |
| ------ | --------------------------------- | ------------------------------ |
| POST   | `/auth/staff-activation/verify`   | token 유효성 사전 확인         |
| POST   | `/auth/staff-activation/complete` | 새 password 설정 + 계정 활성화 |
| POST   | `/auth/password-reset/verify`     | reset token 유효성 사전 확인   |
| POST   | `/auth/password-reset/complete`   | 새 password 설정               |

Token-holder route는 session을 요구하지 않는다. 권한은 유효한 1회용 token 소유로
판단한다.

```ts
type CredentialTokenPreview = {
  purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET";
  loginId: string;
  name: string;
  expiresAt: string;
  passwordPolicy: {
    minLength: number;
    maxLength: number;
  };
};

type CredentialCompleteInput = {
  token: string;
  password: string;
  confirmPassword: string;
};

type CredentialCompleteResult = {
  redirectTo: "/login";
  activated: boolean;
  revokedSessionCount: number;
};
```

Complete 성공 시 자동 로그인하지 않고 `/login`으로 보낸다.

## Business Rules

| 규칙                 | 정책                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| Activation 대상      | `INACTIVE` 사용자만 허용. `STAFF`는 active store 배정이 필요                         |
| Password reset 대상  | `ACTIVE` 사용자만 허용. inactive user는 activation flow를 사용                       |
| Admin 대상           | store 없이 activation 가능하지만 마지막 활성 관리자 보호 규칙을 약화하지 않음        |
| Self reset           | admin staff 관리 route를 통한 자기 자신 reset은 금지. 별도 self password flow로 분리 |
| Status change        | `change-status`는 계정 상태 관리일 뿐 password activation이 아님                     |
| Deactivation         | user를 `INACTIVE`로 바꿀 때 active sessions와 active password token을 모두 revoke    |
| Role/store change    | 권한 또는 store 변경 시 active sessions와 active password token revoke 검토          |
| Delivery unavailable | token을 만들지 않거나 transaction 전체 rollback 후 `DELIVERY_UNAVAILABLE` 반환       |

## AuditLog Policy

추가 audit action 후보:

| Action                               | 시점                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `ADMIN_STAFF_ACTIVATION_ISSUED`      | ADMIN이 활성화 요청 발급                                    |
| `ADMIN_STAFF_ACTIVATION_REVOKED`     | ADMIN이 활성화 요청 회수                                    |
| `ADMIN_STAFF_PASSWORD_RESET_ISSUED`  | ADMIN이 reset 요청 발급                                     |
| `ADMIN_STAFF_PASSWORD_RESET_REVOKED` | ADMIN이 reset 요청 회수                                     |
| `STAFF_ACTIVATION_COMPLETED`         | token-holder가 활성화 완료                                  |
| `STAFF_PASSWORD_RESET_COMPLETED`     | token-holder가 reset 완료                                   |
| `AUTH_PASSWORD_TOKEN_FAILED`         | rate limit 또는 의심 실패. raw token 없이 제한적으로만 기록 |

Audit payload 허용 필드:

```ts
{
  tokenId: string;
  userId: string;
  loginId: string;
  role: "ADMIN" | "STAFF";
  statusBefore?: "ACTIVE" | "INACTIVE";
  statusAfter?: "ACTIVE" | "INACTIVE";
  storeId: string | null;
  purpose: "STAFF_ACTIVATION" | "PASSWORD_RESET";
  expiresAt: string;
  deliveryMode: "EMAIL_QUEUED" | "SMS_QUEUED" | "OUT_OF_BAND_APPROVED";
  revokedPreviousCount?: number;
  revokedSessionCount?: number;
  reason?: string;
}
```

Audit payload 금지 필드:

- raw token
- reset URL 또는 activation URL
- token hash
- password
- password hash
- password length
- temporary password
- placeholder secret
- raw request body dump
- session token 또는 session token hash

## Web Boundary

이번 preflight에서는 UI control을 추가하지 않는다.

향후 API/security gate 통과 후에만 `/staffs?detail=<userId>` detail drawer에 별도
`계정 접근` section을 추가한다. 기존 `현재 상태` 변경 control과 계정 접근 요청은
시각적으로도 의미적으로도 분리한다.

허용 copy:

- `비밀번호 설정 요청 발급`
- `비밀번호 재설정 요청 발급`
- `직원이 본인 비밀번호를 직접 설정해야 로그인할 수 있습니다.`
- `설정 요청은 만료 시간이 있으며 다시 발급할 수 있습니다.`

금지 copy / UI:

- `임시 비밀번호`
- `초기 비밀번호`
- `관리자가 비밀번호를 설정`
- `복사` action for one-time link
- raw password, generated password, token, reset URL, hash, secret
- browser-native `alert` 또는 `confirm`

Token-holder page는 workspace sidebar layout을 상속하지 않는 auth-side route로 둔다.
Web Server Action은 FormData validation, API adapter 호출, redirect/revalidation만
담당한다.

## Test Matrix

### DB / Migration

| 구분        | 케이스                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| validate    | Prisma validate/generate 통과                                            |
| migration   | create-only migration SQL review                                         |
| unique      | `tokenHash @unique`, `activeKey @unique` 제약 검증                       |
| issue twice | 같은 user/purpose 두 번 발급 시 이전 token revoke, active token 1개 유지 |
| seed        | seed/master seed 후 token count `0`, idempotency 유지                    |
| cleanup     | AuditLog 삭제 없이 token retention cleanup 가능성 확인                   |

### API Inject

| 구분       | 케이스                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| auth order | no cookie + invalid payload -> `401 AUTH_REQUIRED`                       |
| forbidden  | STAFF issue/revoke -> `403 FORBIDDEN`, token row 없음, forbidden audit   |
| validation | malformed body, unknown secret key -> generic `VALIDATION_FAILED`        |
| activation | INACTIVE STAFF with active store activation issue success                |
| activation | INACTIVE ADMIN activation issue success                                  |
| reset      | ACTIVE STAFF/ADMIN password reset issue success                          |
| state      | ACTIVE activation, INACTIVE reset, STAFF without active store는 conflict |
| revoke     | issued token revoke 후 complete 실패                                     |
| consume    | valid token complete once success, second complete generic failure       |
| expired    | expired token complete 실패                                              |
| session    | reset/activation complete 후 대상 user active sessions revoke            |
| login      | activation 전 login 실패, activation 완료 후 새 password login 성공      |
| secret     | response/AuditLog/log에 token/password/hash/reset URL 문자열 미노출      |
| rate limit | issue/complete 반복 시 separate bucket으로 `429 RATE_LIMITED`            |

### Web / E2E

| 구분          | 케이스                                                              |
| ------------- | ------------------------------------------------------------------- |
| admin drawer  | `계정 접근` section은 API contract 구현 후에만 표시                 |
| no secret     | admin 화면 visible text에 password/hash/token/temp/reset URL 미노출 |
| STAFF         | STAFF는 `/staffs` 및 issue/reset action 접근 불가                   |
| token page    | valid token은 password setup form 표시                              |
| invalid token | invalid/expired/reused token은 generic error 표시                   |
| success       | 완료 후 `/login` redirect, 재사용 token 실패                        |
| viewport      | `/staffs?detail=<id>` 1586x992, 1440x900, 1280x800 검증             |

## 구현 순서

1. DB migration preflight: `UserPasswordTokenPurpose`, `UserPasswordToken`,
   `User` relation, rollback/retention plan 확정.
2. Shared token/password schema: issue/revoke/verify/complete input/result DTO와
   password policy 추가.
3. Token hash helper: raw token generation, HMAC hash, secret validation, redaction
   tests 추가.
4. Repository: token create/find/consume/revoke helper. business rule은 넣지 않음.
5. Service: issue/revoke/verify/complete transaction, password hash, status
   activation, session revoke, AuditLog.
6. Routes: admin guard-before-validation, token-holder unauthenticated route, rate
   limit 적용.
7. Web: staff detail drawer `계정 접근` section, token-holder password setup page,
   thin server actions.
8. API inject, unit, secret scanner, E2E, DB validation, build 검증.

## 금지 범위

- temporary/default/generated password를 관리자 또는 직원에게 보여주기 금지.
- `ACTIVE` 계정 생성으로 activation을 대체 금지.
- `/admin/staffs/change-status`를 password activation으로 재정의 금지.
- raw token, reset URL, token hash를 response/UI/AuditLog/log에 저장 금지.
- token을 list/detail read model에 포함 금지.
- Web Server Action에서 token 생성, password hash, permission 판단 금지.
- STAFF의 staff activation/reset/admin route 접근 허용 금지.
- 무만료, 다회 사용, 수동 DB update 방식 reset 금지.

## Blocker / Follow-up

| Blocker                | 영향                                                   | 다음 조치                                                               |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Delivery policy 미정   | issue API가 token을 만들어도 사용자에게 안전 전달 불가 | email/SMS/out-of-band 중 MVP 정책을 architecture/security gate에서 확정 |
| Token DB model 없음    | one-time/expiry/revoke/audit 구현 불가                 | `db_reviewer` 포함 migration preflight 후 schema 구현                   |
| Rate limit persistence | token brute force 방어 부족                            | login rate limit pattern 재사용 또는 persistent bucket model 검토       |
| P2003 catch 범위       | AuditLog actor FK 실패가 store error로 오인 가능       | staff mutation service의 P2003 mapping을 더 좁히는 후속 hardening       |
