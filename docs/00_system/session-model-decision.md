# Session Model Decision

작성일: 2026-04-30

## 1. 목적

`Credentials 직접 구현 + DB-backed opaque session cookie` 결정을 실제 Prisma schema 적용 단계와 연결하기 위해 `Session` 모델 추가 여부를 확정한다.

이번 작업은 DB schema 변경 전 의사결정 산출물이다. 실제 `prisma/schema.prisma`, migration, DB 파일, auth 구현 코드는 생성하지 않았다.

## 2. 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                        |
| -------------- | -------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router. `(auth)/login` 정적 UI와 `(workspace)` route group 존재      |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories`는 placeholder만 존재 |
| DB             | `prisma/` 없음. `schema.draft.prisma`는 기술문서 패키지에만 존재                 |
| 인증           | Auth/session 결정 문서만 있음. 실제 세션/쿠키/비밀번호 검증 없음                 |
| API 구조       | Server Action 중심. `loginAction`, `logoutAction`, `ActionResult` 계약 유지      |
| 주요 기능 상태 | 앱 골격과 하네스 문서 완료. 업무 도메인 구현은 아직 시작 전                      |

전체 프로젝트 개발 예정 대비 현재 완료율: 약 11% / 100%.

산정 기준:

- 앱 골격, workspace UI skeleton, route placeholder, 하네스 설정이 완료됐다.
- Prisma schema 적용 계획, review checklist, auth/session 결정, Session 모델 gate가 문서화됐다.
- 실제 Prisma schema/migration, auth 구현, Server Action, 도메인 기능, 테스트는 아직 미구현이다.

## 3. 작업 분해

| 세부 작업         | 범위                                            | 결과                                       |
| ----------------- | ----------------------------------------------- | ------------------------------------------ |
| draft schema 확인 | `User`, `AuditLog`, session 모델 존재 여부 확인 | `Session` 모델 없음 확인                   |
| auth 결정 연결    | `auth-session-decision.md` 기준 검토            | DB-backed opaque session 필요              |
| DB 모델 결정      | 필드, 관계, index, unique, onDelete 정책 검토   | `Session` 모델 추가 승인                   |
| 충돌 분석         | Auth, DB, API contract, migration gate 검토     | 실제 적용은 create-only review 단계로 보류 |
| 완료 보고         | subagent 결과, 검증, 다음 작업 정리             | 완료 보고서 작성                           |

## 4. Subagent 할당 및 모델 선택 이유

| 세부 작업              | Subagent             | Model      | Reasoning | 권한      | 배정 이유                                                |
| ---------------------- | -------------------- | ---------- | --------- | --------- | -------------------------------------------------------- |
| Prisma 모델 검토       | `db_reviewer`        | GPT-5.5    | high      | read-only | schema, relation, index, migration gate는 DB 고위험 영역 |
| 세션 보안 검토         | `security_reviewer`  | GPT-5.5    | high      | read-only | token hash, cookie, RBAC, AuditLog는 보안 민감 영역      |
| 아키텍처/API 충돌 검토 | `architect_reviewer` | GPT-5.5    | high      | read-only | Server Action 중심 구조와 Route Handler 예외 충돌 방지   |
| 문서 작성/통합         | Main Codex           | GPT-5 계열 | medium    | write     | 실제 코드 변경 없이 결정 문서와 보고서 통합              |

Spark는 사용하지 않는다.

사유:

- `Session` 모델, auth/session/RBAC, Prisma schema는 Spark 금지 영역이다.
- mini는 코드베이스 매핑에는 적합하지만 DB/auth/API 결정에는 사용하지 않는다.
- 판단이 애매하면 GPT-5.5를 사용한다는 하네스 원칙을 따른다.

## 5. 결정 사항

### 5.1 결론

실제 Prisma schema 적용 시 `Session` 모델을 추가한다.

결정 이유:

- DB-backed opaque session을 구현하려면 서버에서 세션 폐기, 만료, 사용자 상태 확인, 권한 변경 반영이 가능해야 한다.
- stateless signed cookie 또는 JWT만으로는 직원 비활성화, 강제 로그아웃, 세션 단위 감사 추적이 약하다.
- PSMS는 ADMIN/STAFF 권한, 매장 범위 제한, AuditLog가 중요한 업무 콘솔이다.
- Auth.js를 MVP에서 보류했으므로 직접 세션 저장소가 필요하다.

### 5.2 적용 범위

`Session` 모델은 아래 목적에만 사용한다.

- 로그인 성공 시 세션 발급
- 요청마다 session token hash 조회
- `User.status = ACTIVE` 재확인
- STAFF `storeId` 범위 검증을 위한 `SessionContext` 구성
- 로그아웃 또는 강제 폐기 시 `revokedAt` 기록
- 만료된 세션 정리 대상 식별

세션 모델은 business domain의 판매/수납/정책 transaction과 섞지 않는다.

## 6. 권장 Prisma 모델

실제 적용 후보:

```prisma
model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  role         UserRole   @default(STAFF)
  status       UserStatus @default(ACTIVE)
  phone        String?
  storeId      String?
  store        Store?     @relation(fields: [storeId], references: [id])
  lastLoginAt  DateTime?

  sessions Session[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([storeId])
  @@index([role, status])
}

