# Production Env And Log Release Gate

작성일: 2026-05-07

이 문서는 PSMS 릴리즈 후보에서 production env와 로그/아티팩트 secret 노출을 확인하는 게이트를 정의한다.

## 판정

| 판정  | 의미                                                                 |
| ----- | -------------------------------------------------------------------- |
| PASS  | `pnpm release:gate` 통과 및 수동 로그 보존/스크러빙 확인 완료        |
| BLOCK | env gate 실패, artifact secret scan 실패, 또는 수동 로그 검증 미완료 |
| NO-GO | Web/API MVP, 업무 E2E, Electron smoke 등 상위 릴리즈 조건 미충족     |

현 시점의 전체 릴리즈 판정은 NO-GO다. 이 게이트는 production env/log 하위 게이트만 다룬다.

## 실행 명령

릴리즈 후보 env가 현재 shell에 주입되어 있거나 `PSMS_RELEASE_ENV_FILE` 또는 `--env-file`로 전달되어야 한다.

```powershell
pnpm release:gate:prod-env
pnpm release:gate:logs
pnpm release:gate
```

`release:gate:prod-env`는 `scripts/production-release-gate.mjs`를 실행한다.

`release:gate:logs`는 `test/e2e/artifact-secret-scan.mjs`를 실행한다.

## Env Gate

`scripts/production-release-gate.mjs`는 다음 조건을 fail-closed로 확인한다.

| 영역                   | 필수 조건                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | `NODE_ENV=production`                                                                                                                         |
| Host/Port              | `WEB_HOST=127.0.0.1`, `API_HOST=127.0.0.1`, `WEB_PORT=5273`, `API_PORT=4273`                                                                  |
| URL                    | `APP_URL=http://127.0.0.1:5273`, `PSMS_API_URL=http://127.0.0.1:4273`                                                                         |
| Auth bypass            | `PSMS_DEV_AUTH_BYPASS=true` 금지                                                                                                              |
| Secrets                | `AUTH_SECRET`, `PASSWORD_TOKEN_SECRET`, `CREDENTIAL_COMPLETION_SECRET` 필수, 32 bytes 이상, placeholder 금지, 서로 다른 값                    |
| Rate limit             | login/credential/admin credential store는 `file`, 파일 경로는 절대 경로, workspace와 test artifact 디렉터리 밖                                |
| Credential delivery    | 구성 시 `OUT_OF_BAND_APPROVED`, webhook URL은 credentials/query/hash 없는 production `https://`, webhook secret 필수 및 다른 secret과 다른 값 |
| Delivery timeout/retry | timeout env는 설정 시 `1000..5000ms`, max attempts는 receiver idempotency contract 승인 전까지 `1`                                            |

성공/실패 출력은 JSON이며 `ok`, `code`, `stage`, `checked`, `failures`를 포함한다. 실패 출력은 secret 값을 포함하지 않고 env key와 실패 사유만 남긴다.

## Log Gate

`test/e2e/artifact-secret-scan.mjs`는 build, E2E, dev runner 이후 남는 다음 위치에서 raw token/password/cookie/header 노출을 확인한다.

| 범위          | 예시                                |
| ------------- | ----------------------------------- |
| 임시 아티팩트 | `.tmp`, `.codex-logs`               |
| 테스트 결과   | `test-results`, `playwright-report` |
| dev 로그      | `.psms-dev*.log`                    |

스캔 실패는 즉시 release BLOCK이다. raw secret/token 노출이 확인되면 secret rotation, credential token invalidation, 관련 로그/아티팩트 격리 또는 폐기 여부를 release report에 기록한다.

## Manual Checks

자동 게이트 외에 release report에 다음 수동 확인을 기록한다.

| 항목                  | 확인 내용                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Reverse proxy/CDN/APM | credential route query string, request body, Cookie, Set-Cookie, Authorization header 저장 금지 또는 scrubber 적용 |
| Webhook receiver      | request body, raw token, Authorization header 저장 금지. retry/dedupe를 켜기 전 receiver idempotency contract 확인 |
| Rollback              | secret rotation, credential token invalidation, 로그/아티팩트 quarantine 절차                                      |
| Evidence              | 실행 명령, 결과 JSON, DB 경로, 백업 경로, smoke 결과                                                               |

