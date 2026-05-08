# Credential Completion Secret Unit Report - 2026-05-07

## 1. 작업 요약

- 작업명: Credential completion marker dedicated secret and unit gate
- 목표: completion marker HMAC signing secret을 `AUTH_SECRET`에서 분리하고, helper 레벨 fail-closed 단위 테스트를 추가한다.
- 결과: `CREDENTIAL_COMPLETION_SECRET` 전용 env를 도입했고, `AUTH_SECRET`/`PASSWORD_TOKEN_SECRET` fallback 없이 생성은 fail-fast, 검증은 fail-closed로 동작하도록 고정했다.

## 2. 자동 subagent 위임

| Subagent  | 역할                | 모델 선택 이유                                                                                    | 결과                                                                                                                              |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Descartes | `security_reviewer` | secret 분리, fallback 금지, fail-closed는 auth/cookie 보안 영역이라 GPT-5.5 high 검토가 필요했다. | `CREDENTIAL_COMPLETION_SECRET` 유지, fallback 금지, 구조적으로 유효한 marker의 invalid secret 검증 테스트 추가를 권고했다.        |
| Franklin  | `qa_agent`          | helper 단위 acceptance와 managed E2E 회귀 범위 선정은 QA 전문 GPT-5.5 high가 적합했다.            | 전용 secret only, purpose binding, nonce uniqueness, malformed/tamper/expired/future 테스트와 managed runner env 반영을 요구했다. |

Spark는 사용하지 않았다. 이번 작업은 secret/auth/cookie/token 보안 영역이라 프로젝트 라우팅 규칙상 Spark 금지 범위다.

## 3. 작업 분해 및 상태

| Task | 내용                                                              | 상태 |
| ---- | ----------------------------------------------------------------- | ---- |
| T1   | 하네스/MCP/현재 completion marker 구조 확인                       | 완료 |
| T2   | 보안/QA subagent 자동 위임                                        | 완료 |
| T3   | `CREDENTIAL_COMPLETION_SECRET` 전용 env 도입                      | 완료 |
| T4   | `server-only` wrapper와 테스트 가능한 core helper 분리            | 완료 |
| T5   | missing/placeholder/short secret create throw, verify false 처리  | 완료 |
| T6   | malformed/tamper/purpose-swap/expired/future/nonce unit test 추가 | 완료 |
| T7   | managed E2E runner에 전용 completion secret 주입                  | 완료 |
| T8   | `.env.example`과 root test script 반영                            | 완료 |
| T9   | 전체 검증과 완료 보고서 작성                                      | 완료 |

## 4. 작업 전/후 변동률

| Phase / Task                       | 작업 전 | 작업 후 | 변동률 | 판단 근거                                                           |
| ---------------------------------- | ------: | ------: | -----: | ------------------------------------------------------------------- |
| Completion marker secret isolation |     20% |     95% |  +75%p | `AUTH_SECRET` 재사용을 제거하고 전용 secret만 사용하도록 고정했다.  |
| Completion marker unit coverage    |      0% |     90% |  +90%p | helper 단위에서 생성/검증/변조/만료/미래/invalid secret을 검증한다. |
| Credential token Web success UX    |     96% |     96% |    0%p | UI 동작은 유지하고 signing secret만 분리했다.                       |
| Credential token Browser E2E       |     98% |     98% |    0%p | 기존 48개 managed E2E가 전용 secret 환경에서도 통과했다.            |
| Release hardening evidence         |     53% |     59% |   +6%p | 보안/QA 리뷰와 unit/E2E/build 증거가 추가되었다.                    |
| Credential token slice 전체        |     84% |     88% |   +4%p | 남은 주요 보안 리스크가 raw token URL/log redaction으로 좁혀졌다.   |

## 5. 변경 파일

