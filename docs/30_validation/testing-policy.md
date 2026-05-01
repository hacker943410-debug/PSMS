# Testing Policy

작성일: 2026-05-01

이 문서는 `C:\Project\AI_Harness\docs\30_validation\testing-policy.md`를 PSMS workspace와 포트 정책에 맞게 적용한 기준이다.

## Required Commands

공통 변경 후 가능한 범위에서 아래 명령을 실행한다.

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm build
```

DB나 seed를 변경한 경우:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

API 변경 시:

```powershell
pnpm --filter @psms/api build
pnpm --filter @psms/api lint
```

Web 변경 시:

```powershell
pnpm --filter @psms/web lint
pnpm --filter @psms/web build
```

## Test Scope

| 영역     | 필수 검증                                                                               |
| -------- | --------------------------------------------------------------------------------------- |
| 공통     | format, lint, typecheck, build                                                          |
| Shared   | Zod schema, result type, pure rule unit test                                            |
| DB       | Prisma validate, migration rehearsal, seed idempotency                                  |
| API      | route test, auth/session/RBAC integration, transaction test                             |
| Web      | component a11y, API adapter behavior, route guard                                       |
| UI       | Playwright screenshot, console/network check, accessibility scan                        |
| E2E      | ADMIN/STAFF login, sale entry, receivable payment, customer detail, schedule, inventory |
| Electron | packaged smoke, local port check, userData SQLite persistence                           |

## Completion Rules

- 테스트를 실행하지 못한 경우, 이유와 대체 검증을 보고한다.
- 실패한 테스트가 있으면 완료로 보지 않는다.
- auth/DB/API contract 변경은 단순 build 통과만으로 완료 처리하지 않는다.
- 화면 변경은 `docs/30_validation/ui-validation.md` 기준을 함께 적용한다.
- 릴리즈 단계는 `docs/60_release/electron-release-checklist.md`를 함께 적용한다.

## Minimum By Change Type

| 변경 유형                  | 최소 검증                                                |
| -------------------------- | -------------------------------------------------------- |
| 문서만 변경                | `pnpm format:check` 또는 문서 포맷 확인                  |
| UI presentational 변경     | `pnpm lint`, `pnpm typecheck`, screenshot 계획           |
| Web data/API adapter 변경  | `pnpm lint`, `pnpm typecheck`, `pnpm build`              |
| Fastify route/service 변경 | API build, route/integration test, `pnpm build`          |
| Prisma 변경                | `pnpm db:validate`, migration/seed 검증, `pnpm build`    |
| Electron 변경              | Web/API build, Electron smoke, local DB persistence 확인 |
