# Orchestrator Rules

## 1. 목적

PSMS의 AI 하네스는 구현 속도보다 구조 보존, 인증/DB/API 안정성, 업무 데이터 정합성을 우선한다.

현재 프로젝트는 초기화 전 상태이므로, 오케스트레이터는 항상 `docs/00_system/project-current-state.md`와 기술문서 기준 구조를 먼저 확인한다.

## 2. 자동 Subagent 위임 정책

메인 오케스트레이터는 작업이 독립 가능한 영역으로 나뉘는 경우 자동으로 subagent 배정을 고려한다.

다만 다음 작업은 분해 전에 GPT-5.5 경로로 먼저 설계한다.

- 인증, 세션, RBAC
- Prisma schema, migration, seed 전략
- API contract 변경
- 판매 등록 transaction
- 수납 등록/취소 및 미수금 재계산
- 재고 판매 잠금/중복 판매 방지
- 정책 활성화/충돌 검증
- Export 권한/Audit Log

## 3. 기본 배정

| 작업 유형            | 기본 담당              | 모델                  | 권한            |
| -------------------- | ---------------------- | --------------------- | --------------- |
| 구조 탐색            | `codebase_mapper`      | `gpt-5.4-mini`        | read-only       |
| 아키텍처/API 방향    | `architect_reviewer`   | `gpt-5.5`             | read-only       |
| 인증/권한/보안       | `security_reviewer`    | `gpt-5.5`             | read-only       |
| DB/Prisma 검토       | `db_reviewer`          | `gpt-5.5`             | read-only       |
| 서버 구현            | `backend_agent`        | `gpt-5.5`             | workspace-write |
| route-aware frontend | `frontend_agent`       | `gpt-5.5`             | workspace-write |
| 단순 UI skeleton     | `spark_ui_iterator`    | `gpt-5.3-codex-spark` | workspace-write |
| 테스트/QA            | `qa_agent`             | `gpt-5.5`             | workspace-write |
| 문서/보고            | `docs_release_manager` | `gpt-5.4-mini`        | workspace-write |

## 4. 위임 전 체크

작업 예정 보고에는 다음을 포함한다.

- 목표
- 세부 작업
- subagent
- model
- reasoning effort
- 권한
- 파일 범위
- 산출물
- Spark 사용 여부
- 예상 검증

## 5. 충돌 처리

다음 충돌이 발견되면 진행을 멈추고 사용자에게 확인한다.

- 기술문서와 사용자의 새 요구가 충돌한다.
- auth, DB, API contract를 변경해야만 작업이 가능한 경우
- STAFF 권한을 완화해야 하는 경우
- Route Handler를 일반 CRUD 용도로 만들어야 하는 경우
- SQLite와 PostgreSQL 중 어떤 동작을 기준으로 삼을지 결정이 필요한 경우

## 6. 완료 조건

검증 결과가 없는 완료 보고는 완료로 인정하지 않는다.

완료 보고에는 반드시 다음을 포함한다.

- 변경 파일
- 적용된 subagent/model
- 검증 명령 또는 검증 방법
- auth/DB/API contract 변경 여부
- Spark 사용 및 escalation 여부
- 남은 리스크
- 다음 작업 5개
