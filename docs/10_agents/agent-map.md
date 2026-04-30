# Agent Map

## 사용할 Subagent

| Agent                  | Model                 | Reasoning | Sandbox         | 책임 범위                                                | 사용 조건                    |
| ---------------------- | --------------------- | --------- | --------------- | -------------------------------------------------------- | ---------------------------- |
| `codebase_mapper`      | `gpt-5.4-mini`        | medium    | read-only       | 구조 탐색, 파일 매핑                                     | 작업 전 빠른 현황 파악       |
| `architect_reviewer`   | `gpt-5.5`             | high      | read-only       | 아키텍처, API contract, 라우팅, 계층 구조                | 설계/충돌/contract 판단      |
| `security_reviewer`    | `gpt-5.5`             | high      | read-only       | 인증, 세션, RBAC, 개인정보, Export 권한                  | auth/security 변경 또는 검토 |
| `db_reviewer`          | `gpt-5.5`             | high      | read-only       | Prisma, migration, seed, index, DB 정합성                | DB 관련 변경 검토            |
| `backend_agent`        | `gpt-5.5`             | high      | workspace-write | Server Action, query, service, repository, business rule | 서버/도메인 구현             |
| `frontend_agent`       | `gpt-5.5`             | medium    | workspace-write | App Router page, URL Search Params, Drawer routing       | route-aware frontend 구현    |
| `spark_ui_iterator`    | `gpt-5.3-codex-spark` | medium    | workspace-write | 순수 UI skeleton, Tailwind, 정적 컴포넌트                | auth/DB/API 없는 UI 작업     |
| `qa_agent`             | `gpt-5.5`             | high      | workspace-write | 테스트 전략, 회귀 검증, 인수 기준                        | 기능 완료 전 검증            |
| `docs_release_manager` | `gpt-5.4-mini`        | medium    | workspace-write | 문서, 보고서, 상태 문서 갱신                             | 결과 보고/문서 정리          |

## 제거한 Subagent

| 제거 대상               | 제거 이유                                                       |
| ----------------------- | --------------------------------------------------------------- |
| `product_planner`       | 제품 요구사항 문서가 이미 별도 패키지에 충분히 존재             |
| `project_manager`       | 현재는 구현 전 문서/하네스 세팅 단계이며 별도 일정 agent 불필요 |
| `ai_integration_agent`  | OpenAI API/RAG/moderation 기능은 MVP 범위 아님                  |
| `mobile_agent`          | 모바일 전용 UX는 초기 MVP 제외                                  |
| `devops_sre_reviewer`   | 배포/인프라는 초기 하네스 적용 범위 밖                          |
| `release_reviewer`      | 릴리즈 단계 아님                                                |
| `visual_asset_designer` | 이미지/시안 생성은 현재 범위 아님                               |
| `visual_ui_reviewer`    | UI 구현 후 필요 시 재도입 가능                                  |
| `ui_runtime_validator`  | Playwright 검증은 `qa_agent`로 통합                             |
| `code_reviewer`         | 일반 리뷰는 GPT-5.5 agent와 QA로 통합                           |

## Agent 경계

- `spark_ui_iterator`는 `src/server`, `prisma`, auth, API contract 파일을 수정하지 않는다.
- `frontend_agent`는 route-aware frontend를 담당하지만 auth/session 구현 자체는 수정하지 않는다.
- `backend_agent`는 Server Action과 service를 구현하되 DB schema와 API contract 변경 시 escalation한다.
- `db_reviewer`, `security_reviewer`, `architect_reviewer`는 read-only reviewer다.
- `docs_release_manager`는 구현 코드를 수정하지 않는다.

## 작업 예정 보고 예시

| 세부 작업          | Subagent            | Model                 | 이유                        | 산출물              |
| ------------------ | ------------------- | --------------------- | --------------------------- | ------------------- |
| 현 구조 확인       | `codebase_mapper`   | `gpt-5.4-mini`        | 빠른 파일 매핑              | 관련 파일 목록      |
| 공통 UI skeleton   | `spark_ui_iterator` | `gpt-5.3-codex-spark` | 순수 UI 작업                | 컴포넌트 diff       |
| URL 필터 page 구현 | `frontend_agent`    | `gpt-5.5`             | route-aware 상태 필요       | page/component diff |
| Server Action 구현 | `backend_agent`     | `gpt-5.5`             | contract와 transaction 필요 | action/service diff |
| 검증               | `qa_agent`          | `gpt-5.5`             | 회귀 위험 확인              | 테스트 결과         |
