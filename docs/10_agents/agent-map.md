# Agent Map

작성일: 2026-05-01

이 문서는 `C:\Project\AI_Harness`를 PSMS 현재 구조에 맞게 반영한 에이전트 라우팅 기준이다. 실제 subagent 실행 여부는 현재 작업 환경과 사용자 지시에 따른다. 실행하지 않는 경우에도 아래 표를 작업 분해, 리뷰 관점, 완료 기준 체크리스트로 사용한다.

## Active Agents

| Agent                   | Model                 | Reasoning | Sandbox         | 책임 범위                                                                                                | 사용 조건                                                           |
| ----------------------- | --------------------- | --------- | --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `project_manager`       | `gpt-5.4-mini`        | medium    | workspace-write | 작업 흐름, 단계 분해, 진행 문서                                                                          | 큰 기능을 여러 게이트로 나눌 때                                     |
| `codebase_mapper`       | `gpt-5.4-mini`        | medium    | read-only       | 구조 탐색, 파일 매핑                                                                                     | 작업 전 빠른 현황 파악                                              |
| `architect_reviewer`    | `gpt-5.5`             | high      | read-only       | workspace 구조, Fastify API contract, Web/API/Desktop 경계                                               | 구조 변경, contract 변경, 책임 경계 판단                            |
| `security_reviewer`     | `gpt-5.5`             | high      | read-only       | 인증, 세션, RBAC, 개인정보, Export 권한                                                                  | auth/security 변경 또는 검토                                        |
| `db_reviewer`           | `gpt-5.5`             | high      | read-only       | Prisma, migration, seed, index, DB 정합성                                                                | DB 관련 변경 검토                                                   |
| `backend_agent`         | `gpt-5.5`             | high      | workspace-write | `apps/api` routes/services/repositories, transaction, business rule                                      | API/도메인 구현                                                     |
| `frontend_agent`        | `gpt-5.5`             | medium    | workspace-write | `apps/web` App Router, UI adapter, URL state, Drawer/Modal/Form                                          | Spark 한도 소진 또는 auth/DB/API contract 경계가 있는 frontend 구현 |
| `spark_ui_iterator`     | `gpt-5.3-codex-spark` | medium    | workspace-write | DB/인증/API contract 비관련 `apps/web` frontend 구현, Tailwind, Client Component, 화면 상태, 디자인 보정 | frontend 작업 기본 1순위                                            |
| `ui_runtime_validator`  | `gpt-5.4-mini`        | medium    | workspace-write | Playwright 실행, 콘솔/네트워크/스크린샷 수집                                                             | 화면 구현 후 런타임 QA                                              |
| `visual_ui_reviewer`    | `gpt-5.5`             | high      | read-only       | 기준 PNG 대비 시각 품질 리뷰                                                                             | 디자인 게이트 판정                                                  |
| `qa_agent`              | `gpt-5.5`             | high      | workspace-write | 테스트 전략, 통합 검증, 회귀 확인                                                                        | 기능 완료 전 검증                                                   |
| `code_reviewer`         | `gpt-5.3-codex`       | high      | read-only       | diff 기반 버그/회귀 리뷰                                                                                 | 큰 변경 또는 릴리즈 전 코드 리뷰                                    |
| `devops_sre_reviewer`   | `gpt-5.5`             | high      | read-only       | 포트, env, build, 로컬 실행/패키징 위험                                                                  | dev server, CI, release infra 변경                                  |
| `desktop_release_agent` | `gpt-5.5`             | high      | workspace-write | Electron local app packaging, userData SQLite, preload IPC                                               | Web/API MVP와 E2E 통과 후                                           |
| `release_reviewer`      | `gpt-5.5`             | high      | read-only       | 릴리즈 체크리스트, smoke, rollback                                                                       | Electron 또는 배포 전 최종 리뷰                                     |
| `docs_release_manager`  | `gpt-5.4-mini`        | medium    | workspace-write | 문서, 보고서, 상태 문서 갱신                                                                             | 작업 완료 보고/문서 정리                                            |

## Boundary Rules

- `spark_ui_iterator`는 DB/인증/API contract 비관련 `apps/web` 프론트엔드 작업의 기본 1순위다.
- `spark_ui_iterator` 한도가 소진되었거나 사용할 수 없으면 기존 라우팅대로 `frontend_agent` 또는 관련 검증 subagent로 전환한다.
- `spark_ui_iterator`는 `apps/api`, `packages/db`, `packages/shared`의 auth/session/password/token/rule 파일, Web auth adapter, API adapter contract, Electron runtime 파일을 수정하지 않는다.
- `frontend_agent`는 Web 화면과 API 호출 adapter를 다루되, API business logic을 Web Server Action으로 가져오지 않는다.
- `backend_agent`는 Fastify API와 domain service를 구현하되, Prisma schema 변경은 `db_reviewer` 검토가 필요하다.
- `desktop_release_agent`는 MVP 이후에만 활성화한다. Electron renderer에는 Node 권한을 주지 않고 preload IPC만 허용한다.
- `visual_ui_reviewer`는 기준 이미지와 screenshot evidence를 검토한다. DOM 동작, auth, API, DB pass/fail은 `ui_runtime_validator`와 `qa_agent`가 확인한다.
- `docs_release_manager`는 구현 코드를 변경하지 않는다.

## Work Routing Examples

| 작업                    | 기본 라우팅                                                                               | 완료 산출물                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 현 구조 파악            | `codebase_mapper`                                                                         | 관련 파일/위험 목록                            |
| API contract 변경       | `architect_reviewer` -> `backend_agent` -> `qa_agent`                                     | route/schema/test diff                         |
| Prisma schema/seed 변경 | `db_reviewer` -> `backend_agent`                                                          | migration/seed/validation 결과                 |
| 화면 skeleton           | `spark_ui_iterator`                                                                       | presentational component diff                  |
| 화면 기능 연결          | `spark_ui_iterator` 우선, Spark 한도 소진/경계 조건 시 `frontend_agent` + `backend_agent` | Web/API 연결 diff                              |
| 디자인 게이트           | `ui_runtime_validator` -> `visual_ui_reviewer`                                            | screenshot, console/network/accessibility 결과 |
| 릴리즈 준비             | `devops_sre_reviewer` -> `desktop_release_agent` -> `release_reviewer`                    | Electron smoke와 release checklist             |
