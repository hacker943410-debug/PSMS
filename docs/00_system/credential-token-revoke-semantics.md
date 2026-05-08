# Credential Token Revoke Semantics

작성일: 2026-05-08

## 목적

관리자 계정 접근 요청(`STAFF_ACTIVATION`, `PASSWORD_RESET`)의 `revoke`와
`revokedTokenCount` 의미를 고정한다. 이 문서는 외부 `ActionResult` shape나 shared
schema를 변경하지 않고, 현재 DB/API 동작을 테스트 가능한 계약으로 정리한다.

## 용어

| 용어                     | 의미                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| redeemable token         | `activeKey`가 있고 `usedAt`, `revokedAt`이 없으며 `expiresAt > now`인 실제 사용 가능 토큰 |
| active-key-pending token | `activeKey`가 있고 `usedAt`, `revokedAt`이 없는 outstanding 요청                          |
| expired active-key token | `expiresAt <= now`라 사용할 수 없지만 `activeKey`가 아직 남은 outstanding 요청            |
| historical token         | 이미 `usedAt` 또는 `revokedAt`이 있거나 `activeKey`가 `null`인 과거 기록                  |

## Revoke Count Contract

`revokedTokenCount`는 이번 mutation이 `active-key-pending token`에서 `revoked` 상태로
전환한 row 수다.

따라서 다음을 포함한다.

- 아직 만료되지 않은 `active-key-pending token`
- 만료되어 verify/complete는 실패하지만 `activeKey`가 남아 있는 token

다음은 포함하지 않는다.

- 이미 `usedAt`이 있는 token
- 이미 `revokedAt`이 있는 token
- `activeKey`가 이미 `null`인 token
- 같은 user의 다른 purpose token

`expiresAt`은 token-holder의 verify/complete 가능 여부를 판단한다. 관리자 revoke는
stale outstanding 요청도 정리해야 하므로 `expiresAt > now`로 제한하지 않는다.

## ActiveKey Lifecycle

`activeKey`는 `${userId}:${purpose}` 형식이며 nullable unique field다. 이 값은 사용자와
목적별 outstanding 요청을 한 개로 제한하기 위한 lifecycle marker다.

| 상태                    | `activeKey`            | `usedAt`  | `revokedAt` |
| ----------------------- | ---------------------- | --------- | ----------- |
| 발급 전 committed token | `null`                 | `null`    | `null`      |
| 전달 성공 후 active     | `${userId}:${purpose}` | `null`    | `null`      |
| 완료 처리됨             | `null`                 | timestamp | `null`      |
| 관리자 회수됨           | `null`                 | `null`    | timestamp   |
| 전달 실패/rollback      | `null`                 | `null`    | timestamp   |

만료는 `activeKey`를 자동으로 지우지 않는다. 이후 reissue 또는 admin revoke가
`activeKey`를 지우고 audit에 count를 남긴다.

## Audit Contract

관리자 revoke 성공 응답의 `data.revokedTokenCount`와
`ADMIN_STAFF_*_REVOKED` AuditLog의 `afterJson.revokedTokenCount`는 같은 값을 가져야
한다.

관리자 issue 성공 응답의 `data.revokedTokenCount`는 기존 active-key-pending 요청 정리
건수이며, issue audit에서는 `afterJson.revokedPreviousCount`로 기록한다.

응답과 AuditLog에는 raw token, token hash, password, session token, reset URL,
temporary password를 포함하지 않는다.

## Current Test Coverage

`test/smoke/api-credential-token-inject-smoke.ts`는 다음 계약을 검증한다.

- 만료된 active-key token은 verify에 실패한다.
- 만료된 active-key token이 남아 있어도 reissue가 성공하고 `revokedTokenCount`가 `1`이다.
- 만료된 active-key token에 admin revoke를 호출하면 `revokedTokenCount`가 `1`이고 `activeKey`가 `null`이 된다.
- 유효한 password-reset token을 admin revoke하면 complete가 `INVALID_CREDENTIAL_TOKEN`으로 실패한다.
- 같은 대상에 revoke를 다시 호출하면 `revokedTokenCount`가 `0`이다.
- 과거 used/revoked token과 같은 user의 `STAFF_ACTIVATION` token은 password-reset revoke count에 포함되지 않는다.
