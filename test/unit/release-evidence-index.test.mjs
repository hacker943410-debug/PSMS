import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildReleaseEvidenceIndex,
  formatReleaseEvidenceIndexMarkdown,
} from "../../scripts/release-evidence-index.mjs";
import { writeReleaseEvidenceArtifact } from "../../scripts/release-evidence-write.mjs";

const workspaceRoot = process.cwd();
const outputRoot = "release-evidence";
const releaseDate = "20990104";
const outputPath = path.join(workspaceRoot, outputRoot, releaseDate);
const releaseCandidateId = "release-20990104-local";

const requiredGates = [
  {
    gate: "env-gate",
    scope: "release candidate",
    command: "pnpm release:gate:prod-env",
    gateType: "automated",
    required: true,
  },
  {
    gate: "credential-cleanup-confirm",
    scope: "credential cleanup",
    command: "pnpm ops:credential-compensation-cleanup --confirm ...",
    gateType: "automated",
    required: true,
  },
  {
    gate: "postgresql-readiness",
    scope: "PostgreSQL release candidate",
    command: "pnpm pg:profile:require-readiness",
    gateType: "manual",
    required: true,
  },
];

function baseInput(overrides = {}) {
  return {
    releaseCandidateId,
    gate: "env-gate",
    result: "PASS",
    createdAt: new Date("2099-01-04T05:30:00.000Z"),
    owner: "release-operator",
    reviewer: "security-reviewer",
    commandName: "release:gate:prod-env",
    commandTemplate: "pnpm release:gate:prod-env",
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
      commandCaptured: true,
      parsedJson: true,
      parsedFrom: "stdout",
      exitCode: 0,
    },
    outputRoot,
    retentionUntil: "2100-01-04T00:00:00.000Z",
    storageOwner: "release-ops",
    accessClass: "internal-restricted",
    ...overrides,
  };
}

