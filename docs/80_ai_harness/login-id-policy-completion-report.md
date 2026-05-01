# 로그인 ID 정책 변경 및 테스트 계정 표시 완료 보고

## Summary

- 현시점 기준 전체 개발 완료율은 `29% / 100%`로 산정한다.
- Web/API MVP 업무 기능 기준 완료율은 `12% / 100%`로 산정한다.
- 로그인 요청 계약은 `email`에서 `loginId`로 변경했다.
- 로그인 ID 정책은 영문 소문자와 숫자로 구성된 4-32자 평문 ID로 고정했다.
- 로컬 개발 로그인 페이지에 ADMIN/STAFF 테스트 계정을 표시했다.
- DB schema는 이번 단계에서 변경하지 않고, 기존 `User.email` 물리 컬럼을 `loginId` 저장 컬럼으로 재사용한다.

## Model Selection

| 역할                       | 모델                                | 선택 이유                                                                               |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Main implementation        | Current Codex GPT-5 session default | 코드 변경, 검증, 보고서 작성까지 단일 컨텍스트로 이어야 해서 메인 모델이 직접 구현했다. |
| Security reviewer subagent | Inherited default model             | 인증 정책 변경의 위험 지점과 최소 변경 범위를 빠르게 병렬 검토하기 위해 위임했다.       |
| Project manager subagent   | Inherited default model             | 전체 Phase/Task 진행율 산정은 구현 작업과 독립적으로 병렬 수행 가능해서 위임했다.       |

## Automatic Subagent Delegation

| Subagent            | 목적                                                                             | 결과                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `security_reviewer` | 이메일 로그인에서 평문/숫자 ID 로그인으로 변경할 때의 안전한 최소 구현 경로 검토 | DB migration 없이 `User.email` 물리 컬럼을 호환 저장소로 사용하고 API/Web 계약만 `loginId`로 바꾸는 경로를 권고했다. |
| `project_manager`   | 하네스 기준 전체 작업 예정 대비 현재 완료율 산정                                 | 전체 `29%`, Web/API MVP `12%`, Phase 및 주요 Task별 진행율을 산정했다.                                               |

## Work Breakdown

| Step | 작업                                              | 상태 |
| ---- | ------------------------------------------------- | ---- |
| 1    | 하네스 기준 확인 및 자동 subagent 위임            | 완료 |
| 2    | 로그인 ID 정책 영향 범위 분석                     | 완료 |
| 3    | shared schema/API/Web action/login page/seed 변경 | 완료 |
| 4    | 로컬 개발 테스트 계정 표시                        | 완료 |
| 5    | API 로그인 및 로그인 페이지 노출 검증             | 완료 |
| 6    | lint/typecheck/db validation/build 검증           | 완료 |
| 7    | 완료 보고서 작성                                  | 완료 |

## Phase Progress

| Phase                                |       진행율 |
| ------------------------------------ | -----------: |
| Phase 0 Baseline/Harness             | `90% / 100%` |
| Phase 1 Design System Gate           | `58% / 100%` |
| Phase 2 API/DB Foundation            | `48% / 100%` |
| Phase 3 Admin Foundation             |  `8% / 100%` |
| Phase 4 Inventory                    |  `5% / 100%` |
| Phase 5 Sales                        | `18% / 100%` |
| Phase 6 Receivable/Customer/Schedule |  `6% / 100%` |
| Phase 7 Dashboard/Report/Export      | `16% / 100%` |
| Phase 8 Web MVP Gate                 | `10% / 100%` |
| Phase 9 Electron Release             |  `3% / 100%` |
| Overall Project                      | `29% / 100%` |
| Web/API MVP business readiness       | `12% / 100%` |

## Task Progress

| Task                              |       진행율 |
| --------------------------------- | -----------: |
| Monorepo/workspace                | `85% / 100%` |
| Harness/project docs              | `90% / 100%` |
| Prisma schema/migration/client    | `75% / 100%` |
| Smoke auth seed                   | `60% / 100%` |
| Auth/session scaffold             | `55% / 100%` |
| Web shell/sidebar/RBAC visibility | `60% / 100%` |
| Common workspace UI primitives    | `70% / 100%` |
| Dashboard Gate 1 static           | `65% / 100%` |
| Sales list Gate 1 static          | `60% / 100%` |
| Sales entry Gate 1 static         | `55% / 100%` |
| Remaining 7 design screens        | `10% / 100%` |
| Domain API contracts              | `10% / 100%` |
| Core sales transaction            |  `0% / 100%` |
| Receivable payment/cancel         |  `0% / 100%` |
| Inventory CRUD/status             |  `0% / 100%` |
| Export/audit reports              |  `5% / 100%` |
| Automated test suite              |  `5% / 100%` |

## Implementation Details

- `packages/shared/src/auth.validation.ts`: `loginInputSchema`를 `loginId` 기반으로 변경했다.
- `packages/shared/src/auth.ts`: `SessionContext.email`을 `SessionContext.loginId`로 변경했다.
- `apps/api/src/repositories/user.repository.ts`: 로그인 조회 함수를 `findUserForLoginByLoginId`로 변경했다.
- `apps/api/src/services/auth.service.ts`: 인증 흐름, rate limit key, session mapping을 `loginId` 기준으로 변경했다.
- `apps/web/src/server/actions/auth.actions.ts`: 로그인 Server Action 입력을 `loginId` 기준으로 변경했다.
- `apps/web/src/lib/api-client.ts`: API 로그인 요청 payload를 `loginId` 기준으로 변경했다.
- `apps/web/src/app/(auth)/login/page.tsx`: 로컬 개발 테스트 계정을 표시했다.
- `apps/web/src/app/(auth)/login/_components/login-form.tsx`: 이메일 입력을 일반 ID 입력으로 변경했다.
- `apps/api/src/server.ts`: `.env` 로딩이 route/db import보다 먼저 실행되도록 동적 import 구조로 변경했다.
- `apps/api/src/routes/auth.routes.ts`: 인증 API 응답 문구를 정상 한국어로 정리했다.
- `packages/db/prisma/seed.ts`: 기본 seed 계정을 `admin1001`, `staff1001`로 변경했다.
- `.env.example`: seed login ID 환경변수를 추가했다.
- `.env`: 로컬 테스트용 `AUTH_SECRET`, 포트, seed 계정 값을 추가했다. 이 파일은 gitignore 대상이다.

## Local Test Accounts

| Role  | Login ID    | Password         |
| ----- | ----------- | ---------------- |
| ADMIN | `admin1001` | `LocalAdmin123!` |
| STAFF | `staff1001` | `LocalStaff123!` |

## Validation

| 검증                                    | 결과 |
| --------------------------------------- | ---- |
| Login page HTTP 200                     | 통과 |
| Login page `name="loginId"` 표시        | 통과 |
| Login page ADMIN/STAFF 테스트 계정 표시 | 통과 |
| API login with `admin1001`              | 통과 |
| `pnpm lint`                             | 통과 |
| `pnpm typecheck`                        | 통과 |
| `pnpm db:validate`                      | 통과 |
| `pnpm build`                            | 통과 |
| `git diff --check`                      | 통과 |

## Remaining Notes

- 장기적으로는 Prisma schema에 `loginId` 컬럼을 추가하고 기존 `email` 컬럼과 분리하는 migration이 필요하다.
- 평문/숫자 ID는 열거 가능성이 있으므로 production 전 영구 저장소 기반 rate limit, lockout 정책, 감사 로그 마스킹을 추가해야 한다.
- Electron release 단계에서는 renderer가 직접 인증 토큰을 다루지 않도록 preload IPC 경계를 다시 검토해야 한다.
