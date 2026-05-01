# Stage 1 Inventory Reference Density Completion Report

## 요약

- `/inventory` 재고 관리 화면을 `C:\Project\PSMS_Tech\design-reference\inventory.png` 기준 구조에 맞춰 정적 UI로 재구성했다.
- 변경 범위는 `apps/web` presentational UI로 제한했다.
- Auth / DB / API Contract는 변경하지 않았다.
- 기준 흐름은 `PageIntro -> Filter panel -> Inventory table panel -> right registration Drawer`로 정리했다.
- 1586x992, 1440x900, 1280x800에서 page-level scroll 없이 동작하는 것을 확인했다.

## 작업 분해

| Task                                 | 이전 | 현재 / 전체 |  증감 | 결과                                            |
| ------------------------------------ | ---: | ----------: | ----: | ----------------------------------------------- |
| 기준 PNG 대비 `/inventory` 구조 분석 |   0% | 100% / 100% | +100% | `visual_ui_reviewer` 체크리스트 수집            |
| Spark-safe 정적 UI 초안 패치         |   0% | 100% / 100% | +100% | 단일 파일 presentational 변경                   |
| 메인 통합 보정                       |   0% | 100% / 100% | +100% | 필터, 테이블, Drawer, pagination 기준 보정      |
| 3 viewport density QA                |   0% | 100% / 100% | +100% | inventory 전용 3 passed                         |
| 전체 회귀 검증                       |   0% | 100% / 100% | +100% | route guard 12 passed, design-density 30 passed |
| 완료 보고서 작성                     |   0% | 100% / 100% | +100% | 본 문서 작성                                    |

## Phase별 진행률

|                 Phase | 이전 | 현재 / 전체 | 이번 증감 | 근거                                            |
| --------------------: | ---: | ----------: | --------: | ----------------------------------------------- |
|               Overall |  35% |  36% / 100% |       +1% | 재고 화면 디자인 게이트 1차 기준화              |
|    0 Baseline/Harness |  86% |  86% / 100% |       +0% | 하네스 유지                                     |
|  1 Design System Gate |  75% |  78% / 100% |       +3% | `/inventory` 기준 화면 구조 반영                |
|           2 Auth/RBAC |  70% |  70% / 100% |       +0% | 변경 없음                                       |
|             3 DB/Seed |  59% |  59% / 100% |       +0% | 변경 없음                                       |
|    4 Dashboard/Report |   9% |   9% / 100% |       +0% | 변경 없음                                       |
|               5 Sales |   9% |   9% / 100% |       +0% | 변경 없음                                       |
| 6 Receivable/Customer |   6% |   6% / 100% |       +0% | 변경 없음                                       |
|  7 Schedule/Inventory |  15% |  18% / 100% |       +3% | inventory 화면 기준화                           |
|      8 Admin Settings |  10% |  10% / 100% |       +0% | 변경 없음                                       |
|       9 QA/Validation |  39% |  41% / 100% |       +2% | screenshot QA, route guard, design-density 회귀 |

## Subagent별 결과

| 작업               | Subagent             | Model          | 결과                                                                              |
| ------------------ | -------------------- | -------------- | --------------------------------------------------------------------------------- |
| 기준 PNG 시각 판정 | `visual_ui_reviewer` | GPT-5.5        | 필터 6종, 테이블 컬럼, 상태값, Drawer 필드, density risk 체크리스트 제공          |
| 정적 UI 초안 패치  | `spark_ui_iterator`  | Spark          | 단일 파일 UI 초안 작성, web typecheck 통과                                        |
| 최종 diff 리뷰     | `code_reviewer`      | Codex reviewer | blocking 이슈 없음, static-only controls와 hardcoded total을 residual risk로 기록 |

## 모델 선택 이유

| 모델/경로                    | 선택 이유                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| GPT-5.5 `visual_ui_reviewer` | 기준 PNG와 실제 화면 위계 차이를 판단해야 하므로 고정밀 시각 리뷰가 필요했다.        |
| Spark `spark_ui_iterator`    | 정적 JSX, Tailwind spacing, 더미 데이터, 필드 마크업만 다루는 Spark-safe 작업이었다. |
| Main Codex                   | Spark 산출물 통합, 1280/1440/1586 viewport 보정, 검증/보고서 작성이 필요했다.        |
| Codex `code_reviewer`        | 최종 diff에서 회귀나 누락 리스크를 read-only로 확인했다.                             |

