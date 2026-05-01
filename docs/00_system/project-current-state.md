# Project Current State

작성일: 2026-04-30
갱신: 2026-05-01

## 2026-05-01 재계획 반영

현재 실제 개발 작업 디렉터리는 `C:\Project\Activate\PSMS`이다.

기준 기술 문서와 디자인 레퍼런스는 `C:\Project\PSMS_Tech`를 사용한다.

프로젝트는 Web/API/Desktop 릴리즈 계획을 반영해 `pnpm workspace` 구조로 전환되었다.

```txt
apps/web       Next.js App Router Web, http://127.0.0.1:5273
apps/api       Fastify API, http://127.0.0.1:4273
apps/desktop   Electron shell placeholder
packages/shared
packages/db
```

`C:\Project\PSMS_Tech\design-reference`의 10개 PNG를 화면별 디자인 게이트 기준으로 사용한다.

## 2026-05-01 AI Harness 동기화

`C:\Project\AI_Harness`를 확인해 PSMS 현재 구조에 맞는 하네스 설정을 추가 반영했다.

- `.codex/config.toml`의 agent 동시성 기준을 `max_threads = 6`으로 확장했다.
- code review, UI validation, release review profile을 추가했다.
- `project_manager`, `code_reviewer`, `ui_runtime_validator`, `visual_ui_reviewer`, `devops_sre_reviewer`, `release_reviewer`, `desktop_release_agent`를 추가했다.
- agent map, orchestrator, model routing, task execution rule을 Web/API/Desktop workspace와 디자인 게이트 기준으로 갱신했다.
- UI validation, testing policy, Electron release checklist 문서를 추가했다.
- 현 시점 개발 흐름 기준은 `docs/00_system/development-flow.md`에 고정했다.

## 현재 구조

아래 내용은 2026-04-30 bootstrap 상태 설명을 포함한다. 경로가 `C:\Projects\Active\PSMS` 또는 `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs`로 표기된 부분은 2026-05-01 기준 각각 `C:\Project\Activate\PSMS`, `C:\Project\PSMS_Tech`로 대체해서 해석한다.

현 시점 기준으로 `C:\Projects\Active\PSMS`에는 Next.js App Router 기반 애플리케이션 골격과 AI 하네스 설정이 생성되어 있다.

Git 저장소는 아직 생성되어 있지 않다.

Prisma 초기 create-only migration은 생성되었고 실제 개발 DB `dev.db`에 적용 완료되었다.

Smoke/auth seed script는 구현 및 실행 완료되었다. 현재 `dev.db`에는 smoke용 `Store` 1개와 `ADMIN`, `STAFF` 계정 각 1개가 존재한다.

Auth/session 1차 구현이 완료되었다. `loginAction`, `logoutAction`, DB-backed opaque session, HMAC 기반 `sessionTokenHash`, workspace session guard, ADMIN 전용 route guard, sidebar role filtering이 적용되었다.

참고 기술문서는 `C:\Projects\PSMS_Tech\phoneshop_rebuild_docs`에 별도로 정리되어 있다.

```txt
C:\Projects\Active\PSMS
├─ AGENTS.md
├─ .codex
│  ├─ config.toml
│  └─ agents
├─ package.json
├─ pnpm-lock.yaml
├─ prisma.config.ts
├─ next.config.ts
├─ tsconfig.json
├─ eslint.config.mjs
├─ postcss.config.mjs
├─ .prettierrc.json
├─ .prettierignore
├─ .env.example
├─ prisma
│  ├─ schema.prisma
│  └─ migrations
│     ├─ migration_lock.toml
│     └─ 20260430030525_init
│        └─ migration.sql
├─ src
│  ├─ app
│  │  ├─ (auth)
│  │  │  └─ login
│  │  ├─ (workspace)
│  │  │  ├─ _components
│  │  │  ├─ customers
│  │  │  ├─ inventory
│  │  │  ├─ receivables
│  │  │  ├─ reports
│  │  │  ├─ sales
│  │  │  ├─ schedule
│  │  │  ├─ settings
│  │  │  ├─ staffs
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  ├─ components
│  ├─ lib
│  │  └─ prisma.ts
│  ├─ generated
│  │  └─ prisma
│  ├─ server
│  │  ├─ actions
│  │  ├─ queries
│  │  ├─ services
│  │  └─ repositories
│  └─ types
├─ test
└─ docs
   ├─ 00_core
   └─ 00_system
   ├─ 10_agents
   ├─ 20_execution
   ├─ 40_reports
   └─ 80_ai_harness
```

