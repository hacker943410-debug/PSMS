# Electron Release Checklist

작성일: 2026-05-01

Electron은 Web/API MVP와 화면별 디자인 게이트, E2E가 통과한 뒤 활성화한다. 초기 릴리즈는 단일 PC 로컬 앱형이며 SQLite를 사용한다.

## Prerequisites

| 항목                                | 상태 |
| ----------------------------------- | ---- |
| Web/API MVP 기능 완료               | ⬜   |
| 주요 화면 디자인 게이트 통과        | ⬜   |
| `pnpm format:check` 통과            | ⬜   |
| `pnpm lint` 통과                    | ⬜   |
| `pnpm typecheck` 통과               | ⬜   |
| `pnpm db:validate` 통과             | ⬜   |
| `pnpm build` 통과                   | ⬜   |
| `pnpm release:gate` 통과            | ⬜   |
| Production env/log gate 증거 기록   | ⬜   |
| ADMIN/STAFF E2E 통과                | ⬜   |
| 판매 등록 E2E 통과                  | ⬜   |
| 수납 등록/취소 E2E 통과             | ⬜   |
| 앱 재시작 후 데이터 유지 smoke 통과 | ⬜   |

## Runtime Rules

- Electron은 로컬 Web `http://127.0.0.1:5273`와 API `http://127.0.0.1:4273`를 실행해 감싼다.
- 개발 중 DB는 `file:./dev.db`를 사용한다.
- 패키징 후 DB는 Electron `userData` 경로의 `psms.db`를 사용한다.
- 앱 시작 시 DB 파일 존재 여부, migration 상태, 백업 가능 여부를 확인한다.
- renderer에는 Node 권한을 주지 않는다.
- preload IPC만 허용한다.
- auth/session/RBAC, DB schema, 판매/수납/정책 로직은 Electron 단계에서 재작성하지 않는다.
- production/release 후보는 `AUTH_SECRET`, `PASSWORD_TOKEN_SECRET`,
  `CREDENTIAL_COMPLETION_SECRET`을 모두 강한 값으로 설정하고 서로 재사용하지 않는다.
- production/release 후보에서 `PSMS_DEV_AUTH_BYPASS=true`는 금지한다.
- credential delivery webhook을 켜는 경우 URL은 `https://`만 허용하고 webhook secret은
  필수이며 다른 secret과 달라야 한다.
- credential delivery webhook URL에는 credentials, query string, fragment,
  local/test/example host를 사용하지 않는다.
- credential delivery retry는 receiver idempotency contract가 승인되기 전까지
  production/release 후보에서 비활성화한다. max attempts는 `1`을 유지한다.
- receiver idempotency contract는 `X-PSMS-Delivery-Id`를 dedupe key로 사용하고
  `X-PSMS-Delivery-Attempt`를 진단용으로만 사용한다.
- receiver는 같은 delivery id를 이미 성공 처리했다면 재전달/중복 알림 없이 2xx를
  반환해야 한다.
- reverse proxy/CDN/APM/error reporting은 credential route query string, request
  body, Cookie, Set-Cookie, Authorization header를 저장하지 않거나 scrubber를 적용한다.
- credential compensation failure cleanup은
  `docs/60_release/credential-compensation-failure-cleanup-runbook.md`를 따르며,
  release report에 limbo token scan 결과와 cleanup evidence를 기록한다.

## Env / Log Gate

릴리즈 후보는 다음 명령을 통과해야 한다.

```powershell
pnpm release:gate:prod-env
pnpm release:gate:logs
pnpm release:gate
```

검증 범위:

1. `scripts/production-release-gate.mjs`가 `NODE_ENV=production`, host/port,
   local URL, 필수 secret, dev bypass, rate-limit store/file, delivery webhook
   HTTPS/secret을 확인한다.
2. `test/e2e/artifact-secret-scan.mjs`가 `.tmp`, `.codex-logs`, `test-results`,
   `playwright-report`, `.psms-dev*.log`에서 raw token/password/cookie/header 노출을
   확인한다.
3. credential delivery receiver가 raw token/body/Auth header를 저장하지 않고
   `X-PSMS-Delivery-Id` dedupe contract를 지키는지 확인한다.
4. credential compensation failure cleanup runbook 기준 limbo token scan 결과를
   기록한다.
5. production reverse proxy, CDN, APM, error reporting의 query/body/header/cookie
   scrubber는 자동 검증 밖의 수동 release gate로 기록한다.

상세 운영 기준은 `docs/60_release/production-env-and-log-release-gate.md`를 따른다.

잘못된 secret 또는 raw token 노출이 발견되면 즉시 릴리즈를 중단하고 secret rotation,
credential token invalidation, 관련 로그/artifact 격리 또는 폐기 여부를 release report에
기록한다.

## Smoke Test

릴리즈 후보는 최소 다음을 확인한다.

1. 앱 실행
2. local port 점유 충돌 감지
3. API `/health` 통과
4. 로그인
5. 주요 메뉴 진입
6. 판매 등록
7. 수납 등록
8. 앱 재시작
9. 데이터 유지 확인
10. 로그/백업 위치 확인

## Release Report

릴리즈 보고에는 다음을 포함한다.

- 빌드 산출물 경로
- 실행 환경
- 사용 DB 경로
- 실행한 검증 명령
- smoke 결과
- known issues
- rollback/backup 절차
