# Task Execution Rule

작성일: 2026-05-01

## 기본 실행 흐름

1. Must Read 문서와 `C:\Project\PSMS_Tech` 관련 기술문서를 확인한다.
2. 작업 목표를 Web/API/Desktop/DB/문서/디자인/릴리즈 중 하나 이상으로 분류한다.
3. 영향 범위와 위험도를 확인한다.
4. 현재 환경과 사용자 지시가 허용하면 subagent 위임을 고려한다. 허용되지 않으면 같은 책임 경계를 직접 적용한다.
5. 구현 전 변경 범위와 검증 계획을 정한다.
6. 구현한다.
7. 포맷, 타입, lint, build, DB, 테스트, UI 검증 중 관련 검증을 실행한다.
8. 완료된 background subagent를 닫고, 잔여 활성 subagent가 없는지 확인한다.
9. `git status --short`를 확인하고, 완료 작업의 dirty/untracked 파일을 커밋하거나 의도적 잔여로 분류한다.
10. 변경 파일, 검증 결과, subagent cleanup 상태, worktree 상태, 남은 위험, 다음 작업을 보고한다.

## 작업 분해 기준

| 작업 유형 | 분해 방식                                                                  |
| --------- | -------------------------------------------------------------------------- |
| 화면 구현 | design reference, shell, filter, table, drawer, modal, form, responsive QA |
| API 구현  | route, Zod schema, service, repository, permission, transaction, test      |
| DB 변경   | model, relation, index, migration, seed, rollback/rehearsal, validation    |
| 인증      | user model, password hash, session, cookie, route guard, menu RBAC, tests  |
| Export    | query, permission, file generation, audit log, e2e                         |
| Electron  | process launch, port check, userData DB, migration, preload IPC, smoke     |
| 문서      | current-state, routing, validation, release, completion report             |

## 화면 완료 흐름

각 화면은 아래 순서로 완료 처리한다.

```txt
디자인 정합성 -> API 계약 -> 기능 연결 -> 테스트 -> 스크린샷 QA
```

- 기준 이미지는 `C:\Project\PSMS_Tech\design-reference`의 PNG다.
- 먼저 static/seed data로 PNG와 시각 구조를 맞춘다.
- 그 다음 Fastify API 데이터를 연결한다.
- 화면별 완료에는 `1586x992`, `1440x900`, `1280x800` screenshot evidence가 필요하다.

## Spark 사용 범위

Spark 사용 가능:

- `apps/web` 화면 skeleton
- Tailwind 스타일링
- 공통 presentational 컴포넌트
- 정적 컬럼 정의
- Story/demo/dummy data
- 디자인 reference 기반 spacing/color 1차 보정
- 문서 포맷 정리

Spark 사용 금지:

- `apps/api`
- `packages/db`
- `packages/shared`의 auth/session/password/token/rule 파일
- `apps/web/src/server/actions/auth.actions.ts`
- `apps/web/src/lib/auth`
- `apps/web/src/lib/api-client.ts`의 API contract 변경
- `apps/desktop`
- auth/session/RBAC
- Fastify API contract
- Prisma schema/migration/seed
- payment/receivable/sale transaction
- policy calculation
- Audit Log
- Export permission
- release/env/port 정책

## 병렬 작업 금지 조건

- 같은 파일을 여러 작업자가 수정해야 하는 경우
- DB schema와 service contract가 동시에 확정되지 않은 경우
- API contract가 아직 미정인 경우
- 권한 정책이 불명확한 경우
- auth/DB/API contract 변경이 필요한데 사용자 확인이 없는 경우
- 디자인 기준 PNG와 기능 요구가 충돌하는 경우

## 완료 기준

- 변경이 `C:\Project\PSMS_Tech` 기술문서와 충돌하지 않는다.
- Web은 `5273`, API는 `4273` 기준을 따른다.
- `5173`, `4173`을 사용하지 않는다.
- 관련 권한 검사가 포함되어 있다.
- 서버 입력은 Zod 검증을 통과한다.
- 금액/재고/수납/정책 변경은 테스트가 있다.
- 화면 변경은 디자인 게이트와 UI validation 계획이 있다.
- Electron 변경은 release checklist와 smoke 계획이 있다.
- 변경 후 실행한 검증 명령 또는 검증하지 못한 이유를 보고한다.
- auth/DB/API contract 변경 여부를 명시한다.
- 완료 후 더 이상 필요 없는 background subagent를 닫고, 잔여 활성 subagent 상태를 명시한다.
- 최종 `git status --short`를 확인하고, dirty/untracked 파일이 남으면 커밋 대상인지 의도적 잔여인지 명시한다.

검증 결과가 없으면 완료로 보고하지 않는다.
