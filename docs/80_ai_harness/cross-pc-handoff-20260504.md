# Cross-PC Handoff

작성일: 2026-05-04

## 목적

다른 PC에서 `PSMS` 작업을 이어받기 위한 현재 동기화 지점, 실행 절차, 검증 명령, 다음 작업 순서를 정리한다.

## GitHub 동기화 지점

| 항목       | 값                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- |
| Repository | `https://github.com/hacker943410-debug/PSMS.git`                                        |
| Branch     | `main`                                                                                  |
| 기준 커밋  | `f1e127c chore: sync design gate and phase 2 status` 이후 이 handoff 문서 커밋까지 포함 |
| Web URL    | `http://127.0.0.1:5273`                                                                 |
| API URL    | `http://127.0.0.1:4273`                                                                 |

## 새 PC에서 시작하기

PowerShell 기준:

```powershell
git clone https://github.com/hacker943410-debug/PSMS.git
cd PSMS
git checkout main
git pull --ff-only origin main
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

실행 후 확인:

- Web: `http://127.0.0.1:5273`
- API health: `http://127.0.0.1:4273/health`

## 로컬에서 다시 생성해야 하는 것

| 항목              | Git 포함 여부 | 새 PC 처리                              |
| ----------------- | ------------: | --------------------------------------- |
| `node_modules`    |            No | `pnpm install`                          |
| `.env`            |            No | `.env.example`을 복사한 뒤 로컬 값 조정 |
| SQLite DB `*.db`  |            No | `pnpm db:migrate`, `pnpm db:seed`       |
| `.next`           |            No | `pnpm dev` 또는 `pnpm build`에서 생성   |
| Playwright 결과물 |            No | 테스트 실행 시 생성                     |

## 현재 작업 현황

| 영역                                   | 상태                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| Design Reference Match Gate            | `10 / 10` 사용자 승인 완료                                  |
| Phase 1 Design System Gate             | 완료                                                        |
| Phase 2 API/DB Foundation              | 진행 중, surface map 완료                                   |
| Auth/session/RBAC                      | Fastify auth/session, Web guard, ADMIN/STAFF guard 1차 구현 |
| Admin read API                         | staffs/base/policies read endpoint 존재                     |
| Admin CRUD                             | 아직 미구현                                                 |
| Sales/Inventory/Receivable transaction | 아직 미구현                                                 |
| Electron release                       | placeholder 단계                                            |

## 이어받기 전 권장 검증

```powershell
pnpm format:check
pnpm --filter @psms/web lint
pnpm --filter @psms/web typecheck
pnpm db:validate
pnpm test:api:inject
```

필요 시 전체 검증:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 중요 문서

| 문서                                                                                 | 용도                               |
| ------------------------------------------------------------------------------------ | ---------------------------------- |
| `AGENTS.md`                                                                          | 프로젝트 하네스와 안전 규칙        |
| `docs/00_system/development-flow.md`                                                 | 현재 단계와 구현 순서              |
| `docs/00_system/design-reference-match-gate.md`                                      | 디자인 기준 화면 승인 상태         |
| `docs/80_ai_harness/design-reference-match-gate-final-completion-report-20260504.md` | 디자인 게이트 최종 완료 보고       |
| `docs/80_ai_harness/phase-2-api-db-foundation-surface-map-report-20260504.md`        | Phase 2 API/DB/Auth 표면 매핑 보고 |

## 다음 작업 3단계

| 순서 | 작업                                                          | 권장 Subagent                                                    |
| ---: | ------------------------------------------------------------- | ---------------------------------------------------------------- |
|    1 | Auth cookie parsing hardening 및 malformed cookie inject test | `security_reviewer + backend_agent + qa_agent`                   |
|    2 | Admin read response DTO를 `packages/shared` 계약으로 승격     | `architect_reviewer + backend_agent + frontend_agent + qa_agent` |
|    3 | Acceptance/master seed 및 idempotency gate 설계               | `db_reviewer + backend_agent + qa_agent`                         |

## 주의사항

- `5173`, `4173` 포트는 사용하지 않는다.
- Web은 `5273`, API는 `4273`을 사용한다.
- Auth, DB, API contract 변경은 GPT-5.5 계열 리뷰 경로를 거친다.
- Spark 계열은 UI skeleton, Tailwind layout, 단순 문서 정리에만 사용한다.
- 새 PC에서 `.env`의 `AUTH_SECRET`은 로컬용 값으로 교체하는 것이 좋다.
