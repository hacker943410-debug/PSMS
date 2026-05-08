# PostgreSQL Credential Cleanup Rehearsal Profile

작성일: 2026-05-08

## 목적

`ops:credential-compensation-cleanup` command는 SQLite 개발 DB에서 unit 검증을 통과했지만,
운영 DB 후보인 PostgreSQL에서는 migration provider, nullable unique, transaction
isolation, affected-count behavior를 별도로 검증해야 한다.

이 문서는 PostgreSQL 전환 또는 PostgreSQL 기반 production profile 승인 전에 필요한
rehearsal 절차와 PASS/BLOCK 기준을 정의한다. 현재 repository의 Prisma datasource는
`provider = "sqlite"`이므로 이 문서는 즉시 실행 완료된 결과가 아니라 PostgreSQL profile
준비 전 release gate이다.

## 현재 판정

| 항목                            | 판정  | 근거                                                         |
| ------------------------------- | ----- | ------------------------------------------------------------ |
| SQLite cleanup command          | PASS  | `pnpm test:unit:credential-compensation-cleanup` 통과        |
| PostgreSQL execution rehearsal  | BLOCK | PostgreSQL datasource/profile과 generated client가 아직 없다 |
| Production PostgreSQL readiness | BLOCK | 아래 evidence가 채워지기 전까지 PASS 금지                    |

SQLite-only Electron local release 후보에서는 이 profile을 `N/A-SQLite-only`로
기록할 수 있다. 단, PostgreSQL을 운영 DB로 사용하는 release 후보에서는 N/A가 허용되지
않는다.

## 사전 조건

| 조건                      | 설명                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| Disposable PostgreSQL DB  | 운영 데이터와 분리된 임시 DB. 백업/복구 rehearsal과 별도                          |
| PostgreSQL Prisma profile | `provider = "postgresql"` schema/profile, matching generated client, adapter 검증 |
| Migration rehearsal       | 현재 SQLite schema와 동등한 PostgreSQL migration apply 완료                       |
| Strong test secrets       | raw credential token이 아닌 테스트 전용 secret                                    |
| AuditLog visibility       | `AuditLog` row 조회와 JSON evidence 검증 가능                                     |

현재 `packages/db/prisma/schema.prisma`는 SQLite provider이므로, 이 사전 조건이 없으면
PostgreSQL rehearsal은 BLOCK으로 기록한다. PostgreSQL profile/client를 추가하기 전에는
`docs/60_release/postgresql-prisma-profile-preflight.md`의 분리 원칙과 PASS/BLOCK 기준을
먼저 통과해야 한다.

## Rehearsal Data Set

PostgreSQL 임시 DB에 최소 아래 row를 준비한다.

| row                | 조건                                                                               | 기대          |
| ------------------ | ---------------------------------------------------------------------------------- | ------------- |
| old limbo          | `activeKey NULL`, `usedAt NULL`, `revokedAt NULL`, `createdAt <= now - 10 minutes` | dry-run 후보  |
| young in-flight    | null 상태 동일, `createdAt > now - 10 minutes`                                     | 제외          |
| active token       | `activeKey NOT NULL`, `usedAt NULL`, `revokedAt NULL`                              | 제외          |
| used token         | `usedAt NOT NULL`                                                                  | 제외          |
| revoked token      | `revokedAt NOT NULL`                                                               | 제외          |
| expired limbo      | limbo 상태 + `expiresAt <= now`                                                    | dry-run 후보  |
| active ADMIN actor | `role ADMIN`, `status ACTIVE`                                                      | confirm actor |
| STAFF actor        | `role STAFF`, `status ACTIVE`                                                      | confirm 거부  |

테스트 데이터와 결과 artifact에는 `tokenHash`, raw token, reset/activation URL,
password, Cookie, Authorization header를 포함하지 않는다.

## Dry-run 검증

현재 root `ops:credential-compensation-cleanup` command는 SQLite build에서 non-SQLite URL을
fail-closed로 막는다. PostgreSQL Prisma profile/client가 추가되면 같은 safety contract를
유지하는 PG-capable command로 아래 dry-run을 임시 DB에 대해 실행한다.

```powershell
pnpm ops:credential-compensation-cleanup --database-url "<postgres-url>"
```

PASS 조건:

- output의 `database.provider = postgresql`과 redacted `database.identifier`가 임시
  PostgreSQL DB를 가리킨다.
- output에는 full PostgreSQL DSN, username, password, query string, connection secret이
  없어야 한다.