## 변경 파일

| 파일                                                                                          | 변경 내용                                                                                                        |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/inventory/page.tsx`                                             | placeholder를 기준 PNG형 재고 관리 화면으로 교체. 필터, 테이블, 페이지네이션, 우측 재고 등록 Drawer 정적 UI 구현 |
| `docs/80_ai_harness/stage-1-inventory-reference-density-completion-report-20260501-211654.md` | 작업 완료 보고서 추가                                                                                            |

## UI 적용 내용

- 제목/액션: `재고 관리`, 기준 설명문, `+ 재고 등록` 버튼으로 정리.
- 필터: `매장`, `통신사`, `기종`, `상태`, `입고일`, `검색` 구성으로 기준 PNG 순서에 맞춤.
- 테이블: `전체 1,248건`, 체크박스, `상태/매장/통신사/기종/색상/용량/S/N/Model No./입고가/입고일/담당자` 컬럼 구성.
- 상태값: `입고`, `예약`, `판매완료`, `불량`으로 기준 상태 체계에 맞춤.
- Drawer: `매장`, `통신사`, `기종`, `색상`, `용량`, `S/N`, `Model No.`, `입고가`, `상태`, `입고일`, `담당자`, `메모`, 하단 `취소/등록하기` 액션 구성.
- 1280/1440에서는 테이블 내부 가로/세로 스크롤만 허용하고 page-level scroll은 제거.

## 검증 결과

| 검증                                                                           | 결과 | 근거                                   |
| ------------------------------------------------------------------------------ | ---: | -------------------------------------- |
| `pnpm --filter @psms/web typecheck`                                            | Pass | Spark 패치 후 및 메인 보정 후 통과     |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "inventory"` | Pass | 3 passed                               |
| Manual screenshot QA                                                           | Pass | 1586x992, 1440x900, 1280x800 캡처 저장 |
| `pnpm format:check`                                                            | Pass | 전체 포맷 확인                         |
| `pnpm lint`                                                                    | Pass | API/Web lint 통과                      |
| `pnpm typecheck`                                                               | Pass | shared/db/api/web typecheck 통과       |
| `pnpm db:validate`                                                             | Pass | Prisma schema valid                    |
| `pnpm build`                                                                   | Pass | Next build 포함 전체 build 통과        |
| `pnpm test:e2e:route-guards`                                                   | Pass | 12 passed                              |
| `pnpm test:e2e:design-density`                                                 | Pass | 30 passed                              |
| `git diff --check`                                                             | Pass | 기존 CRLF 경고만 표시                  |

## Screenshot Evidence

| Viewport | 파일                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| 1586x992 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\inventory-reference-density-1586x992-v2.png` |
| 1440x900 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\inventory-reference-density-1440x900-v2.png` |
| 1280x800 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\inventory-reference-density-1280x800-v2.png` |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고      |
| ------------ | --------: | --------- |
| Auth         |        No | 변경 없음 |
| DB           |        No | 변경 없음 |
| API Contract |        No | 변경 없음 |

## 남은 리스크

| 리스크                                              | 영향 | 대응                                                                        |
| --------------------------------------------------- | ---: | --------------------------------------------------------------------------- |
| 필터, 페이지네이션, Drawer 액션은 아직 정적 UI      | 중간 | API 연결 단계에서 URL search params, create action, validation 연결         |
| `전체 1,248건`과 pagination은 기준 PNG 맞춤 더미 값 | 낮음 | 실제 inventory query 연결 시 API count 기반으로 대체                        |
| 1440/1280에서 테이블 내부 가로 스크롤 존재          | 낮음 | 기준상 page-level scroll 제거 우선. 실제 기능 연결 후 컬럼 고정/밀도 재검토 |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                         | Subagent / Model                                |
| ---: | ---------------------------------------------------------------------------- | ----------------------------------------------- |
|    1 | `/staffs` 직원 관리 화면을 `staffs.png` 기준으로 Drawer/Table/Form 밀도 확장 | `visual_ui_reviewer` + `spark_ui_iterator`      |
|    2 | `/settings/base`, `/settings/policies` 관리자 설정 화면 기준화               | `frontend_agent` + `spark_ui_iterator`          |
|    3 | inventory API 연결 전 계약/데이터 흐름 preflight 및 E2E 시나리오 설계        | `frontend_agent` + `backend_agent` + `qa_agent` |