수동 확인이 비어 있으면 `pnpm release:gate`가 통과해도 최종 릴리즈는 PASS로 판정하지 않는다.

### Webhook Receiver Idempotency Contract

`PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS`는 production/release 후보에서 `1`을
유지한다. 아래 receiver idempotency contract가 security/release review에서 승인되기
전까지 production retry를 켜지 않는다.

| 항목                 | 승인 조건                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Auth                 | `Authorization: Bearer <secret>` 필수, 값은 저장/로그 금지                                |
| Dedupe key           | `X-PSMS-Delivery-Id`를 유일한 dedupe key로 사용                                           |
| Attempt header       | `X-PSMS-Delivery-Attempt`는 진단용 숫자로만 사용하고 dedupe key에 포함하지 않음           |
| Duplicate success    | 이미 성공 처리한 delivery id가 다시 들어오면 재전달/중복 알림 없이 2xx 반환               |
| Atomic persistence   | delivery id 저장과 receiver-side notification 상태 변경은 원자적으로 처리                 |
| Retention            | delivery id dedupe record TTL은 credential token expiry보다 길고 운영 정책에 기록         |
| Logging              | request body, raw token, Authorization value 저장 금지                                    |
| Allowlisted metadata | delivery id, attempt count/status, timestamp, failure class만 저장                        |
| Response contract    | 2xx는 수신 완료, 4xx는 재시도 불가 설정 오류, 429/5xx/timeout은 non-production retry 후보 |
| Evidence             | 동일 delivery id 반복 요청, 동시 요청, 성공 후 재요청, 실패 후 재요청 테스트 결과를 첨부  |

릴리즈 보고서에는 receiver owner, 승인자, 승인 시간, evidence artifact 경로, retry 설정값,
rollback 담당자를 기록한다. 이 증거가 없으면 retry rollout은 BLOCK이다.

### Manual Evidence Template

release report는 최소 아래 표를 채운다.

| Gate                 | Owner | Evidence artifact | Result | Time | Notes |
| -------------------- | ----- | ----------------- | ------ | ---- | ----- |
| Env gate JSON        |       |                   |        |      |       |
| Artifact secret scan |       |                   |        |      |       |
| Reverse proxy scrub  |       |                   |        |      |       |
| CDN/APM scrub        |       |                   |        |      |       |
| Webhook receiver log |       |                   |        |      |       |
| Receiver idempotency |       |                   |        |      |       |
| DB path/backup path  |       |                   |        |      |       |
| Smoke results        |       |                   |        |      |       |
| Rollback rehearsal   |       |                   |        |      |       |

## Incident / Rollback

credential delivery 또는 secret/log 노출 이상 징후가 있으면 릴리즈를 즉시 중단하고 다음
순서로 stop-the-line 처리한다.

1. Delivery를 중지한다. `PSMS_CREDENTIAL_DELIVERY_MODE`를 제거하거나 webhook endpoint를
   격리하고, retry 값은 `PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS=1`로 되돌린다.
2. Webhook secret을 폐기하고 새 secret으로 rotation한다. 노출 가능성이 있는
   `AUTH_SECRET`, `PASSWORD_TOKEN_SECRET`, `CREDENTIAL_COMPLETION_SECRET`도 영향 범위에
   따라 rotation한다.
3. 미사용 active credential token을 invalidation한다. 재발급은 receiver/log 상태가
   확인된 뒤에만 수행한다.
4. `.tmp`, `.codex-logs`, `test-results`, `playwright-report`, `.psms-dev*.log`와 외부
   proxy/CDN/APM/receiver 로그를 quarantine하거나 폐기한다.
5. duplicate delivery 또는 duplicate completion 여부를 DB와 Audit Log에서 확인한다.
6. 필요 시 릴리즈 후보 DB를 백업본으로 복구하고 migration 상태를 재확인한다.
7. `pnpm release:gate:prod-env`, `pnpm release:gate:logs`, 관련 API smoke를 재실행하고
   결과 JSON과 담당자 승인을 release report에 첨부한다.
