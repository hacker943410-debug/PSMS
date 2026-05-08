# Credential Token URL Log Redaction

작성일: 2026-05-07

## 목적

직원 계정 활성화와 비밀번호 재설정 raw token은 1회용 secret이다. 최초 링크
진입 시 URL query로 들어올 수 있지만, 앱 화면, DOM, client payload, 테스트 로그,
운영 로그에 원문이 남지 않도록 fail-safe 기준을 둔다.

## 적용 기준

| 영역              | 기준                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 최초 URL          | `/staff-activation?token=...`, `/password-reset?token=...`만 허용                                                                       |
| Web proxy         | `token` query를 httpOnly path-bound cookie로 옮긴 뒤 clean URL로 redirect                                                               |
| Browser           | redirect 후 현재 URL, DOM, body text, hidden input에 raw token을 남기지 않음                                                            |
| Dev logs          | Root `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`는 redacted dev runner를 기본값으로 사용                                                 |
| Managed E2E logs  | Web/API/Playwright child stdout/stderr의 완료된 log line을 출력 전 credential token/cookie/password/hash/Authorization 값으로 redaction |
| Completion marker | 완료 화면 표시용 marker cookie도 로그에서는 redaction                                                                                   |
| Server Action/API | token은 cookie/server boundary에서만 사용하고 client form field로 노출하지 않음                                                         |
| Delivery webhook  | raw token을 전송하는 의도된 외부 경계이므로 수신 측 body/header 로그 저장 금지                                                          |

## Redaction 대상

| 대상               | 예시                                | 출력                                     |
| ------------------ | ----------------------------------- | ---------------------------------------- |
| Query              | `?token=<raw>`                      | `?token=[REDACTED]`                      |
| Credential cookie  | `psms_staff_activation_token=<raw>` | `psms_staff_activation_token=[REDACTED]` |
| Reset cookie       | `psms_password_reset_token=<raw>`   | `psms_password_reset_token=[REDACTED]`   |
| Completion cookie  | `psms_*_completed=<marker>`         | `psms_*_completed=[REDACTED]`            |
| JSON body fallback | `"token":"<raw>"`                   | `"token":"[REDACTED]"`                   |
| Password field     | `"password":"<raw>"`                | `"password":"[REDACTED]"`                |
| Form body fallback | `token=<raw>&password=<raw>`        | `token=[REDACTED]&password=[REDACTED]`   |
| Authorization      | `Authorization: Bearer <secret>`    | `Authorization: Bearer [REDACTED]`       |

## 구현 위치

| 파일                                            | 역할                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web/src/proxy.ts`                         | token query를 clean URL과 httpOnly cookie로 전환하고 no-store/no-referrer header 적용  |
| `scripts/support/credential-log-redaction.mjs`  | dev/E2E 공용 redaction helper                                                          |
| `scripts/dev-redacted-runner.mjs`               | root/API/Web dev server를 line-buffered redaction 후 실행                              |
| `test/e2e/support/credential-log-redaction.mjs` | 테스트 경로 호환용 re-export helper                                                    |
| `test/e2e/managed-runner.mjs`                   | Web/API/Playwright child stdout/stderr를 line-buffered helper로 redaction 후 출력      |
| `test/unit/credential-log-redaction.test.mjs`   | query/cookie/body/chunk-split redaction 단위 검증                                      |
| `test/unit/dev-redacted-runner.test.mjs`        | dev runner preflight와 target selection 검증                                           |
| `test/e2e/artifact-secret-scan.mjs`             | `.tmp`, `.codex-logs`, `test-results`, `playwright-report`, `.psms-dev*.log` scan gate |
| `test/e2e/credential-token-browser.spec.ts`     | Browser URL/DOM/body/console/request failure secret leak 검증                          |
| `.gitignore`                                    | `.psms-dev*.log` 수동 개발 로그 커밋 방지                                              |

## 남은 운영 Gate

로컬 managed runner 로그는 redaction된다. 다만 production reverse proxy, CDN, APM,
웹 서버 access log가 query string을 별도로 기록하는 경우 앱 내부 helper로는 차단할
수 없다. 릴리즈 전 다음 항목을 별도 운영 gate로 확인한다.

| 항목                     | 권장 기준                                                                     |
| ------------------------ | ----------------------------------------------------------------------------- |
| Reverse proxy access log | credential route의 query string 제외 또는 `token` query redaction             |
| APM/trace capture        | request URL query와 cookie capture 비활성화 또는 allowlist 방식               |
| Error reporting          | request headers/cookies/body를 기본 수집하지 않도록 scrubber 적용             |
| Browser history          | 앱은 즉시 clean URL로 redirect하며, 외부 mail/SMS preview 로그는 별도 관리    |
| Delivery webhook         | 수신 서버 request body, Authorization header, raw URL 로그 저장 금지          |
| Raw dev output           | 기본 script에서 raw child output 직접 연결 금지. 진단 시에도 산출물 scan 필수 |
