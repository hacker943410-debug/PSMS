import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

import {
  buildManualAttestationEvidenceInput,
  writeManualAttestationEvidence,
} from "../../scripts/release-evidence-attest.mjs";
import {
  validateReleaseEvidenceArtifact,
  validateReleaseEvidencePath,
} from "../../scripts/release-evidence-validate.mjs";
import { buildReleaseEvidenceIndex } from "../../scripts/release-evidence-index.mjs";
import { buildReleaseEvidenceArtifact } from "../../scripts/release-evidence-write.mjs";

const workspaceRoot = process.cwd();
const releaseDate = "20990105";
const outputRoot = "release-evidence";
const outputPath = path.join(workspaceRoot, outputRoot, releaseDate);
const releaseCandidateId = "release-20990105-local";

const requiredAttestationGates = [
  {
    gate: "external-scrub-attestation",
    scope: "external systems",
    command: "external owner attestation",
    gateType: "external",
    required: true,
  },
  {
    gate: "webhook-receiver-log-policy",
    scope: "external receiver",
    command: "receiver owner attestation",
    gateType: "external",
    required: true,
  },
  {
    gate: "rollback-rehearsal",
    scope: "release rollback",
    command: "backup/restore or rollback note",
    gateType: "manual",
    required: true,
  },
];

const controlSets = {
  "external-scrub-attestation": {
    queryStringCaptureDisabled: true,
    requestBodyCaptureDisabled: true,
    cookieHeaderScrubbed: true,
    setCookieHeaderScrubbed: true,
    authorizationHeaderScrubbed: true,
    telemetryScrubbed: true,
    externalOwnerAttested: true,
  },
  "webhook-receiver-log-policy": {
    requestBodyNotPersisted: true,
    rawSecretNotPersisted: true,
    authHeaderValueNotPersisted: true,
    deliveryIdMetadataOnly: true,
    attemptMetadataOnly: true,
    receiverOwnerAttested: true,
  },
  "rollback-rehearsal": {
    backupVerified: true,
    dbRestoreOrRollbackRehearsed: true,
    migrationStatusChecked: true,
    applicationRestartChecked: true,
    secretRotationPlanReviewed: true,
    credentialInvalidationPlanReviewed: true,
    artifactQuarantinePlanReviewed: true,
    rollbackOwnerAttested: true,
  },
};

function baseInput(gate, overrides = {}) {
  return {
    gate,
    result: "PASS",
    releaseCandidateId,
    createdAt: new Date("2099-01-05T05:30:00.000Z"),
    attestedAt: new Date("2099-01-05T05:29:00.000Z"),
    attestationReference: `${gate}-ATTEST-20990105`,
    supportingEvidenceArtifactPath: `release-evidence/${releaseDate}/manual-attestation-support/${gate}.md`,
    supportingEvidenceArtifactSha256: "b".repeat(64),
    owner: `${gate}-owner`,
    reviewer: `${gate}-reviewer`,
    outputRoot,
    retentionUntil: "2100-01-05T00:00:00.000Z",
    storageOwner: "release-ops",
    accessClass: "internal-restricted",
    backupArtifactSha256: "c".repeat(64),
    controls: controlSets[gate],
    ...overrides,
  };
}

function failureIds(failures) {
  return failures.map((failure) => failure.id);
}

