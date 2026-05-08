# Manual Dev Log Wrapper Hardening Report - 2026-05-07

## 1. 작업 요약

- 작업명: Manual dev log wrapper hardening
- 목표: 일반 `pnpm dev`, `pnpm dev:web`, `pnpm dev:api` 경로에서도 password/token/cookie/hash/Authorization 값이 터미널과 파일 로그에 원문으로 남지 않도록 한다.
- 결과: root dev script를 redacted dev runner로 전환했고, dev/E2E 공용 redaction helper와 dev runner preflight 테스트를 추가했다.

## 2. 자동 subagent 위임 및 모델 선택 이유

| Subagent | 역할                  | 모델 선택 이유                                                                                                            | 결과                                                                                                                      |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Russell  | `security_reviewer`   | dev log의 token/password/cookie 노출은 auth/session/secret 보안 영역이라 GPT-5.5 high 검토가 필요했다.                    | root `dev`, `dev:web`, `dev:api` 모두 wrapper 기본값이 되어야 하며 raw child output 직접 연결은 금지해야 한다고 권고했다. |
| Bacon    | `devops_sre_reviewer` | child process cleanup, Windows 호환, 로그 파일 처리, signal handling은 운영 안정성 영역이라 GPT-5.5 high 검토가 적합했다. | Node wrapper, line-buffer redaction, Windows `taskkill`, `.tmp/dev` redacted file log, preflight 검증을 권고했다.         |

Spark는 사용하지 않았다. 이번 작업은 secret/log/security/devops 범위라 하네스 기준 Spark 금지 또는 부적합 범위다.

## 3. 작업 분해 및 상태

| Task | 내용                                                        | 상태 |
| ---- | ----------------------------------------------------------- | ---- |
| T1   | MCP/harness/model-routing/report-format 확인                | 완료 |
| T2   | 보안/운영 subagent 자동 위임                                | 완료 |
| T3   | 기존 managed E2E redaction 구조 확인                        | 완료 |
| T4   | redaction helper를 `scripts/support` 공용 위치로 승격       | 완료 |
| T5   | root/API/Web dev server를 실행하는 redacted dev runner 추가 | 완료 |
| T6   | `dev`, `dev:web`, `dev:api`를 wrapper 기본값으로 전환       | 완료 |
| T7   | dev runner preflight unit test 추가                         | 완료 |
| T8   | 실제 `pnpm dev` smoke, artifact secret scan, 전체 회귀 검증 | 완료 |
| T9   | 운영 문서와 완료 보고서 갱신                                | 완료 |

## 4. 작업 전/후 변동률

| Phase / Task                     | 작업 전 | 작업 후 | 변동률 | 판단 근거                                                                                     |
| -------------------------------- | ------: | ------: | -----: | --------------------------------------------------------------------------------------------- |
| Manual dev log wrapper hardening |     10% |     88% |  +78%p | root dev가 raw pnpm parallel에서 redacted Node wrapper로 전환됐다.                            |
| Dev log secret-safe default      |     15% |     90% |  +75%p | `dev`, `dev:web`, `dev:api` 모두 stdout/stderr를 line-buffered redaction 후 출력한다.         |
| Dev file log hygiene             |     20% |     85% |  +65%p | `.tmp/dev/psms-dev-current.log`에는 redacted output만 기록되고 artifact scan 대상에 포함된다. |
| Shared redaction contract        |     40% |     95% |  +55%p | E2E helper가 `scripts/support` 공용 helper를 re-export하게 정리됐다.                          |
| Credential token slice 전체      |     92% |     93% |   +1%p | token-holder 자체보다 운영 로그 노출면을 추가로 줄인 작업이다.                                |
| Release hardening evidence       |     68% |     73% |   +5%p | dev smoke, managed E2E, artifact scan, build 증거가 누적됐다.                                 |

## 5. 변경 파일

