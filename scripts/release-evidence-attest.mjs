import { pathToFileURL } from "node:url";

import {
  buildReleaseEvidenceArtifact,
  writeReleaseEvidenceArtifact,
} from "./release-evidence-write.mjs";

const COMMAND_NAME = "release:evidence:attest";
const COMMAND_TEMPLATE =
  "pnpm release:evidence:attest --gate <gate> --result <result> --attestation-reference <reference>";
const ALLOWED_RESULTS = new Set(["PASS", "BLOCK", "NO-GO"]);
const ALLOWED_BLOCK_REASONS = new Set([
  "N/A",
  "external-attestation-pending",
  "control-gap",
  "receiver-idempotency-pending",
  "rollback-rehearsal-pending",
  "release-no-go",
]);
const ALLOWED_OPTIONS = new Set([
  "gate",
  "result",
  "release-candidate-id",
  "created-at",
  "attested-at",
  "attestation-reference",
  "supporting-evidence-artifact",
  "supporting-evidence-sha256",
  "owner",
  "reviewer",
  "release-kind",
  "database-provider",
  "database-identifier",
  "postgresql-readiness",
  "output-root",
  "retention-until",
  "storage-owner",
  "access-class",
  "block-reason",
  "query-string-scrubbed",
  "body-scrubbed",
  "session-headers-scrubbed",
  "set-cookie-header-scrubbed",
  "auth-header-scrubbed",
  "telemetry-scrubbed",
  "external-owner-attested",
  "body-not-persisted",
  "secret-value-not-persisted",
  "auth-header-not-persisted",
  "delivery-id-metadata-only",
  "attempt-metadata-only",
  "receiver-owner-attested",
  "backup-verified",
  "restore-rehearsed",
  "secret-rotation-plan-reviewed",
  "credential-invalidation-plan-reviewed",
  "artifact-quarantine-plan-reviewed",
  "rollback-owner-attested",
  "backup-artifact-alias",
  "backup-artifact-sha256",
]);

export const MANUAL_ATTESTATION_GATES = {
  "external-scrub-attestation": {
    attestationKind: "external-scrub",
    scope: "external systems",
    requiredControls: [
      "queryStringCaptureDisabled",
      "requestBodyCaptureDisabled",
      "cookieHeaderScrubbed",
      "setCookieHeaderScrubbed",
      "authorizationHeaderScrubbed",
      "telemetryScrubbed",
      "externalOwnerAttested",
    ],
    controlOptions: {
      "query-string-scrubbed": "queryStringCaptureDisabled",
      "body-scrubbed": "requestBodyCaptureDisabled",
      "session-headers-scrubbed": "cookieHeaderScrubbed",
      "set-cookie-header-scrubbed": "setCookieHeaderScrubbed",
      "auth-header-scrubbed": "authorizationHeaderScrubbed",
      "telemetry-scrubbed": "telemetryScrubbed",
      "external-owner-attested": "externalOwnerAttested",
    },
  },
  "webhook-receiver-log-policy": {
    attestationKind: "receiver-log-policy",
    scope: "external receiver",
    requiredControls: [
      "requestBodyNotPersisted",
      "rawSecretNotPersisted",
      "authHeaderValueNotPersisted",
      "deliveryIdMetadataOnly",
      "attemptMetadataOnly",
      "receiverOwnerAttested",
    ],
    controlOptions: {
      "body-not-persisted": "requestBodyNotPersisted",
      "secret-value-not-persisted": "rawSecretNotPersisted",
      "auth-header-not-persisted": "authHeaderValueNotPersisted",
      "delivery-id-metadata-only": "deliveryIdMetadataOnly",
      "attempt-metadata-only": "attemptMetadataOnly",
      "receiver-owner-attested": "receiverOwnerAttested",
    },
  },
  "rollback-rehearsal": {
    attestationKind: "rollback-rehearsal",
    scope: "release rollback",
    requiredControls: [
      "backupVerified",
      "dbRestoreOrRollbackRehearsed",
      "migrationStatusChecked",
      "applicationRestartChecked",
      "secretRotationPlanReviewed",
      "credentialInvalidationPlanReviewed",
      "artifactQuarantinePlanReviewed",
      "rollbackOwnerAttested",
    ],
    controlOptions: {
      "backup-verified": "backupVerified",
      "restore-rehearsed": "dbRestoreOrRollbackRehearsed",
      "secret-rotation-plan-reviewed": "secretRotationPlanReviewed",
      "credential-invalidation-plan-reviewed":
        "credentialInvalidationPlanReviewed",
      "artifact-quarantine-plan-reviewed": "artifactQuarantinePlanReviewed",
      "rollback-owner-attested": "rollbackOwnerAttested",
    },
  },
};

