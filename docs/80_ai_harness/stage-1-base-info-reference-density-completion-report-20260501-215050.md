# Stage 1 Base Info Reference Density Completion Report

## 요약

- `/settings/base` 기초정보 화면을 `C:\Project\PSMS_Tech\design-reference\base-info.png` 기준 구조에 맞춰 정적 UI로 재구성했다.
- 변경 범위는 `apps/web` presentational UI로 제한했다.
- 기존 ADMIN route guard는 유지했다.
- Auth / DB / API Contract는 변경하지 않았다.
- 기준 흐름은 `PageIntro -> tabs -> device table/help panel -> right device registration Drawer`로 정리했다.
- 1586x992, 1440x900, 1280x800에서 page-level scroll 없이 동작하는 것을 확인했다.

## 작업 분해

| Task                                     | 이전 | 현재 / 전체 |  증감 | 결과                                                  |
| ---------------------------------------- | ---: | ----------: | ----: | ----------------------------------------------------- |
| 기준 PNG 대비 `/settings/base` 구조 분석 |   0% | 100% / 100% | +100% | `visual_ui_reviewer` 체크리스트 수집                  |
| Spark-safe 정적 UI 초안 패치             |   0% | 100% / 100% | +100% | 단일 파일 presentational 변경                         |
| 메인 통합 보정                           |   0% | 100% / 100% | +100% | tabs, action row, table, help panel, Drawer 기준 보정 |
| 3 viewport density QA                    |   0% | 100% / 100% | +100% | base-info 전용 3 passed                               |
| 전체 회귀 검증                           |   0% | 100% / 100% | +100% | route guard 12 passed, design-density 30 passed       |
| 완료 보고서 작성                         |   0% | 100% / 100% | +100% | 본 문서 작성                                          |

## Phase별 진행률

|                 Phase | 이전 | 현재 / 전체 | 이번 증감 | 근거                                            |
| --------------------: | ---: | ----------: | --------: | ----------------------------------------------- |
|               Overall |  37% |  38% / 100% |       +1% | 기초정보 화면 디자인 게이트 1차 기준화          |
|    0 Baseline/Harness |  86% |  86% / 100% |       +0% | 하네스 유지                                     |
|  1 Design System Gate |  81% |  84% / 100% |       +3% | `/settings/base` 기준 화면 구조 반영            |
|           2 Auth/RBAC |  70% |  70% / 100% |       +0% | ADMIN guard 유지, 정책 변경 없음                |
|             3 DB/Seed |  59% |  59% / 100% |       +0% | 변경 없음                                       |
|    4 Dashboard/Report |   9% |   9% / 100% |       +0% | 변경 없음                                       |
|               5 Sales |   9% |   9% / 100% |       +0% | 변경 없음                                       |
| 6 Receivable/Customer |   6% |   6% / 100% |       +0% | 변경 없음                                       |
|  7 Schedule/Inventory |  18% |  18% / 100% |       +0% | 변경 없음                                       |
|      8 Admin Settings |  13% |  16% / 100% |       +3% | base-info 기준 UI 반영                          |
|       9 QA/Validation |  43% |  45% / 100% |       +2% | screenshot QA, route guard, design-density 회귀 |

## Subagent별 결과

| 작업               | Subagent             | Model          | 결과                                                                           |
| ------------------ | -------------------- | -------------- | ------------------------------------------------------------------------------ |
| 기준 PNG 시각 판정 | `visual_ui_reviewer` | GPT-5.5        | tabs, action row, table columns, help panel, Drawer fields must-fix 제공       |
| 정적 UI 초안 패치  | `spark_ui_iterator`  | Spark          | ADMIN guard 유지, 단일 파일 UI 초안 작성, web typecheck 통과                   |
| 최종 diff 리뷰     | `code_reviewer`      | Codex reviewer | blocking 이슈 없음, URL sync와 static Drawer visibility를 residual risk로 기록 |

## 모델 선택 이유

| 모델/경로                    | 선택 이유                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| GPT-5.5 `visual_ui_reviewer` | 기준 PNG와 실제 화면 위계 차이를 판단해야 하므로 고정밀 시각 리뷰가 필요했다.        |
| Spark `spark_ui_iterator`    | 정적 JSX, Tailwind spacing, 더미 데이터, 필드 마크업만 다루는 Spark-safe 작업이었다. |
| Main Codex                   | Spark 산출물 통합, 1280/1440/1586 viewport 보정, 검증/보고서 작성이 필요했다.        |
| Codex `code_reviewer`        | 최종 diff에서 회귀나 누락 리스크를 read-only로 확인했다.                             |

## 변경 파일

