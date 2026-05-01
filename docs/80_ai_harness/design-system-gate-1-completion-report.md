# Design System Gate 1 Completion Report

작성일: 2026-05-01

## 목표

현재 하네스 기준에 맞춰 `dashboard.png`, `sales-management.png`, `sales-entry.png`를 우선 대상으로 Design System Gate 1차를 구현한다.

## 모델 선택 이유

- 기본 구현/검토 모델: GPT-5.5
- 이유:
  - 단순 UI skeleton을 넘어 `apps/web` Shell, auth-protected workspace layout, `packages/db` runtime path, 디자인 QA 흐름에 걸쳐 영향 범위가 넓다.
  - DB schema 변경은 없지만 API login runtime 확인 중 DB 파일 경로 불일치가 발견되어 GPT-5.5 수준의 경계 판단이 필요했다.
  - Spark는 순수 UI 반복에 적합하지만 이번 변경은 Web/Auth/DB runtime 검증을 포함하므로 단독 사용하지 않았다.

## 자동 Subagent 위임

| Subagent             | 역할                                | 결과                                                                           |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `codebase_mapper`    | 현재 UI 파일맵과 누락 컴포넌트 파악 | `FilterBar`, `Drawer`, `Modal`, `FormField` 누락 확인                          |
| `visual_ui_reviewer` | 디자인 PNG 기준 시각 요구사항 추출  | sidebar, KPI, filter, table, drawer, sales wizard 밀도/색상/구조 요구사항 확인 |

## 작업 분해

1. 하네스 문서와 디자인 기준 확인
2. subagent 위임으로 구조/시각 요구사항 분리 확인
3. 공통 workspace component 구현
4. `/`, `/sales`, `/sales/new` 정적 기준 화면 구현
5. 1586/1440/1280 viewport screenshot QA
6. format/lint/typecheck/db/build 검증

## 변경 요약

- `lucide-react` 추가
- workspace 공통 컴포넌트 추가:
  - `Button`
  - `FilterBar`
  - `FormField`, `TextInput`, `SelectInput`
  - `Drawer`
  - `Modal`
- 기존 workspace 컴포넌트 디자인 기준 보정:
  - `WorkspaceShell`
  - `WorkspaceSidebar`
  - `PageIntro`
  - `MetricCard`
  - `DataTable`
  - `TonePill`
- 기준 화면 3개 정적 구현:
  - `/`
  - `/sales`
  - `/sales/new`
- favicon 404 방지를 위해 `apps/web/public/favicon.svg` 추가
- Playwright 산출물을 format 대상에서 제외하기 위해 `.prettierignore` 갱신
- `packages/db/src/client.ts`의 SQLite 상대 경로 정규화를 `packages/db` 기준으로 보정

## 검증

명령 검증:

- `pnpm format:check`: 통과
- `pnpm lint`: 통과
- `pnpm typecheck`: 통과
- `pnpm db:validate`: 통과
- `pnpm build`: 통과
- `git diff --check`: 통과

런타임 검증:

- API `GET http://127.0.0.1:4273/health`: 통과
- API `POST http://127.0.0.1:4273/auth/login`: 통과
- Web `http://127.0.0.1:5273`: 실행 확인
- 현재 listener:
  - Web `127.0.0.1:5273`
  - API `127.0.0.1:4273`

Screenshot QA:

- `psms-dashboard-1586x992-v2.png`
- `psms-sales-1586x992.png`
- `psms-sales-new-1586x992.png`
- `psms-dashboard-1440x900.png`
- `psms-sales-1440x900.png`
- `psms-sales-new-1440x900.png`
- `psms-dashboard-1280x800-v2.png`
- `psms-sales-1280x800-v2.png`
- `psms-sales-new-1280x800.png`

## Auth / DB / API Contract 변경 여부

- Auth contract 변경: 없음
- API contract 변경: 없음
- DB schema 변경: 없음
- DB migration 파일 변경: 없음
- DB runtime path fix: 있음
  - `file:./dev.db`가 migration/seed와 API runtime에서 같은 `packages/db/dev.db`를 보도록 정규화 기준을 보정했다.

## 남은 위험

- 화면은 아직 정적/seed 데이터 기반이다. 실제 API data binding은 다음 단계에서 수행해야 한다.
- 차트는 구조 재현용 정적 CSS mock이다. 실제 chart library 또는 SVG chart 연결은 추후 필요하다.
- Drawer는 정적 표시 상태다. URL search param 기반 open/close 상태는 다음 판매 관리 기능 연결 단계에서 구현해야 한다.
- `/sales/new`는 1280에서 2열로 안전하게 내려가지만, 실제 입력 오류/동적 데이터가 붙으면 재검증이 필요하다.

## 다음 작업

1. acceptance seed 확장
2. dashboard/sales/sales-new용 shared schema와 API contract 초안 작성
3. 판매 관리 목록 API와 URL Search Params 연결
4. 판매 상세 Drawer를 `detail` search param 기반 상태로 전환
5. 판매 등록 Wizard step state와 form validation 연결
