# AI Harness Application Report

작성일: 2026-04-30

## 1. 현재 프로젝트 구조 분석 요약

현재 프로젝트 루트는 `C:\Projects\Active\PSMS`다.

애플리케이션 코드는 아직 없으며, 현재 존재하는 것은 프로젝트 상태 문서와 이번에 적용한 AI 하네스 설정이다.

```txt
C:\Projects\Active\PSMS
├─ AGENTS.md
├─ .codex
│  ├─ config.toml
│  └─ agents
├─ docs
│  ├─ 00_core
│  ├─ 00_system
│  ├─ 10_agents
│  ├─ 20_execution
│  ├─ 40_reports
│  └─ 80_ai_harness
```

문서 기준 시스템 구조는 다음과 같다.

| 영역      | 기준 구조                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js App Router, React, TypeScript, Tailwind CSS. Server Component 조회, Client Component 상호작용 |
| Backend   | Next.js 서버 영역 BFF. `server/queries`, `server/actions`, `server/services`, `server/repositories`   |
| DB        | Prisma ORM. 개발 SQLite, 운영 PostgreSQL 권장                                                         |
| 인증      | Credentials 기반 세션 또는 Auth.js 계열. ADMIN/STAFF RBAC                                             |
| API       | Server Action 중심. Export/file/webhook만 Route Handler                                               |
| 기능 상태 | 애플리케이션 구현 전. 하네스 설정만 적용 완료                                                         |

## 2. 하네스 적용 시 충돌 가능성 분석

| 영역         | 충돌 가능성                                                    | 적용한 대응                                             |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| Auth         | 원본 하네스의 범용 agent가 auth를 수정할 수 있음               | Spark/mini auth 수정 금지, `security_reviewer`만 검토   |
| DB           | 원본 하네스가 migration을 일반 backend 작업으로 처리할 수 있음 | DB 변경은 `db_reviewer` + GPT-5.5 review로 제한         |
| API contract | REST CRUD 생성 가능성                                          | Server Action 중심 규칙과 generic `/api` CRUD 금지 명시 |
| Spark        | 빠른 코드 수정 중 위험 영역 침범 가능                          | Spark 허용 범위를 UI/단순 문서로 제한                   |
| Agent 수     | 원본 하네스 agent가 MVP 범위보다 많음                          | mobile, ai integration, devops, release 등 제거         |
| 자동 위임    | 무조건 병렬 위임 시 파일 충돌 가능                             | 같은 파일/미정 contract/권한 불명확 시 병렬 금지        |

## 3. 하네스 커스터마이징 결과

생성/수정한 핵심 파일은 다음과 같다.

| 파일                                            | 적용 결과                                |
| ----------------------------------------------- | ---------------------------------------- |
| `AGENTS.md`                                     | PSMS 전용 최상위 AI 규칙 생성            |
| `.codex/config.toml`                            | GPT-5.5 기본, Spark/mini/QA profile 설정 |
| `.codex/agents/*.toml`                          | 사용할 subagent만 선별 생성              |
| `docs/00_core/orchestrator-rules.md`            | 자동 위임과 충돌 시 질문 기준 정의       |
| `docs/00_core/model-routing.md`                 | GPT-5.5/Spark/mini 라우팅 기준 정의      |
| `docs/00_core/approval-policy.md`               | auth/DB/API contract 보수 정책 정의      |
| `docs/10_agents/agent-map.md`                   | 사용할/제거할 subagent 정리              |
| `docs/20_execution/task-execution-rule.md`      | 작업 분해, Spark 제한, 완료 기준 정의    |
| `docs/20_execution/task-report-format.md`       | 작업 예정/결과 보고 템플릿 생성          |
| `docs/40_reports/completion-report-template.md` | 완료 보고 템플릿 생성                    |
| `docs/00_system/project-current-state.md`       | 하네스 적용 상태 반영                    |

## 4. Subagent 구성 최적화

### 사용할 Subagent

| Agent                  | Model                 | 사용 범위                                                |
| ---------------------- | --------------------- | -------------------------------------------------------- |
| `codebase_mapper`      | `gpt-5.4-mini`        | 구조 탐색, 파일 매핑                                     |
| `architect_reviewer`   | `gpt-5.5`             | 아키텍처, API contract, 계층 구조 검토                   |
| `security_reviewer`    | `gpt-5.5`             | 인증, 세션, RBAC, 개인정보, Export 권한                  |
| `db_reviewer`          | `gpt-5.5`             | Prisma, migration, seed, DB 정합성                       |
| `backend_agent`        | `gpt-5.5`             | Server Action, query, service, repository, business rule |
| `frontend_agent`       | `gpt-5.5`             | App Router page, URL Search Params, Drawer routing       |
| `spark_ui_iterator`    | `gpt-5.3-codex-spark` | 순수 UI skeleton, Tailwind, 정적 컴포넌트                |
| `qa_agent`             | `gpt-5.5`             | 테스트 전략, 회귀 검증, 인수 기준                        |
| `docs_release_manager` | `gpt-5.4-mini`        | 문서, 보고서, 상태 문서 갱신                             |

