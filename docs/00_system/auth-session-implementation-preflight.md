# Auth Session Implementation Preflight

작성일: 2026-04-30

## 1. 목적

다음 단계인 실제 `loginAction`, `logoutAction`, DB-backed opaque session, workspace guard, RBAC 구현 전에 구현 경계와 안전 gate를 확정한다.

이번 작업은 preflight 문서화 작업이다. 인증 코드, DB schema, migration, API contract, seed 데이터는 변경하지 않는다.

## 2. 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router. `(auth)/login` 정적 UI와 `(workspace)` route group, workspace shell/sidebar skeleton 존재   |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories`는 `.gitkeep`만 존재. 실제 action/query/service 없음 |
| DB             | SQLite `dev.db`에 Prisma initial migration 적용 완료. `User`, `Session`, `Store`, `AuditLog` table 존재         |
| 인증           | `src/lib/auth/password.ts` scrypt password helper와 smoke ADMIN/STAFF seed만 존재. 실제 login/session/RBAC 없음 |
| API 구조       | Server Action 중심. 일반 CRUD Route Handler 금지. `ActionResult` shape 유지 필요                                |
| 주요 기능 상태 | 앱 골격, Prisma migration, smoke/auth seed까지 완료. 실제 업무 기능과 auth flow는 미구현                        |

전체 프로젝트 개발 예정 대비 현재 완료율은 **약 21% / 100%**로 유지한다. 이번 preflight는 구현 전 안전 gate이며, 실제 MVP 업무 기능 완료율을 크게 올리는 작업은 아니다.

## 3. 작업 분해

| 단계 | 작업                               | 산출물                                    |
| ---: | ---------------------------------- | ----------------------------------------- |
|    1 | 하네스 필수 문서와 기술문서 재확인 | 현재 구조, 금지 영역, API contract 재확인 |
|    2 | auth/session 구현 범위 분리        | 다음 구현 파일 범위와 순서 정의           |
|    3 | 보안 gate 정리                     | cookie, token hash, password, secret 정책 |
|    4 | backend/API contract gate 정리     | action/repository/service 경계 정의       |
|    5 | subagent 리뷰 결과 통합            | security/backend read-only 리뷰 반영      |
|    6 | 상태 문서와 완료 보고서 갱신       | current-state, completion report 갱신     |

## 4. Subagent 할당 및 모델 선택 이유

| 세부 작업              | Subagent            | Model   | Reasoning | 권한      | 배정 이유                                                                   |
| ---------------------- | ------------------- | ------- | --------- | --------- | --------------------------------------------------------------------------- |
| auth/session 보안 gate | `security_reviewer` | GPT-5.5 | high      | read-only | password, cookie, token hash, RBAC, AuditLog는 하네스상 GPT-5.5 고위험 영역 |
| backend/API 구현 경계  | `backend_agent`     | GPT-5.5 | high      | read-only | Server Action contract, repository/service/action 계층 경계 보존 필요       |
| 문서 작성/통합         | Main Codex          | GPT-5   | medium    | write     | 실제 코드 변경 없이 preflight 산출물 통합                                   |

Spark는 사용하지 않는다.

사유:

- auth/session/RBAC, password, cookie, API contract는 Spark 금지 영역이다.
- mini는 문서 정리에는 가능하지만 이번 작업은 auth/API 판단이 포함되어 사용하지 않는다.
- 판단이 애매하면 GPT-5.5를 사용한다는 하네스 원칙을 따른다.

## 5. 구현 범위 결정

### 5.1 이번 작업에서 변경하지 않는 영역

| 영역                | 결정                                   |
| ------------------- | -------------------------------------- |
| Auth flow           | 실제 login/logout/session 구현 안 함   |
| DB schema/migration | 변경 안 함                             |
| Seed data           | 변경 안 함                             |
| API contract        | `ActionResult` shape 변경 안 함        |
| Route Handler       | 생성 안 함                             |
| Workspace guard     | 실제 적용 안 함. 다음 구현 단계로 분리 |

### 5.2 다음 구현 단계에서 허용되는 파일 범위