| 파일                                                                                          | 변경 내용                                                                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                                         | placeholder를 기준 PNG형 기초정보 화면으로 교체. 탭, 기종 관리 액션/테이블, 도움말 패널, 기종 등록 Drawer 정적 UI 구현 |
| `docs/80_ai_harness/stage-1-base-info-reference-density-completion-report-20260501-215050.md` | 작업 완료 보고서 추가                                                                                                  |

## UI 적용 내용

- 제목/상단: `기초정보`, `ADMIN 전용` badge, 기준 설명문 구성.
- 탭: `매장`, `직원`, `통신사`, `거래대리점`, `색상`, `기종`, `요금제`, `부가서비스`, `백업`, `복원` 탭 구성, `기종` underline 활성 상태 적용.
- 메인 패널: `기종 관리` 헤더, `신규 등록`, `수정`, `삭제`, `활성`, `비활성`, 검색 action row 구성.
- 테이블: checkbox, `기종명`, `모델명`, `제조사`, `출시일`, `상태`, `관리` 컬럼과 10개 정적 row 구성.
- 도움말 패널: `기초정보란?`, `주요 활용 화면`, `운영 팁` 구성.
- Drawer: `기종 등록` 폼에 기종명, 모델명, 제조사, 출시일, 5G 지원, 대표 이미지, 상태, 메모, 하단 `취소/저장` 액션 구성.
- 1280/1440에서는 table/drawer 내부 스크롤만 허용하고 page-level scroll은 제거.

## 검증 결과

| 검증                                                                           | 결과 | 근거                                        |
| ------------------------------------------------------------------------------ | ---: | ------------------------------------------- |
| `pnpm --filter @psms/web typecheck`                                            | Pass | Spark 패치 후 및 메인 보정 후 통과          |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "base-info"` | Pass | 3 passed                                    |
| Manual screenshot QA                                                           | Pass | 1586x992, 1440x900, 1280x800 최종 캡처 저장 |
| `pnpm format:check`                                                            | Pass | 전체 포맷 확인                              |
| `pnpm lint`                                                                    | Pass | API/Web lint 통과                           |
| `pnpm typecheck`                                                               | Pass | shared/db/api/web typecheck 통과            |
| `pnpm db:validate`                                                             | Pass | Prisma schema valid                         |
| `pnpm build`                                                                   | Pass | Next build 포함 전체 build 통과             |
| `pnpm test:e2e:route-guards`                                                   | Pass | 12 passed                                   |
| `pnpm test:e2e:design-density`                                                 | Pass | 30 passed                                   |

## Screenshot Evidence

| Viewport | 파일                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| 1586x992 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\base-info-reference-density-1586x992-v4.png` |
| 1440x900 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\base-info-reference-density-1440x900-v4.png` |
| 1280x800 | `C:\Project\Activate\PSMS\.tmp\runtime-validation\base-info-reference-density-1280x800-v4.png` |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                  |
| ------------ | --------: | ----------------------------------------------------- |
| Auth         |        No | `requireRole(await requireSession(), ["ADMIN"])` 유지 |
| DB           |        No | 변경 없음                                             |
| API Contract |        No | 변경 없음                                             |

## 남은 리스크

| 리스크                                                                       | 영향 | 대응                                                                        |
| ---------------------------------------------------------------------------- | ---: | --------------------------------------------------------------------------- |
| 검색/페이지네이션/page size state가 아직 URL search params와 동기화되지 않음 | 중간 | 기능 연결 단계에서 App Router searchParams 기반으로 보정                    |
| Drawer visibility가 breakpoint 기반 정적 rail임                              | 낮음 | Drawer 표시 조건을 query/state 기반으로 바꾸는 단계에서 실제 닫기 동작 연결 |
| 기종 등록/수정/삭제/활성/비활성은 아직 정적 UI                               | 중간 | Admin Foundation API contract 연결 후 validation/action 적용                |
| 1280에서 테이블 내부 세로 스크롤 존재                                        | 낮음 | 기준상 page-level scroll 제거 우선. 기능 연결 후 row density 재검토         |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                 | Subagent / Model                               |
| ---: | -------------------------------------------------------------------- | ---------------------------------------------- |
|    1 | `/settings/policies` 정책 관리 화면을 `policies.png` 기준으로 보정   | `visual_ui_reviewer` + `spark_ui_iterator`     |
|    2 | Admin Foundation 화면들의 URL search params / Drawer state preflight | `frontend_agent` + `architect_reviewer`        |
|    3 | 직원/기초정보/정책 API 연결 전 Admin Foundation contract 및 E2E 설계 | `backend_agent` + `qa_agent` + `code_reviewer` |
