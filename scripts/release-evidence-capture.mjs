import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeReleaseEvidenceArtifact } from "./release-evidence-write.mjs";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURE_BYTES = 1024 * 1024;
const PNPM_BIN = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const ALLOWED_OPTIONS = new Set([
  "command-key",
  "release-candidate-id",
  "created-at",
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
  "notes",
  "timeout-ms",
  "token-id",
  "expected-count",
  "actor-user-id",
  "operator",
  "ticket-id",
  "detection-window-minutes",
]);
const HIGH_RISK_OUTPUT_PATTERNS = [
  /\bpostgres(?:ql)?:\/\/[^\s"']+/i,
  /https?:\/\/[^\s"']*(?:[?&]token=|token%3D|staff-activation|password-reset)[^\s"']*/i,
  /\bauthorization:\s*Bearer\s+[^\s]+/i,
  /\b(cookie|set-cookie|x-api-key|x-auth-token):\s*[^\r\n]+/i,
  /"(?:activeKey|authorization|confirmPassword|newPassword|password|passwordHash|rawToken|sessionHash|sessionToken|token|tokenHash|webhookBody|requestBody|webhookSecret|apiToken|accessToken|refreshToken)"\s*:\s*"[^"]*"/i,
  /\b[A-Za-z_][A-Za-z0-9_]*(?:_SECRET|_TOKEN|_PASSWORD|_COOKIE|_DSN|_DATABASE_URL)\s*=\s*[^\s]+/i,
  /\b(v1:hmac-sha256):[A-Za-z0-9:._-]+/i,
];
const CONFIRM_ONLY_OPTIONS = [
  "tokenIds",
  "expectedCandidateCount",
  "actorUserId",
  "operator",
  "ticketId",
  "detectionWindowMinutes",
];
const CLEANUP_AUDIT_ACTION = "ADMIN_CREDENTIAL_COMPENSATION_CLEANED_UP";

const COMMANDS = {
  "prod-env": {
    commandName: "release:gate:prod-env",
    commandTemplate: "pnpm release:gate:prod-env",
    executable: PNPM_BIN,
    args: ["release:gate:prod-env"],
    gate: "env-gate",
  },
  "secret-scan": {
    commandName: "release:gate:logs",
    commandTemplate: "pnpm release:gate:logs",
    executable: PNPM_BIN,
    args: ["release:gate:logs"],
    gate: "artifact-secret-scan",
  },
  "pg-profile-preflight": {
    commandName: "pg:profile:preflight",
    commandTemplate: "pnpm pg:profile:preflight",
    executable: PNPM_BIN,
    args: ["pg:profile:preflight"],
    gate: "postgresql-profile",
    databaseProvider: "postgresql",
    databaseIdentifier: "postgresql:<redacted>",
  },
  "pg-profile-readiness": {
    commandName: "pg:profile:require-readiness",
    commandTemplate: "pnpm pg:profile:require-readiness",
    executable: PNPM_BIN,
    args: ["pg:profile:require-readiness"],
    gate: "postgresql-readiness",
    databaseProvider: "postgresql",
    databaseIdentifier: "postgresql:<redacted>",
  },
  "credential-cleanup-dry-run": {
    commandName: "ops:credential-compensation-cleanup",
    commandTemplate: "pnpm ops:credential-compensation-cleanup",
    executable: PNPM_BIN,
    args: ["ops:credential-compensation-cleanup"],
    gate: "credential-cleanup-dry-run",
  },
  "credential-cleanup-confirm": {
    commandName: "ops:credential-compensation-cleanup",
    commandTemplate:
      "pnpm ops:credential-compensation-cleanup --confirm --token-id <token-id> --expected-count <count> --actor-user-id <admin-user-id> --operator <operator> --ticket-id <ticket-id>",
    executable: PNPM_BIN,
    gate: "credential-cleanup-confirm",
    buildArgs: buildCredentialCleanupConfirmArgs,
  },
};

export async function captureReleaseEvidenceCommand(
  input,
  runner = runCommand
) {
  const config = buildCommandConfig(input);
  const commandReport = await runner(config, {
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  const parsedOutput = parseCommandJson(commandReport);
  const artifactInput = buildCapturedArtifactInput({
    input,
    config,
    commandReport,
    parsedOutput,
  });
  const writeReport = await writeReleaseEvidenceArtifact(artifactInput);

  return {
    ...writeReport,
    capturedResult: artifactInput.result,
    commandExitCode: commandReport.exitCode,
  };
}

export function buildCapturedArtifactInput({
  input,
  config,
  commandReport,
  parsedOutput,
}) {
  const parsed = parsedOutput.value;
  const result = deriveResult(config, commandReport, parsed);
  const environment = deriveEnvironment(input, config, parsed);
  const summary = deriveSummary(config, parsed);
  const evidence = deriveEvidence(config, commandReport, parsedOutput);

  return {
    releaseCandidateId: input.releaseCandidateId,
    gate: config.gate,
    result,
    createdAt: input.createdAt,
    owner: input.owner,
    reviewer: input.reviewer,
    commandName: config.commandName,
    commandTemplate: config.commandTemplate,
    exitCode: commandReport.exitCode,
    releaseKind: input.releaseKind,
    databaseProvider: environment.databaseProvider,
    databaseIdentifier: environment.databaseIdentifier,
    postgresqlReadiness: environment.postgresqlReadiness,
    summary,
    evidence,
    outputRoot: input.outputRoot,
    retentionUntil: input.retentionUntil,
    storageOwner: input.storageOwner,
    accessClass: input.accessClass,
    notes: input.notes ?? [],
  };
}

export function redactCommandOutput(value) {
  return redactCommandOutputWithFindings(value).text;
}

export function redactCommandOutputWithFindings(value) {
  const original = String(value ?? "");
  const highRiskDetected = HIGH_RISK_OUTPUT_PATTERNS.some((pattern) =>
    pattern.test(original)
  );
  const text = original
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED]")
    .replace(
      /https?:\/\/[^\s"']*(?:[?&]token=|token%3D|staff-activation|password-reset)[^\s"']*/gi,
      "https://[REDACTED]"
    )
    .replace(
      /\bauthorization:\s*Bearer\s+[^\s]+/gi,
      "authorization: Bearer [REDACTED]"
    )
    .replace(
      /\b(cookie|set-cookie|x-api-key|x-auth-token):\s*[^\r\n]+/gi,
      "$1: [REDACTED]"
    )
    .replace(
      /"(?:activeKey|authorization|confirmPassword|newPassword|password|passwordHash|rawToken|sessionHash|sessionToken|token|tokenHash|webhookBody|requestBody|webhookSecret|apiToken|accessToken|refreshToken)"\s*:\s*"[^"]*"/gi,
      (match) => `${match.split(":")[0]}: "[REDACTED]"`
    )
    .replace(
      /\b([A-Za-z_][A-Za-z0-9_]*(?:_SECRET|_TOKEN|_PASSWORD|_COOKIE|_DSN|_DATABASE_URL))\s*=\s*[^\s]+/gi,
      "$1=[REDACTED]"
    )
    .replace(/\b(v1:hmac-sha256):[A-Za-z0-9:._-]+/gi, "$1:[REDACTED]");

  return { text, highRiskDetected };
}

async function runCommand(config, options) {
  return new Promise((resolve) => {
    const child = spawn(config.executable, config.args, {
      shell: false,
      windowsHide: true,
    });
    const startedAt = new Date();
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_CAPTURE_BYTES) {
        stdoutChunks.push(chunk);
      } else {
        truncated = true;
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_CAPTURE_BYTES) {
        stderrChunks.push(chunk);
      } else {
        truncated = true;
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      const redactedError = redactCommandOutputWithFindings(error.message);

      resolve({
        exitCode: 1,
        signal: null,
        timedOut: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        stdout: "",
        stderr: redactedError.text,
        stdoutBytes: 0,
        stderrBytes: Buffer.byteLength(error.message),
        truncated: false,
        redactionHighRisk: redactedError.highRiskDetected,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const redactedStdout = redactCommandOutputWithFindings(
        Buffer.concat(stdoutChunks).toString()
      );
      const redactedStderr = redactCommandOutputWithFindings(
        Buffer.concat(stderrChunks).toString()
      );

      resolve({
        exitCode: Number.isInteger(code) ? code : 1,
        signal,
        timedOut,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        stdout: redactedStdout.text,
        stderr: redactedStderr.text,
        stdoutBytes,
        stderrBytes,
        truncated,
        redactionHighRisk:
          redactedStdout.highRiskDetected || redactedStderr.highRiskDetected,
      });
    });
  });
}

function parseCommandJson(commandReport) {
  for (const source of ["stdout", "stderr"]) {
    const value = commandReport[source].trim();

    if (!value) {
      continue;
    }

    try {
      return {
        source,
        parsed: true,
        value: JSON.parse(value),
      };
    } catch {
      continue;
    }
  }

  return {
    source: null,
    parsed: false,
    value: null,
  };
}

function deriveResult(config, commandReport, parsed) {
  if (commandReport.timedOut) {
    return "BLOCK";
  }

  if (commandReport.redactionHighRisk === true) {
    return "BLOCK";
  }

  if (config.commandName === "pg:profile:preflight") {
    return commandReport.exitCode === 0 &&
      parsed?.ok === true &&
      parsed?.readiness === "PASS"
      ? "PASS"
      : "BLOCK";
  }

  if (config.commandName === "pg:profile:require-readiness") {
    return commandReport.exitCode === 0 &&
      parsed?.ok === true &&
      parsed?.readiness === "PASS"
      ? "PASS"
      : "BLOCK";
  }

  if (commandReport.exitCode !== 0 || parsed?.ok === false) {
    return "BLOCK";
  }

  if (config.gate === "credential-cleanup-confirm") {
    return isValidConfirmedCleanupResult(config, parsed) ? "PASS" : "BLOCK";
  }

  return "PASS";
}

function deriveEnvironment(input, config, parsed) {
  const databaseProvider =
    input.databaseProvider ?? config.databaseProvider ?? "sqlite";
  const databaseIdentifier =
    input.databaseIdentifier ??
    config.databaseIdentifier ??
    "file:<redacted-or-approved-path>";
  const postgresqlReadiness =
    input.postgresqlReadiness ??
    parsed?.readiness ??
    (databaseProvider === "postgresql" ? "BLOCK" : "N/A-SQLite-only");

  return {
    databaseProvider,
    databaseIdentifier,
    postgresqlReadiness,
  };
}

function deriveSummary(config, parsed) {
  if (config.commandName === "ops:credential-compensation-cleanup") {
    const candidates = Array.isArray(parsed?.candidates)
      ? parsed.candidates
      : [];
    const cleanedTokenIds = Array.isArray(parsed?.cleanedTokenIds)
      ? parsed.cleanedTokenIds
      : [];
    const auditLogIds = Array.isArray(parsed?.auditLogIds)
      ? parsed.auditLogIds
      : [];

    return {
      candidateCount: candidates.length,
      cleanedCount: cleanedTokenIds.length,
      auditLogCount: auditLogIds.length,
      secretScanPassed: true,
    };
  }

  return {
    candidateCount: 0,
    cleanedCount: 0,
    auditLogCount: 0,
    secretScanPassed: true,
  };
}

function deriveEvidence(config, commandReport, parsedOutput) {
  const base = {
    commandCaptured: true,
    parsedJson: parsedOutput.parsed,
    parsedFrom: parsedOutput.source ?? "none",
    exitCode: commandReport.exitCode,
    timedOut: commandReport.timedOut,
    signal: commandReport.signal ?? "none",
    stdoutBytes: commandReport.stdoutBytes,
    stderrBytes: commandReport.stderrBytes,
    outputTruncated: commandReport.truncated,
    redactionHighRisk: commandReport.redactionHighRisk === true,
  };
  const parsed = parsedOutput.value;

  if (config.commandName === "release:gate:prod-env") {
    return {
      ...base,
      ok: parsed?.ok === true,
      code: safeString(parsed?.code),
      stage: safeString(parsed?.stage),
      checkCount: Array.isArray(parsed?.checks) ? parsed.checks.length : 0,
      failureCount: Array.isArray(parsed?.failures)
        ? parsed.failures.length
        : 0,
      failedCheckIds: safeIdList(parsed?.failures),
      manualCheckCount: Array.isArray(parsed?.manualChecks)
        ? parsed.manualChecks.length
        : 0,
    };
  }

  if (config.commandName === "release:gate:logs") {
    return {
      ...base,
      ok: parsed?.ok === true,
      code: safeString(parsed?.code),
      scannedFiles: readNonNegativeInteger(parsed?.scannedFiles),
      skippedCounts: isObject(parsed?.skipped) ? parsed.skipped : {},
      findingCount: Array.isArray(parsed?.findings)
        ? parsed.findings.length
        : 0,
    };
  }

  if (
    config.commandName === "pg:profile:preflight" ||
    config.commandName === "pg:profile:require-readiness"
  ) {
    return {
      ...base,
      ok: parsed?.ok === true,
      code: safeString(parsed?.code),
      readiness: safeString(parsed?.readiness ?? "BLOCK"),
      checkCount: Array.isArray(parsed?.checks) ? parsed.checks.length : 0,
      readinessBlockerCount: Array.isArray(parsed?.readinessBlockers)
        ? parsed.readinessBlockers.length
        : 0,
      failureCount: Array.isArray(parsed?.failures)
        ? parsed.failures.length
        : 0,
      failureIds: safeIdList(parsed?.failures),
      readinessBlockerIds: safeIdList(parsed?.readinessBlockers),
    };
  }

  if (config.commandName === "ops:credential-compensation-cleanup") {
    const candidates = Array.isArray(parsed?.candidates)
      ? parsed.candidates
      : [];
    const cleanedTokenIds = Array.isArray(parsed?.cleanedTokenIds)
      ? parsed.cleanedTokenIds
      : [];
    const auditLogIds = Array.isArray(parsed?.auditLogIds)
      ? parsed.auditLogIds
      : [];

    return {
      ...base,
      dryRun: parsed?.mode !== "confirmed",
      detectionWindowMinutes: readNonNegativeInteger(
        parsed?.detectionWindowMinutes
      ),
      candidateCount: candidates.length,
      candidateIds: candidates.map((candidate) => safeString(candidate.id)),
      candidates: candidates.map(toEvidenceCandidate),
      cleanedCount: cleanedTokenIds.length,
      cleanedTokenIds: cleanedTokenIds.map(safeString),
      auditLogIds: auditLogIds.map(safeString),
      ...(config.gate === "credential-cleanup-confirm" && candidates.length > 0
        ? {
            requestedTokenIds: config.captureArgs?.tokenIds ?? [],
            expectedCandidateCount: Number.isInteger(
              config.captureArgs?.expectedCount
            )
              ? config.captureArgs.expectedCount
              : candidates.length,
            auditAction: CLEANUP_AUDIT_ACTION,
            operator: safeString(config.captureArgs?.operator),
            ticketId: safeString(config.captureArgs?.ticketId),
          }
        : {}),
    };
  }

  return base;
}

function toEvidenceCandidate(candidate) {
  return {
    tokenId: safeString(candidate.id),
    userId: safeString(candidate.userId),
    purpose: safeString(candidate.purpose),
    createdAt: safeString(candidate.createdAt),
    expiresAt: safeString(candidate.expiresAt),
    createdById: safeString(candidate.createdById),
    hadActiveKey: candidate.hadActiveKey === true,
    hadUsedAt: candidate.hadUsedAt === true,
    hadRevokedAt: candidate.hadRevokedAt === true,
    detectionWindowMinutes: readNonNegativeInteger(
      candidate.detectionWindowMinutes
    ),
  };
}

function isValidConfirmedCleanupResult(config, parsed) {
  if (parsed?.mode !== "confirmed") {
    return false;
  }

  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const cleanedTokenIds = Array.isArray(parsed?.cleanedTokenIds)
    ? parsed.cleanedTokenIds
    : [];
  const auditLogIds = Array.isArray(parsed?.auditLogIds)
    ? parsed.auditLogIds
    : [];
  const candidateIds = candidates.map((candidate) => safeString(candidate.id));
  const cleanedIds = cleanedTokenIds.map(safeString);

  return (
    Number.isInteger(config.captureArgs?.expectedCount) &&
    config.captureArgs.expectedCount === candidates.length &&
    candidates.length > 0 &&
    cleanedIds.length === candidates.length &&
    auditLogIds.length === candidates.length &&
    candidateIds.every((candidateId) => cleanedIds.includes(candidateId))
  );
}

function safeIdList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => safeString(item?.id)).filter(Boolean);
}

function readNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function safeString(value) {
  return String(value ?? "").slice(0, 120);
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildCommandConfig(input) {
  const config = COMMANDS[input.commandKey];

  if (!config) {
    throw new Error(
      `Unsupported release evidence command key. Allowed keys: ${Object.keys(
        COMMANDS
      ).join(", ")}.`
    );
  }

  if (input.commandKey !== "credential-cleanup-confirm") {
    for (const option of CONFIRM_ONLY_OPTIONS) {
      if (input[option] !== undefined) {
        throw new Error(
          `${toKebabOption(option)} is allowed only with credential-cleanup-confirm.`
        );
      }
    }
  }

  if (config.buildArgs) {
    return config.buildArgs(input, config);
  }

  return config;
}

function buildCredentialCleanupConfirmArgs(input, config) {
  const tokenIds = readTokenIds(input.tokenIds);
  const expectedCount = readNonNegativeRequiredInteger(
    input.expectedCandidateCount,
    "expected-count"
  );
  const actorUserId = readSafeIdentifier(input.actorUserId, "actor-user-id");
  const operator = readSafeCliText(input.operator, "operator");
  const ticketId = readSafeCliText(input.ticketId, "ticket-id");
  const detectionWindowMinutes =
    input.detectionWindowMinutes === undefined
      ? undefined
      : readNonNegativeRequiredInteger(
          input.detectionWindowMinutes,
          "detection-window-minutes"
        );
  const args = ["ops:credential-compensation-cleanup", "--confirm"];

  for (const tokenId of tokenIds) {
    args.push("--token-id", tokenId);
  }

  args.push(
    "--expected-count",
    String(expectedCount),
    "--actor-user-id",
    actorUserId,
    "--operator",
    operator,
    "--ticket-id",
    ticketId
  );

  if (detectionWindowMinutes !== undefined) {
    args.push("--detection-window-minutes", String(detectionWindowMinutes));
  }

  return {
    ...config,
    args,
    captureArgs: {
      tokenIds,
      expectedCount,
      actorUserId,
      operator,
      ticketId,
      detectionWindowMinutes,
    },
  };
}

function readTokenIds(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const tokenIds = [...new Set(values.map((item) => item.trim()))].filter(
    Boolean
  );

  if (tokenIds.length === 0) {
    throw new Error("credential cleanup confirm requires --token-id.");
  }

  if (tokenIds.length > 100) {
    throw new Error(
      "credential cleanup confirm supports at most 100 token ids."
    );
  }

  return tokenIds.map((tokenId) => readSafeIdentifier(tokenId, "token-id"));
}

function readNonNegativeRequiredInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return number;
}