| 파일                                                                      | 변경 내용                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/src/lib/credential-token-completion-core.ts`                    | 전용 secret 기반 marker 생성/검증 core helper 추가                      |
| `apps/web/src/lib/credential-token-completion.ts`                         | `server-only` wrapper로 유지                                            |
| `test/unit/credential-completion-marker.test.ts`                          | helper 단위 보안 테스트 추가                                            |
| `test/e2e/managed-runner.mjs`                                             | managed E2E에 `CREDENTIAL_COMPLETION_SECRET` 주입                       |
| `.env.example`                                                            | completion marker 전용 secret placeholder 추가                          |
| `package.json`                                                            | `test:unit:credential-completion-marker`와 전체 `pnpm test` 체인에 포함 |
| `docs/80_ai_harness/credential-completion-secret-unit-report-20260507.md` | 이번 작업 완료 보고서 추가                                              |

## 6. 검증 결과

| 검증                                          | 결과 | 근거                              |
| --------------------------------------------- | ---- | --------------------------------- |
| `pnpm test:unit:credential-completion-marker` | 통과 | 5 tests passed                    |
| `pnpm test:unit:credential-token`             | 통과 | 9 tests passed                    |
| `pnpm typecheck`                              | 통과 | shared/db/api/web TypeScript 통과 |
| `pnpm lint`                                   | 통과 | API tsc lint, Web eslint 통과     |
| `pnpm test:e2e:managed:preflight`             | 통과 | Web 5273/API 4273 free            |
| `pnpm test:e2e:managed`                       | 통과 | 48 passed                         |
| `pnpm format:check`                           | 통과 | Prettier 통과                     |
| `pnpm db:validate`                            | 통과 | Prisma schema valid               |
| `pnpm test`                                   | 통과 | unit/API inject 전체 통과         |
| `pnpm build`                                  | 통과 | Next production build 포함 통과   |
| `git diff --check`                            | 통과 | whitespace error 없음             |

## 7. Auth / DB / API Contract 변경 여부

| 영역                   | 변경 여부 | 비고                                                    |
| ---------------------- | --------: | ------------------------------------------------------- |
| Auth / Cookie / Secret |       Yes | completion marker signing secret을 전용 env로 분리했다. |
| DB                     |        No | Prisma schema/migration 변경 없음.                      |
| API contract           |        No | Fastify route/shared ActionResult contract 변경 없음.   |
| UI copy/layout         |        No | 화면 문구와 레이아웃 변경 없음.                         |

## 8. 이슈 및 해결

| 이슈                                                                | 원인                                                          | 해결                                                                                        | 재발 방지                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Node unit test가 `server-only` import에서 실패                      | Next `server-only` 패키지는 일반 Node test import를 차단한다. | pure core helper와 `server-only` wrapper를 분리했다.                                        | 서버 전용 Next wrapper와 pure helper 테스트 대상을 분리한다. |
| invalid secret verify 테스트가 실제 signature 경로를 타지 않을 위험 | 단순 `"1"` 값은 secret 없이도 형식 단계에서 실패한다.         | 구조적으로 유효한 marker를 만든 뒤 secret을 삭제/placeholder/short로 바꿔 false를 확인했다. | 보안 테스트는 대상 방어 경로를 실제로 통과하게 구성한다.     |

## 9. 남은 리스크

| 리스크                                                                               | 영향도 | 대응                                                           |
| ------------------------------------------------------------------------------------ | -----: | -------------------------------------------------------------- |
| 기존 60초 completion marker는 secret 전환 배포 순간 무효화될 수 있음                 |   낮음 | 성공 화면 표시용이므로 보안상 수용 가능. 배포 노트에 기록 권장 |
| raw token 최초 URL query가 history/log에 남을 수 있음                                |   중간 | 다음 hardening에서 URL/log redaction 정책 정리                 |
| production env에 `CREDENTIAL_COMPLETION_SECRET` 미설정 시 완료 화면 marker 생성 실패 |   중간 | 배포 체크리스트/env validation에 필수 secret으로 추가 필요     |

## 10. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                             | 담당 subagent                                            | 상세                                                                                                             |
| ---- | ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | Raw token URL/log redaction hardening | `security_reviewer` + `devops_sre_reviewer`              | proxy redirect 이후 로그/문서/운영 설정에서 raw token 노출을 줄이는 정책을 정리한다.                             |
| 2    | Production env validation gate        | `devops_sre_reviewer` + `release_reviewer`               | `AUTH_SECRET`, `PASSWORD_TOKEN_SECRET`, `CREDENTIAL_COMPLETION_SECRET` 필수 검증과 release checklist를 연결한다. |
| 3    | Admin credential issue/revoke UX 연결 | `frontend_agent` + `backend_agent` + `security_reviewer` | 직원 관리 화면에서 activation/reset token 발급/폐기 UX를 연결하고 권한/audit/브라우저 회귀를 검증한다.           |
