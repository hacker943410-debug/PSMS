# Credential Token URL Log Redaction Report - 2026-05-07

## 1. 작업 요약

- 작업명: Credential token URL/log redaction hardening
- 목표: 직원 활성화/비밀번호 재설정 raw token과 관련 password/hash/Authorization 값이 URL, DOM, managed E2E 로그, 산출물에 남지 않도록 보강한다.
- 결과: managed runner에 line-buffered redaction을 적용하고, 산출물 secret scan gate와 단위 테스트를 추가했다.

## 2. 자동 subagent 위임 및 모델 선택 이유

| Subagent | 역할                  | 모델 선택 이유                                                                                   | 결과                                                                                                                        |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Carson   | `security_reviewer`   | token/cookie/password/log 노출은 auth/session 보안 영역이라 GPT-5.5 high 검토가 필요했다.        | proxy clean URL 구조는 적절하다고 확인했고, 일반 dev 로그, delivery webhook, Playwright 산출물 scan을 리스크로 제시했다.    |
| Peirce   | `devops_sre_reviewer` | stdout/stderr, access log, 산출물 scan은 운영/릴리즈 로그 위생 영역이라 GPT-5.5 high가 적합했다. | chunk split redaction 누락을 blocking으로 지적했고, line-buffer/foreground Playwright redaction과 artifact scan을 권고했다. |

Spark는 사용하지 않았다. 이번 범위는 secret/log/security gate라 하네스 기준 Spark 금지 또는 부적합 범위다.

## 3. 작업 분해 및 상태

| Task | 내용                                                               | 상태 |
| ---- | ------------------------------------------------------------------ | ---- |
| T1   | 하네스/MCP/model-routing/report-format 확인                        | 완료 |
| T2   | `security_reviewer`, `devops_sre_reviewer` 자동 위임               | 완료 |
| T3   | managed runner stdout/stderr redaction 경로 확인                   | 완료 |
| T4   | credential log redaction helper 추가                               | 완료 |
| T5   | chunk split 취약점 반영 후 line-buffered stream redaction으로 보강 | 완료 |
| T6   | managed runner의 DB/Web/API/Playwright 출력 redaction 적용         | 완료 |
| T7   | unit test와 artifact secret scan gate 추가                         | 완료 |
| T8   | `.psms-dev*.log` ignore와 redaction 운영 문서 추가                 | 완료 |
| T9   | 전체 검증과 완료 보고서 작성                                       | 완료 |

## 4. 작업 전/후 변동률

| Phase / Task                 | 작업 전 | 작업 후 | 변동률 | 판단 근거                                                                                            |
| ---------------------------- | ------: | ------: | -----: | ---------------------------------------------------------------------------------------------------- |
| Raw token URL/log redaction  |     35% |     88% |  +53%p | proxy clean URL만 있던 상태에서 managed log redaction, unit, artifact scan까지 추가했다.             |
| Managed E2E log hygiene      |     20% |     95% |  +75%p | Web/API background뿐 아니라 DB reset/Playwright foreground 출력도 redaction한다.                     |
| Chunk-split secret redaction |      0% |     95% |  +95%p | subagent가 잡은 split 누락을 line-buffered stream test로 고정했다.                                   |
| Artifact secret scan gate    |      0% |     85% |  +85%p | `.codex-logs`, `.tmp`, `test-results`, `playwright-report`, `.psms-dev*.log` scan script를 추가했다. |
| Credential token slice 전체  |     88% |     92% |   +4%p | token-holder E2E 이후 남은 URL/log 노출 리스크를 축소했다.                                           |
| Release hardening evidence   |     59% |     68% |   +9%p | 운영 문서, scan gate, full E2E/build 검증 증거가 늘었다.                                             |

## 5. 변경 파일