| 파일                                                                     | 변경 내용                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `scripts/support/credential-log-redaction.mjs`                           | dev/E2E 공용 redaction helper 추가                                                                     |
| `scripts/dev-redacted-runner.mjs`                                        | API/Web dev server wrapper, line-buffered redaction, `.tmp/dev` file log, signal cleanup 추가          |
| `test/e2e/support/credential-log-redaction.mjs`                          | 기존 테스트 import 호환을 위한 공용 helper re-export로 변경                                            |
| `test/unit/dev-redacted-runner.test.mjs`                                 | dev runner preflight, API-only/Web-only, 충돌 옵션 테스트 추가                                         |
| `package.json`                                                           | `dev`, `dev:web`, `dev:api`를 wrapper로 전환하고 `dev:preflight`, `test:unit:dev-redacted-runner` 추가 |
| `docs/00_system/credential-token-url-log-redaction.md`                   | 일반 dev log 정책과 구현 위치 갱신                                                                     |
| `docs/80_ai_harness/manual-dev-log-wrapper-hardening-report-20260507.md` | 이번 작업 완료 보고서 추가                                                                             |

## 6. 검증 결과

| 검증                                      | 결과 | 근거                                                                  |
| ----------------------------------------- | ---- | --------------------------------------------------------------------- |
| `pnpm test:unit:credential-log-redaction` | 통과 | 7 tests passed                                                        |
| `pnpm test:unit:dev-redacted-runner`      | 통과 | 3 tests passed                                                        |
| `pnpm dev:preflight`                      | 통과 | API 4273/Web 5273 free, `canRun: true`                                |
| `pnpm dev` smoke                          | 통과 | API `/health`, Web `/login` 응답 확인 후 taskkill cleanup             |
| `pnpm test:e2e:artifact-secret-scan`      | 통과 | 91 text files scanned, 58 binary artifacts skipped                    |
| `.tmp/**/*.log` secret grep               | 통과 | 테스트 password/raw token/credential cookie/Bearer pattern match 없음 |
| `pnpm format:check`                       | 통과 | Prettier check 통과                                                   |
| `pnpm typecheck`                          | 통과 | shared/db/api/web TypeScript 통과                                     |
| `pnpm lint`                               | 통과 | API tsc lint, Web eslint 통과                                         |
| `pnpm test`                               | 통과 | unit/API inject 전체 통과                                             |
| `pnpm db:validate`                        | 통과 | Prisma schema valid                                                   |
| `pnpm build`                              | 통과 | Next production build 포함 통과                                       |
| `pnpm test:e2e:managed`                   | 통과 | 48 passed                                                             |
| `git diff --check`                        | 통과 | whitespace error 없음                                                 |

## 7. Auth / DB / API Contract 변경 여부

| 영역                  | 변경 여부 | 비고                                                 |
| --------------------- | --------: | ---------------------------------------------------- |
| Auth/session behavior |        No | 로그인/session/permission runtime 동작 변경 없음     |
| Secret/log handling   |       Yes | 일반 dev 실행 경로까지 redaction 기본값으로 전환     |
| DB                    |        No | Prisma schema/migration 변경 없음                    |
| API contract          |        No | Fastify route/shared ActionResult contract 변경 없음 |
| UI                    |        No | 화면 문구/레이아웃 변경 없음                         |

## 8. 이슈 및 해결