- `candidates`에는 old limbo와 expired limbo만 포함된다.
- young/active/used/revoked row는 제외된다.
- output에 `tokenHash`, raw token, URL, password, Cookie, Authorization 문자열이 없다.
- `cleanedTokenIds`와 `auditLogIds`는 dry-run에서 빈 배열이다.

## Confirm 검증

dry-run에서 확인한 old limbo token id만 명시해 confirm을 실행한다.

```powershell
pnpm ops:credential-compensation-cleanup --database-url "<postgres-url>" --confirm --token-id <old-limbo-id> --expected-count 1 --actor-user-id <active-admin-id> --operator <operator-name> --ticket-id <ticket-id>
```

PASS 조건:

- selected old limbo row의 `revokedAt`과 `revokedById`가 설정된다.
- active/used/revoked/young in-flight row는 변경되지 않는다.
- `AuditLog`는 같은 transaction 안에서 1 row 생성된다.
- `AuditLog.action = ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP`.
- `AuditLog.entityType = User`, `entityId = target user id`.
- `afterJson`에는 `tokenId`, `userId`, `purpose`, `cleanupReason`,
  `detectionWindowMinutes`, `hadActiveKey`, `hadUsedAt`, `hadRevokedAt`,
  `operator`, `ticketId`, `revokedAt`만 필요한 범위로 포함된다.
- output과 AuditLog에 금지 credential material이 없다.

## Rollback / Conflict 검증

아래 negative case 중 하나라도 실패하면 PostgreSQL readiness는 BLOCK이다.

| Case                                                              | 기대                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `--expected-count`가 실제 후보 수와 다름                          | transaction rollback, token/audit 변경 없음           |
| requested token id가 confirm 직전 active/used/revoked 상태로 변함 | target mismatch, rollback                             |
| `--actor-user-id`가 STAFF 또는 inactive user                      | 거부, token/audit 변경 없음                           |
| `--detection-window-minutes 9 --confirm`                          | 거부                                                  |
| AuditLog insert 실패 또는 constraint error                        | token revoke rollback                                 |
| concurrent cleanup 두 개가 같은 token id를 동시에 confirm         | 하나만 성공하거나 둘 다 안전 실패. 중복 AuditLog 금지 |

PostgreSQL에서 deadlock/serialization failure가 `P2034`로 나타나는 경우 release report에
error code, retry 여부, 최종 token/audit 상태를 기록한다. cleanup command는 자동 retry를
수행하지 않고 운영자가 dry-run부터 다시 시작한다.

## Evidence Template

release report에는 아래 표를 채운다.

| Evidence                                   | Value                          |
| ------------------------------------------ | ------------------------------ |
| PostgreSQL profile owner                   |                                |
| PostgreSQL version                         |                                |
| Prisma/provider profile commit or artifact |                                |
| Migration apply command/result             |                                |
| Redacted rehearsal DB identifier           |                                |
| Dry-run command artifact                   |                                |
| Confirm command artifact                   |                                |
| Negative case artifact                     |                                |
| AuditLog row id(s)                         |                                |
| Secret scan result                         |                                |
| Reviewer sign-off                          |                                |
| Final result                               | PASS / BLOCK / N/A-SQLite-only |

## Release Gate

- PostgreSQL 운영 DB를 쓰는 release 후보에서 이 evidence가 비어 있으면 BLOCK이다.
- full DSN 또는 DB credential이 artifact에 남으면 BLOCK이다.
- SQLite-only Electron local release 후보는 `N/A-SQLite-only`로 기록할 수 있지만,
  PostgreSQL production readiness를 의미하지 않는다.
- `pnpm release:gate` 통과만으로 이 profile을 PASS 처리하지 않는다.
- PostgreSQL rehearsal PASS 전에는 cleanup automation 또는 scheduled job을 만들지 않는다.

## Validation Commands

PostgreSQL profile 준비 전 현재 repository에서 실행 가능한 검증:

```powershell
pnpm test:unit:credential-compensation-cleanup
pnpm test:unit:production-release-gate
pnpm typecheck
pnpm lint
pnpm format:check
pnpm db:validate
```

PostgreSQL profile 준비 후 추가 검증:

```powershell
pnpm ops:credential-compensation-cleanup --database-url "<redacted-safe-postgres-url-or-env-path>"
pnpm ops:credential-compensation-cleanup --database-url "<redacted-safe-postgres-url-or-env-path>" --confirm --token-id <old-limbo-id> --expected-count 1 --actor-user-id <active-admin-id> --operator <operator-name> --ticket-id <ticket-id>
pnpm release:gate:logs
```
