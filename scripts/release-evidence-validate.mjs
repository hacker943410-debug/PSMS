import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_EVIDENCE_ROOT = "release-evidence";
const ALLOWED_RESULTS = new Set([
  "PASS",
  "BLOCK",
  "NO-GO",
  "N/A-SQLite-only",
  "N/A-NoRows",
]);
const RESULT_FILE_SLUGS = new Map([
  ["PASS", "PASS"],
  ["BLOCK", "BLOCK"],
  ["NO-GO", "NO-GO"],
  ["N/A-SQLite-only", "NA-SQLite-only"],
  ["N/A-NoRows", "NA-NoRows"],
]);
const ALLOWED_CANDIDATE_FIELDS = new Set([
  "tokenId",
  "userId",
  "purpose",
  "createdAt",
  "expiresAt",
  "createdById",
  "hadActiveKey",
  "hadUsedAt",
  "hadRevokedAt",
  "detectionWindowMinutes",
]);
const REQUIRED_TOP_LEVEL_FIELDS = [
  "schemaVersion",
  "project",
  "releaseCandidateId",
  "gate",
  "result",
  "createdAt",
  "owner",
  "reviewer",
  "commandName",
  "commandTemplate",
  "commandArgsRedacted",
  "exitCode",
  "artifactSha256",
  "environment",
  "summary",
  "evidence",
  "forbiddenFieldScan",
  "retention",
  "quarantine",
  "notes",
];
const NO_ROWS_GATES = new Set([
  "credential-cleanup-confirm",
  "credential-cleanup-auditlog",
]);
const MANUAL_ATTESTATION_GATE_SCHEMAS = new Map([
  [
    "external-scrub-attestation",
    {
      attestationKind: "external-scrub",
      requiredControls: [
        "queryStringCaptureDisabled",
        "requestBodyCaptureDisabled",
        "cookieHeaderScrubbed",
        "setCookieHeaderScrubbed",
        "authorizationHeaderScrubbed",
        "telemetryScrubbed",
        "externalOwnerAttested",
      ],
    },
  ],
  [
    "webhook-receiver-log-policy",
    {
      attestationKind: "receiver-log-policy",
      requiredControls: [
        "requestBodyNotPersisted",
        "rawSecretNotPersisted",
        "authHeaderValueNotPersisted",
        "deliveryIdMetadataOnly",
        "attemptMetadataOnly",
        "receiverOwnerAttested",
      ],
    },
  ],
  [
    "rollback-rehearsal",
    {
      attestationKind: "rollback-rehearsal",
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
    },
  ],
]);
const MANUAL_ATTESTATION_COMMAND_NAME = "release:evidence:attest";
const MANUAL_ATTESTATION_COMMAND_TEMPLATE =
  "pnpm release:evidence:attest --gate <gate> --result <result> --attestation-reference <reference>";
const MANUAL_ATTESTATION_BLOCK_REASONS = new Set([
  "external-attestation-pending",
  "control-gap",
  "receiver-idempotency-pending",
  "rollback-rehearsal-pending",
  "release-no-go",
]);
const FORBIDDEN_PATTERNS = [
  ["postgresql dsn", /\bpostgres(?:ql)?:\/\/[^\s"']{8,512}/i],
  [
    "credential url",
    /https?:\/\/[^\s"']*(?:[?&]token=|staff-activation|password-reset)[^\s"']*/i,
  ],
  ["token hash", /\btokenHash\b|v1:hmac-sha256/i],
  ["active key", /\bactiveKey\b/i],
  ["raw token", /\b(rawToken|raw\s+token)\b/i],
  ["password field", /\b(confirmPassword|newPassword|passwordHash)\b/i],
  ["password assignment", /"password"\s*:\s*"[^"]{4,256}"/i],
  ["session secret", /\b(sessionToken|sessionHash)\b/i],
  ["authorization", /\bauthorization\b|\bbearer\s+/i],
  ["cookie", /\bcookie\b|\bset-cookie\b/i],
  ["webhook body", /\bwebhookBody\b|\brequestBody\b/i],
  ["api token", /\b(apiToken|accessToken|refreshToken)\b/i],
];

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createFailure(file, id, message) {
  return { file, id, message };
}

export async function validateReleaseEvidencePath(inputPath, options = {}) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, inputPath);
  const files = await collectJsonFiles(resolvedPath);
  const failures = [];
  const reports = [];

  if (files.length === 0 && options.allowEmpty !== true) {
    failures.push(
      createFailure(
        path.relative(WORKSPACE_ROOT, resolvedPath) || inputPath,
        "path.empty",
        "Release evidence validation requires at least one JSON artifact."
      )
    );
  }

  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    const relativePath = path.relative(WORKSPACE_ROOT, filePath);
    let artifact;

    try {
      artifact = JSON.parse(text);
    } catch {
      failures.push(
        createFailure(
          relativePath,
          "json.parse",
          "Artifact must be valid JSON."
        )
      );
      continue;
    }

    const fileFailures = validateReleaseEvidenceArtifact(
      artifact,
      relativePath,
      text
    );

    failures.push(...fileFailures);
    reports.push({
      file: relativePath,
      result: isObject(artifact) ? artifact.result : null,
      gate: isObject(artifact) ? artifact.gate : null,
      ok: fileFailures.length === 0,
    });
  }

  return {
    ok: failures.length === 0,
    code:
      failures.length === 0
        ? "RELEASE_EVIDENCE_VALIDATION_OK"
        : "RELEASE_EVIDENCE_VALIDATION_FAILED",
    scannedFiles: files.length,
    reports,
    failures,
  };
}

