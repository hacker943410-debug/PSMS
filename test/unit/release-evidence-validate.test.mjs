import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  computeArtifactSha256,
  validateReleaseEvidenceArtifact,
  validateReleaseEvidencePath,
} from "../../scripts/release-evidence-validate.mjs";

const workspaceRoot = process.cwd();
const evidenceRoot = path.join(workspaceRoot, "release-evidence");
const validatorRoot = path.join(evidenceRoot, "validator-test");
const releaseDate = "20990101";

function artifactPath(gate, resultSlug = "PASS") {
  return `release-evidence/${releaseDate}/${gate}/${releaseDate}-143000-${gate}-${resultSlug}.json`;
}

function baseArtifact(overrides = {}) {
  const artifact = {
    schemaVersion: 1,
    project: "PSMS",
    releaseCandidateId: "release-20260508-local",
    gate: "credential-cleanup-dry-run",
    result: "PASS",
    createdAt: "2099-01-01T05:30:00.000Z",
    owner: "release-operator",
    reviewer: "security-reviewer",
    commandName: "ops:credential-compensation-cleanup",
    commandTemplate: "pnpm ops:credential-compensation-cleanup",
    commandArgsRedacted: true,
    exitCode: 0,
    artifactSha256: "",
    environment: {
      releaseKind: "local-electron-sqlite",
      databaseProvider: "sqlite",
      databaseIdentifier: "file:<redacted-or-approved-path>",
      postgresqlReadiness: "N/A-SQLite-only",
    },
    summary: {
      candidateCount: 0,
      cleanedCount: 0,
      auditLogCount: 0,
      secretScanPassed: true,
    },
    evidence: {
      dryRun: true,
      detectionWindowMinutes: 10,
      candidateCount: 0,
      candidateIds: [],
      candidates: [],
    },
    forbiddenFieldScan: {
      checked: true,
      passed: true,
      scanner: "pnpm release:gate:logs",
      scannerVersion: "artifact-secret-scan-v1",
      scannedArtifactPath: "release-evidence/20990101/credential-cleanup",
      scannedRoots: [
        ".codex-logs",
        ".tmp",
        "test-results",
        "playwright-report",
        "release-evidence",
      ],
      skippedCounts: {},
    },
    retention: {
      retentionUntil: "2027-05-08T00:00:00.000Z",
      storageOwner: "release-ops",
      accessClass: "internal-restricted",
    },
    quarantine: {
      required: false,
      quarantineStatus: "not-required",
      incidentTicketId: "N/A",
    },
    notes: [],
    ...overrides,
  };

  artifact.artifactSha256 = computeArtifactSha256(artifact);

  return artifact;
}

function withHash(artifact) {
  return {
    ...artifact,
    artifactSha256: computeArtifactSha256(artifact),
  };
}

function validate(artifact, relativePath = artifactPath(artifact.gate)) {
  const text = JSON.stringify(artifact);

  return validateReleaseEvidenceArtifact(artifact, relativePath, text);
}

function failureIds(failures) {
  return failures.map((failure) => failure.id);
}

async function writeArtifact(relativePath, artifact) {
  const targetPath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(artifact, null, 2));
}

