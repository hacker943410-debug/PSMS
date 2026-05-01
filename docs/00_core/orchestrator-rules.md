# Orchestrator Rules

작성일: 2026-05-01

## Purpose

PSMS 하네스는 구현 속도보다 구조 보존, 인증/DB/API 안정성, 업무 데이터 정합성, 디자인 기준 재현성을 우선한다.

현재 기준 경로는 다음과 같다.

- 구현 저장소: `C:\Project\Activate\PSMS`
- 기술 문서와 디자인 소스: `C:\Project\PSMS_Tech`
- 추가 하네스 기준: `C:\Project\AI_Harness`
- Web dev URL: `http://127.0.0.1:5273`
- API dev URL: `http://127.0.0.1:4273`
- 예약 금지 포트: `5173`, `4173`

## Required Context

작업 시작 전 관련 범위에 따라 다음을 먼저 확인한다.

- 현재 상태: `docs/00_system/project-current-state.md`
- 디자인 게이트: `docs/00_system/design-implementation-gates.md`
- 에이전트 라우팅: `docs/10_agents/agent-map.md`
- 작업 규칙: `docs/20_execution/task-execution-rule.md`
- 테스트 정책: `docs/30_validation/testing-policy.md`
- UI 검증: `docs/30_validation/ui-validation.md`
- Electron 릴리즈: `docs/60_release/electron-release-checklist.md`

## Routing Policy

Subagent 사용은 현재 실행 환경과 사용자 지시가 허용하는 경우에만 수행한다. Subagent를 실행하지 않는 경우에도 같은 책임 경계를 체크리스트로 적용한다.

다음 작업은 구현 전에 GPT-5.5 수준의 설계/검토 경로를 우선한다.

- auth/session/RBAC
- Prisma schema, migration, seed 전략
- Fastify API contract 변경
- 판매 등록 transaction
- 수납 등록/취소와 미수금 잔액 계산
- 재고 상태 전환과 중복 판매 방지
- 정책 활성화/충돌 검증
- Export 권한과 Audit Log
- Electron local DB/userData/runtime 보안

## Default Ownership

| 작업 유형         | 기본 책임                                 | 핵심 파일 범위                                      |
| ----------------- | ----------------------------------------- | --------------------------------------------------- |
| 구조 탐색         | `codebase_mapper`                         | 전체 read-only                                      |
| 아키텍처/API 경계 | `architect_reviewer`                      | workspace, Web/API/Desktop contract                 |
| 보안/RBAC         | `security_reviewer`                       | auth, session, permission, cookie                   |
| DB/Prisma         | `db_reviewer`                             | `packages/db`, migration, seed                      |
| API 구현          | `backend_agent`                           | `apps/api`, `packages/shared`, `packages/db` 사용부 |
| Web 구현          | `frontend_agent`                          | `apps/web`                                          |
| 순수 UI 반복      | `spark_ui_iterator`                       | presentational UI only                              |
| 런타임 UI 검증    | `ui_runtime_validator`                    | Playwright, console, network, screenshot            |
| 시각 리뷰         | `visual_ui_reviewer`                      | design-reference 대비 screenshot 리뷰               |
| 기능 QA           | `qa_agent`                                | test plan, integration/e2e                          |
| 코드 리뷰         | `code_reviewer`                           | diff read-only                                      |
| DevOps/릴리즈     | `devops_sre_reviewer`, `release_reviewer` | scripts, env, build, release checks                 |
| Electron          | `desktop_release_agent`                   | `apps/desktop`                                      |
| 문서              | `docs_release_manager`                    | `docs`, report                                      |

## Design Gate Policy

화면 구현은 다음 순서로만 완료 처리한다.

```txt
디자인 정합성 -> API 계약 -> 기능 연결 -> 테스트 -> 스크린샷 QA
```

- 기준 이미지는 `C:\Project\PSMS_Tech\design-reference`의 PNG 10개다.
- `dashboard.png`, `sales-management.png`, `sales-entry.png`를 우선 구현 기준으로 둔다.
- 각 화면은 먼저 seed/static data로 시각 구조를 맞춘 뒤 API 데이터를 연결한다.
- 기준 viewport는 `1586x992`, `1440x900`, `1280x800`이다.
- 릴리즈 직전 일괄 디자인 보정은 완료 기준으로 인정하지 않는다.

## Conflict Handling

아래 충돌이 보이면 구현을 멈추고 더 안전한 해석을 택하거나 사용자 확인을 받는다.

- 기술문서와 사용자 요구가 충돌한다.
- auth, DB, API contract 변경 없이는 작업이 불가능하다.
- STAFF 권한을 완화해야 한다.
- Web Server Action에 비즈니스 로직을 넣어야 한다.
- SQLite MVP와 PostgreSQL 확장 방향 중 기준 결정이 필요하다.
- 디자인 기준 PNG와 현재 컴포넌트 구조가 큰 폭으로 충돌한다.

## Completion Policy

검증 결과가 없는 완료 보고는 완료로 보지 않는다. 완료 보고에는 최소한 다음이 포함되어야 한다.

- 변경 파일
- 실행한 검증 명령 또는 검증하지 못한 이유
- auth/DB/API contract 변경 여부
- 디자인 게이트 또는 UI 검증 여부
- 남은 위험
- 다음 작업
