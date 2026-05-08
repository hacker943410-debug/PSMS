# Credential Token Browser E2E Completion Report - 2026-05-07

## 1. 작업 요약

- 작업명: Credential token 브라우저 E2E 게이트 보강
- 기준 하네스: `docs/00_system/project-current-state.md`, `docs/00_system/development-flow.md`, `docs/00_core/orchestrator-rules.md`, `docs/00_core/model-routing.md`, `docs/20_execution/task-execution-rule.md`, `docs/20_execution/task-report-format.md`, `docs/30_validation/testing-policy.md`, `docs/30_validation/ui-validation.md`
- 결과: 직원 활성화와 비밀번호 재설정 토큰의 브라우저 성공/재시도/출처 차단/레이트 리밋 흐름을 관리형 Playwright E2E에 포함했고, 최종 `pnpm test:e2e:managed`에서 42개 테스트가 모두 통과했다.

## 2. 자동 subagent 위임

| Subagent | 역할                | 모델 선택 이유                                                                                            | 결과                                                                                                                                                                   |
| -------- | ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tesla    | `security_reviewer` | 토큰, 세션 쿠키, CSRF/출처 검증은 보안 민감 영역이므로 프로젝트 규칙상 GPT-5.5 high 계열 검토가 필요했다. | 완료 쿠키는 권한 토큰이 아닌 짧은 성공 표시용으로 허용 가능하다는 판단을 받았다. 단, HMAC 서명 완료 마커는 후속 강화 항목으로 남겼다.                                  |
| Planck   | `qa_agent`          | 브라우저 E2E 수용 기준과 회귀 위험 검증은 QA 전문 GPT-5.5 high 라우팅이 적합하다.                         | 기존 유효 토큰 성공 흐름의 실패 원인이 토큰 쿠키 삭제 후 Server Component 재렌더에서 성공 상태를 잃는 문제임을 확인했다. 완료 쿠키 기반 Web-only 보강 방향을 승인했다. |

Spark 계열은 사용하지 않았다. 이번 작업은 auth, token, cookie, session, 출처 검증이 포함되어 있어 프로젝트 규칙상 Spark가 수정하면 안 되는 영역이다.

## 3. 작업 분해 및 완료 상태

| Task | 내용                                                                                    | 상태 |
| ---- | --------------------------------------------------------------------------------------- | ---- |
| T1   | 하네스 문서, MCP 표면, 현재 변경 범위 확인                                              | 완료 |
| T2   | 보안/QA subagent 자동 위임 및 피드백 수렴                                               | 완료 |
| T3   | 토큰 URL 진입 후 httpOnly/path-bound 토큰 쿠키 저장 검증 추가                           | 완료 |
| T4   | 성공 후 토큰/세션 쿠키 삭제와 Server Component 성공 화면 유지 보강                      | 완료 |
| T5   | 직원 활성화 유효 토큰, replay 차단, 로그인 성공 E2E 추가                                | 완료 |
| T6   | 비밀번호 재설정 유효 토큰, 기존 세션 revoke, 이전 비밀번호 차단 E2E 추가                | 완료 |
| T7   | cross-site Server Action 재현 요청이 토큰을 소비하지 않는지 검증                        | 완료 |
| T8   | invalid/rate-limited 링크가 비밀번호 필드를 노출하지 않고 secret을 누출하지 않는지 검증 | 완료 |
| T9   | 관리형 E2E runner 환경변수와 전용 npm script 보강                                       | 완료 |
| T10  | 전체 검증 및 완료 보고서 작성                                                           | 완료 |

## 4. 작업 전/후 변동률

진행률은 현재 하네스 기준의 해당 slice 완성도 추정치이며, 전체 제품 완성률이 아니라 이번 credential-token Web/E2E 범위의 작업 준비도다.