아래 파일은 다음 단계에서 생성 또는 수정할 수 있다. 단, DB schema, API contract 변경이 필요해지면 먼저 architecture/security review를 거친다.

| 파일 후보                                                  | 역할                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `src/types/action-result.ts`                               | 문서의 `ActionResult` shape를 코드로 고정                   |
| `src/server/validation/auth.validation.ts`                 | `loginInputSchema` 등 Zod 입력 검증                         |
| `src/lib/auth/password.ts`                                 | 기존 scrypt password helper 재사용. 약화 금지               |
| `src/lib/auth/session-token.ts`                            | cookie name, token 생성, HMAC hash, 만료 상수               |
| `src/lib/auth/session.ts`                                  | cookie 조회, session token 생성/hash, session context 구성  |
| `src/lib/auth/permissions.ts`                              | `requireRole`, `requireWorkspaceAccess`, menu permission    |
| `src/lib/auth/login-rate-limit.ts`                         | 로그인 실패 제한. production 전 persistent/shared 전략 필요 |
| `src/server/repositories/user.repository.ts`               | email/userId 기반 user 조회. 권한 판단 금지                 |
| `src/server/repositories/session.repository.ts`            | session 생성, token hash 조회, revoke                       |
| `src/server/repositories/audit-log.repository.ts`          | 인증 이벤트용 sanitized audit log 기록                      |
| `src/server/services/auth.service.ts`                      | credentials 검증, ACTIVE/STAFF 검증, session transaction    |
| `src/server/actions/auth.actions.ts`                       | `loginAction`, `logoutAction`                               |
| `src/app/(auth)/login/_components/login-form.tsx`          | form/action 연결. 클라이언트 상태만 담당                    |
| `src/app/(auth)/login/page.tsx`                            | 실제 form action 연결. UI 구조 변경은 최소화                |
| `src/app/(workspace)/layout.tsx`                           | workspace session guard 연결                                |
| `src/app/(workspace)/_components/workspace-navigation.tsx` | ADMIN/STAFF sidebar 메뉴 필터. 서버 guard를 대체하지 않음   |
| `src/app/forbidden/page.tsx`                               | 권한 없음 페이지                                            |

### 5.3 다음 구현 단계에서 금지되는 변경

| 금지 항목                                  | 이유                                    |
| ------------------------------------------ | --------------------------------------- |
| 일반 CRUD `/api` Route Handler 생성        | 기술문서상 Server Action 중심 구조 유지 |
| `ActionResult` 필드 제거/의미 변경         | API contract 변경 위험                  |
| `Session.sessionTokenHash` 원문 token 저장 | DB 유출 시 즉시 세션 탈취 위험          |
| password hash 정적 커밋                    | credential 유출 위험                    |
| repository 내부 권한 판단                  | 계층 경계 붕괴                          |
| sidebar 숨김만으로 RBAC 처리               | 서버 우회 가능                          |
| STAFF 권한 완화                            | 하네스 기본값은 더 제한적인 정책        |
| Spark/mini의 auth, DB, API 파일 수정       | 하네스 금지 영역                        |

## 6. Session/Cookie 보안 Gate

| 항목        | preflight 결정                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Cookie name | `psms_session`                                                                                 |
| httpOnly    | 항상 `true`                                                                                    |
| secure      | production에서는 `true`; local 개발에서는 Next.js 환경에 맞춰 허용                             |
| sameSite    | credential-only 내부 콘솔 기준 `strict` 우선. 외부 auth 연동이 생기면 별도 review              |
| path        | `/`                                                                                            |
| maxAge      | MVP 기본 8시간 후보. `Session.expiresAt`과 cookie maxAge는 반드시 일치시킴                     |
| 저장값      | cookie에는 raw opaque token만 저장. role, userId, storeId, 개인정보 저장 금지                  |
| DB 저장값   | `Session.sessionTokenHash`만 저장. raw token 저장 금지                                         |
| 조회 방식   | request cookie raw token -> deterministic hash -> DB lookup -> expiry/revoked/user status 확인 |
| 삭제 방식   | logout 시 cookie 생성 때와 동일한 name/path/sameSite/secure 기준으로 삭제                      |

Session token 정책:

