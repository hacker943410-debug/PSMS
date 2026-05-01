# PSMS Development Flow

작성일: 2026-05-01

## 기준

- 구현 저장소: `C:\Project\Activate\PSMS`
- 기술 문서/디자인 소스: `C:\Project\PSMS_Tech`
- 하네스 기준: `C:\Project\AI_Harness`
- Web: `http://127.0.0.1:5273`
- API: `http://127.0.0.1:4273`
- 금지 포트: `5173`, `4173`

## 구조

```txt
apps/web       Next.js App Router UI/BFF adapter
apps/api       Fastify API, auth/session/RBAC/domain transaction
apps/desktop   Electron local app release shell
packages/shared Zod schema, result types, pure helpers
packages/db     Prisma schema, migration, generated client, seed
```

## 현재 기준 작업 흐름

| 단계                            | 목표                                                                            | 완료 기준                                                 |
| ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 0. Baseline/Harness             | workspace, ports, docs, AI harness 동기화                                       | format/typecheck 통과, agent/routing/validation 문서 갱신 |
| 1. Design System Gate           | `dashboard.png`, `sales-management.png`, `sales-entry.png` 기준 Shell/UI 재구성 | static/seed data screenshot이 기준 PNG 구조와 일치        |
| 2. API/DB Foundation            | Fastify auth/session, shared schema, Prisma/seed/test DB 정리                   | `/health`, auth routes, seed reset, integration test 준비 |
| 3. Admin Foundation             | 직원, 기초정보, 정책 CRUD                                                       | 판매/재고 선택값과 정책 계산 기반 확보                    |
| 4. Inventory                    | 재고 등록 Drawer, S/N unique, Model No., 상태 전환                              | inventory route/API/test/screenshot 통과                  |
| 5. Sales                        | 판매 목록/상세 Drawer, 6단계 판매 등록 Wizard                                   | Sale/Inventory/Receivable transaction test와 E2E 통과     |
| 6. Receivable/Customer/Schedule | 수납/취소, 고객 이력, 후속 일정, 월간 캘린더                                    | 잔액 재계산, 이력, 일정 규칙 검증                         |
| 7. Dashboard/Report/Export      | 실제 집계, 차트, Top 10, CSV/PDF                                                | 권한, Audit Log, export smoke 통과                        |
| 8. Web MVP Gate                 | 주요 화면 기능/디자인/E2E 통합                                                  | lint/typecheck/build/db/e2e/UI validation 통과            |
| 9. Electron Release             | Web/API 로컬 프로세스 래핑, userData SQLite                                     | Electron smoke와 release checklist 통과                   |

## 화면별 완료 순서

모든 화면은 아래 순서로 진행한다.

```txt
디자인 정합성 -> API 계약 -> 기능 연결 -> 테스트 -> 스크린샷 QA
```

- 정적/seed 데이터로 먼저 기준 PNG와 시각 구조를 맞춘다.
- API contract는 `packages/shared` Zod schema와 `ActionResult` 기준으로 확정한다.
- 기능 연결은 Web Server Action adapter가 아니라 `apps/api`가 business logic을 소유한다.
- 화면 완료 보고에는 `1586x992`, `1440x900`, `1280x800` 검증 여부를 포함한다.

## 다음 구현 우선순위

1. `apps/web` Shell, Sidebar, PageIntro, KPI, FilterBar, DataTable, Drawer, Modal, FormField를 design-reference 기준으로 재구성한다.
2. `dashboard.png`, `sales-management.png`, `sales-entry.png` 기준 정적 화면을 먼저 맞춘다.
3. acceptance seed를 확장해 관리자 1명, 직원 5명 이상, 매장 3개 이상, 통신사/기종/재고/고객/판매/미수금/일정/정책 데이터를 확보한다.
4. Fastify API route test와 seed reset 스크립트를 만든다.
5. 관리자 기반 CRUD부터 실제 API 연결을 시작한다.

## 검증 기준

공통:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm build
```

UI:

- API `/health`
- Web `5273`
- Playwright screenshot
- console/network/hydration warning
- accessibility 기본 검사

Electron:

- local port 충돌 감지
- userData `psms.db` 생성/재사용
- migration 상태 확인
- 로그인, 주요 메뉴, 판매 등록, 수납 등록, 재시작 후 데이터 유지
