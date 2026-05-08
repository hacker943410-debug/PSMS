import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateReleaseEvidenceArtifact } from "./release-evidence-validate.mjs";
import {
  buildReleaseEvidenceArtifact,
  writeReleaseEvidenceArtifact,
} from "./release-evidence-write.mjs";

const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const COMMAND_NAME = "release:evidence:cleanup-no-rows";
const COMMAND_TEMPLATE =
  "pnpm release:evidence:cleanup-no-rows --dry-run-artifact <artifact-path>";
const ALLOWED_OPTIONS = new Set([
  "dry-run-artifact",
  "created-at",
  "owner",
  "reviewer",
  "output-root",
  "retention-until",
  "storage-owner",
  "access-class",
]);
const NO_ROWS_GATES = [
  {
    gate: "credential-cleanup-confirm",
    evidence: {
      dryRun: false,
      noRows: true,
      confirmRequired: false,
      expectedCandidateCount: 0,
      requestedTokenIds: [],
      candidateIds: [],
      cleanedCount: 0,
      cleanedTokenIds: [],
      auditLogIds: [],
      reason: "dry-run candidateCount is 0; confirm command not executed",
    },
  },
  {
    gate: "credential-cleanup-auditlog",
    evidence: {
      noRows: true,
      auditLogLookupRequired: false,
      expectedCandidateCount: 0,
      candidateIds: [],
      auditLogIds: [],
      reason:
        "dry-run candidateCount is 0; cleanup AuditLog rows are not expected",
    },
  },
];

export async function writeCleanupNoRowsEvidence(input) {
  const dryRunReport = await readAndValidateDryRunArtifact(
    input.dryRunArtifactPath
  );

  if (!dryRunReport.ok) {
    return dryRunReport;
  }

  const artifactInputs = buildCleanupNoRowsEvidenceInputs({
    ...input,
    dryRunArtifact: dryRunReport.artifact,
    dryRunArtifactPath: dryRunReport.relativePath,
  });
  const builtArtifacts = artifactInputs.map((artifactInput) => ({
    artifactInput,
    ...buildReleaseEvidenceArtifact(artifactInput),
  }));
  const preflightFailures = [];

  for (const { artifact, relativePath } of builtArtifacts) {
    const failures = validateReleaseEvidenceArtifact(
      artifact,
      relativePath,
      `${JSON.stringify(artifact, null, 2)}\n`
    );

    if (failures.length > 0) {
      preflightFailures.push(...failures);
    }
  }

  if (preflightFailures.length > 0) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_VALIDATION_FAILED",
      dryRunArtifactPath: dryRunReport.relativePath,
      failures: preflightFailures,
    };
  }

  const existingArtifacts = [];

  for (const { relativePath } of builtArtifacts) {
    if (await pathExists(relativePath)) {
      existingArtifacts.push(relativePath);
    }
  }

  if (existingArtifacts.length > 0) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_TARGET_EXISTS",
      dryRunArtifactPath: dryRunReport.relativePath,
      artifacts: existingArtifacts.map((artifactPath) => ({
        artifactPath,
        ok: false,
      })),
    };
  }

  const artifacts = [];

  for (const { artifactInput } of builtArtifacts) {
    const report = await writeReleaseEvidenceArtifact(artifactInput);

    artifacts.push({
      gate: artifactInput.gate,
      ok: report.ok,
      artifactPath: report.artifactPath,
      artifactSha256: report.artifactSha256,
      failures: report.failures ?? [],
    });

    if (!report.ok) {
      return {
        ok: false,
        code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_WRITE_FAILED",
        dryRunArtifactPath: dryRunReport.relativePath,
        artifacts,
      };
    }
  }

  return {
    ok: true,
    code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_OK",
    dryRunArtifactPath: dryRunReport.relativePath,
    dryRunArtifactSha256: dryRunReport.artifact.artifactSha256,
    artifacts,
  };
}

export function buildCleanupNoRowsEvidenceInputs(input) {
  const dryRun = input.dryRunArtifact;
  const createdAt = input.createdAt ?? new Date();
  const owner = input.owner ?? dryRun.owner;
  const reviewer = input.reviewer ?? dryRun.reviewer;
  const retention = dryRun.retention ?? {};
  const environment = dryRun.environment ?? {};
  const notes = readSafeNotes(
    input.notes ?? [
      "N/A-NoRows generated from validated cleanup dry-run evidence with candidateCount 0.",
    ]
  );

  return NO_ROWS_GATES.map((config) => ({
    releaseCandidateId: dryRun.releaseCandidateId,
    gate: config.gate,
    result: "N/A-NoRows",
    createdAt,
    owner,
    reviewer,
    commandName: COMMAND_NAME,
    commandTemplate: COMMAND_TEMPLATE,
    exitCode: "N/A",
    releaseKind: environment.releaseKind,
    databaseProvider: environment.databaseProvider,
    databaseIdentifier: environment.databaseIdentifier,
    postgresqlReadiness: environment.postgresqlReadiness,
    summary: {
      candidateCount: 0,
      cleanedCount: 0,
      auditLogCount: 0,
      secretScanPassed: true,
    },
    evidence: {
      ...config.evidence,
      linkedDryRunArtifactPath: input.dryRunArtifactPath,
      linkedDryRunArtifactSha256: dryRun.artifactSha256,
      linkedDryRunResult: dryRun.result,
      linkedDryRunCandidateCount: dryRun.summary?.candidateCount,
    },
    outputRoot: input.outputRoot,
    retentionUntil: input.retentionUntil ?? retention.retentionUntil,
    storageOwner: input.storageOwner ?? retention.storageOwner,
    accessClass: input.accessClass ?? retention.accessClass,
    notes,
  }));
}

