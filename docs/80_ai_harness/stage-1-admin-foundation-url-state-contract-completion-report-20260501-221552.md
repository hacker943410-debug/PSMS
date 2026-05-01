# Stage 1 Admin Foundation URL State Contract Completion Report

작성 시각: 2026-05-01 22:15 KST

## 요약

- Admin Foundation 화면인 `/staffs`, `/settings/base`, `/settings/policies`의 URL search params / Drawer / Modal 상태 계약을 preflight 문서로 정리했다.
- 산출물은 `docs/00_system/admin-foundation-url-state-contract.md`이다.
- 이번 작업은 문서/계약 정리 범위이며 실제 화면 코드, Auth, DB, API Contract, 정책 계산/활성화 로직은 변경하지 않았다.
- Next.js 15+/16 기준 `searchParams` async prop, Server Component 파싱, Client Component URL update 경계를 반영했다.

## 작업 분해

| Task                      | 처리 내용                                                              | 완료율 |  증감 |
| ------------------------- | ---------------------------------------------------------------------- | -----: | ----: |
| 하네스/기술문서 확인      | harness docs, PSMS_Tech IA/API/frontend 문서 확인                      |   100% | +100% |
| 현재 구현 매핑            | `/staffs`, `/settings/base`, `/settings/policies`의 정적 UI와 gap 확인 |   100% | +100% |
| Subagent 위임             | architecture/frontend/codebase mapping 위임 및 결과 반영               |   100% | +100% |
| URL state contract 문서화 | route별 params, mode/detail/confirm 경계, parser 원칙 작성             |   100% | +100% |
| 검증                      | 문서 formatting 및 기존 회귀 명령 일부 확인                            |   100% | +100% |
| 완료 보고                 | Phase/Task 진행율, 모델 선택 이유, 다음 3단계 작성                     |   100% | +100% |

## Phase별 진행율

|                 Phase | 현재 / 전체 | 이번 증감 | 근거                                                 |
| --------------------: | ----------: | --------: | ---------------------------------------------------- |
|               Overall |  40% / 100% |       +1% | Admin Foundation 기능 연결 전 URL 상태 계약 확정     |
|    0 Baseline/Harness |  86% / 100% |       +0% | 기존 유지                                            |
|  1 Design System Gate |  87% / 100% |       +0% | 디자인 화면 변경 없음                                |
|           2 Auth/RBAC |  70% / 100% |       +0% | ADMIN guard 원칙만 문서화, 코드 변경 없음            |
|             3 DB/Seed |  59% / 100% |       +0% | DB 변경 없음                                         |
|    4 Dashboard/Report |   9% / 100% |       +0% | 범위 외                                              |
|               5 Sales |   9% / 100% |       +0% | 범위 외                                              |
| 6 Receivable/Customer |   6% / 100% |       +0% | 범위 외                                              |
|  7 Schedule/Inventory |  18% / 100% |       +0% | 범위 외                                              |
|      8 Admin Settings |  22% / 100% |       +3% | 직원/기초정보/정책 화면 URL 상태 계약 preflight 완료 |
|       9 QA/Validation |  48% / 100% |       +1% | 구현 전 테스트 기준과 invalid param QA 기준 문서화   |

## 모델 선택 이유

| 작업                   | Subagent / Model               | 선택 이유                                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------- |
| URL state architecture | `architect_reviewer` / GPT-5.5 | URL intent와 mutation/API/Auth/DB 경계가 섞이지 않도록 구조 검토 필요 |
| App Router 설계        | `frontend_agent` / GPT-5.5     | Next.js App Router, async `searchParams`, RSC/client 경계 판단 필요   |
| 구현 매핑              | `codebase_mapper` / mini       | read-only로 현재 route, 공통 컴포넌트, 테스트 위치를 빠르게 매핑      |
| 문서 통합              | Codex                          | subagent 결과를 하네스 문서와 완료 보고서로 통합                      |

## Subagent 결과

| Subagent             | 결과                                                                                                                                      | 반영                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `architect_reviewer` | URL은 UI intent만 표현하고 mutation은 API/ActionResult 흐름으로 처리해야 함. `MANAGER`, `tab=staffs`, 정책 활성화는 보류/후보로 구분 필요 | 계약 문서에 변경 금지 범위와 보류/주의 섹션 반영            |
| `frontend_agent`     | Next 15+/16 `searchParams` async prop, 서버 파싱, 클라이언트 URL update 방식 제안                                                         | 공통 타입, Server/Client 경계, parser/href helper 원칙 반영 |
| `codebase_mapper`    | 세 Admin 화면은 아직 searchParams를 읽지 않는 정적 UI이며 Drawer/detail gap 존재                                                          | 현재 구현 Gap과 테스트 기준에 반영                          |