| Phase / Task                        | 작업 전 | 작업 후 | 변동률 | 근거                                                                                        |
| ----------------------------------- | ------: | ------: | -----: | ------------------------------------------------------------------------------------------- |
| Credential token DB/API/shared 기반 |    100% |    100% |    0%p | 이전 Phase 산출물을 이번 검증에서 재확인했다.                                               |
| Token-holder Web UX                 |     72% |     92% |  +20%p | 성공 후 토큰 쿠키 삭제 상태에서도 완료 화면이 유지되도록 completion cookie 흐름을 추가했다. |
| Credential token Browser E2E        |      0% |     96% |  +96%p | 신규 브라우저 E2E가 valid/replay/cross-site/rate-limit/secret leak를 검증한다.              |
| Managed E2E integration             |     82% |     91% |   +9%p | `test:e2e:managed` runner에 credential-token spec과 격리 rate-limit file 환경을 포함했다.   |
| Release evidence / regression gate  |     35% |     47% |  +12%p | typecheck, lint, unit/API inject, build, managed E2E까지 통과 기록을 남겼다.                |
| Credential token slice 전체         |     68% |     80% |  +12%p | API/DB 기반 위에 실제 브라우저 사용자 경로 검증이 붙었다.                                   |

## 5. 변경 파일

- `test/e2e/credential-token-browser.spec.ts`: credential token 브라우저 E2E 신규 추가.
- `test/e2e/managed-runner.mjs`: 관리형 E2E 환경에 credential token rate-limit file, token secret, 신규 spec 포함.
- `package.json`: `test:e2e:credential-token` script 추가.
- `apps/web/src/lib/credential-token-cookie.ts`: 목적별 completion cookie 설정 추가.
- `apps/web/src/proxy.ts`: 새 토큰 URL 진입 시 이전 completion marker 제거.
- `apps/web/src/server/actions/credential-token.actions.ts`: 성공 시 토큰/세션 쿠키 정리와 짧은 완료 마커 설정.
- `apps/web/src/app/(auth)/_components/credential-token-page.tsx`: 토큰 쿠키가 사라진 성공 상태를 서버 렌더링으로 표시.

## 6. 검증 결과

| Command                 | 결과            |
| ----------------------- | --------------- |
| `pnpm db:validate`      | 통과            |
| `pnpm format:check`     | 통과            |
| `pnpm lint`             | 통과            |
| `pnpm typecheck`        | 통과            |
| `pnpm test`             | 통과            |
| `pnpm build`            | 통과            |
| `git diff --check`      | 통과            |
| `pnpm test:e2e:managed` | 통과, 42 passed |

## 7. 확인된 리스크

- completion cookie 값은 짧은 성공 표시용 `"1"`이다. 권한 상승이나 토큰 소비는 만들지 않지만, 사용자가 임의로 성공 화면을 잠깐 표시할 수는 있다. 다음 hardening에서 HMAC 서명 completion marker로 강화할 수 있다.
- raw token은 최초 URL query에 들어온다. proxy가 정규 URL에서는 제거하지만, 브라우저 히스토리나 외부 access log 정책까지 완전히 다루는 단계는 아니다.
- cross-site E2E는 Next Server Action 요청 형식을 일회용 정상 브라우저 요청에서 캡처한 뒤 대상 쿠키만 교체해 재현한다. Next 내부 전송 형식이 바뀌어도 런타임 캡처 방식이라 비교적 안전하지만, framework upgrade 시 재확인이 필요하다.

## 8. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                                | 담당 subagent                                                        | 상세                                                                                                                      |
| ---- | ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Completion marker 및 token URL hardening | `security_reviewer` + main Codex                                     | completion cookie HMAC 서명, raw token URL/log redaction 정책, 출처 검증 단위 테스트를 정리한다.                          |
| 2    | Admin credential issue/revoke UX 연결    | `frontend_agent` + `backend_agent` + `security_reviewer`             | `/staffs` 또는 직원 상세 Drawer에서 activation/reset token 발급/폐기 UI를 연결하고, API permission/audit 흐름을 유지한다. |
| 3    | UI/Release gate 정리 및 동기화 준비      | `ui_runtime_validator` + `release_reviewer` + `docs_release_manager` | staff activation/reset 화면 스크린샷, 접근성, 경로 회귀를 확인하고 다음 커밋/푸시 단위로 묶을 변경 범위를 정리한다.       |