### 제거한 Subagent

| 제거 대상               | 이유                                     |
| ----------------------- | ---------------------------------------- |
| `product_planner`       | 제품 요구사항 문서가 이미 충분함         |
| `project_manager`       | 현재는 별도 일정 agent 불필요            |
| `ai_integration_agent`  | OpenAI/RAG/moderation은 MVP 범위 아님    |
| `mobile_agent`          | 모바일 전용 UX는 MVP 제외                |
| `devops_sre_reviewer`   | 배포/인프라는 현재 적용 범위 밖          |
| `release_reviewer`      | 릴리즈 단계 아님                         |
| `visual_asset_designer` | 현재 이미지/시안 생성 범위 아님          |
| `visual_ui_reviewer`    | UI 구현 후 필요 시 재도입                |
| `ui_runtime_validator`  | QA agent로 통합                          |
| `code_reviewer`         | 일반 리뷰는 GPT-5.5 reviewer와 QA로 통합 |

## 5. 모델 라우팅 전략

| 모델    | 기준                                                                    |
| ------- | ----------------------------------------------------------------------- |
| GPT-5.5 | auth, DB, API contract, transaction, policy, security, architecture, QA |
| Spark   | UI skeleton, Tailwind, presentational component, 정적 table, 문서 포맷  |
| mini    | 구조 매핑, 문서 정리, 보고서 초안, 단순 helper/test scaffold            |

Spark는 다음 영역에서 금지된다.

- 인증/세션/RBAC
- Prisma schema/migration/seed
- Server Action contract
- 판매/수납/미수금/재고/정책 transaction
- Export 권한/Audit Log
- 배포/CI/secret/env 정책

## 6. 작업 실행 정책

자동 subagent 위임 구조는 다음과 같다.

```txt
MUST READ 확인
→ 작업 목표 재정의
→ 위험도/영향 범위 분류
→ agent-map 기준 배정
→ 작업 예정 보고
→ 구현/검증
→ 작업 결과 보고
→ 다음 작업 5개 제안
```

병렬 작업은 파일 범위가 겹치지 않고 auth/DB/API contract가 확정되어 있을 때만 허용한다.

작업 중 다음 상황이 발생하면 사용자에게 확인한다.

- auth, DB, API contract 변경이 필요함
- 기술문서와 새 요구사항이 충돌함
- STAFF 권한 완화가 필요함
- 일반 CRUD Route Handler가 필요함
- SQLite/PostgreSQL 기준 결정이 필요함

## 7. 최종 적용 방법

이번 적용 순서는 다음과 같다.

| 순서 | 작업                                                          |
| ---- | ------------------------------------------------------------- |
| 1    | `C:\Projects\AI_Harness` 원본 구조 확인                       |
| 2    | `docs/00_system` 계획 문서와 충돌 지점 분석                   |
| 3    | root `AGENTS.md` 생성                                         |
| 4    | `.codex/config.toml` 생성                                     |
| 5    | 필요한 `.codex/agents/*.toml`만 생성                          |
| 6    | `docs/00_core` 하네스 정책 문서 생성                          |
| 7    | `docs/10_agents`, `docs/20_execution`, `docs/40_reports` 생성 |
| 8    | `project-current-state.md` 갱신                               |
| 9    | 적용 결과 검증                                                |

## 8. 작업 예정 및 결과 보고 템플릿

작업 예정 보고 템플릿은 `docs/20_execution/task-report-format.md`에 있다.

완료 보고 템플릿은 `docs/40_reports/completion-report-template.md`에 있다.

핵심 보고 필드는 다음과 같다.

| 보고 항목                      | 필수 여부 |
| ------------------------------ | --------: |
| 현재 프로젝트 구조 분석 요약   |      필수 |
| 충돌 가능성 분석               |      필수 |
| Subagent 배정                  |      필수 |
| 모델 라우팅                    |      필수 |
| Spark 사용/제한                |      필수 |
| 변경 파일                      |      필수 |
| 검증 결과                      |      필수 |
| Auth/DB/API contract 변경 여부 |      필수 |
| 남은 리스크                    |      필수 |
| 다음 작업 5개                  |      필수 |

## 9. 적용 결과

AI 하네스 설정은 프로젝트에 적용되었다.

이번 작업은 하네스 설정과 문서 생성만 수행했으며, 인증/DB/API contract는 변경하지 않았다.
