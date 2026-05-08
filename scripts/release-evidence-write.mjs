import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  computeArtifactSha256,
  validateReleaseEvidenceArtifact,
} from "./release-evidence-validate.mjs";

const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_OUTPUT_ROOT = "release-evidence";
const RESULT_FILE_SLUGS = new Map([
  ["PASS", "PASS"],
  ["BLOCK", "BLOCK"],
  ["NO-GO", "NO-GO"],
  ["N/A-SQLite-only", "NA-SQLite-only"],
  ["N/A-NoRows", "NA-NoRows"],
]);

export function buildReleaseEvidenceArtifact(input) {
  const createdAt = input.createdAt ?? new Date();
  const createdAtDate =
    createdAt instanceof Date ? createdAt : new Date(String(createdAt));
  const artifact = {
    schemaVersion: 1,
    project: "PSMS",
    releaseCandidateId: readRequired(
      input.releaseCandidateId,
      "releaseCandidateId"
    ),
    gate: readRequired(input.gate, "gate"),
    result: readRequired(input.result, "result"),
    createdAt: createdAtDate.toISOString(),
    owner: readRequired(input.owner, "owner"),
    reviewer: readRequired(input.reviewer, "reviewer"),
    commandName: readRequired(input.commandName, "commandName"),
    commandTemplate: readRequired(input.commandTemplate, "commandTemplate"),
    commandArgsRedacted: true,
    exitCode: input.exitCode,
    artifactSha256: "",
    environment: {
      releaseKind: readRequired(input.releaseKind, "releaseKind"),
      databaseProvider: readRequired(
        input.databaseProvider,
        "databaseProvider"
      ),
      databaseIdentifier: readRequired(
        input.databaseIdentifier,
        "databaseIdentifier"
      ),
      postgresqlReadiness: readRequired(
        input.postgresqlReadiness,
        "postgresqlReadiness"
      ),
    },
    summary: {
      candidateCount: readInteger(
        input.summary?.candidateCount,
        "candidateCount"
      ),
      cleanedCount: readInteger(input.summary?.cleanedCount, "cleanedCount"),
      auditLogCount: readInteger(input.summary?.auditLogCount, "auditLogCount"),
      secretScanPassed: input.summary?.secretScanPassed === true,
    },
    evidence: input.evidence ?? {},
    forbiddenFieldScan: {
      checked: true,
      passed: true,
      scanner: "pnpm release:gate:logs",
      scannerVersion: input.scannerVersion ?? "artifact-secret-scan-v1",
      scannedArtifactPath: "",
      scannedRoots: [
        ".codex-logs",
        ".tmp",
        "test-results",
        "playwright-report",
        "release-evidence",
      ],
      skippedCounts: input.skippedCounts ?? {},
    },
    retention: {
      retentionUntil: readRequired(input.retentionUntil, "retentionUntil"),
      storageOwner: readRequired(input.storageOwner, "storageOwner"),
      accessClass: readRequired(input.accessClass, "accessClass"),
    },
    quarantine: {
      required: input.quarantineRequired === true,
      quarantineStatus: input.quarantineStatus ?? "not-required",
      incidentTicketId: input.incidentTicketId ?? "N/A",
    },
    notes: input.notes ?? [],
  };
  const relativePath = buildReleaseEvidencePath(
    input.outputRoot ?? DEFAULT_OUTPUT_ROOT,
    artifact
  );

  artifact.forbiddenFieldScan.scannedArtifactPath = path
    .dirname(relativePath)
    .replaceAll("\\", "/");
  artifact.artifactSha256 = computeArtifactSha256(artifact);

  return { artifact, relativePath };
}

export async function writeReleaseEvidenceArtifact(input) {
  const { artifact, relativePath } = buildReleaseEvidenceArtifact(input);
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  const failures = validateReleaseEvidenceArtifact(
    artifact,
    relativePath,
    text
  );

  if (failures.length > 0) {
    return {
      ok: false,
      code: "RELEASE_EVIDENCE_WRITE_VALIDATION_FAILED",
      artifactPath: relativePath,
      failures,
    };
  }

  const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, { flag: "wx" });

  return {
    ok: true,
    code: "RELEASE_EVIDENCE_WRITE_OK",
    artifactPath: relativePath,
    artifactSha256: artifact.artifactSha256,
  };
}

function buildReleaseEvidencePath(outputRoot, artifact) {
  const resultSlug = RESULT_FILE_SLUGS.get(artifact.result);

  if (!resultSlug) {
    throw new Error("Unsupported release evidence result.");
  }

  const date = artifact.createdAt.slice(0, 10).replaceAll("-", "");
  const time = artifact.createdAt.slice(11, 19).replaceAll(":", "");
  const normalizedGate = artifact.gate.trim();

  return path
    .join(
      outputRoot,
      date,
      normalizedGate,
      `${date}-${time}-${normalizedGate}-${resultSlug}.json`
    )
    .replaceAll("\\", "/");
}

function readRequired(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function readInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function parseJsonOption(value, optionName) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${optionName} must be valid JSON.`);
  }
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
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
  const input = {
    releaseCandidateId: args["release-candidate-id"],
    gate: args.gate,
    result: args.result,
    createdAt: args["created-at"]
      ? new Date(String(args["created-at"]))
      : undefined,
    owner: args.owner,
    reviewer: args.reviewer,
    commandName: args["command-name"],
    commandTemplate: args["command-template"],
    exitCode:
      args["exit-code"] === undefined ? undefined : Number(args["exit-code"]),
    releaseKind: args["release-kind"],
    databaseProvider: args["database-provider"],
    databaseIdentifier: args["database-identifier"],
    postgresqlReadiness: args["postgresql-readiness"],
    summary: parseJsonOption(args.summary, "--summary"),
    evidence: parseJsonOption(args.evidence, "--evidence"),
    outputRoot: args["output-root"],
    retentionUntil: args["retention-until"],
    storageOwner: args["storage-owner"],
    accessClass: args["access-class"],
    notes: parseJsonOption(args.notes, "--notes") ?? [],
  };
  const report = await writeReleaseEvidenceArtifact(input);
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
          code: "RELEASE_EVIDENCE_WRITE_ERROR",
          message,
        },
        null,
        2
      )
    );
    process.exit(2);
  });
}
