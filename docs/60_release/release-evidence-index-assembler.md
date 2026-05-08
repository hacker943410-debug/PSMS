# Release Evidence Index Assembler

작성일: 2026-05-08

## 목적

`release:evidence:index`는 `release-evidence/**` JSON artifacts를 검증하고, 릴리즈 보고서에
붙일 deterministic evidence index table을 만든다. 이 도구는 **릴리즈 승인 도구가 아니며**,
누락, 수동 미검토, invalid artifact를 `BLOCK`으로 드러내는 assembler다.

## 입력

```powershell
pnpm release:evidence:index --release-candidate-id release-20260508-local
pnpm release:evidence:index --release-candidate-id release-20260508-local --path release-evidence/20260508
pnpm release:evidence:index --release-candidate-id release-20260508-local --format markdown
```

필수:

- `--release-candidate-id`: 한 release run에 속한 artifact만 조립한다.

선택:

- `--path`: scan root. 기본값은 `release-evidence`.
- `--format`: `json` 또는 `markdown`. 기본값은 `json`.

## 출력

출력은 expected gate 순서대로 정렬된 index row다.

| Field                | 설명                                                      |
| -------------------- | --------------------------------------------------------- |
| `releaseCandidateId` | artifact release candidate id                             |
| `gate`               | logical gate key                                          |
| `gateType`           | `automated`, `manual`, or `external`                      |
| `file`               | selected artifact path 또는 `MISSING`                     |
| `artifactSha256`     | selected artifact hash 또는 `N/A`                         |
| `command`            | artifact commandName 또는 expected command                |
| `exitCode`           | command exit code 또는 `N/A`                              |
| `createdAt`          | artifact UTC timestamp 또는 `N/A`                         |
| `owner`              | artifact owner 또는 `N/A`                                 |
| `reviewer`           | artifact reviewer 또는 `N/A`                              |
| `result`             | `PASS`, `BLOCK`, `NO-GO`, `N/A-SQLite-only`, `N/A-NoRows` |
| `status`             | `SATISFIED`, `MISSING`, `INVALID`, `BLOCK`, or `NO-GO`    |
| `notes`              | short non-secret note                                     |

Machine JSON includes aggregate counters:

- `overallResult`: `INDEX_READY`, `BLOCK`, or `NO-GO`
- `scannedFiles`
- `validArtifactCount`
- `invalidArtifactCount`
- `requiredGateCount`
- `missingRequiredCount`
- `blockingCount`
- `noGoCount`
- `passLikeCount`

## Fail-Closed Rules

The index is `BLOCK` when:

- evidence root is empty
- any discovered artifact fails schema/hash/path/secret validation
- any required gate is missing
- any required gate selected artifact has `BLOCK`
- any gate selected artifact has `NO-GO`
- manual/external gate has no attestation artifact

The assembler preserves valid artifact result values. It does not rewrite `PASS`, `BLOCK`, `NO-GO`,
or allowed `N/A-*` statuses.

Allowed `N/A-*` remains governed by
`docs/60_release/credential-cleanup-release-evidence-template.md` and the validator:

- `N/A-NoRows` only for cleanup confirm/auditlog evidence with zero candidates.
- `N/A-SQLite-only` only for PostgreSQL-specific gates.

## No Secret Rule

The assembler never copies raw stdout/stderr, shell history, external logs, quarantine paths, DSNs,
credential URLs, cookies, headers, token hashes, or raw tokens. Markdown cells are redacted again as
a final report-output defense.

## Validation

After changing this assembler or its docs:

```powershell
pnpm test:unit:release-evidence-index
pnpm test:unit:release-evidence-validate
pnpm test:unit:release-evidence-write
pnpm test:unit:release-evidence-capture
pnpm test:unit:artifact-secret-scan
pnpm release:gate:logs
pnpm format:check
```
