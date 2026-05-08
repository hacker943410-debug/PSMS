# Credential Cleanup Release Evidence Template

작성일: 2026-05-08

## 목적

credential compensation cleanup, limbo token scan, PostgreSQL rehearsal/profile gate를
릴리즈 보고서에 같은 형식으로 남기기 위한 evidence template이다.

이 문서는 evidence의 **형식과 금지 필드**를 고정한다. 실제 cleanup 실행 여부는
`docs/60_release/credential-compensation-failure-cleanup-runbook.md`,
`docs/60_release/postgresql-credential-cleanup-rehearsal-profile.md`,
`docs/60_release/postgresql-prisma-profile-preflight.md`의 PASS/BLOCK 기준을 따른다.

## Artifact Naming

릴리즈 evidence artifact는 아래 규칙을 사용한다.

```txt
release-evidence/<YYYYMMDD>/<gate>/<YYYYMMDD-HHmmss>-<gate>-<result>.json
```

예시:

```txt
release-evidence/20260508/credential-cleanup/20260508-143000-credential-cleanup-dry-run-PASS.json
release-evidence/20260508/postgresql-profile/20260508-143500-postgresql-profile-scaffold-BLOCK.json
release-evidence/20260508/secret-scan/20260508-144000-artifact-secret-scan-PASS.json
```

파일명 규칙:

- artifact `result`는 `PASS`, `BLOCK`, `NO-GO`, `N/A-SQLite-only`, `N/A-NoRows` 중 하나다.
- filename `<result>` slug는 slash를 쓰지 않기 위해 `N/A-SQLite-only`를
  `NA-SQLite-only`, `N/A-NoRows`를 `NA-NoRows`로 기록한다.
- full DB path, PostgreSQL DSN, user id, token id, ticket id를 파일명에 넣지 않는다.
- artifact directory는 release report에 기록하되, credential raw value를 포함할 수 있는
  외부 로그 원본을 이 디렉터리에 복사하지 않는다.

## Result Semantics

| Result            | 의미                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| `PASS`            | command/manual check 완료, artifact 존재, reviewer 확인, redaction 통과            |
| `BLOCK`           | command 실패, artifact 누락, reviewer 누락, redaction 실패, evidence 공백          |
| `NO-GO`           | 상위 MVP/Electron/release 조건 미충족으로 릴리즈 후보가 아님                       |
| `N/A-SQLite-only` | SQLite-only local Electron 후보라 PostgreSQL 전용 gate가 적용되지 않음             |
| `N/A-NoRows`      | limbo scan row count가 `0`이라 cleanup confirm/audit row가 필요 없는 경우에만 허용 |

`pnpm pg:profile:preflight`가 `ok: true`여도 `readiness: "BLOCK"`이면 PostgreSQL execution
readiness는 `PASS`가 아니다. PostgreSQL release candidate는
`pnpm pg:profile:require-readiness` PASS evidence를 별도로 남긴다.

## Required Evidence Index

release report는 최소 아래 index를 포함한다.

| Gate                            | Scope                        | Owner | Command(s)                                               | Exit code | Evidence artifact | Artifact SHA256 | Result | Time UTC | Reviewer | Notes |
| ------------------------------- | ---------------------------- | ----- | -------------------------------------------------------- | --------- | ----------------- | --------------- | ------ | -------- | -------- | ----- |
| Env gate                        | release candidate            |       | `pnpm release:gate:prod-env`                             |           |                   |                 |        |          |          |       |
| Artifact secret scan            | release artifacts            |       | `pnpm release:gate:logs`                                 |           |                   |                 |        |          |          |       |
| Combined automated release gate | env/log automation           |       | `pnpm release:gate`                                      |           |                   |                 |        |          |          |       |
| Limbo token scan                | credential cleanup           |       | detection SQL or dry-run command                         |           |                   |                 |        |          |          |       |
| Credential cleanup dry-run      | credential cleanup           |       | `pnpm ops:credential-compensation-cleanup`               |           |                   |                 |        |          |          |       |
| Credential cleanup confirm      | credential cleanup           |       | `pnpm ops:credential-compensation-cleanup --confirm ...` |           |                   |                 |        |          |          |       |
| AuditLog evidence               | credential cleanup           |       | `ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP` lookup        |           |                   |                 |        |          |          |       |
| PostgreSQL cleanup rehearsal    | PostgreSQL release candidate |       | PG cleanup rehearsal profile                             |           |                   |                 |        |          |          |       |
| PostgreSQL profile scaffold     | PG static scaffold           |       | `pnpm pg:profile:preflight`                              |           |                   |                 |        |          |          |       |
| PostgreSQL readiness            | PostgreSQL release candidate |       | `pnpm pg:profile:require-readiness`                      |           |                   |                 |        |          |          |       |
| Reverse proxy/CDN/APM scrub     | external systems             |       | external owner attestation                               |           |                   |                 |        |          |          |       |
| Webhook receiver log policy     | external receiver            |       | receiver owner attestation                               |           |                   |                 |        |          |          |       |
| Rollback rehearsal              | release rollback             |       | backup/restore or rollback note                          |           |                   |                 |        |          |          |       |