async function readAndValidateDryRunArtifact(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_USAGE",
      message: "--dry-run-artifact is required.",
    };
  }

  const absolutePath = path.resolve(WORKSPACE_ROOT, inputPath);
  const relativePath = path
    .relative(WORKSPACE_ROOT, absolutePath)
    .replaceAll("\\", "/");

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_PATH_REJECTED",
      message: "dry-run artifact must be inside the workspace.",
    };
  }

  let text;
  let artifact;

  try {
    text = await readFile(absolutePath, "utf8");
    artifact = JSON.parse(text);
  } catch {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_READ_FAILED",
      dryRunArtifactPath: relativePath,
      message: "dry-run artifact must be readable JSON.",
    };
  }

  const failures = validateReleaseEvidenceArtifact(
    artifact,
    relativePath,
    text
  );

  if (failures.length > 0) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_DRY_RUN_INVALID",
      dryRunArtifactPath: relativePath,
      failures,
    };
  }

  const candidateIds = Array.isArray(artifact.evidence?.candidateIds)
    ? artifact.evidence.candidateIds
    : [];
  const candidates = Array.isArray(artifact.evidence?.candidates)
    ? artifact.evidence.candidates
    : [];
  const cleanedTokenIds = Array.isArray(artifact.evidence?.cleanedTokenIds)
    ? artifact.evidence.cleanedTokenIds
    : [];
  const auditLogIds = Array.isArray(artifact.evidence?.auditLogIds)
    ? artifact.evidence.auditLogIds
    : [];
  const requestedTokenIds = Array.isArray(artifact.evidence?.requestedTokenIds)
    ? artifact.evidence.requestedTokenIds
    : [];

  if (
    artifact.gate !== "credential-cleanup-dry-run" ||
    artifact.result !== "PASS" ||
    artifact.commandName !== "ops:credential-compensation-cleanup" ||
    artifact.evidence?.dryRun !== true ||
    artifact.summary?.candidateCount !== 0 ||
    artifact.summary?.cleanedCount !== 0 ||
    artifact.summary?.auditLogCount !== 0 ||
    artifact.evidence?.candidateCount !== 0 ||
    candidateIds.length !== 0 ||
    candidates.length !== 0 ||
    cleanedTokenIds.length !== 0 ||
    auditLogIds.length !== 0 ||
    requestedTokenIds.length !== 0
  ) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_NOT_APPLICABLE",
      dryRunArtifactPath: relativePath,
      message:
        "cleanup no-row evidence requires a PASS credential-cleanup-dry-run artifact with zero candidates.",
    };
  }

  return {
    ok: true,
    artifact,
    relativePath,
  };
}

async function pathExists(relativePath) {
  try {
    await access(path.resolve(WORKSPACE_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function readSafeNotes(value) {
  if (!Array.isArray(value)) {
    throw new Error("notes must be an array.");
  }

  return value.map((item) => {
    const text = String(item ?? "").trim();

    if (
      text.length === 0 ||
      text.length > 160 ||
      /[\0\r\n]/.test(text) ||
      /[?&=]|https?:\/\/|\bpostgres(?:ql)?:|bearer\s+|authorization|cookie|set-cookie|password|tokenhash|rawtoken|raw token/i.test(
        text
      )
    ) {
      throw new Error("notes contain unsafe release evidence text.");
    }

    return text;
  });
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await writeCleanupNoRowsEvidence({
    dryRunArtifactPath: args["dry-run-artifact"],
    createdAt: args["created-at"]
      ? new Date(String(args["created-at"]))
      : undefined,
    owner: args.owner,
    reviewer: args.reviewer,
    outputRoot: args["output-root"],
    retentionUntil: args["retention-until"],
    storageOwner: args["storage-owner"],
    accessClass: args["access-class"],
  });
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
          code: "RELEASE_EVIDENCE_CLEANUP_NO_ROWS_ERROR",
          message,
        },
        null,
        2
      )
    );
    process.exit(2);
  });
}