참고 문서 패키지 구조는 다음과 같다.

```txt
C:\Projects\PSMS_Tech\phoneshop_rebuild_docs
├─ README.md
├─ PHONESHOP_REBUILD_MASTER_SPEC.md
├─ docs
├─ prisma
│  └─ schema.draft.prisma
├─ prompts
├─ source
└─ design-reference
```

계획된 애플리케이션 구조는 Next.js App Router 기반이다.

```txt
src
├─ app
│  ├─ (auth)
│  └─ (workspace)
├─ components
├─ server
│  ├─ actions
│  ├─ queries
│  ├─ services
│  └─ repositories
├─ lib
├─ types
└─ test
```

## 이미 구현된 기능

실제 업무 기능은 아직 구현되지 않았다.

현재 준비된 산출물은 재개발을 위한 기술문서, 설계 자료, AI 하네스 설정, Next.js 초기 실행 골격이다.

- 제품 요구사항 문서
- 정보 구조, 라우트, RBAC 명세
- UI/UX 디자인 시스템 명세
- 컴포넌트 아키텍처 명세
- 프론트엔드/백엔드 아키텍처 명세
- 도메인 모델 및 DB 명세
- Prisma 스키마 초안
- Server Action 및 Export API 계약
- 기능별 상세 명세
- 테스트, QA, 인수 기준
- 개발 로드맵 및 운영 Runbook
- 화면 디자인 참고 이미지
- 프로젝트 전용 `AGENTS.md`
- 프로젝트 전용 `.codex` agent 설정
- 모델 라우팅, agent map, 작업 실행 규칙, 보고 템플릿
- Prisma schema 적용 계획 문서
- Prisma schema review 체크리스트
- Auth/session 방식 의사결정 문서
- Session 모델 추가 여부 결정 문서
- Auth/session 실제 구현 전 preflight 문서
- Prisma bootstrap preflight 문서
- Prisma 초기 create-only migration SQL
- Prisma migration 적용 전 최종 gate 검토 문서
- Prisma SQLite runtime native build-script 정책 반영
- Prisma migration rollback/test plan 문서
- Prisma disposable DB migration apply rehearsal 통과
- Prisma 실제 적용 전 `dev.db` backup/hash gate 통과
- Prisma 실제 apply 직전 final preflight 통과
- Prisma 초기 migration 실제 `dev.db` 적용 완료
- Smoke seed/auth seed 정책 문서
- Smoke seed/auth seed script 구현 및 idempotency 검증
- `ActionResult` 공통 타입
- Zod 기반 login 입력 검증
- HMAC 기반 session token hash helper
- DB-backed opaque session 조회/생성/폐기 흐름
- 로그인 실패 in-memory rate limit 1차 guard
- `loginAction`, `logoutAction`
- Login form 실제 action 연결
- Workspace layout session guard
- ADMIN 전용 route server guard
- Sidebar ADMIN/STAFF role filtering
- 403 forbidden page
- 인증 이벤트 AuditLog repository/service 연결
- Next.js App Router 초기 프로젝트
- TypeScript strict 설정
- Tailwind CSS 4 설정
- ESLint flat config 설정
- Prettier 설정 및 전체 포맷 검증 스크립트
- `src/app/(auth)/login` 정적 Login UI skeleton
- `src/app/(workspace)` route group
- `src/app/(workspace)/layout.tsx` 기반 Workspace Shell 적용
- `src/app/(workspace)/_components/workspace-navigation.tsx` 기반 Sidebar active state 자동 반영
- `/` 대시보드 준비 화면
- 업무 메뉴별 정적 placeholder route
  - `/login`
  - `/sales`
  - `/sales/new`
  - `/receivables`
  - `/customers`
  - `/schedule`
  - `/inventory`
  - `/staffs`
  - `/settings/base`
  - `/settings/policies`
  - `/reports/summary`
- 공통 Workspace UI 컴포넌트 1차 세트
  - `WorkspaceShell`
  - `WorkspaceSidebar`
  - `PageIntro`
  - `Panel`
  - `MetricCard`
  - `TonePill`
  - `DataTable`