describe("release evidence validator", () => {
  it("accepts a valid credential cleanup evidence artifact", () => {
    const artifact = baseArtifact();
    const failures = validate(artifact);

    assert.deepEqual(failures, []);
  });

  it("fails closed when required fields are missing", () => {
    const artifact = baseArtifact();

    delete artifact.schemaVersion;
    delete artifact.project;
    delete artifact.commandArgsRedacted;
    delete artifact.forbiddenFieldScan;

    const ids = failureIds(validate(artifact));

    for (const id of [
      "field.schemaVersion",
      "field.project",
      "field.commandArgsRedacted",
      "field.forbiddenFieldScan",
      "schemaVersion",
      "project",
      "commandArgsRedacted",
      "forbiddenFieldScan",
    ]) {
      assert.ok(ids.includes(id));
    }
  });

  it("rejects unsupported and misplaced N/A results", () => {
    const unsupported = baseArtifact({ result: "N/A-Manual" });
    const sqliteOnlyWrongGate = baseArtifact({
      result: "N/A-SQLite-only",
      gate: "credential-cleanup-dry-run",
    });
    const noRowsWrongGate = baseArtifact({
      result: "N/A-NoRows",
      gate: "credential-cleanup-dry-run",
    });

    assert.ok(failureIds(validate(unsupported)).includes("result.enum"));
    assert.ok(
      failureIds(validate(sqliteOnlyWrongGate)).includes(
        "result.NA-SQLite-only.gate"
      )
    );
    assert.ok(
      failureIds(validate(noRowsWrongGate)).includes("result.NA-NoRows.gate")
    );
  });

  it("allows N/A-NoRows only for cleanup confirm with zero candidates", () => {
    const artifact = baseArtifact({
      gate: "credential-cleanup-confirm",
      result: "N/A-NoRows",
      exitCode: "N/A",
      summary: {
        candidateCount: 0,
        cleanedCount: 0,
        auditLogCount: 0,
        secretScanPassed: true,
      },
      evidence: {
        noRows: true,
        linkedDryRunArtifactPath:
          "release-evidence/20990101/credential-cleanup-dry-run/20990101-143000-credential-cleanup-dry-run-PASS.json",
        linkedDryRunArtifactSha256: "a".repeat(64),
        linkedDryRunResult: "PASS",
        linkedDryRunCandidateCount: 0,
      },
    });

    assert.deepEqual(
      validate(
        artifact,
        artifactPath("credential-cleanup-confirm", "NA-NoRows")
      ),
      []
    );

    const invalid = {
      ...artifact,
      summary: {
        ...artifact.summary,
        candidateCount: 1,
      },
    };

    assert.ok(
      failureIds(
        validate(
          invalid,
          artifactPath("credential-cleanup-confirm", "NA-NoRows")
        )
      ).includes("result.NA-NoRows")
    );
  });

  it("rejects N/A-NoRows artifacts without linked zero-row dry-run evidence", () => {
    const missingLink = baseArtifact({
      gate: "credential-cleanup-auditlog",
      result: "N/A-NoRows",
      exitCode: "N/A",
      evidence: {
        noRows: true,
      },
    });
    const badCount = baseArtifact({
      gate: "credential-cleanup-auditlog",
      result: "N/A-NoRows",
      exitCode: "N/A",
      evidence: {
        noRows: true,
        linkedDryRunArtifactPath:
          "release-evidence/20990101/credential-cleanup-dry-run/20990101-143000-credential-cleanup-dry-run-PASS.json",
        linkedDryRunArtifactSha256: "a".repeat(64),
        linkedDryRunResult: "PASS",
        linkedDryRunCandidateCount: 1,
      },
    });

    assert.ok(
      failureIds(
        validate(
          missingLink,
          artifactPath("credential-cleanup-auditlog", "NA-NoRows")
        )
      ).includes("evidence.linkedDryRunArtifactPath")
    );
    assert.ok(
      failureIds(
        validate(
          badCount,
          artifactPath("credential-cleanup-auditlog", "NA-NoRows")
        )
      ).includes("evidence.linkedDryRunCandidateCount")
    );
  });

  it("accepts valid credential cleanup confirm evidence and rejects unsafe command templates", () => {
    const artifact = baseArtifact({
      gate: "credential-cleanup-confirm",
      commandTemplate:
        "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
      summary: {
        candidateCount: 1,
        cleanedCount: 1,
        auditLogCount: 1,
        secretScanPassed: true,
      },
      evidence: {
        dryRun: false,
        detectionWindowMinutes: 10,
        candidateCount: 1,
        requestedTokenIds: ["cleanup_1"],
        candidateIds: ["cleanup_1"],
        candidates: [
          {
            tokenId: "cleanup_1",
            userId: "user_1",
            purpose: "STAFF_ACTIVATION",
            createdAt: "2099-01-01T05:00:00.000Z",
            expiresAt: "2099-01-01T06:00:00.000Z",
            createdById: "admin_1",
            hadActiveKey: false,
            hadUsedAt: false,
            hadRevokedAt: false,
            detectionWindowMinutes: 10,
          },
        ],
        expectedCandidateCount: 1,
        cleanedCount: 1,
        cleanedTokenIds: ["cleanup_1"],
        auditAction: "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP",
        auditLogIds: ["audit_1"],
        operator: "release-operator",
        ticketId: "OPS-20990101",
      },
    });
    const unsafeTemplate = withHash({
      ...artifact,
      commandTemplate:
        "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count 1 --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
    });

    assert.deepEqual(
      validate(artifact, artifactPath("credential-cleanup-confirm")),
      []
    );
    assert.ok(
      failureIds(
        validate(unsafeTemplate, artifactPath("credential-cleanup-confirm"))
      ).includes("commandTemplate.expected-count")
    );
  });

  it("rejects incomplete or inconsistent credential cleanup confirm evidence", () => {
    const valid = baseArtifact({
      gate: "credential-cleanup-confirm",
      commandTemplate:
        "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
      summary: {
        candidateCount: 1,
        cleanedCount: 1,
        auditLogCount: 1,
        secretScanPassed: true,
      },
      evidence: {
        dryRun: false,
        requestedTokenIds: ["cleanup_1"],
        candidateIds: ["cleanup_1"],
        expectedCandidateCount: 1,
        cleanedCount: 1,
        cleanedTokenIds: ["cleanup_1"],
        auditAction: "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP",
        auditLogIds: ["audit_1"],
        operator: "release-operator",
        ticketId: "OPS-20990101",
      },
    });
    const missingRequired = withHash({
      ...valid,
      evidence: {
        ...valid.evidence,
      },
    });
    delete missingRequired.evidence.auditAction;
    const requestedMismatch = withHash({
      ...valid,
      evidence: {
        ...valid.evidence,
        requestedTokenIds: ["cleanup_2"],
      },
    });
    const auditMismatch = withHash({
      ...valid,
      summary: {
        ...valid.summary,
        auditLogCount: 0,
      },
      evidence: {
        ...valid.evidence,
        auditLogIds: [],
      },
    });

    assert.ok(
      failureIds(
        validate(missingRequired, artifactPath("credential-cleanup-confirm"))
      ).includes("evidence.auditAction")
    );
    assert.ok(
      failureIds(
        validate(requestedMismatch, artifactPath("credential-cleanup-confirm"))
      ).includes("evidence.requestedTokenIds.set")
    );
    assert.ok(
      failureIds(
        validate(auditMismatch, artifactPath("credential-cleanup-confirm"))
      ).includes("credentialCleanup.confirm.auditLogCount")
    );
  });

  it("keeps PostgreSQL scaffold BLOCK separate from readiness PASS", () => {
    const pgScaffold = baseArtifact({
      gate: "postgresql-profile",
      result: "BLOCK",
      commandName: "pg:profile:preflight",
      commandTemplate: "pnpm pg:profile:preflight",
      environment: {
        releaseKind: "postgresql-rehearsal",
        databaseProvider: "postgresql",
        databaseIdentifier: "postgresql:<redacted>",
        postgresqlReadiness: "BLOCK",
      },
      evidence: {
        ok: true,
        readiness: "BLOCK",
      },
    });
    const pgReadinessPass = baseArtifact({
      gate: "postgresql-readiness",
      result: "PASS",
      commandName: "pg:profile:require-readiness",
      commandTemplate: "pnpm pg:profile:require-readiness",
      environment: {
        releaseKind: "postgresql-rehearsal",
        databaseProvider: "postgresql",
        databaseIdentifier: "postgresql:<redacted>",
        postgresqlReadiness: "PASS",
      },
    });

    assert.deepEqual(
      validate(pgScaffold, artifactPath("postgresql-profile", "BLOCK")),
      []
    );
    assert.deepEqual(
      validate(pgReadinessPass, artifactPath("postgresql-readiness", "PASS")),
      []
    );

    const invalidPass = withHash({ ...pgScaffold, result: "PASS" });
    assert.ok(
      failureIds(
        validate(invalidPass, artifactPath("postgresql-profile", "PASS"))
      ).includes("postgresql.preflight-readiness")
    );
  });

  it("rejects forbidden fields without echoing secret values in failure messages", () => {
    const artifact = baseArtifact({
      evidence: {
        rawToken: "secret-release-token-value",
        tokenHash: "v1:hmac-sha256:secret-token-hash",
        callback: "https://127.0.0.1/staff-activation?token=secret-token",
      },
      notes: ["Authorization: Bearer secret-bearer-token"],
    });
    const failures = validate(artifact);
    const serializedFailures = JSON.stringify(failures);

    assert.ok(failureIds(failures).some((id) => id.startsWith("forbidden.")));
    assert.equal(
      serializedFailures.includes("secret-release-token-value"),
      false
    );
    assert.equal(serializedFailures.includes("secret-token-hash"), false);
    assert.equal(serializedFailures.includes("secret-bearer-token"), false);
  });

  it("rejects candidate fields outside the release evidence allow-list", () => {
    const artifact = baseArtifact({
      evidence: {
        dryRun: true,
        candidates: [
          {
            tokenId: "token_1",
            userId: "user_1",
            purpose: "STAFF_ACTIVATION",
            ipAddress: "198.51.100.1",
            userAgent: "test-agent",
          },
        ],
      },
    });

    assert.ok(
      failureIds(validate(artifact)).includes("evidence.candidates.0.ipAddress")
    );
    assert.ok(
      failureIds(validate(artifact)).includes("evidence.candidates.0.userAgent")
    );
  });

  it("permits PASSWORD_RESET as a purpose enum while still blocking password fields", () => {
    const valid = baseArtifact({
      evidence: {
        dryRun: true,
        candidateIds: ["token_1"],
        candidates: [
          {
            tokenId: "token_1",
            userId: "user_1",
            purpose: "PASSWORD_RESET",
            createdAt: "2099-01-01T05:00:00.000Z",
            expiresAt: "2099-01-01T06:00:00.000Z",
            createdById: "admin_1",
            hadActiveKey: false,
            hadUsedAt: false,
            hadRevokedAt: false,
            detectionWindowMinutes: 10,
          },
        ],
      },
      summary: {
        candidateCount: 1,
        cleanedCount: 0,
        auditLogCount: 0,
        secretScanPassed: true,
      },
    });
    const invalid = baseArtifact({
      evidence: {
        passwordHash: "secret-password-hash",
      },
    });

    assert.deepEqual(validate(valid), []);
    assert.ok(
      failureIds(validate(invalid)).includes("forbidden.password-field")
    );
  });

  it("recursively validates release-evidence directories and path/result naming", async () => {
    await rm(validatorRoot, { force: true, recursive: true });

    try {
      const validPath =
        "release-evidence/20990101/credential-cleanup-dry-run/20990101-143000-credential-cleanup-dry-run-PASS.json";
      const invalidPath =
        "release-evidence/20990101/credential-cleanup-dry-run/20990101-143000-credential-cleanup-dry-run-BLOCK.json";

      await writeArtifact(validPath, baseArtifact());
      await writeArtifact(invalidPath, baseArtifact());

      const report = await validateReleaseEvidencePath(
        "release-evidence/20990101/credential-cleanup-dry-run"
      );

      assert.equal(report.ok, false);
      assert.equal(report.scannedFiles, 2);
      assert.ok(
        report.failures.some((failure) => failure.id === "path.result")
      );
    } finally {
      await rm(path.join(evidenceRoot, "20990101"), {
        force: true,
        recursive: true,
      });
      await rm(validatorRoot, { force: true, recursive: true });
    }
  });

  it("fails on an empty evidence root unless explicitly allowed", async () => {
    const emptyRoot = "release-evidence/validator-empty";

    await rm(path.join(workspaceRoot, emptyRoot), {
      force: true,
      recursive: true,
    });
    await mkdir(path.join(workspaceRoot, emptyRoot), { recursive: true });

    try {
      const strictReport = await validateReleaseEvidencePath(emptyRoot);
      const allowedReport = await validateReleaseEvidencePath(emptyRoot, {
        allowEmpty: true,
      });

      assert.equal(strictReport.ok, false);
      assert.ok(
        strictReport.failures.some((failure) => failure.id === "path.empty")
      );
      assert.equal(allowedReport.ok, true);
      assert.equal(allowedReport.scannedFiles, 0);
    } finally {
      await rm(path.join(workspaceRoot, emptyRoot), {
        force: true,
        recursive: true,
      });
    }
  });
});
