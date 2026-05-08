# Credential Compensation Failure Cleanup Runbook

작성일: 2026-05-08

## 목적

credential delivery 성공 후 activation/rollback compensation transaction 자체가 실패하면
raw token은 외부 receiver에 전달됐지만 DB row는 `activeKey = null`, `usedAt = null`,
`revokedAt = null` 상태로 남을 수 있다.

이 상태의 token은 redeemable하지 않지만, 명시 revoke와 rollback AuditLog evidence가
없으므로 운영 추적상 `limbo token`으로 취급한다.

## 상태 정의

| 상태                | 조건                                                                                    | 처리                                               |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| In-flight token     | `activeKey IS NULL`, `usedAt IS NULL`, `revokedAt IS NULL`, 생성 직후 grace window 이내 | issue/delivery 처리 중일 수 있으므로 건드리지 않음 |
| Limbo token         | `activeKey IS NULL`, `usedAt IS NULL`, `revokedAt IS NULL`, grace window 초과           | 수동 조사 후 revoke + AuditLog                     |
| Expired limbo token | limbo 조건 + `expiresAt <= now`                                                         | 즉시 revoke + AuditLog 후보                        |
| Historical token    | `usedAt IS NOT NULL` 또는 `revokedAt IS NOT NULL`                                       | 변경 금지                                          |
| Redeemable token    | `activeKey IS NOT NULL`, `usedAt IS NULL`, `revokedAt IS NULL`, `expiresAt > now`       | 정상 active request 또는 admin revoke 대상         |

기본 grace window는 10분이다. delivery timeout 최대값, non-production retry, DB 지연을
합쳐도 충분히 지난 token만 limbo 후보로 본다.

## Alerting / Detection Triggers

아래 조건 중 하나라도 발생하면 release/operation 담당자가 runbook을 실행한다.

| Trigger                          | 기준                                                                   | 조치                                                  |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Limbo scan count                 | 10분 grace window 초과 limbo token `> 0`                               | 즉시 조사 및 cleanup ticket 생성                      |
| Compensation error               | delivery 성공 이후 rollback/compensation transaction error             | API log와 DB 상태 대조                                |
| Prisma conflict spike            | post-delivery `P2002` 또는 `P2034` 증가                                | rollback audit row와 delivered token revoke 여부 확인 |
| Webhook 2xx + activation failure | receiver 2xx 이후 API가 activation conflict 또는 rollback failure 기록 | delivery id/token id 대조                             |
| Rollback audit spike             | `ADMIN_STAFF_*_DELIVERY_ROLLED_BACK`가 평시보다 급증                   | receiver/idempotency/DB contention 점검               |

자동 알림이 없더라도 release candidate 검증 시에는 아래 탐지 SQL을 수동으로 실행해 row
count를 release report에 기록한다.

## 탐지 SQL

SQLite 기준:

```sql
SELECT
  id,
  userId,
  purpose,
  createdById,
  createdAt,
  expiresAt,
  ipAddress,
  userAgent
FROM UserPasswordToken
WHERE activeKey IS NULL
  AND usedAt IS NULL
  AND revokedAt IS NULL
  AND datetime(createdAt) <= datetime('now', '-10 minutes')
ORDER BY createdAt ASC;
```

PostgreSQL 기준:

```sql
SELECT
  id,
  "userId",
  purpose,
  "createdById",
  "createdAt",
  "expiresAt",
  "ipAddress",
  "userAgent"
FROM "UserPasswordToken"
WHERE "activeKey" IS NULL
  AND "usedAt" IS NULL
  AND "revokedAt" IS NULL
  AND "createdAt" <= now() - interval '10 minutes'
ORDER BY "createdAt" ASC;
```

쿼리 결과에는 `tokenHash`를 포함하지 않는다. raw token은 DB에 저장되지 않으며, receiver
또는 로그에서 조회/복구하려고 시도하지 않는다.

DB 무결성 확인용 orphan scan:

```sql
SELECT
  t.id,
  t.userId,
  t.purpose,
  t.createdAt,
  t.activeKey,
  t.usedAt,
  t.revokedAt
FROM UserPasswordToken t
LEFT JOIN User u ON u.id = t.userId
WHERE u.id IS NULL;
```

정상 운영에서는 `UserPasswordToken.userId`가 restricted foreign key라 orphan row가
생기지 않아야 한다. row가 발견되면 routine cleanup이 아니라 DB integrity incident로
처리한다.

## 조사 절차

1. 관련 release/runbook window를 확인한다.
   - delivery webhook outage
   - API error spike
   - Prisma `P2002`, `P2034`, timeout, DB unavailable 로그
2. `AuditLog`에서 같은 `tokenId`가 있는지 확인한다.
   - `ADMIN_STAFF_*_ISSUED`
   - `ADMIN_STAFF_*_DELIVERY_FAILED`
   - `ADMIN_STAFF_*_DELIVERY_ROLLED_BACK`
   - `ADMIN_STAFF_*_REVOKED`
3. audit row가 없거나 rollback audit가 누락됐으면 compensation failure로 기록한다.
4. receiver log는 delivery id, attempt count, HTTP status만 확인한다.
   - request body, raw token, Authorization header를 열람하거나 저장하지 않는다.
5. 같은 user/purpose의 현재 redeemable token 수를 확인한다.
   - 정상 active token이 있으면 limbo token cleanup이 active request를 방해하지 않는다.
   - active token이 없어도 limbo token은 redeemable하지 않으므로 cleanup 대상이다.

## Cleanup 절차

우선 앱 내부 audited cleanup command를 dry-run으로 실행한다.

```powershell
pnpm ops:credential-compensation-cleanup
```

confirmed cleanup은 dry-run 결과의 token id와 expected count, active ADMIN actor,
operator, ticket id를 명시해야 한다.

```powershell
pnpm ops:credential-compensation-cleanup --confirm --token-id <limbo-token-id> --expected-count 1 --actor-user-id <admin-user-id> --operator <operator-name> --ticket-id <ticket-id>
```

SQLite command output에는 resolved DB path가 포함된다. PostgreSQL profile에서는 full DSN이
아니라 redacted DB identifier만 evidence에 남긴다. 운영자는 dry-run/confirm 전에 해당 DB
identifier가 백업 대상 DB와 일치하는지 확인한다.

직접 SQL cleanup은 command를 사용할 수 없는 incident 상황에서만 사용한다. 이 경우에도
createdAt cutoff guard를 포함해야 한다.

SQLite emergency SQL:

```sql
UPDATE UserPasswordToken
SET
  revokedAt = CURRENT_TIMESTAMP,
  revokedById = NULL,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = '<limbo-token-id>'
  AND activeKey IS NULL
  AND usedAt IS NULL
  AND revokedAt IS NULL
  AND datetime(createdAt) <= datetime('now', '-10 minutes');
```

PostgreSQL emergency SQL:

```sql
UPDATE "UserPasswordToken"
SET
  "revokedAt" = now(),
  "revokedById" = NULL,
  "updatedAt" = now()
WHERE id = '<limbo-token-id>'
  AND "activeKey" IS NULL
  AND "usedAt" IS NULL
  AND "revokedAt" IS NULL
  AND "createdAt" <= now() - interval '10 minutes';
```

수동 revoke 뒤 AuditLog를 반드시 남긴다. 현재 운영 DB 직접 정리 단계에서는 아래 필드를
release/incident report에 기록하고, 앱 내부 cleanup command가 생기기 전까지 SQL과
AuditLog insert는 같은 운영 변경 티켓으로 관리한다.

운영 cleanup은 같은 DB transaction 안에서 token revoke와 AuditLog insert가 함께
성공해야 한다. 이 원자성을 보장할 수 없으면 cleanup을 보류하고 audited cleanup command를
먼저 구현한다.

cleanup transaction은 다음 guard를 지켜야 한다.

