import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateReleaseEvidenceArtifact } from "./release-evidence-validate.mjs";

const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_EVIDENCE_ROOT = "release-evidence";

export const DEFAULT_REQUIRED_GATES = [
  {
    gate: "env-gate",
    scope: "release candidate",
    command: "pnpm release:gate:prod-env",
    gateType: "automated",
    required: true,
  },
  {
    gate: "artifact-secret-scan",
    scope: "release artifacts",
    command: "pnpm release:gate:logs",
    gateType: "automated",
    required: true,
  },
  {
    gate: "combined-release-gate",
    scope: "env/log automation",
    command: "pnpm release:gate",
    gateType: "automated",
    required: true,
  },
  {
    gate: "limbo-token-scan",
    scope: "credential cleanup",
    command: "detection SQL or dry-run command",
    gateType: "automated",
    required: true,
  },
  {
    gate: "credential-cleanup-dry-run",
    scope: "credential cleanup",
    command: "pnpm ops:credential-compensation-cleanup",
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
    gate: "credential-cleanup-auditlog",
    scope: "credential cleanup",
    command: "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP lookup",
    gateType: "automated",
    required: true,
  },
  {
    gate: "postgresql-cleanup-rehearsal",
    scope: "PostgreSQL release candidate",
    command: "PG cleanup rehearsal profile",
    gateType: "manual",
    required: true,
  },
  {
    gate: "postgresql-profile",
    scope: "PG static scaffold",
    command: "pnpm pg:profile:preflight",
    gateType: "automated",
    required: true,
  },
  {
    gate: "postgresql-readiness",
    scope: "PostgreSQL release candidate",
    command: "pnpm pg:profile:require-readiness",
    gateType: "automated",
    required: true,
  },
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

const PASSING_RESULTS = new Set(["PASS", "N/A-SQLite-only", "N/A-NoRows"]);

export async function buildReleaseEvidenceIndex(inputPath, options = {}) {
  const requiredGates = options.requiredGates ?? DEFAULT_REQUIRED_GATES;
  const releaseCandidateId = options.releaseCandidateId ?? null;
  const files = await collectJsonFiles(
    path.resolve(WORKSPACE_ROOT, inputPath ?? DEFAULT_EVIDENCE_ROOT)
  );
  const artifacts = [];
  const invalidArtifacts = [];

  for (const filePath of files) {
    const relativePath = path.relative(WORKSPACE_ROOT, filePath);
    const text = await readFile(filePath, "utf8");
    let artifact;

    try {
      artifact = JSON.parse(text);
    } catch {
      invalidArtifacts.push({
        file: relativePath,
        gate: null,
        result: "BLOCK",
        failureIds: ["json.parse"],
      });
      continue;
    }

    const failures = validateReleaseEvidenceArtifact(
      artifact,
      relativePath,
      text
    );

    if (failures.length > 0) {
      invalidArtifacts.push({
        file: relativePath,
        gate: safeString(artifact?.gate),
        result: "BLOCK",
        failureIds: failures.map((failure) => failure.id),
      });
      continue;
    }

    if (
      releaseCandidateId &&
      artifact.releaseCandidateId !== releaseCandidateId
    ) {
      continue;
    }

    artifacts.push({
      file: relativePath,
      artifact,
    });
  }

  const latestByGate = new Map();

  for (const item of artifacts) {
    const previous = latestByGate.get(item.artifact.gate);

    if (
      !previous ||
      item.artifact.createdAt > previous.artifact.createdAt ||
      (item.artifact.createdAt === previous.artifact.createdAt &&
        item.file > previous.file)
    ) {
      latestByGate.set(item.artifact.gate, item);
    }
  }

  const rows = requiredGates.map((gateConfig) =>
    buildGateRow(gateConfig, latestByGate.get(gateConfig.gate), {
      releaseCandidateId,
    })
  );

  for (const invalid of invalidArtifacts) {
    rows.push({
      gate: invalid.gate || "invalid-artifact",
      releaseCandidateId: releaseCandidateId ?? "N/A",
      gateType: "automated",
      scope: "release evidence validation",
      command: "N/A",
      required: true,
      present: false,
      file: invalid.file,
      artifactSha256: "N/A",
      result: "BLOCK",
      status: "INVALID",
      exitCode: "N/A",
      owner: "N/A",
      reviewer: "N/A",
      createdAt: "N/A",
      notes: `invalid artifact: ${invalid.failureIds.join(",")}`,
    });
  }

  const missingRequiredCount = rows.filter(
    (row) => row.required && row.status === "MISSING"
  ).length;
  const blockingCount = rows.filter((row) => row.result === "BLOCK").length;
  const noGoCount = rows.filter((row) => row.result === "NO-GO").length;
  const passLikeCount = rows.filter((row) =>
    PASSING_RESULTS.has(row.result)
  ).length;

  return {
    ok:
      invalidArtifacts.length === 0 &&
      missingRequiredCount === 0 &&
      blockingCount === 0 &&
      noGoCount === 0,
    code:
      invalidArtifacts.length === 0 &&
      missingRequiredCount === 0 &&
      blockingCount === 0 &&
      noGoCount === 0
        ? "RELEASE_EVIDENCE_INDEX_OK"
        : "RELEASE_EVIDENCE_INDEX_BLOCKED",
    releaseCandidateId: releaseCandidateId ?? "ALL",
    scannedFiles: files.length,
    validArtifactCount: artifacts.length,
    invalidArtifactCount: invalidArtifacts.length,
    overallResult:
      invalidArtifacts.length === 0 &&
      missingRequiredCount === 0 &&
      blockingCount === 0 &&
      noGoCount === 0
        ? "INDEX_READY"
        : noGoCount > 0
          ? "NO-GO"
          : "BLOCK",
    requiredGateCount: requiredGates.filter((gate) => gate.required).length,
    missingRequiredCount,
    blockingCount,
    noGoCount,
    passLikeCount,
    rows,
  };
}

export function formatReleaseEvidenceIndexMarkdown(report) {
  const lines = [
    "| Gate | Scope | Command | Exit code | Evidence artifact | Artifact SHA256 | Result | Time UTC | Reviewer | Notes |",
    "| ---- | ----- | ------- | --------- | ----------------- | --------------- | ------ | -------- | -------- | ----- |",
  ];

  for (const row of report.rows) {
    lines.push(
      [
        row.gate,
        row.scope,
        row.command,
        String(row.exitCode),
        row.file,
        row.artifactSha256,
        row.result,
        row.createdAt,
        row.reviewer,
        row.notes,
      ]
        .map(markdownCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildGateRow(gateConfig, item, options) {
  if (!item) {
    return {
      gate: gateConfig.gate,
      releaseCandidateId: options.releaseCandidateId ?? "N/A",
      gateType: gateConfig.gateType ?? "manual",
      scope: gateConfig.scope,
      command: gateConfig.command,
      required: gateConfig.required === true,
      present: false,
      file: "MISSING",
      artifactSha256: "N/A",
      result: gateConfig.required === true ? "BLOCK" : "N/A",
      status: "MISSING",
      exitCode: "N/A",
      owner: "N/A",
      reviewer: "N/A",
      createdAt: "N/A",
      notes:
        gateConfig.required === true
          ? "required evidence missing"
          : "optional evidence missing",
    };
  }

  const artifact = item.artifact;

  return {
    gate: gateConfig.gate,
    releaseCandidateId: artifact.releaseCandidateId,
    gateType: gateConfig.gateType ?? "automated",
    scope: gateConfig.scope,
    command: artifact.commandName,
    required: gateConfig.required === true,
    present: true,
    file: item.file.replaceAll("\\", "/"),
    artifactSha256: artifact.artifactSha256,
    result: artifact.result,
    status: PASSING_RESULTS.has(artifact.result)
      ? "SATISFIED"
      : artifact.result,
    exitCode: artifact.exitCode,
    owner: artifact.owner,
    reviewer: artifact.reviewer,
    createdAt: artifact.createdAt,
    notes: summarizeArtifactNotes(artifact),
  };
}

function summarizeArtifactNotes(artifact) {
  if (artifact.result === "BLOCK") {
    return "artifact result BLOCK";
  }

  if (artifact.result === "NO-GO") {
    return "artifact result NO-GO";
  }

  if (artifact.result === "N/A-NoRows") {
    return "no limbo rows";
  }

  if (artifact.result === "N/A-SQLite-only") {
    return "sqlite-only release context";
  }

  return "artifact present";
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

function markdownCell(value) {
  return redactReportCell(safeString(value))
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ");
}

function safeString(value) {
  return String(value ?? "N/A").slice(0, 240);
}

function redactReportCell(value) {
  return String(value ?? "")
    .replace(/\bpostgres(?:ql)?:\/\/[^\s|]+/gi, "postgresql://[REDACTED]")
    .replace(
      /https?:\/\/[^\s|]*(?:[?&]token=|token%3D|staff-activation|password-reset)[^\s|]*/gi,
      "https://[REDACTED]"
    )
    .replace(
      /\bauthorization:\s*Bearer\s+[^\s|]+/gi,
      "authorization: Bearer [REDACTED]"
    )
    .replace(/\bbearer\s+[^\s|]+/gi, "Bearer [REDACTED]")
    .replace(/\b(cookie|set-cookie):\s*[^|]+/gi, "$1: [REDACTED]")
    .replace(/\btokenHash\b|v1:hmac-sha256:[^\s|]+/gi, "[TOKEN_HASH_REDACTED]")
    .replace(/\b(rawToken|raw\s+token)\b/gi, "[RAW_TOKEN_REDACTED]");
}

function parseArgs(args) {
  const parsed = {
    format: "json",
    path: DEFAULT_EVIDENCE_ROOT,
    requiredGate: [],
    releaseCandidateId: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      parsed.path = arg;
      continue;
    }

    const key = arg.slice(2);
    const value = args[index + 1];

    if (key === "path" || key === "format" || key === "release-candidate-id") {
      if (!value || value.startsWith("--")) {
        throw new Error(`--${key} requires a value.`);
      }

      if (key === "release-candidate-id") {
        parsed.releaseCandidateId = value;
      } else {
        parsed[key] = value;
      }
      index += 1;
      continue;
    }

    if (key === "required-gate") {
      if (!value || value.startsWith("--")) {
        throw new Error("--required-gate requires a value.");
      }

      parsed.requiredGate.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported option: --${key}`);
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.releaseCandidateId) {
    throw new Error("--release-candidate-id is required.");
  }

  const requiredGates =
    args.requiredGate.length > 0
      ? args.requiredGate.map((gate) => ({
          gate,
          scope: "custom",
          command: "custom",
          required: true,
        }))
      : DEFAULT_REQUIRED_GATES;
  const report = await buildReleaseEvidenceIndex(args.path, {
    requiredGates,
    releaseCandidateId: args.releaseCandidateId,
  });

  if (args.format === "markdown") {
    const markdown = formatReleaseEvidenceIndexMarkdown(report);

    if (!report.ok) {
      console.error(markdown);
      process.exit(1);
    }

    console.log(markdown);
    return;
  }

  if (args.format !== "json") {
    throw new Error("--format must be json or markdown.");
  }

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
          code: "RELEASE_EVIDENCE_INDEX_ERROR",
          message,
        },
        null,
        2
      )
    );
    process.exit(2);
  });
}
