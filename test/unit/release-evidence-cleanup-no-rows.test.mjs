import assert from "node:assert/strict";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { writeCleanupNoRowsEvidence } from "../../scripts/release-evidence-cleanup-no-rows.mjs";
import { buildReleaseEvidenceIndex } from "../../scripts/release-evidence-index.mjs";
import { validateReleaseEvidencePath } from "../../scripts/release-evidence-validate.mjs";
import { writeReleaseEvidenceArtifact } from "../../scripts/release-evidence-write.mjs";

const workspaceRoot = process.cwd();
const outputRoot = "release-evidence";
const releaseDate = "20990105";
const outputPath = path.join(workspaceRoot, outputRoot, releaseDate);
const releaseCandidateId = "release-20990105-local";

const cleanupRequiredGates = [
  {
    gate: "credential-cleanup-confirm",
    scope: "credential cleanup",
    command: "pnpm release:evidence:cleanup-no-rows",
    gateType: "automated",
    required: true,
  },
  {
    gate: "credential-cleanup-auditlog",
    scope: "credential cleanup",
    command: "pnpm release:evidence:cleanup-no-rows",
    gateType: "automated",
    required: true,
  },
];

function dryRunInput(overrides = {}) {
  return {
    releaseCandidateId,
    gate: "credential-cleanup-dry-run",
    result: "PASS",
    createdAt: new Date("2099-01-05T05:30:00.000Z"),
    owner: "release-operator",
    reviewer: "security-reviewer",
    commandName: "ops:credential-compensation-cleanup",
    commandTemplate: "pnpm ops:credential-compensation-cleanup",
    exitCode: 0,
    releaseKind: "local-electron-sqlite",
    databaseProvider: "sqlite",
    databaseIdentifier: "file:<redacted-or-approved-path>",
    postgresqlReadiness: "N/A-SQLite-only",
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
    outputRoot,
    retentionUntil: "2100-01-05T00:00:00.000Z",
    storageOwner: "release-ops",
    accessClass: "internal-restricted",
    ...overrides,
  };
}

