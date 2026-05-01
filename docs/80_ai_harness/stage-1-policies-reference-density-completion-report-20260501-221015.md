# Stage 1 Policies Reference Density Completion Report

작성 시각: 2026-05-01 22:10 KST

## 요약

- `/settings/policies` 정책 관리 화면을 `C:\Project\PSMS_Tech\design-reference\policies.png` 기준의 정적 디자인 밀도 게이트 화면으로 재구성했다.
- `WorkspacePlaceholder`를 제거하고 정책 탭, 필터 카드, 정책 목록 10행, 상태 요약, 정책 액션, 우측 정책 상세 패널을 한 화면 구조로 반영했다.
- 기준 해상도 `1586x992`에서는 page-level scroll 없이 테이블 액션 컬럼까지 수납되도록 조정했다.
- `1440x900`, `1280x800`에서는 page/body/main scroll 없이 테이블 내부 overflow와 우측 상세 내부 스크롤로 처리한다.
- Auth / DB / API Contract 변경 여부: `No / No / No`.

## 작업 분해

| Task               | 처리 내용                                                                     | 완료율 |  증감 |
| ------------------ | ----------------------------------------------------------------------------- | -----: | ----: |
| 기준 문서/PNG 확인 | 하네스 문서, `policies.png`, 기존 placeholder 확인                            |   100% | +100% |
| Subagent 위임      | 시각 리뷰, 구조 매핑, Spark UI 초안, 런타임 검증, 최종 리뷰 위임              |   100% | +100% |
| UI 패치 통합       | `/settings/policies/page.tsx` 정적 정책 관리 화면 구현                        |   100% | +100% |
| 3 viewport QA      | `1586x992`, `1440x900`, `1280x800` screenshot/scroll/runtime 확인             |   100% | +100% |
| 회귀 검증          | format, lint, typecheck, db validate, build, route guard, design-density 통과 |   100% | +100% |
| 완료 보고          | 하네스 형식 보고서 작성                                                       |   100% | +100% |

## Phase별 진행율

|                 Phase | 현재 / 전체 | 이번 증감 | 근거                                                 |
| --------------------: | ----------: | --------: | ---------------------------------------------------- |
|               Overall |  39% / 100% |       +1% | 정책 관리 기준 화면 완료 및 전체 design-density 통과 |
|    0 Baseline/Harness |  86% / 100% |       +0% | 기존 유지                                            |
|  1 Design System Gate |  87% / 100% |       +3% | `policies.png` 기준 화면 반영                        |
|           2 Auth/RBAC |  70% / 100% |       +0% | 가드 보존, 정책 변경 없음                            |
|             3 DB/Seed |  59% / 100% |       +0% | DB 변경 없음                                         |
|    4 Dashboard/Report |   9% / 100% |       +0% | 범위 외                                              |
|               5 Sales |   9% / 100% |       +0% | 범위 외                                              |
| 6 Receivable/Customer |   6% / 100% |       +0% | 범위 외                                              |
|  7 Schedule/Inventory |  18% / 100% |       +0% | 범위 외                                              |
|      8 Admin Settings |  19% / 100% |       +3% | 정책 관리 ADMIN 화면 디자인 게이트 반영              |
|       9 QA/Validation |  47% / 100% |       +2% | 정책 단독 및 전체 design-density 회귀 통과           |

## 모델 선택 이유

| 작업               | Subagent / Model                 | 선택 이유                                                   |
| ------------------ | -------------------------------- | ----------------------------------------------------------- |
| 기준 PNG 시각 판정 | `visual_ui_reviewer` / GPT-5.5   | 디자인 기준 대비 누락, 밀도, 겹침 판단 필요                 |
| 구조 매핑          | `codebase_mapper` / mini         | read-only 파일 위치와 overflow 위험 빠른 정리               |
| 정적 UI 초안       | `spark_ui_iterator` / Spark      | presentational JSX/Tailwind/static data만 변경하는 범위     |
| 런타임 검증        | `ui_runtime_validator` / mini    | Playwright screenshot, console/network/scroll evidence 수집 |
| 최종 diff 리뷰     | `code_reviewer` / Codex reviewer | 회귀, 하네스 위반, staging 리스크 확인                      |
| 메인 통합          | Codex                            | subagent 결과 통합, 하네스 경계 보존, 최종 검증/보고        |

## Subagent 결과

