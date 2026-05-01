# Stage 1 Visual Copy And Harness Stability Completion Report

## Summary

- Phase 1B 후속으로 7개 기준 화면의 한국어 업무 콘솔 톤을 보정했다.
- Spark가 담당한 4개 화면의 영어 UI 라벨을 한국어로 전환했고, Main Codex가 남은 영문 시드 데이터와 관리자 화면 문구를 정리했다.
- E2E runtime guard가 Next.js font 요청 abort를 실패로 오탐하지 않도록 보정했다.
- Playwright global setup은 URL 전환만 기다리지 않고 `psms_session` 생성 기준으로 storageState를 저장하도록 안정화했다.
- Auth / DB / API Contract 변경 여부: `No / No / No`.

## Work Breakdown

| Task                               | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 결과                                                    |
| ---------------------------------- | ----------: | ----------: | --------: | ------------------------------------------------------- |
| 7개 화면 UI copy/tone review       |   0% / 100% | 100% / 100% |     +100% | 영문/개발용 문구 잔여 항목 식별                         |
| Spark-safe UI copy patch           |   0% / 100% | 100% / 100% |     +100% | receivables/customers/schedule/inventory 한국어 UI 정리 |
| 관리자 화면 visible role 문구 정리 |   0% / 100% | 100% / 100% |     +100% | `ADMIN 전용` 등 표시 문구를 업무 톤으로 정리            |
| E2E runtime guard 안정화           |   0% / 100% | 100% / 100% |     +100% | Next font abort 오탐 예외 처리                          |
| E2E global setup 안정화            |   0% / 100% | 100% / 100% |     +100% | storageState 생성 기준을 session cookie로 보정          |
| 순차 검증                          |   0% / 100% | 100% / 100% |     +100% | route guard 12 passed, density 30 passed                |

## Phase Progress

|                 Phase | 이전 / 전체 | 현재 / 전체 | 이번 증감 | 근거                                     |
| --------------------: | ----------: | ----------: | --------: | ---------------------------------------- |
|               Overall |  32% / 100% |  33% / 100% |       +1% | 디자인 화면 품질과 E2E 안정성 보정       |
|    0 Baseline/Harness |  84% / 100% |  85% / 100% |       +1% | global setup과 runtime guard 안정화      |
|  1 Design System Gate |  66% / 100% |  69% / 100% |       +3% | 7개 화면 한국어 업무 톤 보정             |
|           2 Auth/RBAC |  70% / 100% |  70% / 100% |       +0% | Auth logic 변경 없음, route guard 통과   |
|             3 DB/Seed |  59% / 100% |  59% / 100% |       +0% | DB/schema/seed 변경 없음                 |
|    4 Dashboard/Report |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                |
|               5 Sales |   9% / 100% |   9% / 100% |       +0% | 변경 없음                                |
| 6 Receivable/Customer |   9% / 100% |  10% / 100% |       +1% | 미수금/고객 화면 copy와 표시 데이터 보정 |
|  7 Schedule/Inventory |   9% / 100% |  10% / 100% |       +1% | 일정/재고 화면 copy와 표시 데이터 보정   |
|      8 Admin Settings |  14% / 100% |  15% / 100% |       +1% | 직원/기초정보/정책 화면 관리자 문구 보정 |
|       9 QA/Validation |  34% / 100% |  36% / 100% |       +2% | E2E flake 원인 보정 및 전체 검증 통과    |

## Subagent Delegation

| 작업                  | Subagent               | Model   | 선택 이유                                              | 결과                                                    |
| --------------------- | ---------------------- | ------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Visual/copy review    | `visual_ui_reviewer`   | GPT-5.5 | 기준 PNG와 업무 콘솔 톤 판단 필요                      | 구조 안정성 확인, pixel-level 비교는 잔여 리스크로 분리 |
| Runtime validation    | `ui_runtime_validator` | mini    | Playwright screenshot/console/network 증거 수집에 적합 | 7개 route overflow 0 확인, inventory 1회 flake 보고     |
| Spark-safe copy patch | `spark_ui_iterator`    | Spark   | 정적 UI 문구/Tailwind 범위의 반복 보정에 적합          | 4개 화면 한국어 UI copy 정리                            |
| Harness integration   | Main Codex             | GPT-5   | E2E flake 원인 판단과 하네스 보정 필요                 | font abort guard, storageState setup 안정화             |

## Model Selection Rationale

- GPT-5 계열은 테스트 하네스, route guard, global setup처럼 인증 경계에 가까운 안정성 판단에 사용했다.
- Spark는 Auth/DB/API를 건드리지 않는 정적 UI 문구와 표시 데이터 보정에만 사용했다.
- mini 계열은 runtime 증거 수집과 화면 구조 확인처럼 읽기 중심 작업에 배정했다.
- GPT-5.5 reviewer는 기준 PNG 대비 시각/문구 이슈 판단에 배정했다.