- raw token은 `crypto.randomBytes(32)` 이상으로 생성한다.
- DB lookup용 hash는 `AUTH_SECRET` 기반 HMAC-SHA256을 우선한다.
- hash format은 내부 구현 세부사항이지만 version prefix를 둘 수 있다. 예: `v1:hmac-sha256:<base64url>`.
- `AUTH_SECRET`이 없거나 `.env.example`의 `replace-with-local-secret` 그대로거나 최소 32 bytes entropy를 만족하지 못하면 auth runtime은 실패해야 한다.
- raw token, token hash, password, password hash는 로그와 AuditLog에 기록하지 않는다.

## 7. Password Gate

현재 `src/lib/auth/password.ts`에는 scrypt 기반 `hashPassword`, `verifyPassword`, `isPasswordHash`가 있다.

다음 구현 원칙:

- login 구현은 기존 `verifyPassword()`를 재사용한다.
- hash parser의 strict 검증을 완화하지 않는다.
- password mismatch, user 없음, inactive user는 사용자에게 동일한 generic 실패 메시지를 반환한다.
- user enumeration 방지를 위해 user가 없어도 dummy password hash 검증 경로를 둔다.
- password hash 알고리즘을 argon2/bcrypt 등으로 교체하려면 별도 security review를 거친다.
- seed password env와 auth runtime secret은 credential로 취급한다.

## 8. Login/Logout Action Gate

`loginAction` contract는 기술문서의 형태를 유지한다.

```ts
loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>>;
```

`loginAction`은 미인증 사용자가 진입하는 예외 action이다. 일반 mutation action의 "세션 확인 -> 권한 확인" 순서를 그대로 적용하지 않고, 아래 순서로 처리한다.

1. Zod 입력 검증
2. email 정규화
3. active user 조회
4. password hash 검증
5. STAFF `storeId` 필수 검증
6. 기존 활성 session 정리 정책 적용 여부 확인
7. raw session token 생성
8. token hash 저장 및 `expiresAt` 기록
9. cookie set
10. `User.lastLoginAt` 갱신
11. sanitized AuditLog 기록
12. `ActionResult` 반환

`logoutAction` contract는 기술문서의 형태를 유지한다.

```ts
logoutAction(): Promise<void>;
```

`logoutAction`은 일반 action flow를 따르되, 이미 세션이 없거나 만료된 경우에도 cookie 삭제은 수행한다.

1. cookie에서 raw session token 조회
2. token hash로 session 조회
3. session이 있으면 `revokedAt` 기록
4. sanitized AuditLog 기록
5. cookie 삭제

주의:

- 현재 `package.json`에는 `zod` dependency가 없다. 다음 구현에서 입력 검증을 위해 `zod` 추가가 필요할 수 있다.
- 잘못된 비밀번호/미존재 user/inactive user의 error code는 기술문서에 명확히 고정되어 있지 않다. 다음 구현 전 `FORBIDDEN`으로 통일할지, `INVALID_CREDENTIALS`를 API contract에 추가할지 architecture review가 필요하다.
- 로그인 실패 제한은 production 전 필수 gate다. 최소 기준은 `email + ip` 실패 제한, IP 단위 제한, generic 실패 응답, 실패 AuditLog다.
- persistent/shared rate limit 저장소가 없는 상태에서 production 배포를 열지 않는다. local MVP는 명시적으로 제한된 dev-only 정책으로 시작할 수 있으나 완료 보고서에 production gap을 남긴다.

## 9. Session 활성 조건

세션은 아래 조건을 모두 만족할 때만 유효하다.

| 조건                  | 기준                                            |
| --------------------- | ----------------------------------------------- |
| token hash            | cookie raw token의 HMAC hash와 DB row가 일치    |
| revoked               | `Session.revokedAt IS NULL`                     |
| expiry                | `Session.expiresAt > now`                       |
| user status           | `User.status = ACTIVE`                          |
| STAFF store scope     | `role=STAFF`이면 `storeId`가 not null           |
| password/session leak | raw token, token hash, password, hash 로그 금지 |

## 10. Guard/RBAC Gate

다음 helper를 우선 구현한다.