| Subagent               | 결과                                                                                               | 반영                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `visual_ui_reviewer`   | 기준 구조는 3열, 탭+필터+10행 목록+우측 상세. 기존 초안은 영문/5행/우측 겹침 위험 지적             | 한국어 라벨, 10행, checkbox/action, 우측 상세 fit 반영 |
| `codebase_mapper`      | 수정 1차 대상은 `apps/web/.../settings/policies/page.tsx`, 공통 컴포넌트 변경 불필요               | 단일 페이지 파일로 범위 제한                           |
| `spark_ui_iterator`    | Spark-safe 정적 UI 초안 작성, web typecheck 통과                                                   | 메인에서 기준 PNG에 맞게 재통합                        |
| `ui_runtime_validator` | 3 viewport page/body/main scroll 없음, console/request/hydration failure 없음, 우측 패널 겹침 없음 | 최종 QA 근거로 반영                                    |
| `code_reviewer`        | 중대 코드 이슈 없음. 단, staged placeholder와 unstaged 보정본 불일치 커밋 리스크 지적              | 커밋/스테이징 미수행, 리스크 명시                      |

## Spark 사용 범위

| 항목              | 내용                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Spark 사용 여부   | Yes                                                                                       |
| 허용 범위         | `apps/web/src/app/(workspace)/settings/policies/page.tsx` 정적 UI/Tailwind/demo data 초안 |
| 금지 영역 준수    | auth/session/RBAC, DB, Prisma, API contract, 정책 계산/활성화 로직 미변경                 |
| GPT-5.5 추가 리뷰 | `visual_ui_reviewer`로 기준 PNG 대비 시각 검토                                            |

## 변경 파일

| 파일                                                                                         | 변경 내용                                          |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                                    | placeholder 제거, 정책 관리 기준 화면 정적 UI 구현 |
| `docs/80_ai_harness/stage-1-policies-reference-density-completion-report-20260501-221015.md` | 완료 보고서 추가                                   |

## 검증 결과

| 검증                                                                          | 결과 | 근거                             |
| ----------------------------------------------------------------------------- | ---: | -------------------------------- |
| `pnpm format:check`                                                           | Pass | Prettier 통과                    |
| `pnpm lint`                                                                   | Pass | API tsc lint + Web ESLint 통과   |
| `pnpm typecheck`                                                              | Pass | shared/db/api/web typecheck 통과 |
| `pnpm db:validate`                                                            | Pass | Prisma schema valid              |
| `pnpm build`                                                                  | Pass | shared/db/api/web build 통과     |
| `pnpm test:e2e:route-guards`                                                  | Pass | 12 passed                        |
| `pnpm exec playwright test test/e2e/design-density.spec.ts --grep "policies"` | Pass | 3 passed                         |
| `pnpm test:e2e:design-density`                                                | Pass | 30 passed                        |

## Screenshot Evidence

| Viewport   | 파일                                                                 | 결과                                            |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `1586x992` | `.tmp/runtime-validation/policies-reference-density-1586x992-v4.png` | page/body/main scroll 없음, table `956/956`     |
| `1440x900` | `.tmp/runtime-validation/policies-reference-density-1440x900-v4.png` | page/body/main scroll 없음, table 내부 overflow |
| `1280x800` | `.tmp/runtime-validation/policies-reference-density-1280x800-v4.png` | page/body/main scroll 없음, table 내부 overflow |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                  |
| ------------ | --------: | ----------------------------------------------------- |
| Auth         |        No | `requireRole(await requireSession(), ["ADMIN"])` 유지 |
| DB           |        No | Prisma/schema/seed 변경 없음                          |
| API Contract |        No | Fastify/shared schema/API adapter 변경 없음           |

## 남은 리스크

| 리스크                                         |                                        영향 | 대응                                                              |
| ---------------------------------------------- | ------------------------------------------: | ----------------------------------------------------------------- |
| staged placeholder와 unstaged UI 보정본 불일치 |             커밋 시 잘못된 산출물 포함 가능 | 커밋 전 `git status`, `git diff --cached`, `git diff` 재확인 필요 |
| 현재 화면은 정적 UI                            | 필터, 상세, 활성화, 정책 이력 기능은 미연결 | 다음 Admin Foundation API contract 단계에서 연결                  |
| 접근성 단언 테스트 부재                        | 키보드/스크린리더 회귀를 자동 단언하지 못함 | 기능 연결 전 a11y 테스트 추가                                     |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                      | Subagent / Model                                                    |
| ---: | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
|    1 | Admin Foundation 화면들의 URL search params, Drawer/detail 상태 계약 정리 | `frontend_agent` GPT-5.5 + `architect_reviewer` GPT-5.5             |
|    2 | 직원/기초정보/정책 API contract preflight 및 shared schema 설계           | `architect_reviewer` GPT-5.5 + `backend_agent` GPT-5.5              |
|    3 | Admin Foundation E2E/a11y 회귀 계획과 diff 리뷰                           | `qa_agent` GPT-5.5 + `code_reviewer` Codex + Spark는 반복 UI 보정만 |