- `src/server` 계층 디렉터리 placeholder
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과 상태

## 아직 안된 기능

프로젝트 초기 골격은 생성되었지만, 아래 업무 기능은 아직 미구현 상태다.

- Master/QA acceptance seed 데이터 작성 및 실행
- Auth/RBAC 자동화 테스트
- 운영용 persistent/shared login rate limit 저장소
- Auth/session 브라우저 기반 E2E 검증
- 세션 강제 폐기/직원 비활성화 연동
- 권한 기반 Workspace Shell/Sidebar 메뉴 필터링 고도화
- 실제 데이터 기반 대시보드
- 판매 관리 실제 목록/상세/등록
- 판매 등록 6단계 Wizard 실제 동작
- 미수금 관리 실제 수납/취소
- 고객 관리 실제 상세/이력
- 일정 관리 실제 캘린더/업무 큐
- 재고 관리 실제 등록/상태 변경
- 직원 관리 실제 계정 관리
- 기초정보 실제 CRUD
- 정책 관리 실제 계산/활성화
- 상세 리포트 실제 집계
- CSV/PDF Export
- Audit Log
- 백업/복원
- Unit, Integration, E2E 테스트
- 배포 설정 및 운영 환경 구성

AI 하네스, 앱 골격, 공통 Workspace UI 컴포넌트 1차 세트는 적용되었지만, 실제 업무 도메인 구현은 아직 시작되지 않았다.

전체 프로젝트 개발 예정 대비 현재 완료율: 약 25% / 100%.

산정 기준:

- Phase 0 프로젝트 초기화 일부 완료
- Prettier 설정 및 전체 포맷 검증 완료
- Prisma schema 적용 계획 수립 완료
- Prisma schema review 체크리스트 확정 완료
- Auth/session 방식 의사결정 완료
- Session 모델 추가 여부 결정 완료
- Auth/session 구현 preflight 완료
- Prisma bootstrap preflight 완료
- Prisma 7.8 의존성 및 script 추가
- Prisma config, SQLite datasource env, schema 파일 추가
- Session 모델 실제 Prisma schema 반영
- Prisma Client 생성
- Prisma 초기 create-only migration 생성
- 생성 migration SQL 임시 SQLite 적용 검증 완료
- Prisma migration 적용 전 최종 gate 수행: 현 상태 적용 보류 판정
- pnpm native build-script 허용 목록 반영 및 Prisma SQLite runtime 연결 복구
- Prisma migration rollback/test plan 작성
- Prisma disposable DB migration apply rehearsal 통과: 실제 `dev.db` 미변경 확인
- Prisma 실제 적용 전 `dev.db` backup/hash gate 통과: `dev.db.pre-init-20260430132108.bak`
- Prisma 실제 apply 직전 final preflight 통과: target/hash/pending/runtime/catalog 확인
- Prisma 초기 migration 실제 `dev.db` 적용 완료: 업무 table 22개, index 55개, migration row 1건
- Smoke seed/auth seed 정책 수립 완료
- Smoke seed/auth seed script 구현 및 실행 완료: `Store` 1개, `ADMIN` 1명, `STAFF` 1명
- Smoke seed idempotency 검증 완료: 재실행 후 `Store=1`, `User=2`, 금지 table 0건 유지
- Auth/session 구현 preflight 완료
- Auth/session 1차 구현 완료: `loginAction`, `logoutAction`, DB-backed session, workspace guard, ADMIN route guard
- Phase 1 디자인 시스템/레이아웃 일부 완료
- Login UI skeleton route 완료
- Login form 실제 action 연결 완료
- 주요 workspace route placeholder 완료
- Sidebar active state 자동 반영 완료
- 인증 flow 1차 구현 완료. master/QA seed 데이터, 도메인 Server Action, 도메인 기능, Export, E2E는 미구현

## 기술 스택

기술문서 기준 권장 스택은 다음과 같다.