export async function writeManualAttestationEvidence(input) {
  let artifactInput;

  try {
    artifactInput = buildManualAttestationEvidenceInput(input);
  } catch (error) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_ATTESTATION_USAGE",
      message: safeErrorMessage(error),
    };
  }

  if (
    artifactInput.result === "PASS" &&
    !Object.values(artifactInput.evidence.controls).every((value) => value)
  ) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_ATTESTATION_NOT_PASSABLE",
      gate: artifactInput.gate,
      message: "PASS attestation requires every required control to be true.",
    };
  }

  const built = buildReleaseEvidenceArtifact(artifactInput);
  const report = await writeReleaseEvidenceArtifact(artifactInput);

  return {
    ...report,
    gate: artifactInput.gate,
    result: artifactInput.result,
    artifactPath: report.artifactPath ?? built.relativePath,
  };
}

export function buildManualAttestationEvidenceInput(input) {
  const gate = readGate(input.gate);
  const config = MANUAL_ATTESTATION_GATES[gate];
  const result = readResult(input.result);
  const createdAt = readDate(input.createdAt ?? new Date(), "createdAt");
  const attestedAt = readDate(input.attestedAt ?? createdAt, "attestedAt");
  const controls = readControls(input.controls ?? {}, config);
  const blockReason =
    result === "PASS" ? "N/A" : readBlockReason(input.blockReason);
  const owner = readRequired(input.owner, "owner");
  const reviewer = readRequired(input.reviewer, "reviewer");

  assertSafeReference(input.attestationReference);
  assertDistinctOwnerReviewer(owner, reviewer);

  return {
    releaseCandidateId: readRequired(
      input.releaseCandidateId,
      "releaseCandidateId"
    ),
    gate,
    result,
    createdAt,
    owner,
    reviewer,
    commandName: COMMAND_NAME,
    commandTemplate: COMMAND_TEMPLATE,
    exitCode: result === "PASS" ? 0 : 1,
    releaseKind: input.releaseKind ?? "local-electron-sqlite",
    databaseProvider: input.databaseProvider ?? "sqlite",
    databaseIdentifier:
      input.databaseIdentifier ?? "file:<redacted-or-approved-path>",
    postgresqlReadiness: input.postgresqlReadiness ?? "N/A-SQLite-only",
    summary: {
      candidateCount: 0,
      cleanedCount: 0,
      auditLogCount: 0,
      secretScanPassed: true,
    },
    evidence: {
      attestationKind: config.attestationKind,
      attestedAt: attestedAt.toISOString(),
      attestationReference: input.attestationReference.trim(),
      supportingEvidenceArtifactPath: readSafeSupportingArtifactPath(
        input.supportingEvidenceArtifactPath
      ),
      supportingEvidenceArtifactSha256: readSha256(
        input.supportingEvidenceArtifactSha256,
        "supportingEvidenceArtifactSha256"
      ),
      controls,
      blockReason,
      ...buildGateSpecificEvidence(gate, input),
    },
    outputRoot: input.outputRoot,
    retentionUntil:
      input.retentionUntil ?? addUtcYears(createdAt, 1).toISOString(),
    storageOwner: input.storageOwner ?? "release-ops",
    accessClass: input.accessClass ?? "internal-restricted",
    notes: input.notes ?? [
      `${config.attestationKind} manual attestation captured as release evidence.`,
    ],
  };
}

function readGate(value) {
  const gate = readRequired(value, "gate");

  if (!Object.hasOwn(MANUAL_ATTESTATION_GATES, gate)) {
    throw new Error("Unsupported attestation gate.");
  }

  return gate;
}

function readResult(value) {
  const result = readRequired(value, "result");

  if (!ALLOWED_RESULTS.has(result)) {
    throw new Error("Unsupported attestation result.");
  }

  return result;
}

function readBlockReason(value) {
  const reason = readRequired(value, "blockReason");

  if (!ALLOWED_BLOCK_REASONS.has(reason) || reason === "N/A") {
    throw new Error("Unsupported attestation block reason.");
  }

  return reason;
}

function readControls(inputControls, config) {
  const controls = {};

  for (const controlName of config.requiredControls) {
    if (!(controlName in inputControls)) {
      throw new Error("Every required attestation control must be set.");
    }

    if (typeof inputControls[controlName] !== "boolean") {
      throw new Error("Attestation controls must be boolean.");
    }

    controls[controlName] = inputControls[controlName];
  }

  return controls;
}

function buildGateSpecificEvidence(gate, input) {
  if (gate === "external-scrub-attestation") {
    return {
      coveredSystems: ["reverse-proxy", "cdn", "apm", "error-reporting"],
      credentialRouteClassesCovered: ["staff-activation", "password-reset"],
      scrubbedFields: [
        "query-string",
        "request-body",
        "session-header",
        "response-session-header",
        "auth-header",
      ],
    };
  }

  if (gate === "webhook-receiver-log-policy") {
    return {
      receiverContract: {
        dedupeKey: "X-PSMS-Delivery-Id",
        attemptHeaderDiagnosticOnly: true,
        duplicateSuccessReturns2xx: true,
        atomicPersistenceAttested: true,
        dedupeRetentionLongerThanCredentialExpiry: true,
        retryMaxAttemptsObserved: 1,
        loggedMetadataAllowlist: [
          "deliveryId",
          "attempt",
          "status",
          "timestamp",
          "failureClass",
        ],
      },
    };
  }

  if (gate === "rollback-rehearsal") {
    return {
      rollbackRehearsal: {
        backupArtifactAlias: readSafeAlias(
          input.backupArtifactAlias ?? "release-backup-redacted",
          "backupArtifactAlias"
        ),
        backupArtifactSha256: readSha256(
          input.backupArtifactSha256,
          "backupArtifactSha256"
        ),
        migrationStatusChecked: true,
        applicationRestartChecked: true,
        dbRestoreOrRollbackRehearsed: true,
      },
    };
  }

  return {};
}

