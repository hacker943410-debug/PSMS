# Credential Completion Marker Hardening Report - 2026-05-07

## 1. 작업 요약

- 작업명: Credential token completion marker HMAC hardening
- 목표: 직원 활성화/비밀번호 재설정 완료 화면을 유지하기 위해 쓰던 단순 completion cookie 값 `"1"`을 서명 검증 가능한 서버 전용 marker로 교체한다.
- 결과: `v1.issuedAt.nonce.signature` 형식의 HMAC marker를 서버에서만 생성/검증하도록 추가했고, forged/tampered/stale marker 차단을 브라우저 E2E로 확인했다.

## 2. 자동 subagent 위임

| Subagent | 역할                | 모델 선택 이유                                                                                     | 결과                                                                                                |
| -------- | ------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Noether  | `security_reviewer` | completion marker는 auth/session/cookie 보안 영역이므로 GPT-5.5 high 검토가 필요했다.              | purpose-bound HMAC, context separation, 짧은 TTL, malformed/tamper fail-closed 요구사항을 제시했다. |
| Feynman  | `qa_agent`          | 브라우저 성공 화면, forged marker, proxy cleanup 회귀는 QA 전문 GPT-5.5 high 검증 경로가 적합했다. | E2E acceptance와 검증 우선순위를 제시했고, 성공/reload/forged/proxy cleanup assertion에 반영했다.   |

Spark는 사용하지 않았다. 이번 작업은 auth/session/cookie/token 보안 영역이라 프로젝트 라우팅 규칙상 Spark 금지 범위다.

## 3. 작업 분해 및 상태

| Task | 내용                                                                    | 상태 |
| ---- | ----------------------------------------------------------------------- | ---- |
| T1   | 하네스 문서, MCP surface, 현재 dirty worktree 확인                      | 완료 |
| T2   | 보안/QA subagent 자동 위임                                              | 완료 |
| T3   | 서버 전용 HMAC completion marker helper 추가                            | 완료 |
| T4   | Server Action 성공 경로에서 signed marker 설정                          | 완료 |
| T5   | Server Component 성공 화면 조건을 marker 검증 기반으로 전환             | 완료 |
| T6   | E2E 성공 흐름에 signed cookie shape/path/httpOnly/reload assertion 추가 | 완료 |
| T7   | forged `"1"` marker와 tampered marker 실패 assertion 추가               | 완료 |
| T8   | 새 token URL 진입 시 stale completion marker 제거 assertion 추가        | 완료 |
| T9   | 전체 검증 및 완료 보고서 작성                                           | 완료 |

## 4. 작업 전/후 변동률

| Phase / Task                    | 작업 전 | 작업 후 | 변동률 | 판단 근거                                                                           |
| ------------------------------- | ------: | ------: | -----: | ----------------------------------------------------------------------------------- |
| Credential token Web success UX |     92% |     96% |   +4%p | 성공 후 reload 유지와 marker 검증을 모두 확인했다.                                  |
| Completion marker security      |     40% |     88% |  +48%p | 단순 `"1"` 표시 marker에서 purpose-bound HMAC marker로 전환했다.                    |
| Credential token Browser E2E    |     96% |     98% |   +2%p | 관리형 E2E가 42개에서 48개로 확장되었고 forged/proxy cleanup 회귀가 추가되었다.     |
| Release hardening evidence      |     47% |     53% |   +6%p | 보안 리뷰, QA 리뷰, build/test/e2e 증거를 추가했다.                                 |
| Credential token slice 전체     |     80% |     84% |   +4%p | 남은 핵심 리스크가 raw token URL/log 정책과 전용 completion secret 분리로 좁혀졌다. |

## 5. 변경 파일

| 파일                                                                           | 변경 내용                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/web/src/lib/credential-token-completion.ts`                              | server-only HMAC marker 생성/검증 helper 추가                                         |
| `apps/web/src/server/actions/credential-token.actions.ts`                      | 성공 시 completion cookie 값을 signed marker로 설정                                   |
| `apps/web/src/app/(auth)/_components/credential-token-page.tsx`                | completion cookie `"1"` 비교를 서명 검증으로 대체                                     |
| `test/e2e/credential-token-browser.spec.ts`                                    | signed marker, reload success, tampered marker, forged marker, proxy cleanup E2E 추가 |
| `docs/80_ai_harness/credential-completion-marker-hardening-report-20260507.md` | 이번 작업 완료 보고서 추가                                                            |

## 6. 검증 결과

| 검증                              | 결과 | 근거                                                      |
| --------------------------------- | ---- | --------------------------------------------------------- |
| `codex mcp list`                  | 통과 | MCP surface 확인, stdio Auth Unsupported는 예상 동작      |
| `pnpm typecheck`                  | 통과 | shared/db/api/web TypeScript 통과                         |
| `pnpm lint`                       | 통과 | API tsc lint, Web eslint 통과                             |
| `pnpm test:e2e:managed:preflight` | 통과 | Web 5273/API 4273 free, 금지 포트 5173/4173 occupied 확인 |
| `pnpm test:e2e:managed`           | 통과 | 48 passed                                                 |
| `pnpm format:check`               | 통과 | Prettier 통과                                             |
| `pnpm db:validate`                | 통과 | Prisma schema valid                                       |
| `pnpm test`                       | 통과 | unit/API inject 통과                                      |
| `pnpm build`                      | 통과 | Next production build 포함 통과                           |
| `git diff --check`                | 통과 | whitespace error 없음                                     |

## 7. Auth / DB / API Contract 변경 여부

| 영역                    | 변경 여부 | 비고                                                                   |
| ----------------------- | --------: | ---------------------------------------------------------------------- |
| Auth / Session / Cookie |       Yes | Web completion cookie 검증 로직 변경. 세션 발급/검증 정책은 변경 없음. |
| DB                      |        No | Prisma schema/migration 변경 없음.                                     |
| API contract            |        No | Fastify route/shared ActionResult contract 변경 없음.                  |
| UI copy/layout          |        No | 성공/오류 화면 문구와 레이아웃은 유지.                                 |

## 8. 남은 리스크

| 리스크                                                              | 영향도 | 대응                                                                                         |
| ------------------------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------- |
| completion marker signing secret이 현재 `AUTH_SECRET`에 의존        |   중간 | 릴리즈 전 `CREDENTIAL_COMPLETION_SECRET` 전용 32바이트 이상 secret으로 분리 권고             |
| raw token 최초 URL query가 브라우저 history/log에 남을 수 있음      |   중간 | token URL/log redaction 정책과 access log 가이드 추가 필요                                   |
| expired/future marker 세부 조건은 helper 레벨 unit test가 아직 없음 |   낮음 | server-only helper 테스트 전략을 정해 malformed/expired/future/purpose-swap 단위 테스트 추가 |

## 9. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                                    | 담당 subagent                                            | 상세                                                                                                    |
| ---- | -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | 전용 completion secret 및 helper 단위 테스트 | `security_reviewer` + `qa_agent` + main Codex            | `CREDENTIAL_COMPLETION_SECRET` 도입 여부를 확정하고 expired/future/purpose-swap 단위 테스트를 추가한다. |
| 2    | Raw token URL/log redaction hardening        | `security_reviewer` + `devops_sre_reviewer`              | proxy redirect 이후 로그/문서/운영 설정에서 raw token 노출을 줄이는 정책을 정리한다.                    |
| 3    | Admin credential issue/revoke UX 연결        | `frontend_agent` + `backend_agent` + `security_reviewer` | 직원 관리 화면에서 activation/reset token 발급/폐기 UX를 연결하고 권한/audit/브라우저 회귀를 검증한다.  |