1. cleanup 전에 DB 백업과 dry-run row 목록을 만든다.
2. 같은 transaction 안에서 exact predicate로 대상 row를 다시 조회한다.
3. update affected row count가 dry-run target count와 다르면 rollback한다.
4. `usedAt IS NOT NULL`, `revokedAt IS NOT NULL`, `activeKey IS NOT NULL` row는 변경하지 않는다.
5. rollback은 token re-activation이 아니라 DB 백업 복구를 원칙으로 한다.

AuditLog action:

```txt
ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP
```

AuditLog `afterJson` 최소 필드:

```json
{
  "tokenId": "<limbo-token-id>",
  "userId": "<target-user-id>",
  "purpose": "STAFF_ACTIVATION",
  "cleanupReason": "COMPENSATION_FAILURE_LIMBO_TOKEN",
  "detectionWindowMinutes": 10,
  "hadActiveKey": false,
  "hadUsedAt": false,
  "hadRevokedAt": false,
  "operator": "<operator-name>",
  "ticketId": "<ticket-id>"
}
```

금지 필드:

- raw token
- token hash
- activation/reset URL
- password, confirm password, password hash
- session token/hash
- Cookie, Set-Cookie, Authorization
- webhook request body

## 릴리즈 게이트 적용

릴리즈 후보 또는 credential delivery 장애 이후 release report에는 다음 evidence를 포함한다.
artifact naming, JSON shape, reviewer checklist는
`docs/60_release/credential-cleanup-release-evidence-template.md`를 따른다.

| Gate              | Evidence                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| Limbo token scan  | 위 탐지 SQL 결과 row count. 0이면 PASS                                 |
| Cleanup ticket    | row가 있으면 cleanup ticket id, token id 목록, operator                |
| AuditLog evidence | `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` row id                      |
| Secret scan       | `pnpm release:gate:logs` 결과                                          |
| Receiver check    | delivery id/status만 확인했고 raw body/header를 저장하지 않았다는 확인 |

수동 확인이 비어 있으면 `pnpm release:gate`가 통과해도 최종 릴리즈는 PASS로 판정하지 않는다.
limbo token scan row count가 `0`이면 cleanup confirm과 AuditLog evidence는
`N/A-NoRows`로 기록할 수 있다. row count가 `> 0`인데 cleanup confirm 또는 AuditLog
evidence가 없으면 release readiness는 `BLOCK`이다.

## Validation Commands

credential delivery 또는 compensation cleanup 관련 변경 후 최소 아래 명령을 실행한다.

```powershell
pnpm test:unit:credential-delivery
pnpm test:unit:production-release-gate
pnpm test:e2e:credential-token
pnpm release:gate:prod-env
pnpm release:gate:logs
pnpm release:gate
```

문서만 변경한 경우에도 `pnpm test:unit:production-release-gate`, `pnpm release:gate:logs`,
`pnpm format:check`를 실행한다.

## Release Readiness

이 runbook의 limbo token scan 또는 cleanup evidence가 비어 있으면 release readiness는
BLOCK이다. `pnpm release:gate`가 통과해도 security/release reviewer가 수동 evidence를
확인하기 전까지 Electron/production release 후보를 PASS로 올리지 않는다.

PostgreSQL 운영 DB를 사용하는 release 후보는
`docs/60_release/postgresql-credential-cleanup-rehearsal-profile.md`의 evidence도 PASS여야
한다. SQLite-only Electron local release 후보는 해당 profile을 `N/A-SQLite-only`로 기록할
수 있지만, PostgreSQL production readiness로 간주하지 않는다.

## 자동화 보류 조건

아래 조건이 충족되기 전까지 자동 cleanup job은 만들지 않는다.

- 운영 DB 백업/복구 rehearsal 완료
- cleanup command가 AuditLog를 같은 transaction에 기록
- token id 목록 dry-run 출력과 explicit confirm 지원
- security/db reviewer 승인
- PostgreSQL profile에서 동일 query와 transaction behavior 검증

자동 cleanup이 도입되더라도 `usedAt IS NOT NULL` 또는 `revokedAt IS NOT NULL` row는 절대
변경하지 않는다.