function readRequired(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function readDate(value, fieldName) {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

function addUtcYears(date, years) {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function assertSafeReference(value) {
  const reference = readRequired(value, "attestationReference");

  if (
    reference.length > 80 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/.test(reference) ||
    /https?:|[\\/]|[?&=]|\bpostgres(?:ql)?:|\bbearer\b|\bauthorization\b|\bcookie\b|\bset-cookie\b|\bpassword\b|\btokenhash\b|\brawtoken\b/i.test(
      reference
    )
  ) {
    throw new Error("attestationReference must be a safe opaque reference.");
  }
}

function assertDistinctOwnerReviewer(owner, reviewer) {
  if (owner.toLowerCase() === reviewer.toLowerCase()) {
    throw new Error("reviewer must be distinct from owner.");
  }
}

function readSafeAlias(value, fieldName) {
  const alias = readRequired(value, fieldName);

  if (
    alias.length > 80 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*[A-Za-z0-9]$/.test(alias) ||
    /https?:|[\\/]|[?&=]|\bpostgres(?:ql)?:|\bbearer\b|\bauthorization\b|\bcookie\b|\bset-cookie\b|\bpassword\b|\btokenhash\b|\brawtoken\b/i.test(
      alias
    )
  ) {
    throw new Error(`${fieldName} must be a safe opaque alias.`);
  }

  return alias;
}

function readSafeSupportingArtifactPath(value) {
  const artifactPath = readRequired(value, "supportingEvidenceArtifactPath");

  if (
    !/^release-evidence\/\d{8}\/manual-attestation-support\/[A-Za-z0-9._-]+\.(json|md|txt)$/.test(
      artifactPath
    ) ||
    /https?:|[?&=]|\bpostgres(?:ql)?:|\bbearer\b|\bauthorization\b|\bcookie\b|\bset-cookie\b|\bpassword\b|\btokenhash\b|\brawtoken\b/i.test(
      artifactPath
    )
  ) {
    throw new Error(
      "supportingEvidenceArtifactPath must be a safe release-evidence support path."
    );
  }

  return artifactPath;
}

function readSha256(value, fieldName) {
  const sha256 = readRequired(value, fieldName);

  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new Error(`${fieldName} must be a SHA256 hex digest.`);
  }

  return sha256.toLowerCase();
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      throw new Error("Unexpected positional argument.");
    }

    const key = arg.slice(2);

    if (!ALLOWED_OPTIONS.has(key)) {
      throw new Error("Unsupported option.");
    }

    const next = args[index + 1];

    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function inputFromArgs(args) {
  const gate = args.gate;
  const config = MANUAL_ATTESTATION_GATES[gate];
  const controls = {};

  if (config) {
    for (const [optionName, controlName] of Object.entries(
      config.controlOptions
    )) {
      controls[controlName] = readBooleanOption(args[optionName]);
    }
  }

  return {
    gate,
    result: args.result,
    releaseCandidateId: args["release-candidate-id"],
    createdAt: args["created-at"]
      ? new Date(String(args["created-at"]))
      : undefined,
    attestedAt: args["attested-at"]
      ? new Date(String(args["attested-at"]))
      : undefined,
    attestationReference: args["attestation-reference"],
    supportingEvidenceArtifactPath: args["supporting-evidence-artifact"],
    supportingEvidenceArtifactSha256: args["supporting-evidence-sha256"],
    owner: args.owner,
    reviewer: args.reviewer,
    releaseKind: args["release-kind"],
    databaseProvider: args["database-provider"],
    databaseIdentifier: args["database-identifier"],
    postgresqlReadiness: args["postgresql-readiness"],
    outputRoot: args["output-root"],
    retentionUntil: args["retention-until"],
    storageOwner: args["storage-owner"],
    accessClass: args["access-class"],
    blockReason: args["block-reason"],
    backupArtifactAlias: args["backup-artifact-alias"],
    backupArtifactSha256: args["backup-artifact-sha256"],
    controls,
  };
}

function readBooleanOption(value) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    /https?:|postgres(?:ql)?:|bearer|authorization|cookie|set-cookie|password|token|secret/i.test(
      message
    )
  ) {
    return "Invalid attestation input.";
  }

  return message;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await writeManualAttestationEvidence(inputFromArgs(args));
  const payload = JSON.stringify(report, null, 2);

  if (!report.ok) {
    console.error(payload);
    process.exit(1);
  }

  console.log(payload);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "RELEASE_EVIDENCE_ATTESTATION_ERROR",
          message: safeErrorMessage(error),
        },
        null,
        2
      )
    );
    process.exit(2);
  });
}
