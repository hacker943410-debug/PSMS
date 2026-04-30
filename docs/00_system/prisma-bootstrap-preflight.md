# Prisma Bootstrap Preflight

작성일: 2026-04-30

## 1. 목적

실제 Prisma 의존성, env, `prisma/schema.prisma`를 추가하기 직전에 필요한 작업 순서와 중단 조건을 확정한다.

이번 작업은 적용 준비 문서다. 실제 `package.json`, `pnpm-lock.yaml`, `.env*`, `prisma/`, DB migration, Prisma Client, 서버 구현은 변경하지 않았다.

## 2. 현재 프로젝트 구조 분석 요약

| 항목           | 현재 상태                                                                       |
| -------------- | ------------------------------------------------------------------------------- |
| Frontend       | Next.js App Router. `(auth)/login`, `(workspace)` route skeleton 존재           |
| Backend        | `src/server/actions`, `queries`, `services`, `repositories`는 `.gitkeep`만 존재 |
| DB             | `prisma/` 없음. 개발 DB는 SQLite 예정, 운영 DB는 PostgreSQL 권장                |
| 인증           | Credentials 직접 구현 + DB-backed opaque session 결정. 실제 구현 없음           |
| API 구조       | Server Action 중심. 일반 CRUD Route Handler 금지                                |
| 주요 기능 상태 | 문서/하네스/앱 골격 단계. 실제 업무 도메인과 DB는 미구현                        |

전체 프로젝트 개발 예정 대비 현재 완료율: 약 12% / 100%.

산정 기준:

- Prisma 적용 계획, review checklist, Auth/session 결정, Session 모델 결정, Prisma bootstrap preflight가 문서화됐다.
- 실제 Prisma 의존성 설치, schema 생성, migration, DB 적용, auth/server action 구현은 아직 완료되지 않았다.

## 3. 작업 분해

| 세부 작업      | 범위                                                                  | 결과                     |
| -------------- | --------------------------------------------------------------------- | ------------------------ |
| 현재 상태 확인 | `package.json`, `.env*`, `prisma/`, `src/server` 확인                 | Prisma 미적용 상태 확인  |
| 공식 문서 확인 | Prisma install, generator, validate/generate/migrate create-only 확인 | generator 결정 gate 추가 |
| 적용 후보 정리 | dependencies, scripts, env, schema, client wrapper 후보 정리          | 실제 적용 순서 문서화    |
| 충돌 분석      | auth, DB, API contract, secret, migration 위험 확인                   | preflight 중단 조건 정리 |
| 완료 보고      | 검증 명령과 다음 작업 정리                                            | 완료 보고서 작성         |

## 4. 자동 Subagent 위임

| 세부 작업              | Subagent            | Model        | Reasoning | 권한      | 배정 이유                                                         |
| ---------------------- | ------------------- | ------------ | --------- | --------- | ----------------------------------------------------------------- |
| DB/schema gate 검토    | `db_reviewer`       | GPT-5.5      | high      | read-only | Prisma schema, migration, SQLite/PostgreSQL 차이는 DB 고위험 영역 |
| backend 적용 순서 검토 | `backend_agent`     | GPT-5.5      | high      | read-only | package scripts, Prisma client, repository 연결 순서 검토         |
| secret/auth 보안 검토  | `security_reviewer` | GPT-5.5      | high      | read-only | `AUTH_SECRET`, token hash, seed password, AuditLog 보안 검토      |
| 현재 파일 매핑         | `codebase_mapper`   | GPT-5.4-mini | medium    | read-only | 현재 존재/부재 파일의 빠른 확인                                   |

Spark는 사용하지 않는다.

사유:

- Prisma, env, auth/session, DB schema는 Spark 금지 영역이다.
- 실제 적용 전 판단은 GPT-5.5 reviewer 경로를 사용한다.
- mini는 구조 매핑에만 사용하고 DB/auth/API 판단에는 사용하지 않는다.

## 5. 적용 전 결정 필요 항목

