# Stage 1 Web Admin API Adapter Completion Report

작성일: 2026-05-02

## 요약

- `/staffs`, `/settings/base`, `/settings/policies` Web 화면을 정적 데이터에서 Fastify Admin read API page-data 조회로 연결했다.
- Web 전용 `server-only` adapter가 `psms_session` 쿠키를 Fastify API로 전달한다.
- URL 상태 helper는 유지하고, 별도 mapper에서 Web URL state를 API query contract로 변환했다.
- `backup`/`restore` 기초정보 탭은 API allowlist 밖이므로 API 호출하지 않고 릴리즈 단계 placeholder로 처리한다.
- 정책 URL의 `salesType=CHANGE`는 API의 `subscriptionType=CHANGE_DEVICE`로 변환한다.
- Auth / DB / API Contract 변경 여부: No / No / No

## 작업 분해

| Task                          | 시작 | 완료 |  증감 | 결과                                                          |
| ----------------------------- | ---: | ---: | ----: | ------------------------------------------------------------- |
| Web Admin read adapter        |   0% |  75% |  +75% | `server-only` fetcher, cookie forwarding, `ActionResult` 처리 |
| URL state to API query mapper |   0% | 100% | +100% | staff/base/policy query 변환 및 unit test                     |
| Staffs Web API 연결           |   0% |  70% |  +70% | 목록, 매장 필터, metric, drawer 기본값 API 연결               |
| Base Settings Web API 연결    |   0% |  60% |  +60% | API-backed tab 목록/상세/페이지네이션 연결                    |
| Policies Web API 연결         |   0% |  60% |  +60% | 목록, 통신사 필터, summary, 상세 패널 API 연결                |
| E2E URL-state 보정            |   0% |  80% |  +80% | 정적 ID 의존 제거, seed 기반/빈 목록 허용                     |
| Completion report             |   0% | 100% | +100% | 하네스 완료 보고 작성                                         |

## Phase 진행률

|                 Phase | 이전 | 현재 / 전체 | 이번 증감 | 근거                                                  |
| --------------------: | ---: | ----------: | --------: | ----------------------------------------------------- |
|               Overall |  49% |  51% / 100% |       +2% | Admin Web 화면이 실제 API read path에 연결됨          |
|    0 Baseline/Harness |  90% |  90% / 100% |       +0% | 변경 없음                                             |
|  1 Design System Gate |  89% |  89% / 100% |       +0% | 레이아웃 유지, 신규 디자인 보정 없음                  |
|           2 Auth/RBAC |  78% |  78% / 100% |       +0% | 세션/권한 정책 변경 없음                              |
|             3 DB/Seed |  59% |  59% / 100% |       +0% | schema/seed 변경 없음                                 |
|    4 Dashboard/Report |   9% |   9% / 100% |       +0% | 변경 없음                                             |
|               5 Sales |  10% |  10% / 100% |       +0% | 변경 없음                                             |
| 6 Receivable/Customer |   6% |   6% / 100% |       +0% | 변경 없음                                             |
|  7 Schedule/Inventory |   6% |   6% / 100% |       +0% | 변경 없음                                             |
|      8 Admin Settings |  45% |  52% / 100% |       +7% | staffs/base/policies Web read 연결                    |
|       9 QA/Validation |  64% |  67% / 100% |       +3% | mapper unit, API smoke, Playwright 단일 viewport 통과 |

## Subagent 결과

| Subagent                 | Model   | 역할                 | 결과                                                                    |
| ------------------------ | ------- | -------------------- | ----------------------------------------------------------------------- |
| frontend_agent / Ptolemy | GPT-5.5 | route-aware Web 검토 | `apps/web/src/lib/admin-read-api.ts` adapter 권장, URL helper 유지 권장 |
| backend_agent / Poincare | GPT-5.5 | API contract 검토    | `salesType=CHANGE -> CHANGE_DEVICE`, `backup/restore` API 제외 확인     |
| qa_agent / Wegener       | GPT-5.5 | 검증 계획            | mapper unit, E2E URL-state, route guard, design-density 후속 검증 권장  |