`Credential cleanup confirm`과 `AuditLog evidence`는 `Limbo token scan` row count가 `0`일
때만 `N/A-NoRows`를 사용할 수 있다. scan row count가 `> 0`인데 cleanup confirm 또는
AuditLog evidence가 없으면 `BLOCK`이다.

`pnpm release:gate`의 automated `ok: true`는 `AUTOMATED_ENV_LOG_PASS`만 의미한다. 최종
release `PASS`는 모든 manual evidence row가 `PASS` 또는 명시적으로 허용된 `N/A-*`일
때만 사용할 수 있다. 공백 evidence, 미검토 evidence, 허용되지 않은 N/A는 release `BLOCK`이다.

## Artifact JSON Shape

모든 JSON artifact는 아래 상위 필드를 사용한다.

```json
{
  "schemaVersion": 1,
  "project": "PSMS",
  "releaseCandidateId": "release-20260508-local",
  "gate": "credential-cleanup",
  "result": "PASS",
  "createdAt": "2026-05-08T05:30:00.000Z",
  "owner": "release-operator",
  "reviewer": "security-or-release-reviewer",
  "commandName": "ops:credential-compensation-cleanup",
  "commandTemplate": "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
  "commandArgsRedacted": true,
  "exitCode": 0,
  "artifactSha256": "<sha256>",
  "environment": {
    "releaseKind": "local-electron-sqlite",
    "databaseProvider": "sqlite",
    "databaseIdentifier": "file:<redacted-or-approved-path>",
    "postgresqlReadiness": "N/A-SQLite-only"
  },
  "summary": {
    "candidateCount": 0,
    "cleanedCount": 0,
    "auditLogCount": 0,
    "secretScanPassed": true
  },
  "evidence": {},
  "forbiddenFieldScan": {
    "checked": true,
    "passed": true,
    "scanner": "pnpm release:gate:logs",
    "scannerVersion": "artifact-secret-scan-v1",
    "scannedArtifactPath": "release-evidence/20260508/credential-cleanup",
    "scannedRoots": [
      ".codex-logs",
      ".tmp",
      "test-results",
      "playwright-report",
      "release-evidence"
    ],
    "skippedCounts": {}
  },
  "retention": {
    "retentionUntil": "2027-05-08T00:00:00.000Z",
    "storageOwner": "release-ops",
    "accessClass": "internal-restricted"
  },
  "quarantine": {
    "required": false,
    "quarantineStatus": "not-required",
    "incidentTicketId": "N/A"
  },
  "notes": []
}
```

Artifacts store `commandName` and `commandTemplate`, not copied shell history. Command templates may
include option names and placeholders, but must not include raw credential values, full DSN,
Authorization values, Cookie values, token URLs, or unredacted user-provided free text. Token IDs,
actor IDs, operator, and ticket ID belong in bounded structured fields only.

## Credential Cleanup Evidence

Dry-run artifact `evidence`:

```json
{
  "dryRun": true,
  "detectionWindowMinutes": 10,
  "candidateCount": 0,
  "candidateIds": [],
  "candidates": []
}
```

Confirm artifact `evidence`:

```json
{
  "dryRun": false,
  "detectionWindowMinutes": 10,
  "expectedCandidateCount": 1,
  "requestedTokenIds": ["<token-id>"],
  "cleanedCount": 1,
  "auditAction": "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP",
  "auditLogIds": ["<audit-log-id>"],
  "operator": "<operator-name>",
  "ticketId": "<ticket-id>"
}
```