| 결정 항목            | 권장 기본값                                          | 이유                                                                |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Prisma generator     | Prisma 7 계열이면 `prisma-client` + 명시 output 검토 | 공식 문서상 Prisma 7부터 modern generator가 기본 방향               |
| 기존 draft generator | `prisma-client-js` 유지 여부 결정 필요               | 기술문서 draft와 최신 Prisma 문서 간 차이 존재                      |
| 개발 DB URL          | `file:./dev.db` 후보                                 | SQLite 개발 DB 기준                                                 |
| 운영 DB provider     | PostgreSQL 권장 유지                                 | 동시성, audit, backup, reporting 안정성                             |
| `Session` 모델       | 실제 schema에 포함                                   | 직전 결정에서 설계 승인                                             |
| `.env.example` 추적  | `.gitignore` 예외 필요                               | 현재 `.gitignore`의 `.env*`가 `.env.example`까지 무시함             |
| Prisma CLI env 파일  | 루트 `.env` 사용 여부 결정                           | `.env.local`만 있으면 Prisma CLI가 `DATABASE_URL`을 못 읽을 수 있음 |
| password hash 의존성 | auth 구현 단계에서 별도 결정                         | Prisma bootstrap과 분리                                             |

## 6. 다음 실제 변경 후보

실제 적용 단계에서 예상되는 변경 파일:

| 파일                     | 작업                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `package.json`           | Prisma 의존성 및 DB script 추가                              |
| `pnpm-lock.yaml`         | 의존성 lockfile 갱신                                         |
| `.gitignore`             | `.env.example` 추적 예외 추가 검토                           |
| `.env.example`           | placeholder만 추가. 실제 secret 금지                         |
| `.env` 또는 `.env.local` | 로컬 개발 전용. Prisma CLI 호환성을 고려해 실제 적용 전 결정 |
| `prisma/schema.prisma`   | draft 기반 schema + `Session` 모델 반영                      |
| `src/lib/prisma.ts`      | Prisma Client singleton 후보                                 |

이번 턴에서는 위 파일을 수정하지 않았다.

## 7. 의존성 및 Script 후보

예상 설치 명령:

```bash
pnpm add @prisma/client
pnpm add -D prisma
```

`package.json` script 후보:

```json
{
  "db:validate": "prisma validate",
  "db:generate": "prisma generate",
  "db:migrate:create": "prisma migrate dev --create-only",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

주의:

- `db:migrate:create`는 SQL 생성 전용 gate다.
- migration 이름이 필요한 경우 `pnpm prisma migrate dev --create-only --name init_schema`처럼 직접 실행하거나 script 인자 전달 방식을 확인한다.
- `db:migrate`는 개발 DB에 실제 적용하므로 create-only SQL 검토 이후에만 실행한다.
- 운영 DB는 `prisma migrate deploy` 계열을 별도 배포 정책에서 다룬다.

## 8. Env 후보

`.env.example` 후보:

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-local-secret"
APP_URL="http://localhost:3000"
```

원칙:

- `.env.example`에는 실제 secret을 넣지 않는다.
- 실제 로컬 값은 `.env` 또는 `.env.local`에 두되 commit하지 않는다.
- Prisma CLI는 일반적으로 프로젝트 루트 `.env`를 읽으므로, `.env.local`만 사용할 경우 `prisma validate`가 `DATABASE_URL`을 찾지 못할 수 있다.
- 현재 `.gitignore`는 `.env*` 전체를 무시하므로, `.env.example`을 문서화 파일로 추적하려면 예외가 필요하다.

예상 `.gitignore` 조정 후보:

```gitignore
.env
.env*
!.env.example
```

## 9. Schema 반영 후보

실제 `prisma/schema.prisma` 생성 시 기준:

- `schema.draft.prisma`를 시작점으로 사용한다.
- `User.sessions Session[]`를 추가한다.
- `Session` 모델을 추가한다.
- `Session.sessionTokenHash @unique`를 사용한다.
- `Session.user`는 `onDelete: Restrict`로 둔다.
- `@@index([expiresAt])`, `@@index([userId, revokedAt])`를 둔다.
- provider-specific `@db.*` 타입은 초기 SQLite schema에서는 피한다.

