# Auth Session Decision

작성일: 2026-04-30

## 1. 목적

PSMS의 실제 인증 구현 전에 auth/session/RBAC 방식을 먼저 확정하기 위한 의사결정 문서다.

이번 작업은 설계 결정 산출물이며, 실제 인증 코드, Prisma schema, DB migration, API contract는 변경하지 않았다.

## 2. 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                       |
| -------------- | ------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router. `(auth)/login` 정적 UI와 `(workspace)` route group 존재     |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories`는 `.gitkeep`만 존재 |
| DB             | `prisma/` 디렉터리 없음. Prisma 의존성, env, migration, seed 모두 미적용        |
| 인증           | 로그인 화면 skeleton만 존재. 실제 session, cookie, password 검증 없음           |
| API 구조       | 문서상 Server Action 중심. 일반 CRUD Route Handler 금지                         |
| 주요 기능 상태 | 앱 골격과 공통 UI 일부 완료. 업무 도메인 기능은 미구현                          |

전체 프로젝트 개발 예정 대비 현재 완료율: 약 10% / 100%.

완료율 산정 근거:

- Next.js 초기 골격, workspace route, login UI skeleton, 하네스 문서가 완료됐다.
- Prisma schema/migration, auth/session/RBAC, Server Action, 도메인 기능, 테스트는 아직 미구현이다.
- 이번 문서는 구현 완료율을 크게 올리는 작업이 아니라 auth 구현 전 위험을 줄이는 gate 산출물이다.

## 3. 작업 분해

| 세부 작업              | 범위                                             | 결과                         |
| ---------------------- | ------------------------------------------------ | ---------------------------- |
| 현재 구조 확인         | login UI, package, env, prisma, server 계층 확인 | 실제 auth 구현 없음 확인     |
| 기술문서 기준 확인     | IA/RBAC, Backend Architecture, API Contract 확인 | Server Action 중심 구조 유지 |
| auth/session 방식 결정 | Credentials 직접 구현 vs Auth.js 계열 검토       | 1차 권장안 확정              |
| 충돌 가능성 분석       | auth, DB, API contract, RBAC guard 점검          | 금지/보류 영역 정리          |
| 완료 보고 기준 작성    | 변경 파일, 검증, 다음 작업 정리                  | 보고서 작성 기준 확정        |

## 4. Subagent 위임 및 모델 선택 이유

| 세부 작업          | Subagent             | Model        | Reasoning | 권한      | 배정 이유                                         |
| ------------------ | -------------------- | ------------ | --------- | --------- | ------------------------------------------------- |
| 보안/RBAC 검토     | `security_reviewer`  | GPT-5.5      | high      | read-only | 인증, 세션, 쿠키, RBAC는 보안 민감 영역           |
| 아키텍처 충돌 검토 | `architect_reviewer` | GPT-5.5      | high      | read-only | App Router, Server Action, API contract 충돌 방지 |
| 코드베이스 매핑    | `codebase_mapper`    | GPT-5.4-mini | medium    | read-only | 현재 파일/의존성/부재 항목의 빠른 확인            |
| 문서 작성 및 통합  | Main Codex 경로      | GPT-5 계열   | medium    | write     | 실제 코드 변경 없이 산출물 통합                   |

Spark는 이번 작업에 사용하지 않는다.

사유:

- auth/session/RBAC는 Spark 금지 영역이다.
- Spark는 UI skeleton, Tailwind, 정적 컴포넌트, 단순 문서 포맷에만 사용한다.
- 이번 작업은 인증 설계 결정과 보안 risk gate이므로 GPT-5.5 reviewer 경로를 우선한다.

## 5. 결정 사항

### 5.1 1차 권장안

MVP 1차 구현은 Credentials 기반 직접 세션 구현을 권장한다.

핵심 방향:

- `User.passwordHash` 기반 이메일/비밀번호 로그인
- 서버 저장형 opaque session token 사용
- session token 원문은 쿠키에만 저장하고 DB에는 hash만 저장
- session 조회 결과에는 `userId`, `role`, `storeId`, `status`를 포함
- 모든 workspace page, query, action에서 서버 측 session/RBAC guard 적용
- password hash, session cookie, RBAC, AuditLog는 GPT-5.5 경로로만 구현 및 리뷰

### 5.2 Auth.js 계열 보류

Auth.js 계열은 장기 후보로 남긴다.

보류 이유:

- 현재 기술문서의 계약은 `loginAction`, `logoutAction`, Server Action guard, `User.passwordHash`, AuditLog 중심이다.
- MVP에는 OAuth/SSO 요구가 없다.
- Credentials provider를 사용할 경우 session 전략과 password auth 제약을 별도 설계해야 한다.
- PSMS는 ADMIN/STAFF 권한, 매장 범위 제한, 세션 폐기, 감사 로그가 중요하므로 DB 기반 직접 세션이 더 단순하게 통제된다.

Auth.js를 도입하는 경우에는 별도 architecture/security review를 거쳐야 한다.

## 6. 권장 Session Shape

서버 내부에서 사용하는 session shape 후보:

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

원칙:

- `passwordHash`는 session에 포함하지 않는다.
- STAFF는 `storeId`가 반드시 있어야 한다.
- ADMIN은 전체 매장 접근이 가능하되, 작업 대상 `storeId`는 query/action에서 명시적으로 검증한다.
- `status !== "ACTIVE"` 사용자는 로그인 및 세션 유지가 불가하다.

## 7. 권장 Session DB 모델 후보

실제 Prisma 적용 전 검토할 모델 후보:

```prisma
model Session {
  id               String    @id @default(cuid())
  userId           String
  sessionTokenHash String    @unique
  expiresAt        DateTime
  revokedAt        DateTime?
  ipAddress        String?
  userAgent        String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId])
  @@index([expiresAt])
  @@index([revokedAt])
}
```

검토 포인트:

- `schema.draft.prisma`에 session 모델이 없다면 DB review gate에서 추가 여부를 확정한다.
- session token은 원문 저장 금지, hash 저장을 기본으로 한다.
- logout은 session 물리 삭제보다 `revokedAt` 기록을 우선 검토한다.
- 장기 보존이 불필요한 expired session 정리 정책은 운영 Runbook에서 별도 확정한다.

## 8. Cookie 정책

권장 cookie:

| 항목     | 권장값                                     |
| -------- | ------------------------------------------ |
| name     | `psms_session`                             |
| httpOnly | `true`                                     |
| secure   | production `true`                          |
| sameSite | `lax` 기본, 외부 연동 없으면 `strict` 검토 |
| path     | `/`                                        |
| maxAge   | 8-12시간 기준으로 확정                     |

주의:

- localStorage/sessionStorage에 token을 저장하지 않는다.
- cookie에는 권한 정보, 개인정보, password hash를 넣지 않는다.
- session rotation과 idle timeout은 MVP 구현 시 security review에서 확정한다.
- PSMS가 credential-only 내부 업무 콘솔로 유지된다면 `sameSite=strict`를 우선 검토한다.

## 9. Guard 구조

권장 파일 후보:

| 파일 후보                                       | 역할                                      |
| ----------------------------------------------- | ----------------------------------------- |
| `src/lib/auth/session.ts`                       | cookie/session 조회, session context 생성 |
| `src/lib/auth/password.ts`                      | password hash/verify                      |
| `src/lib/auth/permissions.ts`                   | role, store scope, menu permission        |
| `src/server/actions/auth.actions.ts`            | `loginAction`, `logoutAction`             |
| `src/server/repositories/user.repository.ts`    | user 조회                                 |
| `src/server/repositories/session.repository.ts` | session 생성/조회/폐기                    |

권장 guard:

```ts
requireSession();
requireRole(session, ["ADMIN"]);
requireWorkspaceAccess(session, { storeId });
```

적용 원칙:

- workspace layout/page는 서버에서 session을 확인한다.
- Server Action은 반드시 session check, permission check, Zod validation, business rule, transaction, AuditLog, revalidate, `ActionResult` 순서를 따른다.
- repository에는 권한 판단을 넣지 않는다.
- sidebar menu는 session role 기준으로 숨김 처리하고, 서버 action/query에서도 동일 권한을 다시 검증한다.

## 10. API Contract 유지 방침

유지할 계약:

```ts
loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>>;

