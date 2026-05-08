import assert from "node:assert/strict";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  validateReleaseEvidenceArtifact,
  validateReleaseEvidencePath,
} from "../../scripts/release-evidence-validate.mjs";
import {
  buildReleaseEvidenceArtifact,
  writeReleaseEvidenceArtifact,
} from "../../scripts/release-evidence-write.mjs";

const workspaceRoot = process.cwd();
const outputRoot = "release-evidence";
const outputPath = path.join(workspaceRoot, outputRoot, "20990102");

function baseInput(overrides = {}) {
  return {
    releaseCandidateId: "release-20990102-local",
    gate: "credential-cleanup-dry-run",
    result: "PASS",
    createdAt: new Date("2099-01-02T05:30:00.000Z"),
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
    retentionUntil: "2100-01-02T00:00:00.000Z",
    storageOwner: "release-ops",
    accessClass: "internal-restricted",
    ...overrides,
  };
}

describe("release evidence writer", () => {
  it("builds a validator-compatible artifact with canonical SHA", () => {
    const { artifact, relativePath } =
      buildReleaseEvidenceArtifact(baseInput());
    const failures = validateReleaseEvidenceArtifact(
      artifact,
      relativePath,
      JSON.stringify(artifact)
    );

    assert.match(
      relativePath,
      /^release-evidence\/20990102\/credential-cleanup-dry-run\/20990102-053000-credential-cleanup-dry-run-PASS\.json$/
    );
    assert.match(artifact.artifactSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      artifact.forbiddenFieldScan.scannedRoots.includes("release-evidence"),
      true
    );
    assert.deepEqual(failures, []);
  });

  it("writes an artifact that passes recursive validation", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const report = await writeReleaseEvidenceArtifact(baseInput());
      const validation = await validateReleaseEvidencePath(
        "release-evidence/20990102"
      );
      const fileStats = await stat(
        path.join(workspaceRoot, report.artifactPath)
      );

      assert.equal(report.ok, true);
      assert.match(report.artifactSha256, /^[a-f0-9]{64}$/);
      assert.equal(fileStats.isFile(), true);
      assert.equal(validation.ok, true);
      assert.equal(validation.scannedFiles, 1);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("refuses to write artifacts that fail validation", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const report = await writeReleaseEvidenceArtifact(
        baseInput({
          commandTemplate:
            "pnpm ops:credential-compensation-cleanup --token-id actual-token-id",
        })
      );

      assert.equal(report.ok, false);
      assert.ok(
        report.failures.some(
          (failure) => failure.id === "commandTemplate.token-id"
        )
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });
});