| 파일                                                                       | 변경 내용                                                                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.gitignore`                                                               | `.psms-dev*.log` 수동 개발 로그 커밋 방지                                                                 |
| `test/e2e/support/credential-log-redaction.mjs`                            | query/cookie/password/hash/Authorization redaction helper와 line-buffered stream redactor 추가            |
| `test/e2e/managed-runner.mjs`                                              | DB/Web/API/Playwright child stdout/stderr를 redaction 후 출력                                             |
| `test/unit/credential-log-redaction.test.mjs`                              | query/cookie/body/action/chunk-split line redaction 단위 테스트 추가                                      |
| `test/e2e/artifact-secret-scan.mjs`                                        | E2E 산출물 secret scan gate 추가                                                                          |
| `package.json`                                                             | `test:unit:credential-log-redaction`, `test:e2e:artifact-secret-scan` script 추가 및 전체 test chain 포함 |
| `docs/00_system/credential-token-url-log-redaction.md`                     | URL/log redaction 정책과 남은 운영 gate 문서화                                                            |
| `docs/80_ai_harness/credential-token-url-log-redaction-report-20260507.md` | 이번 작업 완료 보고서                                                                                     |

## 6. 검증 결과

| 검증                                      | 결과 | 근거                                                                                      |
| ----------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `pnpm test:unit:credential-log-redaction` | 통과 | 7 tests passed                                                                            |
| `pnpm format:check`                       | 통과 | Prettier check 통과                                                                       |
| `pnpm typecheck`                          | 통과 | shared/db/api/web TypeScript 통과                                                         |
| `pnpm lint`                               | 통과 | API tsc lint, Web eslint 통과                                                             |
| `pnpm test:e2e:managed:preflight`         | 통과 | Web 5273/API 4273 free                                                                    |
| `pnpm test:e2e:managed`                   | 통과 | 48 passed                                                                                 |
| `pnpm test:e2e:artifact-secret-scan`      | 통과 | 82 text files scanned, 58 binary artifacts skipped                                        |
| managed output grep                       | 통과 | `LocalAdmin123`, `LocalStaff123`, `WrongPassword123`, raw token/cookie pattern match 없음 |
| `pnpm test`                               | 통과 | unit/API inject 전체 통과                                                                 |
| `pnpm db:validate`                        | 통과 | Prisma schema valid                                                                       |
| `pnpm build`                              | 통과 | Next production build 포함 통과                                                           |
| `git diff --check`                        | 통과 | whitespace error 없음                                                                     |

## 7. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                     |
| --------------------- | --------: | -------------------------------------------------------- |
| Auth/session behavior |        No | 로그인, session, permission runtime 동작 변경 없음       |
| Secret/log handling   |       Yes | managed E2E 출력과 산출물 scan에서 secret redaction 추가 |
| DB                    |        No | Prisma schema/migration 변경 없음                        |
| API contract          |        No | Fastify route/shared ActionResult contract 변경 없음     |
| UI                    |        No | 화면 문구/레이아웃 변경 없음                             |

## 8. 이슈 및 해결

| 이슈                                           | 원인                                                                                       | 해결                                                                                       | 재발 방지                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| chunk split 시 redaction 누락 가능             | chunk 단위 stateless replace는 `?to` + `ken=...`처럼 분리된 secret을 놓친다.               | line-buffered stream redactor로 완료된 줄만 출력 전 redaction한다.                         | split chunk unit test 추가                                |
| Playwright foreground 출력은 기존 redaction 밖 | `stdio: inherit` 경로는 helper를 거치지 않았다.                                            | `redactOutput` 옵션으로 DB reset과 Playwright 실행도 pipe 처리한다.                        | managed runner의 모든 E2E child output을 같은 pipe로 통일 |
| 기존 dev 산출물에 password action args 존재    | 이전 dev 로그가 redaction 없이 저장되어 있었다.                                            | `.codex-logs`, `.psms-dev*.log`를 redaction 정리하고 `.psms-dev*.log`를 ignore에 추가했다. | artifact secret scan gate 추가                            |
| HTML report false positive                     | Playwright report 내부 minified library의 `password=` 변수가 form secret pattern에 걸렸다. | HTML/JS 계열에는 form-encoded password pattern을 적용하지 않도록 제한했다.                 | JSON/action/cookie/token 패턴은 그대로 유지               |

## 9. 남은 리스크

| 리스크                                                            | 영향도 | 대응                                                                     |
| ----------------------------------------------------------------- | -----: | ------------------------------------------------------------------------ |
| 일반 `pnpm dev` 터미널 출력은 managed runner redaction 밖         |   중간 | 다음 작업에서 dev wrapper 또는 Next dev action log redaction 정책을 검토 |
| production reverse proxy/CDN/APM access log는 앱 내부 redactor 밖 |   중간 | 릴리즈 gate에서 query string/cookie/body capture scrubber 확인           |
| delivery webhook은 raw token의 의도된 외부 경계                   |   중간 | 수신 서버 body/header/access log 저장 금지 계약과 검증 필요              |

## 10. Phase별 진행률 재산정

| Phase | 원본 목표              | 현재 상태                                                               | 완료율 |
| ----: | ---------------------- | ----------------------------------------------------------------------- | -----: |
|     0 | 프로젝트 초기화        | workspace/script/검증 하네스는 안정화. 로그 scan gate 추가              |    92% |
|     1 | 디자인 시스템/레이아웃 | shell과 주요 컴포넌트 기반 완료, 세부 화면 완성도는 후속                |    67% |
|     2 | 인증/RBAC              | login/session/admin guard와 credential token 보안 slice가 크게 진전     |    75% |
|     3 | 데이터 모델/Seed       | credential token migration/DB contract 포함. 운영 seed 보강은 남음      |    82% |
|     4 | 대시보드/리포트        | route placeholder 중심, 실제 KPI/query/chart 미완                       |    12% |
|     5 | 판매 관리/판매 등록    | placeholder 중심, transaction wizard 미완                               |     8% |
|     6 | 미수금/고객            | placeholder 중심, 수납/취소/상세 이력 미완                              |     8% |
|     7 | 일정/재고              | placeholder 중심, 캘린더/재고 상태 변경 미완                            |     8% |
|     8 | 관리자 설정            | staff credential API 기반은 진전, 화면 연결은 남음                      |    36% |
|     9 | Export/QA/운영 보강    | managed E2E, secret scan, build 검증이 보강됨. export/release gate 남음 |    50% |

## 11. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                             | 담당 subagent                                            | 상세                                                                                                                                                       |
| ---- | ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Manual dev log wrapper hardening      | `devops_sre_reviewer` + `security_reviewer`              | 일반 `pnpm dev`/수동 로그에서도 action args와 secret이 남지 않도록 dev runner wrapper 또는 Next dev logging 정책을 정한다.                                 |
| 2    | Production env and log release gate   | `devops_sre_reviewer` + `release_reviewer`               | `AUTH_SECRET`, `PASSWORD_TOKEN_SECRET`, `CREDENTIAL_COMPLETION_SECRET`, reverse proxy/APM/cookie/body scrubber를 release checklist와 자동 검증에 연결한다. |
| 3    | Admin credential issue/revoke UX 연결 | `frontend_agent` + `backend_agent` + `security_reviewer` | 직원 관리 화면에서 activation/reset 발급/회수 UX를 연결하고 RBAC/AuditLog/secret 비노출 회귀를 검증한다.                                                   |