보류할 schema 의사결정:

| 항목                                          | 상태    |
| --------------------------------------------- | ------- |
| STAFF `User.storeId` 필수화 방식              | Pending |
| `Customer.status` 또는 마스킹 상태 필드       | Pending |
| `assignedUserId` 문자열 vs `User` FK          | Pending |
| 정책 history 별도 모델 여부                   | Pending |
| 모든 relation별 `onDelete` 명시               | Pending |
| SQLite/PostgreSQL nullable unique 동작 리허설 | Pending |
| rollback/test 전략                            | Pending |

## 10. Prisma Client 후보

실제 Prisma Client 생성 이후 `src/lib/prisma.ts` 후보:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

주의:

- generator를 `prisma-client`로 선택하고 custom output을 쓰면 import path가 달라질 수 있다.
- repository 계층은 Prisma 접근만 담당한다.
- auth/session/RBAC 판단은 repository에 넣지 않는다.

## 11. 실제 적용 순서

| 순서 | 작업                                                        | 담당 후보                             | 모델    |
| ---: | ----------------------------------------------------------- | ------------------------------------- | ------- |
|    1 | Prisma generator 버전 방향 결정                             | `db_reviewer` + `backend_agent`       | GPT-5.5 |
|    2 | `package.json` 의존성/script 추가                           | `backend_agent`                       | GPT-5.5 |
|    3 | `.gitignore`, `.env.example`, `.env` 또는 `.env.local` 처리 | `backend_agent` + `security_reviewer` | GPT-5.5 |
|    4 | `prisma/schema.prisma` 생성                                 | `backend_agent` + `db_reviewer`       | GPT-5.5 |
|    5 | `pnpm db:validate`                                          | `backend_agent`                       | GPT-5.5 |
|    6 | `pnpm db:generate`                                          | `backend_agent`                       | GPT-5.5 |
|    7 | create-only migration 생성                                  | `backend_agent` + `db_reviewer`       | GPT-5.5 |
|    8 | generated SQL review                                        | `db_reviewer`                         | GPT-5.5 |

## 12. 중단 조건

아래 조건이 발생하면 실제 적용을 중단한다.

| 조건                                                | 중단 이유                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Prisma generator 선택이 불명확함                    | 최신 Prisma와 draft schema 차이로 import/runtime 충돌 가능        |
| `.env.example`이 `.gitignore`에 막힘                | 신규 개발자 설정 문서가 누락됨                                    |
| Prisma CLI가 `DATABASE_URL`을 읽지 못함             | `.env.local`만 사용하면 validation/generate 단계가 실패할 수 있음 |
| `Session` FK가 cascade delete로 생성됨              | auth/audit 추적 손실                                              |
| create-only SQL에 의도치 않은 cascade/drop이 있음   | destructive migration 위험                                        |
| `ActionResult` 또는 login/logout 계약 변경이 필요함 | API contract 변경 필요                                            |
| STAFF 권한 완화가 필요함                            | 보안 정책 충돌                                                    |
| token 원문 저장이 필요해짐                          | 보안 정책 위반                                                    |

## 13. 검증 계획

실제 적용 후 필수 검증:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate:create
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

create-only migration 이후 SQL 검토 항목:

- `Session` table 생성 여부
- `sessionTokenHash` unique 여부
- `expiresAt`, `(userId, revokedAt)` index 여부
- `Session.userId` FK와 `onDelete Restrict` 여부
- 의도치 않은 cascade/drop 여부
- SQLite와 PostgreSQL 전환 시 차이

## 14. 이번 작업의 미변경 영역

| 영역                   | 상태   |
| ---------------------- | ------ |
| `package.json`         | 미변경 |
| `pnpm-lock.yaml`       | 미변경 |
| `.env*`                | 미생성 |
| `prisma/`              | 미생성 |
| `src/lib/prisma.ts`    | 미생성 |
| `src/server` 실제 구현 | 미변경 |
| DB migration           | 미생성 |
| API contract           | 미변경 |