## Spark 사용 범위

| 항목                 | 내용                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| Spark 사용 여부      | No                                                                           |
| 이유                 | 이번 작업은 URL/API/Auth/DB 경계가 포함된 계약 preflight라 Spark 범위가 아님 |
| 추후 Spark 가능 범위 | 계약 확정 후 단순 presentational drawer/filter UI 반복 보정                  |

## 변경 파일

| 파일                                                                                                  | 변경 내용                                             |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `docs/00_system/admin-foundation-url-state-contract.md`                                               | Admin Foundation URL state / Drawer / Modal 계약 추가 |
| `docs/80_ai_harness/stage-1-admin-foundation-url-state-contract-completion-report-20260501-221552.md` | 완료 보고서 추가                                      |

## 검증 결과

| 검증                             |    결과 | 근거                              |
| -------------------------------- | ------: | --------------------------------- |
| `pnpm exec prettier --write ...` |    Pass | 신규 문서 2개 formatting 완료     |
| `pnpm format:check`              |    Pass | 전체 workspace format 확인        |
| `pnpm lint`                      |    Pass | 전체 workspace lint 확인          |
| `pnpm typecheck`                 |    Pass | 전체 workspace typecheck 확인     |
| `pnpm db:validate`               |    Pass | Prisma schema validate 확인       |
| `pnpm build`                     |    Pass | 전체 build 확인                   |
| `pnpm test:e2e:route-guards`     | Not Run | 문서 전용 변경, 직전 12 passed    |
| `pnpm test:e2e:design-density`   | Not Run | UI 코드 변경 없음, 직전 30 passed |

## Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                           |
| ------------ | --------: | -------------------------------------------------------------- |
| Auth         |        No | ADMIN guard 유지 원칙만 문서화                                 |
| DB           |        No | schema/migration/seed 변경 없음                                |
| API Contract |        No | 공식 Fastify/shared schema 계약은 다음 단계에서 별도 preflight |

## 남은 리스크

| 리스크                                             |                                                  영향 | 대응                                                                    |
| -------------------------------------------------- | ----------------------------------------------------: | ----------------------------------------------------------------------- |
| 현재 구현은 아직 searchParams 미연동               | URL 직접 진입/새로고침 상태 복원이 아직 동작하지 않음 | 다음 구현 단계에서 route별 parser/client shell 추가                     |
| `/staffs` 화면의 `MANAGER` 표현과 공식 RBAC 불일치 |                                권한/DB enum 충돌 가능 | `MANAGER`는 계약 제외, 필요 시 GPT-5.5 + DB/Auth 리뷰 후 결정           |
| `/settings/base?tab=staffs` 범위 불명확            |                   직원 관리와 기초정보 역할 충돌 가능 | `/staffs`로 분리 유지, base의 staffs tab은 보류                         |
| 정책 활성화 URL intent 오용 가능                   |                       GET 진입으로 mutation 처리 위험 | `confirm=activate`는 UI intent만 허용, 실제 mutation은 API 검증 후 수행 |
| 워킹트리 매우 dirty                                |                      staged/unstaged 산출물 혼동 가능 | 커밋 전 `git diff --cached`와 `git diff` 분리 확인                      |

## 다음 작업 예정 3단계

| 단계 | 작업                                                                                               | Subagent / Model                                                          |
| ---: | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
|    1 | Admin URL parser/href helper 구현: `staffs`, `base`, `policies` parser와 canonical URL helper 추가 | `frontend_agent` GPT-5.5 + `code_reviewer` Codex                          |
|    2 | Admin API contract preflight: 직원/기초정보/정책 filter DTO와 ActionResult/API endpoint 경계 확정  | `architect_reviewer` GPT-5.5 + `backend_agent` GPT-5.5                    |
|    3 | UI 연결 및 회귀: route-aware filter/drawer client shell 연결, Spark는 반복 Tailwind 보정만 수행    | `frontend_agent` GPT-5.5 + `spark_ui_iterator` Spark + `qa_agent` GPT-5.5 |
