# `/sales/new` Design Reference Candidate Completion Report

작성일: 2026-05-03

## 작업 범위

- 기준 PNG: `C:\Project\PSMS_Tech\design-reference\sales-entry.png`
- 대상 route: `/sales/new`
- 승인 반영: `/sales` 사용자 승인 완료 반영
- 후보 반영: `/sales/new` 사용자 승인 후보 반영
- 비대상: Auth, RBAC, API, DB, Prisma, 금액/수납 비즈니스 로직

## 작업 분해

| 단계 | 담당                   | 내용                                                  | 결과 |
| ---- | ---------------------- | ----------------------------------------------------- | ---- |
| 1    | 메인 에이전트          | 하네스 문서와 현재 구현 확인, `/sales` 승인 상태 반영 | 완료 |
| 2    | `project_manager`      | Phase/Task 진행률 산정과 보고 문구 작성               | 완료 |
| 3    | `visual_ui_reviewer`   | 기준 PNG와 현재 캡처 차이 분석                        | 완료 |
| 4    | `spark_ui_iterator`    | `/sales/new` UI/Tailwind 표현 패치                    | 완료 |
| 5    | 메인 에이전트          | Spark 변경 검토, 추가 보정, 검증 실행                 | 완료 |
| 6    | `ui_runtime_validator` | 최종 캡처 기준 후보 가능 여부 확인                    | 완료 |

## 모델 선택 이유

| 역할                   | 선택 이유                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `project_manager`      | 하네스 진행률, Phase/Task 변동률, 승인 게이트 상태를 보수적으로 정리하는 데 적합하다.         |
| `visual_ui_reviewer`   | 원본 PNG와 현재 캡처를 좌표/비율/가시성 기준으로 비교하는 시각 QA에 적합하다.                 |
| `spark_ui_iterator`    | UI skeleton, Tailwind 레이아웃, 정적 화면 밀도 조정만 수행하는 범위라 Spark 사용 규칙에 맞다. |
| `ui_runtime_validator` | Playwright 캡처와 viewport별 런타임 가시성을 빠르게 확인하는 데 적합하다.                     |

## 변경 내용