function readSafeIdentifier(value, fieldName) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(text)) {
    throw new Error(`${fieldName} contains unsafe release evidence text.`);
  }

  return text;
}

function readSafeCliText(value, fieldName) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  if (
    text.length > 80 ||
    /[\0\r\n;&|`<>]/.test(text) ||
    /[?&=]|https?:\/\/|\bpostgres(?:ql)?:|bearer\s+|authorization|cookie|set-cookie|password|tokenhash|rawtoken|raw token/i.test(
      text
    )
  ) {
    throw new Error(`${fieldName} contains unsafe release evidence text.`);
  }

  return text;
}

function toKebabOption(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
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

    if (!ALLOWED_OPTIONS.has(key)) {
      throw new Error(`Unsupported option: --${key}`);
    }

    const next = args[index + 1];

    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    if (key === "token-id") {
      parsed[key] = [...(parsed[key] ?? []), next];
    } else {
      parsed[key] = next;
    }

    index += 1;
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await captureReleaseEvidenceCommand({
    commandKey: args["command-key"],
    releaseCandidateId: args["release-candidate-id"],
    createdAt: args["created-at"]
      ? new Date(String(args["created-at"]))
      : undefined,
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
    notes: parseJsonOption(args.notes, "--notes") ?? [],
    timeoutMs:
      args["timeout-ms"] === undefined ? undefined : Number(args["timeout-ms"]),
    tokenIds: args["token-id"],
    expectedCandidateCount: args["expected-count"],
    actorUserId: args["actor-user-id"],
    operator: args.operator,
    ticketId: args["ticket-id"],
    detectionWindowMinutes: args["detection-window-minutes"],
  });
  const payload = JSON.stringify(report, null, 2);

  if (!report.ok) {
    console.error(payload);
    process.exit(
      report.code === "RELEASE_EVIDENCE_WRITE_VALIDATION_FAILED" ? 2 : 1
    );
  }

  console.log(payload);
  if (report.capturedResult !== "PASS") {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "RELEASE_EVIDENCE_CAPTURE_ERROR",
          message: redactCommandOutput(message),
        },
        null,
        2
      )
    );
    process.exit(2);
  });
}
