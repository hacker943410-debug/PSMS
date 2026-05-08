import assert from "node:assert/strict";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildCapturedArtifactInput,
  captureReleaseEvidenceCommand,
  redactCommandOutput,
} from "../../scripts/release-evidence-capture.mjs";
import { validateReleaseEvidencePath } from "../../scripts/release-evidence-validate.mjs";

const workspaceRoot = process.cwd();
const outputRoot = "release-evidence";
const outputPath = path.join(workspaceRoot, outputRoot, "20990103");

function baseInput(overrides = {}) {
  return {
    releaseCandidateId: "release-20990103-local",
    createdAt: new Date("2099-01-03T05:30:00.000Z"),
    owner: "release-operator",
    reviewer: "security-reviewer",
    releaseKind: "local-electron-sqlite",
    outputRoot,
    retentionUntil: "2100-01-03T00:00:00.000Z",
    storageOwner: "release-ops",
    accessClass: "internal-restricted",
    ...overrides,
  };
}

function commandReport(overrides = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    truncated: false,
    ...overrides,
  };
}

function runner(report) {
  return async () => report;
}

describe("release evidence command capture", () => {
  it("writes a validator-compatible prod env capture artifact", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const report = await captureReleaseEvidenceCommand(
        baseInput({ commandKey: "prod-env" }),
        runner(
          commandReport({
            stdout: JSON.stringify({
              ok: true,
              code: "PRODUCTION_RELEASE_GATE_OK",
              stage: "prod-env",
              checks: [{ id: "runtime.node-env", ok: true }],
              failures: [],
              manualChecks: ["manual release checklist omitted from evidence"],
            }),
            stdoutBytes: 128,
          })
        )
      );
      const validation = await validateReleaseEvidencePath(
        "release-evidence/20990103"
      );
      const fileStats = await stat(
        path.join(workspaceRoot, report.artifactPath)
      );

      assert.equal(report.ok, true);
      assert.equal(report.capturedResult, "PASS");
      assert.equal(fileStats.isFile(), true);
      assert.equal(validation.ok, true);
      assert.equal(validation.scannedFiles, 1);
      assert.match(
        report.artifactPath,
        /env-gate\/20990103-053000-env-gate-PASS\.json$/
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("passes fixed argv arrays to the runner without shell input", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const seen = [];
      const report = await captureReleaseEvidenceCommand(
        baseInput({
          commandKey: "secret-scan",
          createdAt: new Date("2099-01-03T05:31:00.000Z"),
        }),
        async (config) => {
          seen.push(config);
          return commandReport({
            stdout: JSON.stringify({
              ok: true,
              scannedFiles: 10,
              skipped: { "binary-extension": 2 },
              roots: ["release-evidence"],
            }),
          });
        }
      );

      assert.equal(report.ok, true);
      assert.equal(seen.length, 1);
      assert.equal(seen[0].commandName, "release:gate:logs");
      assert.deepEqual(seen[0].args, ["release:gate:logs"]);
      assert.equal(/[;&|`\r\n]/.test(seen[0].commandTemplate), false);
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("records pg preflight readiness BLOCK as a BLOCK artifact", () => {
    const artifactInput = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "pg-profile-preflight" }),
      config: {
        commandName: "pg:profile:preflight",
        commandTemplate: "pnpm pg:profile:preflight",
        gate: "postgresql-profile",
        databaseProvider: "postgresql",
        databaseIdentifier: "postgresql:<redacted>",
      },
      commandReport: commandReport({
        stdout: JSON.stringify({
          ok: true,
          code: "POSTGRESQL_PROFILE_PREFLIGHT_OK",
          readiness: "BLOCK",
          checks: [{ id: "pg.schema.exists", ok: true }],
          readinessBlockers: [{ id: "pg.dependency.pg", ok: false }],
          failures: [],
        }),
      }),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          ok: true,
          code: "POSTGRESQL_PROFILE_PREFLIGHT_OK",
          readiness: "BLOCK",
          checks: [{ id: "pg.schema.exists", ok: true }],
          readinessBlockers: [{ id: "pg.dependency.pg", ok: false }],
          failures: [],
        },
      },
    });

    assert.equal(artifactInput.result, "BLOCK");
    assert.equal(artifactInput.postgresqlReadiness, "BLOCK");
    assert.equal(artifactInput.databaseIdentifier, "postgresql:<redacted>");
    assert.equal(artifactInput.evidence.readinessBlockerCount, 1);
  });

  it("writes BLOCK evidence for timed-out commands", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const report = await captureReleaseEvidenceCommand(
        baseInput({
          commandKey: "pg-profile-readiness",
          createdAt: new Date("2099-01-03T05:32:00.000Z"),
          releaseKind: "postgresql-rehearsal",
        }),
        runner(
          commandReport({
            exitCode: 124,
            timedOut: true,
            stderr: "postgresql://user:secret@example.com/db",
            stderrBytes: 40,
          })
        )
      );
      const validation = await validateReleaseEvidencePath(
        "release-evidence/20990103"
      );

      assert.equal(report.ok, true);
      assert.equal(report.capturedResult, "BLOCK");
      assert.equal(validation.ok, true);
      assert.equal(
        JSON.stringify(validation).includes("secret@example.com"),
        false
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("maps credential cleanup dry-run candidates to the release allow-list", () => {
    const artifactInput = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "credential-cleanup-dry-run" }),
      config: {
        commandName: "ops:credential-compensation-cleanup",
        commandTemplate: "pnpm ops:credential-compensation-cleanup",
        gate: "credential-cleanup-dry-run",
      },
      commandReport: commandReport(),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          mode: "dry-run",
          detectionWindowMinutes: 10,
          candidates: [
            {
              id: "token_1",
              userId: "user_1",
              purpose: "PASSWORD_RESET",
              createdAt: "2099-01-03T05:00:00.000Z",
              expiresAt: "2099-01-03T06:00:00.000Z",
              createdById: "admin_1",
              ipAddress: "198.51.100.1",
              tokenHash: "v1:hmac-sha256:secret-token-hash",
            },
          ],
          cleanedTokenIds: [],
          auditLogIds: [],
        },
      },
    });

    assert.equal(artifactInput.summary.candidateCount, 1);
    assert.deepEqual(Object.keys(artifactInput.evidence.candidates[0]).sort(), [
      "createdAt",
      "createdById",
      "detectionWindowMinutes",
      "expiresAt",
      "hadActiveKey",
      "hadRevokedAt",
      "hadUsedAt",
      "purpose",
      "tokenId",
      "userId",
    ]);
    assert.equal(
      JSON.stringify(artifactInput).includes("secret-token-hash"),
      false
    );
    assert.equal(JSON.stringify(artifactInput).includes("198.51.100.1"), false);
  });

  it("captures credential cleanup confirm with placeholder template and safe argv", async () => {
    await rm(outputPath, { force: true, recursive: true });

    try {
      const seen = [];
      const report = await captureReleaseEvidenceCommand(
        baseInput({
          commandKey: "credential-cleanup-confirm",
          createdAt: new Date("2099-01-03T05:33:00.000Z"),
          tokenIds: ["cleanup_1"],
          expectedCandidateCount: 1,
          actorUserId: "admin_1",
          operator: "release-operator",
          ticketId: "OPS-20990103",
          detectionWindowMinutes: 10,
        }),
        async (config) => {
          seen.push(config);
          return commandReport({
            stdout: JSON.stringify({
              mode: "confirmed",
              detectionWindowMinutes: 10,
              candidates: [
                {
                  id: "cleanup_1",
                  userId: "user_1",
                  purpose: "STAFF_ACTIVATION",
                  createdAt: "2099-01-03T05:00:00.000Z",
                  expiresAt: "2099-01-03T06:00:00.000Z",
                  createdById: "admin_1",
                  activeKey: "forbidden-active-key",
                  tokenHash: "v1:hmac-sha256:secret-token-hash",
                },
              ],
              cleanedTokenIds: ["cleanup_1"],
              auditLogIds: ["audit_1"],
            }),
          });
        }
      );
      const validation = await validateReleaseEvidencePath(
        "release-evidence/20990103/credential-cleanup-confirm"
      );

      assert.equal(report.ok, true);
      assert.equal(report.capturedResult, "PASS");
      assert.equal(validation.ok, true);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0].args, [
        "ops:credential-compensation-cleanup",
        "--confirm",
        "--token-id",
        "cleanup_1",
        "--expected-count",
        "1",
        "--actor-user-id",
        "admin_1",
        "--operator",
        "release-operator",
        "--ticket-id",
        "OPS-20990103",
        "--detection-window-minutes",
        "10",
      ]);
      assert.match(seen[0].commandTemplate, /--token-id <token-id>/);
      assert.match(seen[0].commandTemplate, /--actor-user-id <admin-user-id>/);
      assert.match(seen[0].commandTemplate, /--operator <operator>/);
      assert.match(seen[0].commandTemplate, /--ticket-id <ticket-id>/);
      assert.equal(seen[0].commandTemplate.includes("cleanup_1"), false);
      assert.equal(seen[0].commandTemplate.includes("admin_1"), false);
      assert.equal(
        JSON.stringify(validation).includes("secret-token-hash"),
        false
      );
      assert.equal(
        JSON.stringify(validation).includes("forbidden-active-key"),
        false
      );
    } finally {
      await rm(outputPath, { force: true, recursive: true });
    }
  });

  it("blocks cleanup confirm when command output is not confirmed", () => {
    const artifactInput = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "credential-cleanup-confirm" }),
      config: {
        commandName: "ops:credential-compensation-cleanup",
        commandTemplate:
          "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
        gate: "credential-cleanup-confirm",
        captureArgs: {
          operator: "release-operator",
          ticketId: "OPS-20990103",
        },
      },
      commandReport: commandReport(),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          mode: "dry-run",
          detectionWindowMinutes: 10,
          candidates: [],
          cleanedTokenIds: [],
          auditLogIds: [],
        },
      },
    });

    assert.equal(artifactInput.result, "BLOCK");
    assert.equal(artifactInput.gate, "credential-cleanup-confirm");
  });

  it("blocks cleanup confirm when expected count or cleaned ids do not match", () => {
    const expectedMismatch = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "credential-cleanup-confirm" }),
      config: {
        commandName: "ops:credential-compensation-cleanup",
        commandTemplate:
          "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
        gate: "credential-cleanup-confirm",
        captureArgs: {
          tokenIds: ["cleanup_1", "cleanup_2"],
          expectedCount: 2,
          operator: "release-operator",
          ticketId: "OPS-20990103",
        },
      },
      commandReport: commandReport(),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          mode: "confirmed",
          candidates: [{ id: "cleanup_1" }],
          cleanedTokenIds: ["cleanup_1"],
          auditLogIds: ["audit_1"],
        },
      },
    });
    const cleanedMismatch = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "credential-cleanup-confirm" }),
      config: {
        commandName: "ops:credential-compensation-cleanup",
        commandTemplate:
          "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
        gate: "credential-cleanup-confirm",
        captureArgs: {
          tokenIds: ["cleanup_1"],
          expectedCount: 1,
          operator: "release-operator",
          ticketId: "OPS-20990103",
        },
      },
      commandReport: commandReport(),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          mode: "confirmed",
          candidates: [{ id: "cleanup_1" }],
          cleanedTokenIds: ["cleanup_2"],
          auditLogIds: ["audit_1"],
        },
      },
    });

    assert.equal(expectedMismatch.result, "BLOCK");
    assert.equal(cleanedMismatch.result, "BLOCK");
  });

  it("rejects unsafe cleanup confirm capture inputs before execution", async () => {
    await assert.rejects(
      () =>
        captureReleaseEvidenceCommand(
          baseInput({
            commandKey: "credential-cleanup-confirm",
            tokenIds: ["cleanup_1"],
            expectedCandidateCount: 1,
            actorUserId: "admin_1",
            operator: "https://example.com/operator",
            ticketId: "OPS-20990103",
          }),
          runner(commandReport())
        ),
      /operator contains unsafe release evidence text/
    );
  });

  it("redacts command output without leaking secret values", () => {
    const text = redactCommandOutput(
      [
        "postgresql://user:secret@example.com/db?sslmode=require",
        "Authorization: Bearer secret-bearer-token",
        "Cookie: psms_session=secret-cookie-value",
        "X-API-Key: secret-api-key",
        "https://example.com/staff-activation?token=secret-token-value",
        "https://example.com/password-reset?token%3Dsecret-token-value",
        '"tokenHash": "v1:hmac-sha256:secret-token-hash"',
        '"webhookBody": "secret-webhook-body"',
        "AUTH_SECRET=secret-env-value",
      ].join("\n")
    );

    assert.equal(text.includes("secret@example.com"), false);
    assert.equal(text.includes("secret-bearer-token"), false);
    assert.equal(text.includes("secret-cookie-value"), false);
    assert.equal(text.includes("secret-api-key"), false);
    assert.equal(text.includes("secret-token-value"), false);
    assert.equal(text.includes("secret-token-hash"), false);
    assert.equal(text.includes("secret-webhook-body"), false);
    assert.equal(text.includes("secret-env-value"), false);
  });

  it("downgrades otherwise successful commands to BLOCK when high-risk output was redacted", () => {
    const artifactInput = buildCapturedArtifactInput({
      input: baseInput({ commandKey: "prod-env" }),
      config: {
        commandName: "release:gate:prod-env",
        commandTemplate: "pnpm release:gate:prod-env",
        gate: "env-gate",
      },
      commandReport: commandReport({
        redactionHighRisk: true,
        stdout: JSON.stringify({
          ok: true,
          code: "PRODUCTION_RELEASE_GATE_OK",
          checks: [],
          failures: [],
          manualChecks: [],
        }),
      }),
      parsedOutput: {
        source: "stdout",
        parsed: true,
        value: {
          ok: true,
          code: "PRODUCTION_RELEASE_GATE_OK",
          checks: [],
          failures: [],
          manualChecks: [],
        },
      },
    });

    assert.equal(artifactInput.result, "BLOCK");
    assert.equal(artifactInput.evidence.redactionHighRisk, true);
  });

  it("rejects unsupported command keys before execution", async () => {
    await assert.rejects(
      () =>
        captureReleaseEvidenceCommand(
          baseInput({ commandKey: "pnpm-arbitrary" }),
          runner(commandReport())
        ),
      /Unsupported release evidence command key/
    );
  });
});