`operator` and `ticketId` must be bounded safe text. They must not be URLs, DSNs, headers, tokens,
passwords, or free-form incident descriptions.

Candidate objects may include:

| Field                    | 허용 |
| ------------------------ | ---- |
| `tokenId`                | Yes  |
| `userId`                 | Yes  |
| `purpose`                | Yes  |
| `createdAt`              | Yes  |
| `expiresAt`              | Yes  |
| `createdById`            | Yes  |
| `hadActiveKey`           | Yes  |
| `hadUsedAt`              | Yes  |
| `hadRevokedAt`           | Yes  |
| `detectionWindowMinutes` | Yes  |

## Forbidden Fields

Evidence artifact, release report, ticket, screenshots, logs, and copied command output must not
contain:

- raw credential token
- token hash or `tokenHash`
- activation/reset URL
- password, confirm password, password hash
- session token or session hash
- Cookie, Set-Cookie, Authorization header/value
- webhook request body
- full PostgreSQL DSN, username, password, query string, fragment
- bearer token, API token, access token, refresh token

If a forbidden field is found, mark the gate `BLOCK`, quarantine the artifact, rotate impacted
secrets if needed, and rerun `pnpm release:gate:logs` after cleanup.

## Reviewer Checklist

| Check                                                            | Required |
| ---------------------------------------------------------------- | -------- |
| artifact path follows naming rule                                | Yes      |
| artifact SHA256 is recorded                                      | Yes      |
| release candidate id is recorded                                 | Yes      |
| result is one of the approved values                             | Yes      |
| owner, reviewer, createdAt are present                           | Yes      |
| database identifier is redacted or approved                      | Yes      |
| command template, redacted args flag, and exit code are recorded | Yes      |
| dry-run candidate count matches confirm expected count           | Yes      |
| cleanup confirm has token id list and expected count             | Yes      |
| AuditLog evidence exists for cleaned rows                        | Yes      |
| forbidden field scan passed                                      | Yes      |
| PostgreSQL readiness is not inferred from scaffold `ok`          | Yes      |
| SQLite-only `N/A-SQLite-only` is explicit                        | Yes      |
| retention and quarantine fields are recorded                     | Yes      |

## Validator

Machine-readable evidence artifacts are validated with:

```powershell
pnpm release:evidence:validate
pnpm release:evidence:validate release-evidence/20260508/credential-cleanup
```

The validator enforces required fields, path naming, result enum, allowed `N/A-*` context,
PostgreSQL scaffold/readiness separation, candidate allow-list, forbidden field patterns,
retention fields, quarantine fields, and `release-evidence` scanner coverage.

## Writer

Validator-compatible evidence artifacts can be written with:

```powershell
pnpm release:evidence:write --gate credential-cleanup-dry-run --result PASS --release-candidate-id release-20260508-local --created-at 2026-05-08T05:30:00.000Z --owner release-operator --reviewer security-reviewer --command-name ops:credential-compensation-cleanup --command-template "pnpm ops:credential-compensation-cleanup" --exit-code 0 --release-kind local-electron-sqlite --database-provider sqlite --database-identifier "file:<redacted-or-approved-path>" --postgresql-readiness N/A-SQLite-only --summary "{\"candidateCount\":0,\"cleanedCount\":0,\"auditLogCount\":0,\"secretScanPassed\":true}" --evidence "{\"dryRun\":true,\"detectionWindowMinutes\":10,\"candidateCount\":0,\"candidateIds\":[],\"candidates\":[]}" --retention-until 2027-05-08T00:00:00.000Z --storage-owner release-ops --access-class internal-restricted
```

The writer computes canonical `artifactSha256`, fills standard scanner/retention/quarantine
metadata, validates the artifact before writing, and refuses to overwrite an existing artifact.

## Command Capture

Allow-listed release commands can be captured directly into validator-compatible artifacts:

```powershell
pnpm release:evidence:capture --command-key pg-profile-preflight --release-candidate-id release-20260508-local --owner release-operator --reviewer security-reviewer --release-kind postgresql-rehearsal --retention-until 2027-05-08T00:00:00.000Z --storage-owner release-ops --access-class internal-restricted
```