describe("cleanup no-row release evidence helper", () => {
  it("writes validator-compatible confirm and auditlog N/A-NoRows artifacts from zero-row dry-run evidence", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(dryRunInput());
      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: dryRunReport.artifactPath,
        createdAt: new Date("2099-01-05T05:31:00.000Z"),
      });
      const validation = await validateReleaseEvidencePath(
        `release-evidence/${releaseDate}`
      );
      const index = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: cleanupRequiredGates,
          releaseCandidateId,
        }
      );

      assert.equal(dryRunReport.ok, true);
      assert.equal(report.ok, true);
      assert.equal(report.artifacts.length, 2);
      assert.deepEqual(
        report.artifacts.map((artifact) => artifact.gate).sort(),
        ["credential-cleanup-auditlog", "credential-cleanup-confirm"]
      );
      assert.equal(validation.ok, true);
      assert.equal(validation.scannedFiles, 3);
      assert.equal(index.ok, true);
      assert.equal(index.passLikeCount, 2);
      assert.equal(
        index.rows.every((row) => row.result === "N/A-NoRows"),
        true
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("refuses no-row evidence when dry-run has candidates", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(
        dryRunInput({
          summary: {
            candidateCount: 1,
            cleanedCount: 0,
            auditLogCount: 0,
            secretScanPassed: true,
          },
          evidence: {
            dryRun: true,
            detectionWindowMinutes: 10,
            candidateCount: 1,
            candidateIds: ["cleanup_1"],
            candidates: [
              {
                tokenId: "cleanup_1",
                userId: "user_1",
                purpose: "STAFF_ACTIVATION",
                createdAt: "2099-01-05T05:00:00.000Z",
                expiresAt: "2099-01-05T06:00:00.000Z",
                createdById: "admin_1",
                hadActiveKey: false,
                hadUsedAt: false,
                hadRevokedAt: false,
                detectionWindowMinutes: 10,
              },
            ],
          },
        })
      );
      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: dryRunReport.artifactPath,
        createdAt: new Date("2099-01-05T05:32:00.000Z"),
      });

      assert.equal(dryRunReport.ok, true);
      assert.equal(report.ok, false);
      assert.equal(
        report.code,
        "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_NOT_APPLICABLE"
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("refuses inconsistent zero-row dry-run evidence", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(
        dryRunInput({
          evidence: {
            dryRun: true,
            detectionWindowMinutes: 10,
            candidateCount: 1,
            candidateIds: [],
            candidates: [],
          },
        })
      );
      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: dryRunReport.artifactPath,
        createdAt: new Date("2099-01-05T05:32:00.000Z"),
      });

      assert.equal(dryRunReport.ok, true);
      assert.equal(report.ok, false);
      assert.equal(
        report.code,
        "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_NOT_APPLICABLE"
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("refuses non-dry-run source evidence", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(
        dryRunInput({
          evidence: {
            dryRun: false,
            detectionWindowMinutes: 10,
            candidateCount: 0,
            candidateIds: [],
            candidates: [],
          },
        })
      );
      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: dryRunReport.artifactPath,
        createdAt: new Date("2099-01-05T05:32:00.000Z"),
      });

      assert.equal(dryRunReport.ok, true);
      assert.equal(report.ok, false);
      assert.equal(
        report.code,
        "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_NOT_APPLICABLE"
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("fails before partial writes when a target no-row artifact already exists", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(dryRunInput());
      const createdAt = new Date("2099-01-05T05:33:00.000Z");
      const confirmPath = path.join(
        outputPath,
        "credential-cleanup-confirm",
        `${releaseDate}-053300-credential-cleanup-confirm-NA-NoRows.json`
      );
      const auditPath = path.join(
        outputPath,
        "credential-cleanup-auditlog",
        `${releaseDate}-053300-credential-cleanup-auditlog-NA-NoRows.json`
      );

      await mkdir(path.dirname(auditPath), { recursive: true });
      await writeFile(auditPath, "{}");

      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: dryRunReport.artifactPath,
        createdAt,
      });

      assert.equal(report.ok, false);
      assert.equal(
        report.code,
        "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_TARGET_EXISTS"
      );
      await assert.rejects(() => stat(confirmPath), /ENOENT/);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("rejects unsafe notes without echoing secret values", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const dryRunReport = await writeReleaseEvidenceArtifact(dryRunInput());

      await assert.rejects(
        () =>
          writeCleanupNoRowsEvidence({
            dryRunArtifactPath: dryRunReport.artifactPath,
            createdAt: new Date("2099-01-05T05:34:00.000Z"),
            notes: ["postgresql://user:secret@example.com/db"],
          }),
        (error) => {
          assert.match(error.message, /notes contain unsafe/);
          assert.equal(error.message.includes("secret@example.com"), false);
          return true;
        }
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("rejects invalid dry-run artifacts without echoing secret values", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const invalidPath = path.join(
        outputPath,
        "credential-cleanup-dry-run",
        `${releaseDate}-053000-credential-cleanup-dry-run-PASS.json`
      );

      await mkdir(path.dirname(invalidPath), { recursive: true });
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: 1,
          project: "PSMS",
          releaseCandidateId,
          gate: "credential-cleanup-dry-run",
          result: "PASS",
          createdAt: "2099-01-05T05:30:00.000Z",
          tokenHash: "v1:hmac-sha256:secret-token-hash",
        })
      );

      const report = await writeCleanupNoRowsEvidence({
        dryRunArtifactPath: path.relative(workspaceRoot, invalidPath),
      });

      assert.equal(report.ok, false);
      assert.equal(
        report.code,
        "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_DRY_RUN_INVALID"
      );
      assert.equal(JSON.stringify(report).includes("secret-token-hash"), false);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });
});
