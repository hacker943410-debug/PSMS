# Stage 1 Staffs Reference Density Completion Report

## 요약

- `/staffs` 직원 관리 화면을 `C:\Project\PSMS_Tech\design-reference\staffs.png` 기준 구조에 맞춰 정적 UI로 재구성했다.
- 변경 범위는 `apps/web` presentational UI로 제한했다.
- 기존 ADMIN route guard는 유지했다.
- Auth / DB / API Contract는 변경하지 않았다.
- 기준 흐름은 `PageIntro -> KPI cards -> staff table/filter panel -> right registration Drawer`로 정리했다.
- 1586x992, 1440x900, 1280x800에서 page-level scroll 없이 동작하는 것을 확인했다.

## 작업 분해

| Task                              | 이전 | 현재 / 전체 |  증감 | 결과                                            |
| --------------------------------- | ---: | ----------: | ----: | ----------------------------------------------- |
| 기준 PNG 대비 `/staffs` 구조 분석 |   0% | 100% / 100% | +100% | `visual_ui_reviewer` 체크리스트 수집            |
| Spark-safe 정적 UI 초안 패치      |   0% | 100% / 100% | +100% | 단일 파일 presentational 변경                   |
| 메인 통합 보정                    |   0% | 100% / 100% | +100% | KPI, 필터, 테이블, Drawer 기준 보정             |
| 3 viewport density QA             |   0% | 100% / 100% | +100% | staffs 전용 3 passed                            |
| 전체 회귀 검증                    |   0% | 100% / 100% | +100% | route guard 12 passed, design-density 30 passed |
| 완료 보고서 작성                  |   0% | 100% / 100% | +100% | 본 문서 작성                                    |

## Phase별 진행률

|                 Phase | 이전 | 현재 / 전체 | 이번 증감 | 근거                                            |
| --------------------: | ---: | ----------: | --------: | ----------------------------------------------- |
|               Overall |  36% |  37% / 100% |       +1% | 직원 관리 화면 디자인 게이트 1차 기준화         |
|    0 Baseline/Harness |  86% |  86% / 100% |       +0% | 하네스 유지                                     |
|  1 Design System Gate |  78% |  81% / 100% |       +3% | `/staffs` 기준 화면 구조 반영                   |
|           2 Auth/RBAC |  70% |  70% / 100% |       +0% | ADMIN guard 유지, 정책 변경 없음                |
|             3 DB/Seed |  59% |  59% / 100% |       +0% | 변경 없음                                       |
|    4 Dashboard/Report |   9% |   9% / 100% |       +0% | 변경 없음                                       |
|               5 Sales |   9% |   9% / 100% |       +0% | 변경 없음                                       |
| 6 Receivable/Customer |   6% |   6% / 100% |       +0% | 변경 없음                                       |
|  7 Schedule/Inventory |  18% |  18% / 100% |       +0% | 변경 없음                                       |
|      8 Admin Settings |  10% |  13% / 100% |       +3% | staff management 기준 UI 반영                   |
|       9 QA/Validation |  41% |  43% / 100% |       +2% | screenshot QA, route guard, design-density 회귀 |

## Subagent별 결과

| 작업               | Subagent             | Model          | 결과                                                                      |
| ------------------ | -------------------- | -------------- | ------------------------------------------------------------------------- |
| 기준 PNG 시각 판정 | `visual_ui_reviewer` | GPT-5.5        | 상단 액션, KPI, 필터 순서, 테이블 컬럼, Drawer 폼 must-fix 제공           |
| 정적 UI 초안 패치  | `spark_ui_iterator`  | Spark          | ADMIN guard 유지, 단일 파일 UI 초안 작성, web typecheck 통과              |
| 최종 diff 리뷰     | `code_reviewer`      | Codex reviewer | blocking 이슈 없음, URL sync와 static Drawer close를 residual risk로 기록 |

## 모델 선택 이유

| 모델/경로                    | 선택 이유                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| GPT-5.5 `visual_ui_reviewer` | 기준 PNG와 실제 화면 위계 차이를 판단해야 하므로 고정밀 시각 리뷰가 필요했다.        |
| Spark `spark_ui_iterator`    | 정적 JSX, Tailwind spacing, 더미 데이터, 필드 마크업만 다루는 Spark-safe 작업이었다. |
| Main Codex                   | Spark 산출물 통합, 1280/1440/1586 viewport 보정, 검증/보고서 작성이 필요했다.        |
| Codex `code_reviewer`        | 최종 diff에서 회귀나 누락 리스크를 read-only로 확인했다.                             |