| 영역            | 기술                                      |
| --------------- | ----------------------------------------- |
| Framework       | Next.js App Router                        |
| UI Runtime      | React                                     |
| Language        | TypeScript                                |
| Styling         | Tailwind CSS                              |
| ORM             | Prisma ORM                                |
| 개발 DB         | SQLite                                    |
| 운영 DB         | PostgreSQL 권장                           |
| 인증            | Credentials 기반 세션 또는 Auth.js 계열   |
| Validation      | Zod                                       |
| Date            | date-fns                                  |
| Chart           | Recharts 또는 SVG 기반 자체 차트          |
| Test            | Vitest, React Testing Library, Playwright |
| Package Manager | pnpm                                      |
| Export          | 서버 생성 CSV, PDF 리포트 템플릿          |

아키텍처 방향은 서버 렌더링, Server Action, URL Search Params 기반 필터링, Drawer/Modal 중심 CRUD, Prisma transaction 기반 업무 처리를 기준으로 한다.

## 현재 검증 상태

| 검증         | 명령                                  | 상태      |
| ------------ | ------------------------------------- | --------- |
| Format       | `pnpm format:check`                   | 통과      |
| Typecheck    | `pnpm typecheck`                      | 통과      |
| Lint         | `pnpm lint`                           | 통과      |
| Build        | `pnpm build`                          | 통과      |
| DB Schema    | `pnpm db:validate`                    | 통과      |
| DB Client    | `pnpm db:generate`                    | 통과      |
| DB Gate      | rehearsal, backup, final preflight    | 통과      |
| DB Runtime   | Prisma SQLite adapter connect         | 통과      |
| DB Plan      | rollback/test plan                    | 작성 완료 |
| DB Rehearsal | disposable raw SQL + Prisma deploy    | 통과      |
| DB Backup    | pre-apply `dev.db` backup/hash        | 통과      |
| DB Preflight | actual apply final preflight          | 통과      |
| DB Migration | `pnpm db:migrate`                     | 통과      |
| Seed Policy  | smoke/auth seed policy                | 작성 완료 |
| Seed Script  | `pnpm db:seed`                        | 통과      |
| Seed Safety  | idempotency/forbidden table check     | 통과      |
| Auth Gate    | auth/session implementation preflight | 작성 완료 |
| Auth Build   | login/logout/session implementation   | 통과      |

Prisma migration 상태:

- `prisma/migrations/20260430030525_init/migration.sql` 생성 완료
- `pnpm exec prisma migrate status` 기준 schema up to date
- `dev.db`에는 업무 table 22개와 `_prisma_migrations` table이 적용됨
- migration SQL은 임시 SQLite DB에 적용 검증 완료: table 22개, index 55개 생성 확인
- disposable DB Prisma apply rehearsal 통과: `migrate deploy` exit 0, `migrate status` clean, 업무 table 22개, index 55개, migration row 1개 확인
- 리허설 전후 `dev.db` SHA256, size, LastWriteTimeUtc 동일. `_prisma_migrations` row count 0 유지
- 실제 적용 전 백업 생성 완료: `dev.db.pre-init-20260430132108.bak`
- 백업 hash는 원본 `dev.db`와 동일: `8252EF21187C4C09074DBC532121AA321D713E64E03FB2A040DECFE040782C02`
- 실제 apply 직전 final preflight 통과: target DB `file:./dev.db`, migration pending, 업무 table 0개, index 0개, `quick_check=ok`, journal mode `delete`, WAL/SHM 없음
- 실제 `dev.db` migration apply 통과: `20260430030525_init|FINISHED|NOT_ROLLED_BACK`
- post-apply catalog 검증 통과: 업무 table 22개, 전체 non-sqlite table 23개, index 55개
- post-validation `dev.db` hash: `879ADFA986D4BD273C64970AE7C0567F308592BCD3E88F549E563A1AA410F170`
- JSON smoke insert/delete 이후 모든 업무 table row count는 0이며 schema diff는 없음
- pnpm build-script 허용 목록 반영 후 `pnpm ignored-builds`는 `None`
- `better-sqlite3` native binding 생성 및 Prisma SQLite adapter connect 검증 완료
- migration rollback/test plan 작성 완료
- smoke seed/auth seed 정책 작성 완료
- smoke seed/auth seed script 구현 및 idempotency 검증 완료
- 현재 smoke seed row: `Store=1`, `User=2`; login 전 `Session=0`
- 다음 단계는 Auth/RBAC 자동화 테스트와 브라우저 login smoke 검증
