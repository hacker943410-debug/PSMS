# Session Model Decision Completion Report

작성일: 2026-04-30

## 1. 요약

현재 하네스를 기준으로 `Session` 모델 추가 여부를 확정했다.

결론은 실제 Prisma schema 적용 시 `Session` 모델을 추가하는 것이다. 이번 작업은 schema 변경 전 gate 문서화이며, 실제 `prisma/`, migration, DB 파일, auth 구현, API contract는 변경하지 않았다.

전체 프로젝트 개발 예정 대비 현재 완료율: 약 11% / 100%.

## 2. 작업 분해

| 세부 작업         | 내용                                                            | 결과                        |
| ----------------- | --------------------------------------------------------------- | --------------------------- |
| 현재 구조 확인    | project current state, auth/session 결정, schema checklist 확인 | 실제 DB/auth 구현 없음 확인 |
| draft schema 확인 | `schema.draft.prisma`에서 `User`, `AuditLog`, `Session` 확인    | `Session` 모델 부재 확인    |
| 모델 결정         | 필드, relation, index, onDelete 검토                            | `Session` 모델 추가 승인    |
| 충돌 분석         | Auth, DB, API contract, migration, RBAC 검토                    | 보수적 gate 정리            |
| 상태 문서 갱신    | 현재 구현 목록/완료율/미구현 목록 갱신                          | 완료율 약 11%로 조정        |

## 3. Subagent별 결과

| 세부 작업              | Subagent             | Model        | 결과                                                                                                                     | 검증             |
| ---------------------- | -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Prisma 모델 검토       | `db_reviewer`        | GPT-5.5 high | `Session` 모델 추가 승인 권장. `sessionTokenHash @unique`, `expiresAt`, `(userId, revokedAt)`, `onDelete: Restrict` 권고 | read-only        |
| 세션 보안 검토         | `security_reviewer`  | GPT-5.5 high | token 원문 저장 금지, DB hash 저장, cookie/RBAC/AuditLog 연계 필요 확인                                                  | read-only        |
| 아키텍처/API 충돌 검토 | `architect_reviewer` | GPT-5.5 high | App Router guard, Server Action 계약, repository/service 계층과 충돌 없음 확인                                           | read-only        |
| 문서 작성/통합         | Main Codex           | GPT-5 계열   | 결정 문서 및 완료 보고 작성                                                                                              | local validation |

## 4. 모델 선택 이유

| 모델    | 사용 영역          | 이유                                                                                |
| ------- | ------------------ | ----------------------------------------------------------------------------------- |
| GPT-5.5 | DB/auth/API review | `Session` 모델은 Prisma schema, auth/session, RBAC, API contract에 걸친 고위험 결정 |
| Spark   | 미사용             | Prisma schema, auth/session/RBAC는 Spark 금지 영역                                  |
| mini    | 미사용             | 단순 매핑은 가능하지만 이번 핵심 판단은 DB/security 결정                            |

## 5. 변경 파일

| 파일                                                             | 변경 내용                                                        | 담당       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| `docs/00_system/session-model-decision.md`                       | `Session` 모델 추가 결정, 권장 Prisma 모델, gate, 충돌 분석 작성 | Main Codex |
| `docs/00_system/prisma-schema-review-checklist.md`               | `Session` 모델 관련 review gate와 결정 상태 반영                 | Main Codex |
| `docs/00_system/project-current-state.md`                        | Session 모델 결정 문서 완료 항목과 완료율 갱신                   | Main Codex |
| `docs/80_ai_harness/session-model-decision-completion-report.md` | 작업 완료 보고 작성                                              | Main Codex |

## 6. Auth / DB / API Contract 변경 여부

| 영역         | 변경 여부 | 비고                                                    |
| ------------ | --------: | ------------------------------------------------------- |
| Auth         |        No | 실제 auth/session 구현 없음                             |
| DB           |        No | 실제 Prisma schema/migration/DB 파일 미생성             |
| API contract |        No | `loginAction`, `logoutAction`, `ActionResult` 계약 유지 |

## 7. 검증 결과

| 검증           | 결과 | 근거                                                                        |
| -------------- | ---: | --------------------------------------------------------------------------- |
| 문서 경계 확인 | 통과 | `prisma/`, `.env*`, `src/lib/auth` 미생성. `src/server`는 `.gitkeep`만 유지 |
| Format         | 통과 | `pnpm format`                                                               |
| Format Check   | 통과 | `pnpm format:check`                                                         |
| Lint           | 통과 | `pnpm lint`                                                                 |
| Typecheck      | 통과 | `pnpm typecheck`                                                            |
| Build          | 통과 | `pnpm build`                                                                |

## 8. 남은 리스크

| 리스크                                         | 영향도 | 대응                                                                          |
| ---------------------------------------------- | -----: | ----------------------------------------------------------------------------- |
| 실제 schema 적용 전이므로 SQL 검증이 아직 없음 |   High | create-only migration 단계에서 FK/index/cascade 검토                          |
| token hash 방식과 세션 만료 정책 미확정        |   High | security review에서 구현 전 확정                                              |
| SQLite/PostgreSQL index 차이                   | Medium | 초기 schema는 cross-provider 우선, 운영 리허설에서 PostgreSQL 전용 index 검토 |
| STAFF 권한 일부 모호함                         | Medium | 모호한 권한은 제한적으로 시작                                                 |

## 9. 다음 작업 5개

| 우선순위 | 작업                                                          | 작업 예정자                     | 모델    |
| -------: | ------------------------------------------------------------- | ------------------------------- | ------- |
|        1 | Prisma 의존성/env/schema 추가 준비                            | `backend_agent` + `db_reviewer` | GPT-5.5 |
|        2 | create-only migration 생성 및 SQL review                      | `backend_agent` + `db_reviewer` | GPT-5.5 |
|        3 | password hash/cookie/session 세부 정책 확정                   | `security_reviewer`             | GPT-5.5 |
|        4 | Vitest/RTL 테스트 기본 설정                                   | `qa_agent`                      | GPT-5.5 |
|        5 | 공통 `FilterBar`, `WorkspaceDrawer`, `Modal` UI skeleton 추가 | `spark_ui_iterator`             | Spark   |