| 파일                                                                                      | 변경 요약                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/sales/new/page.tsx`                                         | 판매 등록 화면의 상단 도구, 스텝퍼, 입력 패널, 우측 판매 요약, 하단 액션바 밀도와 배치를 기준 PNG에 맞게 보정 |
| `docs/00_system/design-reference-match-gate.md`                                           | `/sales`를 사용자 승인 완료로 반영하고 `/sales/new`를 사용자 승인 후보로 반영                                 |
| `docs/80_ai_harness/design-reference-sales-entry-candidate-completion-report-20260503.md` | 이번 작업 완료 보고 추가                                                                                      |

## 주요 패치 상세

- 우측 판매 요약 폭을 `17rem`으로 조정해 기준 PNG의 약 `272px` 폭에 맞췄다.
- 상단 기간 버튼 옆에 기준 PNG의 날짜 범위와 상세 리포트 버튼을 복원했다.
- 스텝퍼 높이와 간격을 기준 PNG의 단계 진행 영역에 가깝게 재조정했다.
- 고객 정보와 3열 입력부의 패딩/간격/입력 높이를 압축해 1586x992 전체 화면에서 본문과 하단 액션바가 함께 보이도록 했다.
- 부가서비스 하단에 선택 요약 행을 추가해 기준 PNG의 정보 밀도와 맞췄다.
- 재고 썸네일 placeholder를 CSS 기반 휴대폰 형태로 개선했다.
- 하단 액션바를 원본 위치감에 맞춰 올리고, 950px 이하 보조 viewport에서는 압축 상태를 유지하도록 분기했다.

## 진행률

| 구분                                   |   이번 턴 전 | `/sales` 승인 반영 후 | `/sales/new` 후보 반영 후 | 이번 턴 변동 |
| -------------------------------------- | -----------: | --------------------: | ------------------------: | -----------: |
| Design Reference 승인 완료             |     `1 / 10` |              `2 / 10` |                  `2 / 10` |         `+1` |
| Design Reference 승인 후보             |     `1 / 10` |              `0 / 10` |                  `1 / 10` |          `0` |
| Design Reference Match Gate            | `10% / 100%` |          `20% / 100%` |              `20% / 100%` |      `+10%p` |
| Phase 1 Design System / Reference Gate | `47% / 100%` |          `50% / 100%` |              `52% / 100%` |       `+5%p` |
| Phase 5 Sales                          | `13% / 100%` |          `15% / 100%` |              `17% / 100%` |       `+4%p` |
| Phase 9 QA / Validation                | `38% / 100%` |          `39% / 100%` |              `40% / 100%` |       `+2%p` |
| 전체 프로젝트                          | `28% / 100%` |          `29% / 100%` |              `30% / 100%` |       `+2%p` |
| Web/API MVP 업무 기능 준비도           | `14% / 100%` |          `14% / 100%` |              `14% / 100%` |       `+0%p` |

사용자 승인 후보는 승인 완료 수에 포함하지 않는다. `/sales/new`는 사용자 승인 후에만 승인 완료 `3 / 10`으로 전환한다.

## Task별 진행률

| Task                        |     이전 |     현재 |     변동 |
| --------------------------- | -------: | -------: | -------: |
| `/sales` 사용자 승인 반영   |     `0%` |   `100%` | `+100%p` |
| Gate 문서 승인 완료 수 반영 | `1 / 10` | `2 / 10` |     `+1` |
| `/sales/new` 기준 PNG 분석  |     `0%` |   `100%` | `+100%p` |
| `/sales/new` UI 패치        |     `0%` |   `100%` | `+100%p` |
| `/sales/new` viewport 검증  |     `0%` |   `100%` | `+100%p` |
| `/sales/new` 승인 후보 판정 | `0 / 10` | `1 / 10` |     `+1` |

## 검증

| 검증                                                                             | 결과                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `pnpm exec prettier --write "apps/web/src/app/(workspace)/sales/new/page.tsx"`   | 통과                                      |
| `pnpm --filter @psms/web typecheck`                                              | 통과                                      |
| `pnpm --filter @psms/web lint`                                                   | 통과                                      |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "sales-entry"` | 통과, chromium-1586/1440/1280 총 3 passed |

최종 캡처:

- `C:\Project\Activate\PSMS\.tmp\sales-entry-final-v2\sales-entry-1586x992.png`
- `C:\Project\Activate\PSMS\.tmp\sales-entry-final-v2\sales-entry-1440x900.png`
- `C:\Project\Activate\PSMS\.tmp\sales-entry-final-v2\sales-entry-1280x800.png`

## 남은 리스크

- `1280x800`에서는 본문 일부가 접혀 보이므로 콘텐츠가 추가되면 세로 압박이 생길 수 있다.
- 실제 단말 이미지는 아직 정적 CSS placeholder이므로, 이미지 자산 교체 시 다시 시각 검증이 필요하다.
- 문구가 길어지거나 상태 배지가 추가되면 카드 높이 증가로 하단 액션바와의 균형이 바뀔 수 있다.

## 다음 작업 예정 3단계

| 순서 | 작업                                                                                  | 담당 제안                                                         |
| ---: | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
|    1 | 사용자가 `/sales/new` 최종 캡처를 확인하고 승인 여부 결정                             | 메인 에이전트                                                     |
|    2 | 승인 시 `/sales/new`를 승인 완료 `3 / 10`으로 전환하고 다음 route `/receivables` 착수 | `project_manager`, 메인 에이전트                                  |
|    3 | `/receivables` 원본 PNG 정밀 분석 및 UI 패치                                          | `visual_ui_reviewer`, `spark_ui_iterator`, `ui_runtime_validator` |