model Session {
  id               String    @id @default(cuid())
  userId           String
  sessionTokenHash String    @unique
  expiresAt        DateTime
  revokedAt        DateTime?

  ipAddress String?
  userAgent String?

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, revokedAt])
  @@index([expiresAt])
}
```

주의:

- `User` 예시는 세션 relation 추가 위치를 보여주기 위한 축약본이다. 실제 적용 시 기존 `User` relation을 제거하지 않는다.
- `sessionTokenHash`에는 session token 원문이 아니라 hash만 저장한다.
- SQLite/PostgreSQL 전환성을 위해 초기 모델에는 provider-specific `@db.*` 타입을 붙이지 않는다.
- PostgreSQL partial index가 필요하면 운영 리허설 단계에서 별도 custom SQL migration으로 검토한다.
- `lastSeenAt`은 idle timeout 정책이 확정될 때 추가 검토한다.

## 7. 필드 결정

| 필드                    | 결정                          | 이유                                     |
| ----------------------- | ----------------------------- | ---------------------------------------- |
| `id`                    | `String @id @default(cuid())` | 기존 draft의 id 패턴과 일치              |
| `userId`                | required FK                   | 세션은 항상 사용자에 속함                |
| `sessionTokenHash`      | `String @unique`              | token 조회와 중복 방지. 원문 저장 금지   |
| `expiresAt`             | required                      | 만료 판정과 cleanup 기준                 |
| `revokedAt`             | nullable                      | 로그아웃/강제 폐기를 물리 삭제 없이 기록 |
| `ipAddress`             | nullable                      | 감사/보안 분석 보조                      |
| `userAgent`             | nullable                      | 감사/보안 분석 보조                      |
| `createdAt`/`updatedAt` | required                      | 운영 추적과 lifecycle 관리               |

## 8. 관계 및 onDelete 결정

| 관계            | 결정              |
| --------------- | ----------------- |
| `User.sessions` | one-to-many       |
| `Session.user`  | required relation |
| `onDelete`      | `Restrict`        |

`onDelete: Restrict`를 선택하는 이유:

- 직원 계정은 물리 삭제보다 `User.status = INACTIVE`를 우선한다.
- 세션과 감사 흐름이 남아 있는 사용자를 조용히 cascade 삭제하면 운영 추적이 약해진다.
- 계정 비활성화 시 service에서 active session을 `revokedAt`으로 폐기하는 방식을 사용한다.

## 9. Index / Unique 결정

| 제약                           | 결정 | 이유                                              |
| ------------------------------ | ---- | ------------------------------------------------- |
| `sessionTokenHash @unique`     | 필수 | 세션 lookup, token 중복 방지                      |
| `@@index([expiresAt])`         | 필수 | 만료 세션 정리                                    |
| `@@index([userId, revokedAt])` | 필수 | 사용자별 활성/폐기 세션 조회와 강제 로그아웃 처리 |

초기 schema에서는 cross-provider 호환성을 우선한다. PostgreSQL 전용 partial index는 production rehearsal에서 별도 검토한다.

## 10. Security 정책

| 항목             | 결정                                                  |
| ---------------- | ----------------------------------------------------- |
| Cookie 저장값    | session token 원문만 저장                             |
| DB 저장값        | `sessionTokenHash`만 저장                             |
| Token 원문 로그  | 금지                                                  |
| AuditLog         | 로그인 성공/실패/로그아웃/강제 폐기 후보 기록         |
| 사용자 상태 확인 | session 조회 시 `User.status = ACTIVE` 확인           |
| STAFF 범위       | session context의 `role`, `storeId`로 서버에서 재검증 |

보류 항목:

- password hash 알고리즘과 cost
- session token 생성/해시 방식
- cookie maxAge 최종값
- idle timeout / absolute timeout
- 로그인 실패 rate limit
- 만료 세션 cleanup 주기

## 11. API Contract 영향

변경하지 않는 계약:

```ts
loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>>;