| 이슈                                                    | 원인                                                                  | 해결                                                                      | 재발 방지                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| root `pnpm dev`가 raw child output을 직접 노출          | 기존 script가 `pnpm -r --parallel ... dev`를 직접 실행했다.           | `scripts/dev-redacted-runner.mjs`를 기본 dev script로 전환했다.           | `dev:web`, `dev:api`도 같은 wrapper를 사용한다.                                  |
| E2E helper 위치가 테스트 전용이었다                     | 일반 dev script가 테스트 경로 helper를 직접 의존하면 구조가 어색하다. | helper를 `scripts/support`로 승격하고 테스트 경로는 re-export로 유지했다. | dev/E2E가 같은 redaction contract를 공유한다.                                    |
| Windows child cleanup 필요                              | `child.kill()`만으로 process tree가 남을 수 있다.                     | Windows는 `taskkill /pid <pid> /t /f`를 사용한다.                         | `SIGINT`, `SIGTERM`, `SIGHUP`, error/rejection 경로를 같은 cleanup으로 통합했다. |
| build 이후 dev 실행이 `next-env.d.ts`를 dev 경로로 바꿈 | Next dev server가 generated type reference를 바꾼다.                  | build 기준 reference로 되돌리고 `pnpm typecheck`를 재실행했다.            | dev/managed E2E 후 status에서 generated type 변경을 확인한다.                    |

## 9. 남은 리스크

| 리스크                                                           | 영향도 | 대응                                                        |
| ---------------------------------------------------------------- | -----: | ----------------------------------------------------------- |
| 진단 목적으로 shell redirect를 직접 쓰면 wrapper 밖이 될 수 있음 |   중간 | 공식 안내는 `pnpm dev` wrapper만 사용하도록 고정            |
| production reverse proxy/CDN/APM access log는 dev wrapper 밖     |   중간 | 다음 release gate에서 query/cookie/body scrubber 확인       |
| delivery webhook 수신 서버는 raw token 외부 경계                 |   중간 | 수신 서버 body/header/access log 저장 금지 계약과 검증 필요 |

## 10. Phase별 진행률 재산정

| Phase | 원본 목표              | 현재 상태                                                             | 완료율 |
| ----: | ---------------------- | --------------------------------------------------------------------- | -----: |
|     0 | 프로젝트 초기화        | workspace/script/검증 하네스와 안전 dev runner가 안정화됨             |    94% |
|     1 | 디자인 시스템/레이아웃 | shell과 주요 컴포넌트 기반 완료, 세부 화면 완성도는 후속              |    67% |
|     2 | 인증/RBAC              | login/session/admin guard와 credential token 보안 slice가 유지·보강됨 |    76% |
|     3 | 데이터 모델/Seed       | credential token migration/DB contract 포함. 운영 seed 보강은 남음    |    82% |
|     4 | 대시보드/리포트        | route placeholder 중심, 실제 KPI/query/chart 미완                     |    12% |
|     5 | 판매 관리/판매 등록    | placeholder 중심, transaction wizard 미완                             |     8% |
|     6 | 미수금/고객            | placeholder 중심, 수납/취소/상세 이력 미완                            |     8% |
|     7 | 일정/재고              | placeholder 중심, 캘린더/재고 상태 변경 미완                          |     8% |
|     8 | 관리자 설정            | staff credential API 기반은 진전, 화면 연결은 남음                    |    36% |
|     9 | Export/QA/운영 보강    | managed E2E, secret scan, safe dev runner, build 검증이 보강됨        |    55% |

## 11. 다음 작업 3단계 미리보기

| 순서 | 다음 작업                             | 담당 subagent                                            | 상세                                                                                                           |
| ---- | ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | Production env and log release gate   | `devops_sre_reviewer` + `release_reviewer`               | 필수 secret, reverse proxy/APM/cookie/body scrubber, artifact scan을 release checklist와 자동 검증에 연결한다. |
| 2    | Admin credential issue/revoke UX 연결 | `frontend_agent` + `backend_agent` + `security_reviewer` | 직원 관리 화면에서 activation/reset 발급/회수 UX를 연결하고 RBAC/AuditLog/secret 비노출 회귀를 검증한다.       |
| 3    | Delivery webhook operational contract | `security_reviewer` + `devops_sre_reviewer`              | raw token 외부 경계인 webhook 수신 서버의 HTTPS, body/header logging 금지, retry/failure 정책을 확정한다.      |