## 변경 파일

| 파일                                                                                       | 변경 내용                                                                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                             | placeholder를 기준 PNG형 직원 관리 화면으로 교체. KPI, 필터, 테이블, 페이지네이션, 신규 직원 등록 Drawer 정적 UI 구현 |
| `docs/80_ai_harness/stage-1-staffs-reference-density-completion-report-20260501-213510.md` | 작업 완료 보고서 추가                                                                                                 |

## UI 적용 내용

- 제목/액션: `직원 관리`, 기준 설명문, `엑셀 다운로드`, `신규 직원 등록` 버튼 구성.
- KPI: `전체 직원 28명`, `근무중 24명`, `비활성 4명`, `관리자 수 5명`과 변화량 badge 구성.
- 필터: `검색`, `역할`, `매장`, `상태`, `초기화` 순서로 기준 PNG에 맞춤.
- 테이블: `이름`, `역할`, `소속 매장`, `연락처`, `이메일`, `최근 로그인`, `상태`, `액션` 컬럼 구성.
- 상태 UI: 텍스트와 토글형 상태 표시를 함께 제공.
- Drawer: `신규 직원 등록` 폼에 이름, 아이디/이메일, 역할, 매장, 연락처, 비밀번호 초기화, 활성 여부, 하단 `취소/등록` 액션 구성.
- 1280/1440에서는 테이블 내부 스크롤만 허용하고 page-level scroll은 제거.

## 검증 결과

| 검증                                                                        | 결과 | 근거                                   |
| --------------------------------------------------------------------------- | ---: | -------------------------------------- |
| `pnpm --filter @psms/web typecheck`                                         | Pass | Spark 패치 후 및 메인 보정 후 통과     |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "staffs"` | Pass | 3 passed                               |
| Manual screenshot QA                                                        | Pass | 1586x992, 1440x900, 1280x800 캡처 저장 |
| `pnpm format:check`                                                         | Pass | 전체 포맷 확인                         |
| `pnpm lint`                                                                 | Pass | API/Web lint 통과                      |
| `pnpm typecheck`                                                            | Pass | shared/db/api/web typecheck 통과       |
| `pnpm db:validate`                                                          | Pass | Prisma schema valid                    |
| `pnpm build`                                                                | Pass | Next build 포함 전체 build 통과        |
| `pnpm test:e2e:route-guards`                                                | Pass | 12 passed                              |
| `pnpm test:e2e:design-density`                                              | Pass | 30 passed                              |

## Screenshot Evidence

| Viewport | 파일                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 1586x992 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\staffs-reference-density-1586x992.png` |
| 1440x900 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\staffs-reference-density-1440x900.png` |
| 1280x800 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\staffs-reference-density-1280x800.png` |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                  |
| ------------ | --------: | ----------------------------------------------------- |
| Auth         |        No | `requireRole(await requireSession(), ["ADMIN"])` 유지 |
| DB           |        No | 변경 없음                                             |
| API Contract |        No | 변경 없음                                             |

## 남은 리스크

| 리스크                                                             | 영향 | 대응                                                                      |
| ------------------------------------------------------------------ | ---: | ------------------------------------------------------------------------- |
| 필터/페이지네이션 state가 아직 URL search params와 동기화되지 않음 | 중간 | 기능 연결 단계에서 App Router searchParams 기반으로 보정                  |
| Drawer close icon은 현재 정적 rail에서 같은 route로 이동           | 낮음 | Drawer 표시 조건을 query 기반으로 바꾸는 단계에서 실제 닫기 동작 연결     |
| 직원 등록/상태 토글/액션 메뉴는 아직 정적 UI                       | 중간 | Admin staff API contract 연결 후 validation/action 적용                   |
| 1280에서 테이블 내부 가로 스크롤 존재                              | 낮음 | 기준상 page-level scroll 제거 우선. 기능 연결 후 sticky/actions 컬럼 검토 |

## 다음 작업 예정 3단계

| 단계 | 작업                                                               | Subagent / Model                                    |
| ---: | ------------------------------------------------------------------ | --------------------------------------------------- |
|    1 | `/settings/base` 기초정보 화면을 `base-info.png` 기준으로 보정     | `visual_ui_reviewer` + `spark_ui_iterator`          |
|    2 | `/settings/policies` 정책 관리 화면을 `policies.png` 기준으로 보정 | `frontend_agent` + `spark_ui_iterator`              |
|    3 | 직원/기초정보/정책 API 연결 전 Admin Foundation contract preflight | `architect_reviewer` + `backend_agent` + `qa_agent` |