export function validateReleaseEvidenceArtifact(artifact, relativePath, text) {
  const failures = [];

  if (!isObject(artifact)) {
    return [
      createFailure(
        relativePath,
        "artifact.object",
        "Artifact root must be a JSON object."
      ),
    ];
  }

  validateArtifactPath(relativePath, artifact, failures);

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in artifact)) {
      failures.push(
        createFailure(relativePath, `field.${field}`, `${field} is required.`)
      );
    }
  }

  if (artifact.schemaVersion !== 1) {
    failures.push(
      createFailure(relativePath, "schemaVersion", "schemaVersion must be 1.")
    );
  }

  if (artifact.project !== "PSMS") {
    failures.push(
      createFailure(relativePath, "project", "project must be PSMS.")
    );
  }

  for (const field of [
    "releaseCandidateId",
    "gate",
    "createdAt",
    "owner",
    "reviewer",
    "commandName",
    "commandTemplate",
  ]) {
    if (typeof artifact[field] !== "string" || artifact[field].trim() === "") {
      failures.push(
        createFailure(relativePath, `field.${field}`, `${field} must be set.`)
      );
    }
  }

  validateSafeTextField(artifact.owner, "owner", relativePath, failures);
  validateSafeTextField(artifact.reviewer, "reviewer", relativePath, failures);

  if (
    typeof artifact.createdAt === "string" &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(artifact.createdAt)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "createdAt.format",
        "createdAt must be an ISO UTC timestamp with milliseconds."
      )
    );
  }

  if (!ALLOWED_RESULTS.has(artifact.result)) {
    failures.push(
      createFailure(
        relativePath,
        "result.enum",
        "result must be PASS, BLOCK, NO-GO, N/A-SQLite-only, or N/A-NoRows."
      )
    );
  }

  validateResultContext(artifact, relativePath, failures);

  if (artifact.commandArgsRedacted !== true) {
    failures.push(
      createFailure(
        relativePath,
        "commandArgsRedacted",
        "commandArgsRedacted must be true."
      )
    );
  }

  const isNaResult = String(artifact.result ?? "").startsWith("N/A-");

  if (
    !(Number.isInteger(artifact.exitCode) && artifact.exitCode >= 0) &&
    !isNaResult
  ) {
    failures.push(
      createFailure(
        relativePath,
        "exitCode",
        "exitCode must be a non-negative integer unless result is N/A-*."
      )
    );
  }

  if (artifact.result === "PASS" && artifact.exitCode !== 0) {
    failures.push(
      createFailure(
        relativePath,
        "exitCode.pass",
        "PASS artifacts require exitCode 0."
      )
    );
  }

  validateCommandTemplate(artifact, relativePath, failures);

  if (typeof artifact.artifactSha256 !== "string") {
    failures.push(
      createFailure(
        relativePath,
        "artifactSha256",
        "artifactSha256 must be recorded."
      )
    );
  } else if (!/^[a-f0-9]{64}$/i.test(artifact.artifactSha256)) {
    failures.push(
      createFailure(
        relativePath,
        "artifactSha256.format",
        "artifactSha256 must be a 64-character hex digest."
      )
    );
  } else {
    const expectedSha256 = computeArtifactSha256(artifact);

    if (artifact.artifactSha256.toLowerCase() !== expectedSha256) {
      failures.push(
        createFailure(
          relativePath,
          "artifactSha256.mismatch",
          "artifactSha256 must match canonical artifact JSON with artifactSha256 omitted."
        )
      );
    }
  }

  validateEnvironment(artifact.environment, relativePath, failures);
  validateSummary(artifact.summary, relativePath, failures);
  validateEvidence(artifact, relativePath, failures);
  validateForbiddenFieldScan(
    artifact.forbiddenFieldScan,
    relativePath,
    failures
  );
  validateRetention(artifact.retention, relativePath, failures);
  validateQuarantine(artifact.quarantine, relativePath, failures);
  validateNotes(artifact.notes, relativePath, failures);
  validateForbiddenPatterns(text, relativePath, failures);

  return failures;
}