Allowed `--command-key` values:

| Command key                  | Captured command                                         | Evidence gate                |
| ---------------------------- | -------------------------------------------------------- | ---------------------------- |
| `prod-env`                   | `pnpm release:gate:prod-env`                             | `env-gate`                   |
| `secret-scan`                | `pnpm release:gate:logs`                                 | `artifact-secret-scan`       |
| `pg-profile-preflight`       | `pnpm pg:profile:preflight`                              | `postgresql-profile`         |
| `pg-profile-readiness`       | `pnpm pg:profile:require-readiness`                      | `postgresql-readiness`       |
| `credential-cleanup-dry-run` | `pnpm ops:credential-compensation-cleanup`               | `credential-cleanup-dry-run` |
| `credential-cleanup-confirm` | `pnpm ops:credential-compensation-cleanup --confirm ...` | `credential-cleanup-confirm` |

The capture adapter executes fixed argv arrays only, does not accept arbitrary shell commands, redacts
stdout/stderr before artifact construction, derives `summary` and `evidence` per command, then calls
the writer. A command failure, timeout, or PostgreSQL `readiness: "BLOCK"` writes a `BLOCK` artifact
when safe and returns a nonzero adapter exit code. It records gate evidence only; it does not approve
a release candidate.

`credential-cleanup-confirm` capture accepts only bounded structured options:
`--token-id`, `--expected-count`, `--actor-user-id`, `--operator`, `--ticket-id`, and optional
`--detection-window-minutes`. Its artifact `commandTemplate` keeps placeholders for token/admin/
operator/ticket values, and derived evidence records only the allowed cleanup fields. The adapter does
not support `--database-url` or free-form shell fragments.

## Index Assembler

Release reports can assemble validated artifacts into a deterministic gate table with:

```powershell
pnpm release:evidence:index --release-candidate-id release-20260508-local --path release-evidence/20260508 --format markdown
```

The assembler contract lives in `docs/60_release/release-evidence-index-assembler.md`. It marks
missing, manual-pending, invalid, `BLOCK`, and `NO-GO` gates as release blockers and does not approve
the release candidate.

## Release Report Snippet

```md
## Credential Cleanup Evidence

| Gate                        | Scope                        | Command(s)                               | Exit code | Evidence artifact        | Artifact SHA256 | Result          | Reviewer | Notes                      |
| --------------------------- | ---------------------------- | ---------------------------------------- | --------- | ------------------------ | --------------- | --------------- | -------- | -------------------------- |
| Limbo token scan            | credential cleanup           | pnpm ops:credential-compensation-cleanup | 0         | release-evidence/...json | ...             | PASS            |          | row count 0                |
| Credential cleanup confirm  | credential cleanup           | N/A                                      | N/A       | N/A                      | N/A             | N/A-NoRows      |          | no limbo token             |
| PostgreSQL profile scaffold | PG static scaffold           | pnpm pg:profile:preflight                | 0         | release-evidence/...json | ...             | BLOCK           |          | readiness BLOCK            |
| PostgreSQL readiness        | PostgreSQL release candidate | N/A                                      | N/A       | N/A                      | N/A             | N/A-SQLite-only |          | local Electron SQLite-only |
```

## Validation Commands

문서/템플릿 변경 후 최소 아래 명령을 실행한다.

```powershell
pnpm test:unit:production-release-gate
pnpm test:unit:release-evidence-validate
pnpm test:unit:release-evidence-write
pnpm test:unit:release-evidence-capture
pnpm release:gate:logs
pnpm format:check
```

credential cleanup command 또는 PG scaffold가 함께 변경되면 아래도 추가한다.

```powershell
pnpm test:unit:credential-compensation-cleanup
pnpm test:unit:postgresql-profile-preflight
pnpm pg:profile:preflight
pnpm db:validate:pg-schema
```

## 보관 / 격리

- release evidence artifact는 release candidate별로 묶어 보관한다.
- forbidden field가 포함된 artifact는 release evidence로 쓰지 않고 incident/quarantine
  경로로 이동한다.
- quarantine artifact 경로는 공개 release report에 적지 않고 incident ticket에만 남긴다.
- evidence artifact를 외부 시스템에 업로드하기 전 `pnpm release:gate:logs`와 reviewer
  수동 검토를 모두 통과한다.
