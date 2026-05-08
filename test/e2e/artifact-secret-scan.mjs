import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { redactCredentialSecretsFromLog } from "./support/credential-log-redaction.mjs";

const WORKSPACE_ROOT = process.cwd();
const SCAN_ROOTS = [
  ".codex-logs",
  ".tmp",
  "test-results",
  "playwright-report",
  "release-evidence",
];
const ROOT_LOG_PATTERN = /^\.psms-dev.*\.log$/;
const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".bak",
  ".br",
  ".db",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".sqlite",
  ".sqlite3",
  ".webm",
  ".webp",
  ".zip",
]);
const SECRET_PATTERNS = [
  {
    name: "credential token query",
    pattern: /(?:[?&]token=|token%3D)[A-Za-z0-9_-]{32,256}/gi,
  },
  {
    name: "credential token cookie",
    pattern:
      /psms_(?:staff_activation|password_reset)_token=[A-Za-z0-9_-]{32,256}/g,
  },
  {
    name: "credential completion cookie",
    pattern:
      /psms_(?:staff_activation|password_reset)_completed=v1\.\d{13}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
  },
  {
    name: "json credential token",
    pattern: /"token"\s*:\s*"[A-Za-z0-9_-]{32,256}"/gi,
  },
  {
    name: "json sensitive field",
    pattern:
      /"(?:activeKey|authorization|confirmPassword|newPassword|password|passwordHash|rawToken|sessionHash|sessionToken|tokenHash|webhookBody|webhookSecret)"\s*:\s*"[^"\[]{8,256}"/gi,
  },
  {
    name: "form sensitive field",
    pattern:
      /\b(?:confirmPassword|newPassword|password)=((?!\[REDACTED\])[^&\s]{8,256})/gi,
    skipExtensions: new Set([".html", ".js", ".mjs", ".cjs"]),
  },
  {
    name: "authorization bearer",
    pattern: /\bauthorization:\s*Bearer\s+(?!\[REDACTED\])[^\s]{8,256}/gi,
  },
  {
    name: "cookie header",
    pattern: /\b(?:cookie|set-cookie):\s*(?!\[REDACTED\])[^\r\n]{8,512}/gi,
  },
  {
    name: "postgresql dsn",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s"']{8,512}/gi,
  },
  {
    name: "credential url",
    pattern:
      /https?:\/\/[^\s"']*(?:[?&]token=|staff-activation|password-reset)[^\s"']*/gi,
  },
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isLikelyBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 4096);

  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

async function collectFiles(rootPath) {
  const rootStats = await stat(rootPath);

  if (rootStats.isFile()) {
    return [rootPath];
  }

  if (!rootStats.isDirectory()) {
    return [];
  }

  const files = [];
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function collectScanTargets() {
  const targets = [];
  const rootEntries = await readdir(WORKSPACE_ROOT, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (entry.isFile() && ROOT_LOG_PATTERN.test(entry.name)) {
      targets.push(path.join(WORKSPACE_ROOT, entry.name));
    }
  }

  for (const root of SCAN_ROOTS) {
    const rootPath = path.join(WORKSPACE_ROOT, root);

    if (await exists(rootPath)) {
      targets.push(...(await collectFiles(rootPath)));
    }
  }

  return targets;
}

async function scanFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const fileStats = await stat(filePath);

  if (BINARY_EXTENSIONS.has(extension)) {
    return { skipped: "binary-extension" };
  }

  if (fileStats.size > MAX_SCAN_BYTES) {
    return { skipped: "too-large" };
  }

  const buffer = await readFile(filePath);

  if (isLikelyBinary(buffer)) {
    return { skipped: "binary-content" };
  }

  const text = buffer.toString("utf8");
  const matches = [];

  for (const { name, pattern, skipExtensions } of SECRET_PATTERNS) {
    if (skipExtensions?.has(extension)) {
      continue;
    }

    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      matches.push({
        pattern: name,
        excerpt: redactArtifactSecretExcerpt(match[0]).slice(0, 120),
      });
    }
  }

  return { matches };
}

function redactArtifactSecretExcerpt(value) {
  return redactCredentialSecretsFromLog(value)
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED]")
    .replace(/\b(cookie|set-cookie):\s*[^\r\n]+/gi, "$1: [REDACTED]")
    .replace(
      /\bauthorization:\s*Bearer\s+[^\s]+/gi,
      "authorization: Bearer [REDACTED]"
    )
    .replace(
      /https?:\/\/[^\s"']*(?:[?&]token=|staff-activation|password-reset)[^\s"']*/gi,
      "https://[REDACTED]"
    );
}

const targets = await collectScanTargets();
const findings = [];
const skipped = {};
let scannedFiles = 0;

for (const target of targets) {
  const result = await scanFile(target);

  if (result.skipped) {
    skipped[result.skipped] = (skipped[result.skipped] ?? 0) + 1;
    continue;
  }

  scannedFiles += 1;

  if (result.matches?.length) {
    findings.push({
      file: path.relative(WORKSPACE_ROOT, target),
      matches: result.matches,
    });
  }
}

if (findings.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: "CREDENTIAL_SECRET_ARTIFACT_LEAK",
        scannedFiles,
        skipped,
        findings,
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      scannedFiles,
      skipped,
      roots: SCAN_ROOTS,
      rootLogPattern: ROOT_LOG_PATTERN.source,
    },
    null,
    2
  )
);