## 모델 선택 이유

- Main Codex/GPT-5: Web Server Component와 API adapter/cookie forwarding 경계가 있어 route-aware 구현과 보안 판단이 필요했다.
- frontend_agent GPT-5.5: App Router 화면, URL state, drawer/filter/table 영향을 검토해야 했다.
- backend_agent GPT-5.5: API query contract와 shared schema 변경 금지 여부를 판정해야 했다.
- qa_agent GPT-5.5: 기존 테스트가 정적 데이터에 의존하므로 회귀 위험과 재검증 범위를 잡아야 했다.
- Spark: 사용하지 않음. 이번 작업은 `server-only` API adapter, 쿠키 전달, API contract mapping을 포함해 Spark 금지 영역과 맞닿아 있다.

## 변경 파일

| 파일                                                                                    | 변경 내용                                           |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `apps/web/src/lib/admin-read-query.ts`                                                  | URL state to API query mapper 추가                  |
| `apps/web/src/lib/admin-read-api.ts`                                                    | Admin read API adapter, DTO, cookie forwarding 추가 |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                          | 직원 화면 API page-data 연결                        |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                                   | 기초정보 화면 API page-data 연결                    |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                               | 정책 화면 API page-data 연결                        |
| `test/unit/admin-read-query.test.ts`                                                    | mapper unit test 추가                               |
| `test/e2e/admin-url-state.spec.ts`                                                      | 정적 더미 ID 의존 제거                              |
| `package.json`                                                                          | `test:unit:admin-read-query` script 추가            |
| `docs/80_ai_harness/stage-1-web-admin-api-adapter-completion-report-20260502-003228.md` | 완료 보고서                                         |

## 검증 결과

| 검증                                      | 결과 | 근거                                           |
| ----------------------------------------- | ---: | ---------------------------------------------- |
| `pnpm format:check`                       | Pass | Prettier 전체 확인                             |
| `pnpm lint`                               | Pass | API tsc lint, Web eslint                       |
| `pnpm typecheck`                          | Pass | shared/db/api/web typecheck                    |
| `pnpm db:validate`                        | Pass | Prisma schema valid                            |
| `pnpm test`                               | Pass | admin URL, mapper, API query, API inject smoke |
| `pnpm build`                              | Pass | shared/db/api/web build, Next build            |
| Playwright route/admin URL, chromium-1586 | Pass | 10 passed after E2E expectation correction     |

## 이슈 및 처리

| 이슈                                                  | 처리                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Playwright 1차 실행에서 `carrierId` expected mismatch | 정책 필터 form이 `carrierId=all`을 명시 제출하는 실제 동작에 맞춰 E2E 기대값 수정                    |
| Managed E2E preflight                                 | 5273/4273이 이미 실행 중이라 managed runner는 사용하지 않고 실행 중 서버 대상으로 단일 viewport 검증 |
| Base `backup`/`restore`                               | API contract 밖이므로 API 호출 제외, Electron 릴리즈 단계 placeholder로 표시                         |

## 남은 리스크

- 현재 seed에는 base/policy 업무 데이터가 부족해 `/settings/base`, `/settings/policies`는 API 연결 후 빈 목록이 정상일 수 있다.
- metric summary는 별도 aggregate API가 없어 현재 페이지 row 기준 보조 지표로 표시한다.
- 전체 3 viewport design-density는 이번 작업에서 재실행하지 않았다.

## 다음 작업 예정 3단계

1. `spark_ui_iterator` + `frontend_agent`: Admin 화면 빈 상태/loading/error/detail drawer 시각 보정. Spark는 presentational UI만 담당.
2. `backend_agent` + `db_reviewer`: acceptance seed 확장. 매장 3개, 직원 5명, carrier/base/policy fixture 추가.
3. `qa_agent` + `ui_runtime_validator`: `/staffs`, `/settings/base`, `/settings/policies` 1586/1440/1280 screenshot QA와 admin URL E2E 전체 viewport 확장.