```ts
requireSession();
requireRole(session, ["ADMIN"]);
requireWorkspaceAccess(session, { storeId });
```

Session context 후보:

```ts
type SessionContext = {
  sessionId: string;
  userId: string;
  role: "ADMIN" | "STAFF";
  storeId: string | null;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};
```

서버 guard 원칙:

- 모든 workspace page는 Server Component/layout에서 session을 확인한다.
- 모든 query/action은 session과 permission을 다시 확인한다.
- sidebar menu filtering은 UX 보조이며 보안 경계가 아니다.
- `User.status !== "ACTIVE"`면 세션을 무효 처리한다.
- STAFF는 `storeId`가 반드시 있어야 한다.
- STAFF는 직원 관리, 기초정보, 정책 관리, 백업, 복원에 접근할 수 없다.
- 판매 취소, 수납 취소, 재고 삭제, 전체 매장 Export처럼 모호한 STAFF 권한은 MVP 기본값으로 ADMIN 전용에 둔다.

## 11. AuditLog Gate

인증 이벤트는 가능한 한 AuditLog에 남기되, 민감정보는 남기지 않는다.

| 이벤트      | actorUserId       | 기록 후보                                                     | 금지 항목                         |
| ----------- | ----------------- | ------------------------------------------------------------- | --------------------------------- |
| 로그인 성공 | user id           | action, entityType, entityId, ipAddress, userAgent            | password, passwordHash, raw token |
| 로그인 실패 | null 또는 user id | generic failure code, masked email 후보, ipAddress, userAgent | password, passwordHash, raw token |
| 로그아웃    | user id           | action, session id 또는 session 식별자, ipAddress, userAgent  | raw token                         |

AuditLog repository는 DB 쓰기만 담당한다. 어떤 이벤트를 남길지와 민감정보 redaction은 service/action 계층에서 결정한다.

## 12. 개인정보/Export Gate

auth 구현 자체가 고객 기능을 만들지는 않지만, session/RBAC가 이후 고객 상세와 Export의 보안 경계가 되므로 아래 기본값을 유지한다.

| 항목          | preflight 결정                                                                   |
| ------------- | -------------------------------------------------------------------------------- |
| 고객 식별정보 | `identityMasked` 중심. 주민등록번호/신분증 원문 저장 금지                        |
| 연락처/주소   | 상세/Export에서 STAFF 범위 제한과 마스킹 정책을 별도 확인                        |
| Export        | ADMIN 전체, STAFF 소속 매장 범위. 모든 Export는 permission check + AuditLog 필수 |
| AuditLog      | 고객 개인정보 before/after 전체 dump 금지. 필요한 필드만 sanitized snapshot      |

## 13. 충돌 가능성 분석

| 영역         | 충돌 가능성                                                            | 대응                                                                 |
| ------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Auth         | wrong-password error code가 기술문서에 고정되어 있지 않음              | 구현 전 `FORBIDDEN` 통일 또는 신규 code 추가 review 필요             |
| Auth         | `AUTH_SECRET` placeholder로 auth runtime이 동작할 위험                 | runtime guard에서 placeholder/짧은 secret 차단                       |
| Auth         | rate limit 저장소 없이 production login을 열 위험                      | production 전 persistent/shared limit 전략 확정                      |
| DB           | 현재 schema 변경 없이 session 구현 가능하지만 idle timeout 필드는 없음 | MVP는 absolute expiry + revokedAt로 시작. idle timeout은 별도 review |
| API contract | login/logout 구현 중 `ActionResult` shape를 임의 확장할 위험           | `src/types/action-result.ts`에 문서 shape 그대로 고정                |
| RBAC         | UI sidebar filtering만 구현하고 서버 guard를 빠뜨릴 위험               | page/query/action guard 필수                                         |
| AuditLog     | 로그인 실패 로그에 email/password/token 등 민감정보가 남을 위험        | masked email 또는 generic code만 기록                                |
| Dependency   | `zod`가 아직 package에 없음                                            | 다음 구현에서 dependency 추가 필요. contract/schema 변경 아님        |

## 14. Spark/mini 금지 영역

