# Workspace Placeholder Routes Completion Report

작성일: 2026-04-30

## 1. 작업 개요

| 항목                | 내용                               |
| ------------------- | ---------------------------------- |
| 작업 ID             | TASK-WORKSPACE-ROUTES-001          |
| 작업명              | 업무 메뉴별 placeholder route 생성 |
| 요청자              | 사용자                             |
| 메인 오케스트레이터 | GPT-5.5                            |
| 전체 상태           | 완료                               |

## 2. 전체 프로젝트 개발 예정 대비 현재 완료율

현재 완료율: 약 7% / 100%.

산정 기준:

| 범위                           | 상태      | 반영                                                                                                |
| ------------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| Phase 0 프로젝트 초기화        | 일부 완료 | Next.js, TS, Tailwind, ESLint, pnpm 검증 완료. Prisma/SQLite/Prettier/test는 미완료                 |
| Phase 1 디자인 시스템/레이아웃 | 일부 완료 | WorkspaceShell, Sidebar, PageIntro, Panel, MetricCard, DataTable, TonePill, placeholder routes 완료 |
| Phase 2 인증/RBAC              | 미시작    | auth/DB/API contract 변경 금지 유지                                                                 |
| Phase 3 DB/Seed                | 미시작    | Prisma 없음                                                                                         |
| Phase 4~9 업무 기능/Export/QA  | 미시작    | 정적 placeholder만 생성                                                                             |

이번 작업 전 추정 완료율은 약 6%였고, workspace route placeholder 10개가 추가되어 약 7%로 갱신했다.

## 3. 목표

기술문서의 IA/RBAC 라우트 명세에 맞춰 `(workspace)` route group 아래 업무 메뉴별 정적 placeholder 페이지를 생성한다.

이번 작업에서는 인증, DB, Prisma, Server Action, API contract를 변경하지 않는다.

## 4. 작업 분해

| 세부 작업                      | 내용                                                      |
| ------------------------------ | --------------------------------------------------------- |
| 라우트 명세 확인               | 기술문서의 workspace route 목록 확인                      |
| route conflict 점검            | `/`, `/login`, workspace route 충돌 여부 확인             |
| 공통 placeholder 컴포넌트 생성 | route title, status, search params, planned features 표시 |
| 업무 메뉴 route 생성           | `/sales`, `/receivables`, `/customers` 등 10개 route 생성 |
| 검증                           | typecheck, lint, build 실행                               |
| 문서화                         | current-state와 완료 보고 갱신                            |

## 5. 자동 Subagent 위임 및 모델 선택 이유

| 세부 작업                  | Subagent               | Model          | 선택 이유                                         |
| -------------------------- | ---------------------- | -------------- | ------------------------------------------------- |
| 라우트 충돌/파일 범위 확인 | `codebase_mapper`      | `gpt-5.4-mini` | read-only 구조 매핑은 mini가 빠르고 충분          |
| placeholder route 구현     | `frontend_agent`       | `gpt-5.5`      | Next App Router 경로 구조와 route group 판단 필요 |
| 최종 검증                  | `qa_agent`             | `gpt-5.5`      | build/type/lint로 라우트 회귀 확인 필요           |
| 완료 보고 작성             | `docs_release_manager` | `gpt-5.4-mini` | 문서 갱신과 보고서 작성에 적합                    |

Spark는 사용하지 않았다. 이번 작업은 단순 UI 일부가 포함되지만, route tree 생성과 경로 충돌 검증이 중심이므로 `frontend_agent`를 사용했다.

## 6. Subagent 작업 결과

| Subagent            | 결과                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `codebase_mapper`   | 추가할 workspace route 10개를 확인하고 `/login`은 `(auth)` 영역으로 제외해야 함을 확인 |
| `frontend_agent`    | 정적 placeholder component와 10개 route page 생성                                      |
| 메인 오케스트레이터 | 파일 확인, 검증 재실행, 완료율/문서 갱신                                               |

## 7. 실행 결과

생성된 주요 파일:

| 파일                                                        | 내용                       |
| ----------------------------------------------------------- | -------------------------- |
| `src/app/(workspace)/_components/workspace-placeholder.tsx` | 공통 placeholder component |
| `src/app/(workspace)/sales/page.tsx`                        | `/sales`                   |
| `src/app/(workspace)/sales/new/page.tsx`                    | `/sales/new`               |
| `src/app/(workspace)/receivables/page.tsx`                  | `/receivables`             |
| `src/app/(workspace)/customers/page.tsx`                    | `/customers`               |
| `src/app/(workspace)/schedule/page.tsx`                     | `/schedule`                |
| `src/app/(workspace)/inventory/page.tsx`                    | `/inventory`               |
| `src/app/(workspace)/staffs/page.tsx`                       | `/staffs`                  |
| `src/app/(workspace)/settings/base/page.tsx`                | `/settings/base`           |
| `src/app/(workspace)/settings/policies/page.tsx`            | `/settings/policies`       |
| `src/app/(workspace)/reports/summary/page.tsx`              | `/reports/summary`         |

문서 갱신:

| 파일                                                                   | 내용                            |
| ---------------------------------------------------------------------- | ------------------------------- |
| `docs/00_system/project-current-state.md`                              | route placeholder와 완료율 갱신 |
| `docs/80_ai_harness/workspace-placeholder-routes-completion-report.md` | 작업 완료 보고                  |

## 8. 검증 결과

| 검증 항목 | 명령             | 결과 |
| --------- | ---------------- | ---- |
| Typecheck | `pnpm typecheck` | 통과 |
| Lint      | `pnpm lint`      | 통과 |
| Build     | `pnpm build`     | 통과 |

Build output에서 아래 route가 정적 생성됨을 확인했다.

- `/`
- `/customers`
- `/inventory`
- `/receivables`
- `/reports/summary`
- `/sales`
- `/sales/new`
- `/schedule`
- `/settings/base`
- `/settings/policies`
- `/staffs`

## 9. Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                              |
| ------------ | --------: | --------------------------------- |
| Auth         |        No | `/login` route 생성하지 않음      |
| DB           |        No | Prisma/schema/migration 변경 없음 |
| API contract |        No | Server Action/API 변경 없음       |

## 10. 남은 리스크

| 리스크                              | 영향도 | 대응                                     |
| ----------------------------------- | -----: | ---------------------------------------- |
| placeholder는 실제 권한 차단이 아님 |   중간 | auth/RBAC 단계에서 실제 guard 구현       |
| search params는 표시만 됨           |   낮음 | 실제 목록/Drawer 구현 시 URL parser 연결 |
| 업무 기능은 아직 미구현             |   높음 | Phase 2~9 순차 진행                      |

## 11. 다음 작업 5개

| 우선순위 | 다음 작업                                          | 작업 예정자/Subagent                      | 모델            |
| -------: | -------------------------------------------------- | ----------------------------------------- | --------------- |
|        1 | Sidebar active state 구조 설계 및 구현             | `frontend_agent`                          | GPT-5.5         |
|        2 | Prettier 설정 추가                                 | `frontend_agent`                          | GPT-5.5         |
|        3 | `(auth)/login` UI skeleton 생성                    | `spark_ui_iterator` + `security_reviewer` | Spark / GPT-5.5 |
|        4 | Prisma schema 적용 계획 수립                       | `db_reviewer`                             | GPT-5.5         |
|        5 | FilterBar/WorkspaceDrawer/Modal 공통 컴포넌트 추가 | `spark_ui_iterator`                       | Spark           |
