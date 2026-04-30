# Sidebar Active State Completion Report

작성일: 2026-04-30

## 1. 작업 개요

| 항목                | 내용                           |
| ------------------- | ------------------------------ |
| 작업 ID             | TASK-WORKSPACE-NAV-001         |
| 작업명              | Sidebar active state 자동 반영 |
| 요청자              | 사용자                         |
| 메인 오케스트레이터 | GPT-5.5                        |
| 전체 상태           | 완료                           |

## 2. 전체 프로젝트 개발 예정 대비 현재 완료율

현재 완료율: 약 8% / 100%.

산정 기준:

| 범위                           | 상태      | 반영                                                                                |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------- |
| Phase 0 프로젝트 초기화        | 일부 완료 | Next.js, TS, Tailwind, ESLint, pnpm 검증 완료. Prisma/SQLite/Prettier/test는 미완료 |
| Phase 1 디자인 시스템/레이아웃 | 일부 완료 | Workspace Shell, Sidebar, placeholder routes, Sidebar active state 완료             |
| Phase 2 인증/RBAC              | 미시작    | auth/DB/API contract 변경 금지 유지                                                 |
| Phase 3 DB/Seed                | 미시작    | Prisma 없음                                                                         |
| Phase 4~9 업무 기능/Export/QA  | 미시작    | 정적 placeholder와 UI shell 중심                                                    |

이번 작업 전 추정 완료율은 약 7%였고, workspace navigation의 route-aware active state가 추가되어 약 8%로 갱신했다.

## 3. 목표

현재 route에 맞춰 Sidebar 메뉴의 active 상태를 자동 계산한다.

이번 작업에서는 인증, DB, Prisma, Server Action, API contract를 변경하지 않는다.

## 4. 작업 분해

| 세부 작업          | 내용                                                             |
| ------------------ | ---------------------------------------------------------------- |
| 현재 구조 확인     | `layout.tsx`, `workspace-sidebar.tsx`, workspace routes 확인     |
| 충돌 가능성 점검   | `/` prefix 오탐, `/sales/new` 하위 경로 active 규칙 확인         |
| 자동 subagent 위임 | read-only mapper와 UI 구현 agent로 분리                          |
| active state 구현  | `usePathname()` 기반 `WorkspaceNavigation` client component 생성 |
| 검증               | typecheck, lint, build 실행                                      |
| 문서화             | current-state와 완료 보고 갱신                                   |

## 5. 자동 Subagent 위임 및 모델 선택 이유

| 세부 작업            | Subagent            | Model                 | 선택 이유                                                 |
| -------------------- | ------------------- | --------------------- | --------------------------------------------------------- |
| 구조/충돌 점검       | `codebase_mapper`   | `gpt-5.4-mini`        | 읽기 전용 route/sidebar 구조 확인은 빠른 mini 모델로 충분 |
| UI active state 구현 | `spark_ui_iterator` | `gpt-5.3-codex-spark` | UI wrapper 생성과 단순 route 상태 계산은 Spark 허용 범위  |
| 최종 검증/문서화     | 메인 오케스트레이터 | `GPT-5.5`             | 하네스 정책, 완료율 산정, auth/DB/API 불변 검증 필요      |

Spark는 UI/단순 작업에만 제한한다는 하네스 규칙에 맞춰 사용했다. auth, DB, API contract 관련 판단은 메인 오케스트레이터가 보수적으로 재검증했다.

## 6. Subagent 작업 결과

| Subagent            | 결과                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| `codebase_mapper`   | `layout.tsx` 정적 nav 구조와 `WorkspaceSidebar`의 `isActive` 렌더링 구조 확인 |
| `spark_ui_iterator` | `WorkspaceNavigation` client wrapper 생성 및 `layout.tsx` 최소 수정           |
| 메인 오케스트레이터 | 파일 확인, 검증 재실행, 완료율/문서 갱신                                      |

## 7. 실행 결과

변경된 파일:

| 파일                                                           | 내용                                                |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `src/app/(workspace)/_components/workspace-navigation.tsx`     | `usePathname()` 기반 Sidebar active state 자동 계산 |
| `src/app/(workspace)/layout.tsx`                               | 정적 navSections 제거 후 `WorkspaceNavigation` 사용 |
| `docs/00_system/project-current-state.md`                      | 현재 상태와 완료율 갱신                             |
| `docs/80_ai_harness/sidebar-active-state-completion-report.md` | 작업 완료 보고                                      |

적용된 active 규칙:

| Route                | Active 메뉴 |
| -------------------- | ----------- |
| `/`                  | 대시보드    |
| `/sales`             | 판매 관리   |
| `/sales/new`         | 판매 관리   |
| `/receivables`       | 미수금 관리 |
| `/customers`         | 고객 관리   |
| `/schedule`          | 일정 관리   |
| `/inventory`         | 재고 관리   |
| `/staffs`            | 직원 관리   |
| `/settings/base`     | 기초정보    |
| `/settings/policies` | 정책 관리   |

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

| 영역           | 변경 여부 | 비고                              |
| -------------- | --------: | --------------------------------- |
| Auth           |        No | 로그인/세션/RBAC 변경 없음        |
| DB             |        No | Prisma/schema/migration 변경 없음 |
| API contract   |        No | Server Action/API 변경 없음       |
| Package config |        No | 의존성 변경 없음                  |

## 10. 남은 리스크

| 리스크                                   | 영향도 | 대응                                                   |
| ---------------------------------------- | -----: | ------------------------------------------------------ |
| ADMIN badge는 실제 권한 제어가 아님      |   중간 | auth/RBAC 단계에서 guard와 메뉴 필터링 구현            |
| active state는 UI 표시만 담당            |   낮음 | 실제 접근 차단은 별도 middleware/server guard에서 처리 |
| `/reports/summary`는 Sidebar 메뉴에 없음 |   낮음 | 리포트 섹션 설계 시 menu item 추가 여부 결정           |

## 11. 다음 작업 5개

| 우선순위 | 다음 작업                                          | 작업 예정자/Subagent                      | 모델            |
| -------: | -------------------------------------------------- | ----------------------------------------- | --------------- |
|        1 | Prettier 설정 추가                                 | `frontend_agent`                          | GPT-5.5         |
|        2 | `(auth)/login` UI skeleton 생성                    | `spark_ui_iterator` + `security_reviewer` | Spark / GPT-5.5 |
|        3 | Prisma schema 적용 계획 수립                       | `db_reviewer`                             | GPT-5.5         |
|        4 | FilterBar/WorkspaceDrawer/Modal 공통 컴포넌트 추가 | `spark_ui_iterator`                       | Spark           |
|        5 | 권한 기반 Sidebar 메뉴 필터링 설계                 | `security_reviewer` + `frontend_agent`    | GPT-5.5         |