async function collectJsonFiles(inputPath) {
  try {
    const stats = await stat(inputPath);

    if (stats.isFile()) {
      return inputPath.endsWith(".json") ? [inputPath] : [];
    }

    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const files = [];
  const entries = await readdir(inputPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(inputPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function validateArtifactPath(relativePath, artifact, failures) {
  const parts = relativePath.split(/[\\/]+/);
  const fileName = parts.at(-1) ?? "";
  const expectedSlug = RESULT_FILE_SLUGS.get(artifact.result);
  const match = fileName.match(
    /^(\d{8})-(\d{6})-([a-z0-9-]+)-(PASS|BLOCK|NO-GO|NA-SQLite-only|NA-NoRows)\.json$/
  );

  if (parts[0] !== DEFAULT_EVIDENCE_ROOT) {
    failures.push(
      createFailure(
        relativePath,
        "path.root",
        "Artifact must be stored under release-evidence."
      )
    );
  }

  if (!/^\d{8}$/.test(parts[1] ?? "")) {
    failures.push(
      createFailure(
        relativePath,
        "path.releaseDate",
        "Path must include release-evidence/<YYYYMMDD>."
      )
    );
  }

  if (!/^[a-z0-9-]+$/.test(parts[2] ?? "")) {
    failures.push(
      createFailure(
        relativePath,
        "path.gate",
        "Path must include a lowercase gate folder."
      )
    );
  }

  if (!match) {
    failures.push(
      createFailure(
        relativePath,
        "path.filename",
        "Filename must be <YYYYMMDD-HHmmss>-<gate>-<resultSlug>.json."
      )
    );
  }

  if (match) {
    const [, fileDate, , artifactSlug] = match;

    if (parts[1] !== fileDate) {
      failures.push(
        createFailure(
          relativePath,
          "path.dateMismatch",
          "Folder date must match filename date."
        )
      );
    }

    if (
      typeof artifact.createdAt === "string" &&
      artifact.createdAt.slice(0, 10).replaceAll("-", "") !== fileDate
    ) {
      failures.push(
        createFailure(
          relativePath,
          "path.createdAtDate",
          "createdAt date must match filename date."
        )
      );
    }

    if (!artifactSlug.startsWith(parts[2] ?? "")) {
      failures.push(
        createFailure(
          relativePath,
          "path.gateMismatch",
          "Filename artifact slug must start with the gate folder."
        )
      );
    }

    if (artifact.gate !== artifactSlug) {
      failures.push(
        createFailure(
          relativePath,
          "path.artifactGate",
          "artifact.gate must match filename artifact slug."
        )
      );
    }
  }

  if (expectedSlug && !fileName.endsWith(`-${expectedSlug}.json`)) {
    failures.push(
      createFailure(
        relativePath,
        "path.result",
        "Filename result slug must match artifact result."
      )
    );
  }

  for (const segment of parts) {
    if (
      /\bpostgres(?:ql)?:|token|ticket|user_|[?&=]|%3d|\.db\b/i.test(segment)
    ) {
      failures.push(
        createFailure(
          relativePath,
          "path.sensitiveSegment",
          "Artifact path segments must not contain ids, DB names, DSNs, tickets, or token markers."
        )
      );
      break;
    }
  }
}

function validateEnvironment(environment, relativePath, failures) {
  if (!isObject(environment)) {
    failures.push(
      createFailure(relativePath, "environment", "environment is required.")
    );
    return;
  }

  for (const field of [
    "releaseKind",
    "databaseProvider",
    "databaseIdentifier",
    "postgresqlReadiness",
  ]) {
    if (
      typeof environment[field] !== "string" ||
      environment[field].trim() === ""
    ) {
      failures.push(
        createFailure(
          relativePath,
          `environment.${field}`,
          `${field} is required.`
        )
      );
    }
  }

  if (
    environment.databaseProvider === "postgresql" &&
    !String(environment.databaseIdentifier).includes("<redacted>")
  ) {
    failures.push(
      createFailure(
        relativePath,
        "environment.databaseIdentifier",
        "PostgreSQL databaseIdentifier must be redacted."
      )
    );
  }

  if (
    environment.databaseProvider === "postgresql" &&
    String(environment.databaseIdentifier).includes("://")
  ) {
    failures.push(
      createFailure(
        relativePath,
        "environment.databaseIdentifier.url",
        "PostgreSQL databaseIdentifier must be a non-URL redacted alias."
      )
    );
  }

  if (
    environment.postgresqlReadiness === "PASS" &&
    environment.databaseProvider !== "postgresql"
  ) {
    failures.push(
      createFailure(
        relativePath,
        "environment.postgresqlReadiness",
        "postgresqlReadiness PASS requires databaseProvider postgresql."
      )
    );
  }
}

function validateCommandTemplate(artifact, relativePath, failures) {
  const template = String(artifact.commandTemplate ?? "");

  if (/[\r\n;&|`]/.test(template)) {
    failures.push(
      createFailure(
        relativePath,
        "commandTemplate.shell",
        "commandTemplate must not contain shell chaining, newlines, or command substitution."
      )
    );
  }

  for (const option of [
    "token-id",
    "actor-user-id",
    "expected-count",
    "operator",
    "ticket-id",
    "database-url",
  ]) {
    const pattern = new RegExp(`--${option}\\s+(?!<)[^\\s]+`);

    if (pattern.test(template)) {
      failures.push(
        createFailure(
          relativePath,
          `commandTemplate.${option}`,
          `--${option} must use a placeholder in commandTemplate.`
        )
      );
    }
  }
}

function validateSafeTextField(value, fieldName, relativePath, failures) {
  if (typeof value !== "string") {
    return;
  }

  if (value.length > 120 || /[\r\n]/.test(value)) {
    failures.push(
      createFailure(
        relativePath,
        `field.${fieldName}.safeText`,
        `${fieldName} must be single-line safe text of 120 characters or less.`
      )
    );
  }

  if (
    /[?&=]|https?:\/\/|\bpostgres(?:ql)?:|bearer\s+|authorization|cookie|set-cookie|password|tokenhash|rawtoken/i.test(
      value
    )
  ) {
    failures.push(
      createFailure(
        relativePath,
        `field.${fieldName}.forbidden`,
        `${fieldName} contains forbidden evidence material.`
      )
    );
  }
}

function validateSummary(summary, relativePath, failures) {
  if (!isObject(summary)) {
    failures.push(
      createFailure(relativePath, "summary", "summary is required.")
    );
    return;
  }

  for (const field of [
    "candidateCount",
    "cleanedCount",
    "auditLogCount",
    "secretScanPassed",
  ]) {
    if (!(field in summary)) {
      failures.push(
        createFailure(relativePath, `summary.${field}`, `${field} is required.`)
      );
    }
  }

  for (const field of ["candidateCount", "cleanedCount", "auditLogCount"]) {
    if (!Number.isInteger(summary[field]) || summary[field] < 0) {
      failures.push(
        createFailure(
          relativePath,
          `summary.${field}`,
          `${field} must be a non-negative integer.`
        )
      );
    }
  }

  if (summary.secretScanPassed !== true) {
    failures.push(
      createFailure(
        relativePath,
        "summary.secretScanPassed",
        "secretScanPassed must be true."
      )
    );
  }
}

function validateEvidence(artifact, relativePath, failures) {
  const evidence = artifact.evidence;

  if (!isObject(evidence)) {
    failures.push(
      createFailure(relativePath, "evidence", "evidence is required.")
    );
    return;
  }

  if ("dryRun" in evidence && typeof evidence.dryRun !== "boolean") {
    failures.push(
      createFailure(relativePath, "evidence.dryRun", "dryRun must be boolean.")
    );
  }

  if (
    artifact.result === "N/A-NoRows" &&
    artifact.summary?.candidateCount !== 0
  ) {
    failures.push(
      createFailure(
        relativePath,
        "result.NA-NoRows",
        "N/A-NoRows requires summary.candidateCount to be 0."
      )
    );
  }

  if (artifact.result === "N/A-NoRows") {
    validateNoRowsDryRunLink(artifact, relativePath, failures);
  }

  if (MANUAL_ATTESTATION_GATE_SCHEMAS.has(artifact.gate)) {
    validateManualAttestationEvidence(artifact, relativePath, failures);
  }

  if (
    artifact.result === "PASS" &&
    artifact.commandName === "pg:profile:preflight" &&
    artifact.environment?.postgresqlReadiness === "BLOCK"
  ) {
    failures.push(
      createFailure(
        relativePath,
        "postgresql.preflight-readiness",
        "pg:profile:preflight with readiness BLOCK cannot be release PASS."
      )
    );
  }

  if (
    artifact.environment?.postgresqlReadiness === "PASS" &&
    artifact.commandName !== "pg:profile:require-readiness"
  ) {
    failures.push(
      createFailure(
        relativePath,
        "postgresql.readiness-command",
        "postgresqlReadiness PASS requires pg:profile:require-readiness evidence."
      )
    );
  }

  if (Array.isArray(evidence.candidates)) {
    for (const [index, candidate] of evidence.candidates.entries()) {
      if (!isObject(candidate)) {
        failures.push(
          createFailure(
            relativePath,
            `evidence.candidates.${index}`,
            "candidate must be an object."
          )
        );
        continue;
      }

      for (const field of Object.keys(candidate)) {
        if (!ALLOWED_CANDIDATE_FIELDS.has(field)) {
          failures.push(
            createFailure(
              relativePath,
              `evidence.candidates.${index}.${field}`,
              `${field} is not allowed in cleanup evidence candidates.`
            )
          );
        }
      }
    }
  }

  if (artifact.result === "PASS" && Object.keys(evidence).length === 0) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.empty",
        "PASS artifacts require nonempty evidence."
      )
    );
  }

  if (
    artifact.result === "PASS" &&
    artifact.summary?.candidateCount > 0 &&
    artifact.summary?.cleanedCount === 0 &&
    artifact.gate === "credential-cleanup-confirm"
  ) {
    failures.push(
      createFailure(
        relativePath,
        "credentialCleanup.confirm",
        "credential cleanup confirm cannot PASS with candidates but zero cleaned rows."
      )
    );
  }

  validateCleanupCountConsistency(artifact, relativePath, failures);
}

function validateNoRowsDryRunLink(artifact, relativePath, failures) {
  const evidence = artifact.evidence;

  if (!isObject(evidence)) {
    return;
  }

  if (
    artifact.summary?.cleanedCount !== 0 ||
    artifact.summary?.auditLogCount !== 0
  ) {
    failures.push(
      createFailure(
        relativePath,
        "result.NA-NoRows.summary",
        "N/A-NoRows requires cleanedCount and auditLogCount to be 0."
      )
    );
  }

  if (evidence.noRows !== true) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.noRows",
        "N/A-NoRows evidence requires noRows true."
      )
    );
  }

  if (
    typeof evidence.linkedDryRunArtifactPath !== "string" ||
    !/^release-evidence\/\d{8}\/credential-cleanup-dry-run\/\d{8}-\d{6}-credential-cleanup-dry-run-PASS\.json$/.test(
      evidence.linkedDryRunArtifactPath
    )
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.linkedDryRunArtifactPath",
        "N/A-NoRows evidence must link to a credential-cleanup-dry-run PASS artifact path."
      )
    );
  }

  if (
    typeof evidence.linkedDryRunArtifactSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(evidence.linkedDryRunArtifactSha256)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.linkedDryRunArtifactSha256",
        "N/A-NoRows evidence must link to a dry-run artifact SHA256."
      )
    );
  }

  if (evidence.linkedDryRunResult !== "PASS") {
    failures.push(
      createFailure(
        relativePath,
        "evidence.linkedDryRunResult",
        "N/A-NoRows evidence requires linkedDryRunResult PASS."
      )
    );
  }

  if (evidence.linkedDryRunCandidateCount !== 0) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.linkedDryRunCandidateCount",
        "N/A-NoRows evidence requires linkedDryRunCandidateCount 0."
      )
    );
  }
}

function validateManualAttestationEvidence(artifact, relativePath, failures) {
  const schema = MANUAL_ATTESTATION_GATE_SCHEMAS.get(artifact.gate);
  const evidence = artifact.evidence;

  if (!schema || !isObject(evidence)) {
    return;
  }

  if (!["PASS", "BLOCK", "NO-GO"].includes(artifact.result)) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.result",
        "Manual attestation gates require PASS, BLOCK, or NO-GO."
      )
    );
  }

  if (artifact.commandName !== MANUAL_ATTESTATION_COMMAND_NAME) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.commandName",
        "Manual attestation evidence must be written by release:evidence:attest."
      )
    );
  }

  if (artifact.commandTemplate !== MANUAL_ATTESTATION_COMMAND_TEMPLATE) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.commandTemplate",
        "Manual attestation evidence requires the fixed attest command template."
      )
    );
  }

  if (
    artifact.summary?.candidateCount !== 0 ||
    artifact.summary?.cleanedCount !== 0 ||
    artifact.summary?.auditLogCount !== 0
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.summary",
        "Manual attestation summary counts must all be 0."
      )
    );
  }

  if (
    typeof artifact.owner === "string" &&
    typeof artifact.reviewer === "string" &&
    artifact.owner.trim().toLowerCase() ===
      artifact.reviewer.trim().toLowerCase()
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.reviewer",
        "Manual attestation reviewer must be distinct from owner."
      )
    );
  }

  if (evidence.attestationKind !== schema.attestationKind) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.attestationKind",
        "Manual attestation kind does not match the gate."
      )
    );
  }

  if (
    typeof evidence.attestedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evidence.attestedAt)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.attestedAt",
        "Manual attestation requires an ISO UTC attestedAt timestamp."
      )
    );
  }

  validateSafeOpaqueReference(
    evidence.attestationReference,
    "manualAttestation.attestationReference",
    relativePath,
    failures
  );

  validateSupportingEvidenceReference(evidence, relativePath, failures);
  validateManualAttestationControls(artifact, schema, relativePath, failures);

  if (artifact.gate === "external-scrub-attestation") {
    validateExternalScrubEvidence(evidence, relativePath, failures);
  }

  if (artifact.gate === "webhook-receiver-log-policy") {
    validateWebhookReceiverEvidence(evidence, relativePath, failures);
  }

  if (artifact.gate === "rollback-rehearsal") {
    validateRollbackRehearsalEvidence(evidence, relativePath, failures);
  }
}

function validateManualAttestationControls(
  artifact,
  schema,
  relativePath,
  failures
) {
  const controls = artifact.evidence?.controls;

  if (!isObject(controls)) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.controls",
        "Manual attestation requires structured controls."
      )
    );
    return;
  }

  const requiredControls = new Set(schema.requiredControls);

  for (const field of Object.keys(controls)) {
    if (!requiredControls.has(field)) {
      failures.push(
        createFailure(
          relativePath,
          `manualAttestation.controls.${field}`,
          `${field} is not an allowed attestation control.`
        )
      );
    }
  }

  for (const field of schema.requiredControls) {
    if (typeof controls[field] !== "boolean") {
      failures.push(
        createFailure(
          relativePath,
          `manualAttestation.controls.${field}`,
          `${field} must be boolean.`
        )
      );
      continue;
    }

    if (artifact.result === "PASS" && controls[field] !== true) {
      failures.push(
        createFailure(
          relativePath,
          `manualAttestation.controls.${field}.pass`,
          `${field} must be true for PASS attestation.`
        )
      );
    }
  }

  const blockReason = artifact.evidence?.blockReason;

  if (artifact.result === "PASS" && blockReason !== "N/A") {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.blockReason.pass",
        "PASS attestation requires blockReason N/A."
      )
    );
  }

  if (
    artifact.result !== "PASS" &&
    !MANUAL_ATTESTATION_BLOCK_REASONS.has(blockReason)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.blockReason",
        "BLOCK/NO-GO attestation requires an allowed non-N/A blockReason."
      )
    );
  }
}

function validateSupportingEvidenceReference(evidence, relativePath, failures) {
  if (
    typeof evidence.supportingEvidenceArtifactPath !== "string" ||
    !/^release-evidence\/\d{8}\/manual-attestation-support\/[A-Za-z0-9._-]+\.(json|md|txt)$/.test(
      evidence.supportingEvidenceArtifactPath
    ) ||
    /https?:|[?&=]|\bpostgres(?:ql)?:|\bbearer\b|\bauthorization\b|\bcookie\b|\bset-cookie\b|\bpassword\b|\btokenhash\b|\brawtoken\b/i.test(
      evidence.supportingEvidenceArtifactPath
    )
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.supportingEvidenceArtifactPath",
        "Manual attestation requires a safe release-evidence support path."
      )
    );
  }

  if (
    typeof evidence.supportingEvidenceArtifactSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(evidence.supportingEvidenceArtifactSha256)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.supportingEvidenceArtifactSha256",
        "Manual attestation requires a supporting evidence SHA256."
      )
    );
  }
}

function validateExternalScrubEvidence(evidence, relativePath, failures) {
  validateStringSet(
    evidence.coveredSystems,
    ["reverse-proxy", "cdn", "apm", "error-reporting"],
    "manualAttestation.coveredSystems",
    relativePath,
    failures
  );
  validateStringSet(
    evidence.credentialRouteClassesCovered,
    ["staff-activation", "password-reset"],
    "manualAttestation.credentialRouteClassesCovered",
    relativePath,
    failures
  );
  validateStringSet(
    evidence.scrubbedFields,
    [
      "query-string",
      "request-body",
      "session-header",
      "response-session-header",
      "auth-header",
    ],
    "manualAttestation.scrubbedFields",
    relativePath,
    failures
  );
}

function validateWebhookReceiverEvidence(evidence, relativePath, failures) {
  const contract = evidence.receiverContract;

  if (!isObject(contract)) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.receiverContract",
        "Webhook receiver attestation requires receiverContract."
      )
    );
    return;
  }

  const expectedValues = {
    dedupeKey: "X-PSMS-Delivery-Id",
    attemptHeaderDiagnosticOnly: true,
    duplicateSuccessReturns2xx: true,
    atomicPersistenceAttested: true,
    dedupeRetentionLongerThanCredentialExpiry: true,
    retryMaxAttemptsObserved: 1,
  };

  for (const [field, expected] of Object.entries(expectedValues)) {
    if (contract[field] !== expected) {
      failures.push(
        createFailure(
          relativePath,
          `manualAttestation.receiverContract.${field}`,
          `${field} does not match the receiver contract.`
        )
      );
    }
  }

  validateStringSet(
    contract.loggedMetadataAllowlist,
    ["deliveryId", "attempt", "status", "timestamp", "failureClass"],
    "manualAttestation.receiverContract.loggedMetadataAllowlist",
    relativePath,
    failures
  );
}

function validateRollbackRehearsalEvidence(evidence, relativePath, failures) {
  const rehearsal = evidence.rollbackRehearsal;

  if (!isObject(rehearsal)) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.rollbackRehearsal",
        "Rollback attestation requires rollbackRehearsal evidence."
      )
    );
    return;
  }

  validateSafeOpaqueReference(
    rehearsal.backupArtifactAlias,
    "manualAttestation.rollbackRehearsal.backupArtifactAlias",
    relativePath,
    failures,
    /^[A-Za-z0-9][A-Za-z0-9._:-]*[A-Za-z0-9]$/
  );

  if (
    typeof rehearsal.backupArtifactSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(rehearsal.backupArtifactSha256)
  ) {
    failures.push(
      createFailure(
        relativePath,
        "manualAttestation.rollbackRehearsal.backupArtifactSha256",
        "Rollback attestation requires a backup artifact SHA256."
      )
    );
  }

  for (const field of [
    "migrationStatusChecked",
    "applicationRestartChecked",
    "dbRestoreOrRollbackRehearsed",
  ]) {
    if (rehearsal[field] !== true) {
      failures.push(
        createFailure(
          relativePath,
          `manualAttestation.rollbackRehearsal.${field}`,
          `${field} must be true.`
        )
      );
    }
  }
}

function validateStringSet(
  values,
  expectedValues,
  failureId,
  relativePath,
  failures
) {
  if (!Array.isArray(values)) {
    failures.push(
      createFailure(relativePath, failureId, `${failureId} must be an array.`)
    );
    return;
  }

  const actual = [...values].map(String).sort();
  const expected = [...expectedValues].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      createFailure(
        relativePath,
        failureId,
        `${failureId} must contain exactly the required values.`
      )
    );
  }
}

function validateSafeOpaqueReference(
  value,
  failureId,
  relativePath,
  failures,
  pattern = /^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/
) {
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    !pattern.test(value) ||
    /https?:|[\\/]|[?&=]|\bpostgres(?:ql)?:|\bbearer\b|\bauthorization\b|\bcookie\b|\bset-cookie\b|\bpassword\b|\btokenhash\b|\brawtoken\b/i.test(
      value
    )
  ) {
    failures.push(
      createFailure(
        relativePath,
        failureId,
        "Manual attestation reference must be a safe opaque value."
      )
    );
  }
}

function validateCleanupCountConsistency(artifact, relativePath, failures) {
  const evidence = artifact.evidence;

  if (!isObject(evidence)) {
    return;
  }

  if (
    Array.isArray(evidence.candidateIds) &&
    Number.isInteger(artifact.summary?.candidateCount) &&
    evidence.candidateIds.length !== artifact.summary.candidateCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.candidateIds.count",
        "candidateIds length must match summary.candidateCount."
      )
    );
  }

  if (
    Number.isInteger(evidence.expectedCandidateCount) &&
    Number.isInteger(artifact.summary?.candidateCount) &&
    evidence.expectedCandidateCount !== artifact.summary.candidateCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.expectedCandidateCount",
        "expectedCandidateCount must match summary.candidateCount."
      )
    );
  }

  if (
    Array.isArray(evidence.requestedTokenIds) &&
    Number.isInteger(artifact.summary?.candidateCount) &&
    evidence.requestedTokenIds.length !== artifact.summary.candidateCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.requestedTokenIds.count",
        "requestedTokenIds length must match summary.candidateCount."
      )
    );
  }

  if (
    Array.isArray(evidence.auditLogIds) &&
    Number.isInteger(artifact.summary?.auditLogCount) &&
    evidence.auditLogIds.length !== artifact.summary.auditLogCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.auditLogIds.count",
        "auditLogIds length must match summary.auditLogCount."
      )
    );
  }

  if (
    Number.isInteger(evidence.cleanedCount) &&
    Number.isInteger(artifact.summary?.cleanedCount) &&
    evidence.cleanedCount !== artifact.summary.cleanedCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.cleanedCount",
        "evidence.cleanedCount must match summary.cleanedCount."
      )
    );
  }

  if (
    Array.isArray(evidence.cleanedTokenIds) &&
    Number.isInteger(artifact.summary?.cleanedCount) &&
    evidence.cleanedTokenIds.length !== artifact.summary.cleanedCount
  ) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.cleanedTokenIds.count",
        "cleanedTokenIds length must match summary.cleanedCount."
      )
    );
  }

  if (
    artifact.gate === "credential-cleanup-confirm" &&
    artifact.summary?.candidateCount > 0
  ) {
    validateConfirmTokenIdSets(evidence, relativePath, failures);

    if (
      artifact.result === "PASS" &&
      artifact.summary.cleanedCount !== artifact.summary.candidateCount
    ) {
      failures.push(
        createFailure(
          relativePath,
          "credentialCleanup.confirm.cleanedCount",
          "credential cleanup confirm PASS requires cleanedCount to match candidateCount."
        )
      );
    }

    if (
      artifact.result === "PASS" &&
      artifact.summary.auditLogCount !== artifact.summary.cleanedCount
    ) {
      failures.push(
        createFailure(
          relativePath,
          "credentialCleanup.confirm.auditLogCount",
          "credential cleanup confirm PASS requires auditLogCount to match cleanedCount."
        )
      );
    }
  }

  for (const field of ["operator", "ticketId"]) {
    if (field in evidence) {
      validateSafeTextField(
        evidence[field],
        `evidence.${field}`,
        relativePath,
        failures
      );
    }
  }

  if (
    artifact.gate === "credential-cleanup-confirm" &&
    artifact.summary?.candidateCount > 0
  ) {
    for (const field of [
      "requestedTokenIds",
      "expectedCandidateCount",
      "auditAction",
      "operator",
      "ticketId",
      "auditLogIds",
    ]) {
      if (!(field in evidence)) {
        failures.push(
          createFailure(
            relativePath,
            `evidence.${field}`,
            `${field} is required for cleanup confirm artifacts with rows.`
          )
        );
      }
    }

    if (evidence.auditAction !== "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP") {
      failures.push(
        createFailure(
          relativePath,
          "evidence.auditAction",
          "credential cleanup confirm requires ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP auditAction."
        )
      );
    }
  }
}

function validateConfirmTokenIdSets(evidence, relativePath, failures) {
  if (
    !Array.isArray(evidence.requestedTokenIds) ||
    !Array.isArray(evidence.candidateIds) ||
    !Array.isArray(evidence.cleanedTokenIds)
  ) {
    return;
  }

  const requested = [...evidence.requestedTokenIds].map(String).sort();
  const candidates = [...evidence.candidateIds].map(String).sort();
  const cleaned = [...evidence.cleanedTokenIds].map(String).sort();

  if (JSON.stringify(requested) !== JSON.stringify(candidates)) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.requestedTokenIds.set",
        "requestedTokenIds must match candidateIds for cleanup confirm evidence."
      )
    );
  }

  if (JSON.stringify(requested) !== JSON.stringify(cleaned)) {
    failures.push(
      createFailure(
        relativePath,
        "evidence.cleanedTokenIds.set",
        "cleanedTokenIds must match requestedTokenIds for cleanup confirm evidence."
      )
    );
  }
}

function validateResultContext(artifact, relativePath, failures) {
  if (artifact.result === "N/A-NoRows" && !NO_ROWS_GATES.has(artifact.gate)) {
    failures.push(
      createFailure(
        relativePath,
        "result.NA-NoRows.gate",
        "N/A-NoRows is allowed only for cleanup confirm or AuditLog evidence gates."
      )
    );
  }

  if (
    artifact.result === "N/A-SQLite-only" &&
    !String(artifact.gate ?? "").includes("postgresql")
  ) {
    failures.push(
      createFailure(
        relativePath,
        "result.NA-SQLite-only.gate",
        "N/A-SQLite-only is allowed only for PostgreSQL-specific gates."
      )
    );
  }
}

function validateForbiddenFieldScan(scan, relativePath, failures) {
  if (!isObject(scan)) {
    failures.push(
      createFailure(
        relativePath,
        "forbiddenFieldScan",
        "forbiddenFieldScan is required."
      )
    );
    return;
  }

  for (const field of [
    "checked",
    "passed",
    "scanner",
    "scannerVersion",
    "scannedArtifactPath",
    "scannedRoots",
    "skippedCounts",
  ]) {
    if (!(field in scan)) {
      failures.push(
        createFailure(
          relativePath,
          `forbiddenFieldScan.${field}`,
          `${field} is required.`
        )
      );
    }
  }

  if (scan.checked !== true || scan.passed !== true) {
    failures.push(
      createFailure(
        relativePath,
        "forbiddenFieldScan.status",
        "forbiddenFieldScan checked and passed must both be true."
      )
    );
  }

  if (
    !Array.isArray(scan.scannedRoots) ||
    !scan.scannedRoots.includes("release-evidence")
  ) {
    failures.push(
      createFailure(
        relativePath,
        "forbiddenFieldScan.scannedRoots",
        "scannedRoots must include release-evidence."
      )
    );
  }
}

function validateRetention(retention, relativePath, failures) {
  if (!isObject(retention)) {
    failures.push(
      createFailure(relativePath, "retention", "retention is required.")
    );
    return;
  }

  for (const field of ["retentionUntil", "storageOwner", "accessClass"]) {
    if (
      typeof retention[field] !== "string" ||
      retention[field].trim() === ""
    ) {
      failures.push(
        createFailure(
          relativePath,
          `retention.${field}`,
          `${field} is required.`
        )
      );
    }
  }
}

function validateQuarantine(quarantine, relativePath, failures) {
  if (!isObject(quarantine)) {
    failures.push(
      createFailure(relativePath, "quarantine", "quarantine is required.")
    );
    return;
  }

  for (const field of ["required", "quarantineStatus", "incidentTicketId"]) {
    if (!(field in quarantine)) {
      failures.push(
        createFailure(
          relativePath,
          `quarantine.${field}`,
          `${field} is required.`
        )
      );
    }
  }

  if (typeof quarantine.required !== "boolean") {
    failures.push(
      createFailure(
        relativePath,
        "quarantine.required",
        "quarantine.required must be boolean."
      )
    );
  }

  if (
    typeof quarantine.quarantinePath === "string" &&
    quarantine.quarantinePath.trim() !== ""
  ) {
    failures.push(
      createFailure(
        relativePath,
        "quarantine.quarantinePath",
        "Do not include quarantine paths in public release evidence."
      )
    );
  }
}

function validateNotes(notes, relativePath, failures) {
  if (!Array.isArray(notes)) {
    failures.push(
      createFailure(relativePath, "notes", "notes must be an array.")
    );
  }
}

export function computeArtifactSha256(artifact) {
  const clone = cloneForCanonicalJson(artifact);

  delete clone.artifactSha256;

  return createHash("sha256")
    .update(JSON.stringify(sortKeysDeep(clone)))
    .digest("hex");
}

function cloneForCanonicalJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeysDeep(value[key])])
  );
}

function validateForbiddenPatterns(text, relativePath, failures) {
  const textForScan = text.replace(
    /"artifactSha256"\s*:\s*"[^"]*"/g,
    '"artifactSha256":"[HASH]"'
  );

  for (const [name, pattern] of FORBIDDEN_PATTERNS) {
    if (pattern.test(textForScan)) {
      failures.push(
        createFailure(
          relativePath,
          `forbidden.${name.replaceAll(" ", "-")}`,
          `Artifact contains forbidden material: ${name}.`
        )
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowEmpty = args.includes("--allow-empty");
  const pathIndex = args.indexOf("--path");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const inputPath =
    pathIndex >= 0
      ? args[pathIndex + 1]
      : (positional[0] ?? DEFAULT_EVIDENCE_ROOT);

  if (pathIndex >= 0 && !inputPath) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "RELEASE_EVIDENCE_VALIDATION_USAGE",
          message: "--path requires a value.",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const report = await validateReleaseEvidencePath(inputPath, { allowEmpty });
  const payload = JSON.stringify(report, null, 2);

  if (!report.ok) {
    console.error(payload);
    process.exit(1);
  }

  console.log(payload);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "RELEASE_EVIDENCE_VALIDATION_ERROR",
          message,
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}