다음 영역은 Spark와 mini가 수정하지 않는다.

| 금지 파일/영역                                  | 이유                           |
| ----------------------------------------------- | ------------------------------ |
| `src/lib/auth/**`                               | password/session/cookie/RBAC   |
| `src/server/actions/auth*`                      | Server Action auth contract    |
| `src/server/repositories/session*`              | session token hash persistence |
| `src/server/repositories/user*`                 | passwordHash/user status       |
| `src/server/repositories/audit-log*`            | 민감 이벤트 기록               |
| `prisma/**`                                     | DB schema/migration/seed       |
| `.env*`                                         | secret/env policy              |
| route guard, export permission, AuditLog writer | 권한/개인정보 경계             |

## 15. 다음 구현 순서

| 순서 | 작업                                  | 담당 후보                              | 모델    | 비고                                                     |
| ---: | ------------------------------------- | -------------------------------------- | ------- | -------------------------------------------------------- |
|    1 | `zod` dependency 추가 여부 확정       | `backend_agent` + `security_reviewer`  | GPT-5.5 | validation 필수 dependency. DB/API contract 변경 아님    |
|    2 | `ActionResult` type와 auth validation | `backend_agent`                        | GPT-5.5 | 문서 shape 그대로 고정, `loginInputSchema` 작성          |
|    3 | Auth runtime constants/session token  | `backend_agent` + `security_reviewer`  | GPT-5.5 | `AUTH_SECRET`, cookie 정책, HMAC token hash              |
|    4 | user/session/audit repository         | `backend_agent`                        | GPT-5.5 | 권한 판단 없이 Prisma 접근만 담당                        |
|    5 | auth service                          | `backend_agent` + `security_reviewer`  | GPT-5.5 | password 검증, ACTIVE/STAFF 검증, session transaction    |
|    6 | session helper와 permission helper    | `backend_agent` + `security_reviewer`  | GPT-5.5 | session context, `requireSession`, STAFF store guard     |
|    7 | `loginAction`, `logoutAction`         | `backend_agent` + `security_reviewer`  | GPT-5.5 | generic failure, cookie set/delete, ActionResult mapping |
|    8 | login form 연결                       | `frontend_agent` + `security_reviewer` | GPT-5.5 | form/action 연결. auth 구현 자체는 backend 경로          |
|    9 | workspace layout guard/sidebar RBAC   | `frontend_agent` + `security_reviewer` | GPT-5.5 | UI filtering과 서버 guard 동시 적용                      |
|   10 | auth/RBAC tests                       | `qa_agent` + `security_reviewer`       | GPT-5.5 | success/fail/inactive/expired/revoked/STAFF forbidden    |

## 16. 완료 기준

다음 auth/session 구현은 아래 조건을 만족해야 완료로 인정한다.

| 기준       | 완료 조건                                                                          |
| ---------- | ---------------------------------------------------------------------------------- |
| Auth       | login/logout, cookie set/delete, session lookup/revoke 구현                        |
| Security   | raw token/password/hash 로그 없음. `AUTH_SECRET` runtime guard, dummy verify 포함  |
| RBAC       | workspace guard, STAFF forbidden route, server-side permission 재검증 포함         |
| API        | `ActionResult` shape 유지. 일반 CRUD Route Handler 없음                            |
| DB         | schema/migration 변경 없음. 변경 필요 시 별도 gate                                 |
| AuditLog   | 인증 이벤트 sanitized 기록 또는 미구현 사유 명시                                   |
| Rate limit | local/prod 기준과 production gap 명시. production은 shared/persistent 전략 필요    |
| Validation | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, auth 테스트 후보 |

## 17. 이번 작업 결론

현재 프로젝트는 auth/session 구현을 시작할 수 있는 최소 기반을 갖췄다. 다만 실제 구현 전에 error code 결정, `AUTH_SECRET` runtime guard, token hash 방식, AuditLog redaction, STAFF 제한 범위를 보수적으로 고정해야 한다.

다음 단계는 GPT-5.5 경로로 `loginAction/logoutAction + DB-backed session`을 구현하는 것이다. Spark와 mini는 해당 구현에 참여하지 않는다.