## Changed Files

| File                                                                                            | 변경 내용                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/app/(workspace)/receivables/page.tsx`                                             | 영문 고객/담당자/금액 표기와 개발용 설명을 한국어 업무 톤으로 보정 |
| `apps/web/src/app/(workspace)/customers/page.tsx`                                               | 영문 고객/요금제/매장명과 시드성 문구 보정                         |
| `apps/web/src/app/(workspace)/schedule/page.tsx`                                                | 영문 담당자/고객명과 시드성 일정 설명 보정                         |
| `apps/web/src/app/(workspace)/inventory/page.tsx`                                               | 영문 보관지점, `min`, 시드성 패널 문구 보정                        |
| `apps/web/src/app/(workspace)/staffs/page.tsx`                                                  | visible role 표시를 `관리자/직원`, `관리자 전용`으로 보정          |
| `apps/web/src/app/(workspace)/settings/base/page.tsx`                                           | 관리자 전용 표시 문구 보정                                         |
| `apps/web/src/app/(workspace)/settings/policies/page.tsx`                                       | 관리자 전용 표시 문구 보정                                         |
| `test/e2e/route-guards.spec.ts`                                                                 | `__nextjs_font` abort 오탐 예외 처리                               |
| `test/e2e/design-density.spec.ts`                                                               | `__nextjs_font` abort 오탐 예외 처리                               |
| `test/e2e/global-setup.ts`                                                                      | session cookie 생성 기준으로 storageState 생성 안정화              |
| `docs/80_ai_harness/stage-1-visual-copy-harness-stability-completion-report-20260501-203140.md` | 이번 작업 완료 보고서                                              |

## Validation Results

| 검증                           | 결과 | 근거                                           |
| ------------------------------ | ---- | ---------------------------------------------- |
| `pnpm format:check`            | Pass | Prettier all matched files                     |
| `pnpm lint`                    | Pass | API tsc lint, Web eslint 통과                  |
| `pnpm typecheck`               | Pass | shared/db/api/web typecheck 통과               |
| `pnpm build`                   | Pass | Next production build 성공                     |
| `pnpm db:validate`             | Pass | Prisma schema valid                            |
| `pnpm test:e2e:route-guards`   | Pass | 12 passed                                      |
| `pnpm test:e2e:design-density` | Pass | 30 passed                                      |
| `git diff --check`             | Pass | exit 0, 기존 CRLF normalization warning만 표시 |

## Issues And Resolutions

| Issue                                                    | 원인                                                              | 처리                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| route guard에서 Next font abort를 request failure로 오탐 | Next dev font request가 navigation 중 `ERR_ABORTED` 가능          | `__nextjs_font` + `ERR_ABORTED`만 예외 처리          |
| global setup 로그인 URL wait timeout                     | router navigation보다 session cookie 생성이 더 안정적인 완료 신호 | `psms_session` cookie 생성 확인 후 storageState 저장 |
| E2E 병렬 실행 시 seed/storageState 충돌 가능             | route guard와 density가 같은 E2E DB reset을 공유                  | 최종 검증은 순차 실행 기준으로 고정                  |

## Residual Risks

| Risk                                                                       | 영향                                                     | 다음 대응                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| full PNG-by-PNG pixel comparison은 아직 완료되지 않음                      | 기준 PNG 대비 세부 hierarchy 차이 가능                   | visual_ui_reviewer + ui_runtime_validator로 screenshot diff 보정 |
| `/schedule`은 기준 PNG의 월간 캘린더 구조와 현재 table 중심 구조 차이가 큼 | 다음 디자인 게이트에서 가장 큰 보정 대상                 | Spark로 static calendar shell 구성 후 GPT review                 |
| right detail panel이 기준 PNG의 drawer/form 밀도와 아직 다름               | receivables/customers/inventory/admin 화면 fidelity 제한 | 화면별 Drawer/Form static shell 추가                             |

## Next Planned 3 Stages

1. `visual_ui_reviewer` + `ui_runtime_validator` + Spark: `/schedule` 월간 캘린더 shell과 우측 예정 목록을 기준 PNG 구조에 맞춘다.
2. `spark_ui_iterator` + `frontend_agent`: receivables/customers/inventory/staffs/base/policies에 static Drawer/Form shell, tabs, pagination/footer를 추가한다.
3. `backend_agent` + `frontend_agent` + `qa_agent`: API read model 연결을 시작하고, route guard/density 외 기능 E2E를 분리한다.