logoutAction(): Promise<void>;
```

`Session` 모델 추가는 내부 persistence 결정이다. 외부 API contract 또는 `ActionResult` shape를 변경하지 않는다.

## 12. 구현 순서

| 순서 | 작업                                                       | 담당 후보                             | 모델    |
| ---: | ---------------------------------------------------------- | ------------------------------------- | ------- |
|    1 | `Session` 모델을 포함한 실제 `prisma/schema.prisma` 작성   | `backend_agent` + `db_reviewer`       | GPT-5.5 |
|    2 | `User.sessions` relation과 `onDelete: Restrict` 확인       | `db_reviewer`                         | GPT-5.5 |
|    3 | `prisma migrate dev --create-only --name init_schema` 생성 | `backend_agent`                       | GPT-5.5 |
|    4 | 생성 SQL의 FK, unique, index, cascade 여부 검토            | `db_reviewer`                         | GPT-5.5 |
|    5 | auth helper 구현 전 session repository/service 설계        | `backend_agent` + `security_reviewer` | GPT-5.5 |

## 13. 충돌 가능성 분석

| 영역         | 충돌 가능성                                               | 대응                                                               |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Auth         | token 원문을 DB/AuditLog에 남길 위험                      | `sessionTokenHash`만 저장, 원문 로그 금지                          |
| DB           | `schema.draft.prisma`에 `Session` 모델이 없음             | 실제 schema 적용 시 추가 승인 항목으로 반영                        |
| API contract | 세션 저장소 추가를 login/logout 응답 변경으로 확장할 위험 | 기존 `ActionResult` 계약 유지                                      |
| Migration    | PostgreSQL 전용 index를 SQLite 초기 schema에 섞을 위험    | 초기 schema는 cross-provider 우선, 운영 리허설에서 custom SQL 검토 |
| RBAC         | Sidebar 숨김만으로 권한 처리될 위험                       | page/query/action guard에서 session context 재검증                 |
| User 삭제    | cascade 삭제로 세션 이력 손실 위험                        | `onDelete: Restrict`, 계정 비활성화 우선                           |

## 14. 실제 적용 전 Gate

| Gate           | 승인 조건                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Schema Gate    | `Session` 모델, `User.sessions`, `onDelete: Restrict`, index/unique 검토                              |
| Security Gate  | token hash 방식, cookie 속성, session 만료/폐기 정책 확정                                             |
| Migration Gate | create-only SQL에서 FK, unique, index, cascade 여부 확인                                              |
| API Gate       | `loginAction`, `logoutAction`, `ActionResult` shape 변경 없음 확인                                    |
| Test Gate      | login success/fail, expired session, revoked session, inactive user, STAFF forbidden 테스트 후보 확정 |

## 15. 이번 작업의 미변경 영역

| 영역                              | 상태   |
| --------------------------------- | ------ |
| `prisma/`                         | 미생성 |
| `prisma/schema.prisma`            | 미생성 |
| DB migration                      | 미생성 |
| `.env*`                           | 미생성 |
| `package.json` Prisma/auth 의존성 | 미변경 |
| `src/lib/auth`                    | 미생성 |
| `src/server` 실제 구현            | 미변경 |
| API contract                      | 미변경 |