logoutAction(): Promise<void>;
```

금지:

- 일반 CRUD를 `/api` Route Handler로 생성
- login 실패 사유를 과도하게 구체화
- API contract 변경 없이 ActionResult shape 변경
- auth helper가 repository 계층으로 내려가는 구조

허용 가능한 Route Handler 예외:

- Export
- 파일 다운로드
- 외부 webhook
- Auth.js를 별도 승인 후 도입하는 경우의 auth handler

## 11. RBAC 결정

| 항목              | 결정                                       |
| ----------------- | ------------------------------------------ |
| Role              | `ADMIN`, `STAFF`만 사용                    |
| STAFF store scope | `storeId` 필수                             |
| ADMIN scope       | 전체 매장 접근 가능                        |
| STAFF 금지 메뉴   | 직원 관리, 기초정보, 정책 관리, 백업, 복원 |
| STAFF 모호 권한   | 더 제한적인 정책 선택                      |
| Export            | ADMIN 전체, STAFF 소속 매장 범위 제한      |

추가 확인 필요:

- STAFF의 판매 취소 권한은 MVP에서 제한 또는 ADMIN 전용으로 확정한다.
- STAFF의 재고 등록 권한은 문서상 `O 또는 매니저 이상`으로 열려 있으므로 MVP에서는 제한적으로 시작한다.
- 고객 개인정보 원문 표시와 Export 권한은 개인정보 마스킹 정책 확정 후 구현한다.

## 12. Audit Log 정책

인증 관련 AuditLog 후보:

| 이벤트                  | 기록 정책                                        |
| ----------------------- | ------------------------------------------------ |
| 로그인 성공             | actorUserId, ipAddress, userAgent, createdAt     |
| 로그인 실패             | email 후보, 실패 사유 코드, ipAddress, userAgent |
| 로그아웃                | actorUserId, session id 또는 session hash 식별자 |
| 계정 비활성 로그인 시도 | 실패 이벤트로 기록                               |
| 비밀번호 변경/초기화    | ADMIN 작업이면 reason 포함                       |

주의:

- password, password hash, session token 원문은 AuditLog에 기록하지 않는다.
- 고객 개인정보가 포함된 before/after 전체 덤프를 금지한다.

## 13. 충돌 가능성 분석

| 영역         | 충돌 가능성                                                                | 대응                                               |
| ------------ | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Auth         | Auth.js route handler와 Server Action 중심 login contract가 충돌할 수 있음 | MVP는 직접 session 구현 우선. Auth.js는 별도 승인  |
| DB           | `schema.draft.prisma`에 session 모델이 없을 수 있음                        | Prisma review gate에서 Session 모델 추가 여부 확정 |
| API contract | login/logout 구현 중 `ActionResult` shape 변경 위험                        | 문서 계약 유지. 변경 시 architecture review 필요   |
| RBAC         | UI sidebar 숨김만으로 권한 처리될 위험                                     | 서버 page/query/action guard를 필수로 적용         |
| Repository   | repository에 권한/세션 로직이 섞일 위험                                    | repository는 Prisma 접근만 담당                    |
| AuditLog     | 인증 실패/민감 작업 누락 위험                                              | mutation 구현 checklist에 AuditLog 포함            |
| 개인정보     | 실패 로그나 export log에 민감정보 원문 저장 위험                           | token/password/개인정보 원문 기록 금지             |

## 14. 구현 전 Gate

실제 auth/session 구현 전에 아래를 먼저 확정한다.

| Gate          | 확인 항목                                                           |
| ------------- | ------------------------------------------------------------------- |
| DB Gate       | `Session` 모델 추가 여부, `User.storeId` 정책, `User.status` 유지   |
| Security Gate | password hash 알고리즘, cookie maxAge, session rotation, rate limit |
| API Gate      | `loginAction`, `logoutAction`, `ActionResult` 유지                  |
| RBAC Gate     | STAFF 메뉴/데이터 범위, 판매 취소/재고 등록 권한                    |
| Audit Gate    | 로그인 성공/실패/로그아웃 로그 범위                                 |
| Test Gate     | login success/fail, inactive user, STAFF forbidden, session expiry  |

## 15. 다음 구현 순서

| 순서 | 작업                                          | 담당 후보                              | 모델    |
| ---: | --------------------------------------------- | -------------------------------------- | ------- |
|    1 | DB review에서 `Session` 모델 추가 여부 확정   | `db_reviewer`                          | GPT-5.5 |
|    2 | password hash/cookie/session 정책 최종 확정   | `security_reviewer`                    | GPT-5.5 |
|    3 | Prisma 의존성/env/schema 적용                 | `backend_agent` + `db_reviewer`        | GPT-5.5 |
|    4 | auth helper와 `loginAction/logoutAction` 구현 | `backend_agent` + `security_reviewer`  | GPT-5.5 |
|    5 | workspace guard/sidebar RBAC 연결             | `frontend_agent` + `security_reviewer` | GPT-5.5 |
|    6 | auth/RBAC 테스트 추가                         | `qa_agent`                             | GPT-5.5 |

## 16. 이번 작업의 미변경 영역

| 영역                                 | 상태   |
| ------------------------------------ | ------ |
| `src/lib/auth`                       | 미생성 |
| `src/server/actions/auth.actions.ts` | 미생성 |
| `prisma/`                            | 미생성 |
| `.env`, `.env.local`, `.env.example` | 미생성 |
| `package.json` auth/Prisma 의존성    | 미변경 |
| API contract                         | 미변경 |
| 실제 로그인 동작                     | 미구현 |