describe("release evidence index assembler", () => {
  it("marks missing required gates as BLOCK", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      await writeReleaseEvidenceArtifact(baseInput());

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates,
          releaseCandidateId,
        }
      );
      const missing = report.rows.find(
        (row) => row.gate === "credential-cleanup-confirm"
      );

      assert.equal(report.ok, false);
      assert.equal(report.scannedFiles, 1);
      assert.equal(report.missingRequiredCount, 2);
      assert.equal(missing.result, "BLOCK");
      assert.equal(missing.status, "MISSING");
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("selects the latest valid artifact per gate", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      await writeReleaseEvidenceArtifact(
        baseInput({
          createdAt: new Date("2099-01-04T05:30:00.000Z"),
          result: "BLOCK",
          exitCode: 1,
          evidence: { commandCaptured: true, parsedJson: false },
        })
      );
      await writeReleaseEvidenceArtifact(
        baseInput({
          createdAt: new Date("2099-01-04T05:31:00.000Z"),
          result: "PASS",
          exitCode: 0,
          evidence: { commandCaptured: true, parsedJson: true },
        })
      );

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [requiredGates[0]],
          releaseCandidateId,
        }
      );
      const row = report.rows[0];

      assert.equal(report.ok, true);
      assert.equal(row.result, "PASS");
      assert.equal(row.createdAt, "2099-01-04T05:31:00.000Z");
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("uses relative path as deterministic tie-breaker for same-time artifacts", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      await writeReleaseEvidenceArtifact(
        baseInput({
          createdAt: new Date("2099-01-04T05:31:00.000Z"),
          result: "BLOCK",
          exitCode: 1,
          evidence: { commandCaptured: true, parsedJson: false },
        })
      );
      await writeReleaseEvidenceArtifact(
        baseInput({
          createdAt: new Date("2099-01-04T05:31:00.000Z"),
          result: "PASS",
          exitCode: 0,
          evidence: { commandCaptured: true, parsedJson: true },
        })
      );

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [requiredGates[0]],
          releaseCandidateId,
        }
      );
      const row = report.rows[0];

      assert.equal(report.ok, true);
      assert.equal(row.result, "PASS");
      assert.match(row.file, /env-gate-PASS\.json$/);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("preserves allowed N/A artifacts and renders markdown safely", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      await writeReleaseEvidenceArtifact(
        baseInput({
          gate: "postgresql-readiness",
          result: "N/A-SQLite-only",
          exitCode: "N/A",
          commandName: "pg:profile:require-readiness",
          commandTemplate: "pnpm pg:profile:require-readiness",
          environment: undefined,
          databaseProvider: "sqlite",
          databaseIdentifier: "file:<redacted-or-approved-path>",
          postgresqlReadiness: "N/A-SQLite-only",
          evidence: { reason: "local sqlite release" },
        })
      );

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [requiredGates[2]],
          releaseCandidateId,
        }
      );
      const markdown = formatReleaseEvidenceIndexMarkdown(report);

      assert.equal(report.ok, true);
      assert.equal(report.rows[0].result, "N/A-SQLite-only");
      assert.match(markdown, /\| postgresql-readiness \|/);
      assert.equal(markdown.includes("postgresql://"), false);
      assert.equal(markdown.includes("Authorization"), false);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("adds invalid artifacts as BLOCK rows without echoing secret values", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const invalidPath = path.join(
        outputPath,
        "env-gate",
        `${releaseDate}-060000-env-gate-PASS.json`
      );

      await mkdir(path.dirname(invalidPath), { recursive: true });
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: 1,
          project: "PSMS",
          releaseCandidateId,
          gate: "env-gate",
          result: "PASS",
          createdAt: "2099-01-04T06:00:00.000Z",
          tokenHash: "v1:hmac-sha256:secret-token-hash",
        })
      );

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [requiredGates[0]],
          releaseCandidateId,
        }
      );
      const invalid = report.rows.find((row) => row.status === "INVALID");

      assert.equal(report.ok, false);
      assert.equal(report.invalidArtifactCount, 1);
      assert.equal(invalid.result, "BLOCK");
      assert.equal(JSON.stringify(report).includes("secret-token-hash"), false);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("validates discovered JSON artifacts before release candidate filtering", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const invalidPath = path.join(
        outputPath,
        "env-gate",
        `${releaseDate}-070000-env-gate-PASS.json`
      );

      await mkdir(path.dirname(invalidPath), { recursive: true });
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: 1,
          project: "PSMS",
          releaseCandidateId: "different-release-candidate",
          gate: "env-gate",
          result: "PASS",
          createdAt: "2099-01-04T07:00:00.000Z",
        })
      );

      const report = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [],
          releaseCandidateId,
        }
      );

      assert.equal(report.ok, false);
      assert.equal(report.validArtifactCount, 0);
      assert.equal(report.invalidArtifactCount, 1);
      assert.equal(report.rows[0].status, "INVALID");
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("redacts sensitive-looking markdown cell content", () => {
    const markdown = formatReleaseEvidenceIndexMarkdown({
      rows: [
        {
          gate: "env-gate",
          scope: "release candidate",
          command: "Authorization: Bearer secret-bearer-token",
          exitCode: 0,
          file: "release-evidence/postgresql://user:secret@example.com/db",
          artifactSha256: "sha",
          result: "BLOCK",
          createdAt: "2099-01-04T05:30:00.000Z",
          reviewer: "reviewer|with-pipe",
          notes:
            "Cookie: psms_session=secret-cookie and https://example.com/staff-activation?token=secret-token tokenHash",
        },
      ],
    });

    assert.equal(markdown.includes("secret-bearer-token"), false);
    assert.equal(markdown.includes("user:secret@example.com"), false);
    assert.equal(markdown.includes("secret-cookie"), false);
    assert.equal(markdown.includes("secret-token"), false);
    assert.equal(markdown.includes("tokenHash"), false);
    assert.match(markdown, /reviewer\\\|with-pipe/);
  });
});