describe("manual/external release evidence attestation helper", () => {
  it("writes validator-compatible PASS artifacts that satisfy required manual gates", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const reports = [];

      for (const [index, gate] of requiredAttestationGates
        .map((item) => item.gate)
        .entries()) {
        reports.push(
          await writeManualAttestationEvidence(
            baseInput(gate, {
              createdAt: new Date(`2099-01-05T05:3${index}:00.000Z`),
            })
          )
        );
      }

      assert.deepEqual(
        reports.map((report) => report.ok),
        [true, true, true]
      );

      const validation = await validateReleaseEvidencePath(
        `release-evidence/${releaseDate}`
      );
      const index = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: requiredAttestationGates,
          releaseCandidateId,
        }
      );
      const receiverArtifact = JSON.parse(
        await readFile(
          path.join(workspaceRoot, reports[1].artifactPath),
          "utf8"
        )
      );

      assert.equal(validation.ok, true);
      assert.equal(validation.scannedFiles, 3);
      assert.equal(index.ok, true);
      assert.equal(index.passLikeCount, 3);
      assert.equal(
        receiverArtifact.evidence.receiverContract.retryMaxAttemptsObserved,
        1
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("rejects PASS when any required control is false before writing", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const report = await writeManualAttestationEvidence(
        baseInput("external-scrub-attestation", {
          controls: {
            ...controlSets["external-scrub-attestation"],
            telemetryScrubbed: false,
          },
        })
      );
      const validation = await validateReleaseEvidencePath(
        `release-evidence/${releaseDate}`,
        { allowEmpty: true }
      );

      assert.equal(report.ok, false);
      assert.equal(report.code, "RELEASE_EVIDENCE_ATTESTATION_NOT_PASSABLE");
      assert.equal(validation.scannedFiles, 0);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("rejects generic writer artifacts for manual gates without structured attestation evidence", () => {
    const { artifact, relativePath } = buildReleaseEvidenceArtifact({
      releaseCandidateId,
      gate: "external-scrub-attestation",
      result: "PASS",
      createdAt: new Date("2099-01-05T05:30:00.000Z"),
      owner: "release-operator",
      reviewer: "security-reviewer",
      commandName: "manual-attestation",
      commandTemplate: "external owner attestation",
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
        approved: true,
      },
      outputRoot,
      retentionUntil: "2100-01-05T00:00:00.000Z",
      storageOwner: "release-ops",
      accessClass: "internal-restricted",
    });
    const ids = failureIds(
      validateReleaseEvidenceArtifact(
        artifact,
        relativePath,
        JSON.stringify(artifact)
      )
    );

    assert.ok(ids.includes("manualAttestation.commandName"));
    assert.ok(ids.includes("manualAttestation.controls"));
    assert.ok(ids.includes("manualAttestation.supportingEvidenceArtifactPath"));
  });

  it("selects a newer manual BLOCK artifact as a release blocker", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const pass = await writeManualAttestationEvidence(
        baseInput("external-scrub-attestation", {
          createdAt: new Date("2099-01-05T05:30:00.000Z"),
        })
      );
      const block = await writeManualAttestationEvidence(
        baseInput("external-scrub-attestation", {
          result: "BLOCK",
          createdAt: new Date("2099-01-05T05:31:00.000Z"),
          blockReason: "control-gap",
          controls: {
            ...controlSets["external-scrub-attestation"],
            telemetryScrubbed: false,
          },
        })
      );
      const index = await buildReleaseEvidenceIndex(
        `release-evidence/${releaseDate}`,
        {
          requiredGates: [requiredAttestationGates[0]],
          releaseCandidateId,
        }
      );

      assert.equal(pass.ok, true);
      assert.equal(block.ok, true);
      assert.equal(index.ok, false);
      assert.equal(index.rows[0].result, "BLOCK");
      assert.equal(index.rows[0].status, "BLOCK");
      assert.match(index.rows[0].file, /external-scrub-attestation-BLOCK/);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("rejects unsafe references without echoing secret values", async () => {
    const secretUrl =
      "https://example.test/staff-activation?token=secret-release-token";
    const report = await writeManualAttestationEvidence(
      baseInput("webhook-receiver-log-policy", {
        attestationReference: secretUrl,
      })
    );
    const serialized = JSON.stringify(report);

    assert.equal(report.ok, false);
    assert.equal(serialized.includes("secret-release-token"), false);
    assert.equal(serialized.includes(secretUrl), false);
  });

  it("rejects unsupported N/A results for manual and external gates", () => {
    const report = buildManualAttestationEvidenceInput(
      baseInput("rollback-rehearsal")
    );

    assert.equal(report.result, "PASS");
    assert.throws(
      () =>
        buildManualAttestationEvidenceInput(
          baseInput("rollback-rehearsal", {
            result: "N/A-SQLite-only",
          })
        ),
      /Unsupported attestation result/
    );
  });

  it("does not echo unsafe positional CLI arguments", () => {
    const secretArg =
      "https://example.test/password-reset?token=secret-cli-token";
    const result = spawnSync(
      process.execPath,
      ["scripts/release-evidence-attest.mjs", secretArg],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
      }
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0);
    assert.equal(output.includes("secret-cli-token"), false);
    assert.equal(output.includes(secretArg), false);
  });
});
