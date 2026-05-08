import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIN_SECRET_BYTES = 32;
const RELEASE_STAGE = "prod-env";
const REQUIRED_SECRETS = [
  "AUTH_SECRET",
  "PASSWORD_TOKEN_SECRET",
  "CREDENTIAL_COMPLETION_SECRET",
];
const REQUIRED_RATE_LIMIT_CONFIGS = [
  {
    store: "PSMS_LOGIN_RATE_LIMIT_STORE",
    file: "PSMS_LOGIN_RATE_LIMIT_FILE",
  },
  {
    store: "PSMS_CREDENTIAL_RATE_LIMIT_STORE",
    file: "PSMS_CREDENTIAL_RATE_LIMIT_FILE",
  },
  {
    store: "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE",
    file: "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE",
  },
];
const SAFE_LOCAL_HOST = "127.0.0.1";
const WEB_PORT = "5273";
const API_PORT = "4273";
const MIN_DELIVERY_TIMEOUT_MS = 1000;
const MAX_DELIVERY_TIMEOUT_MS = 5000;
const REQUIRED_DELIVERY_MAX_ATTEMPTS = 1;
const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const UNSAFE_ARTIFACT_PATH_SEGMENTS = new Set([
  ".tmp",
  ".codex-logs",
  "test-results",
  "playwright-report",
]);
const PLACEHOLDER_PATTERN =
  /^(?:replace-with|change-me|changeme|todo|example|sample|local-|test-|e2e-)|(?:placeholder|dummy|example|replace-with|local-secret|test-secret|e2e)/i;

function normalizeEnvValue(value) {
  return String(value ?? "").trim();
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseEnvFileText(text) {
  const parsed = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    parsed[key] = unquoteEnvValue(line.slice(equalsIndex + 1));
  }

  return parsed;
}

function createCheck(id, ok, message, meta = {}) {
  return {
    id,
    ok,
    message,
    ...meta,
  };
}

function createFailure(check) {
  return {
    id: check.id,
    code: check.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    field: check.field ?? null,
    message: check.message,
  };
}

function isStrongProductionSecret(value) {
  const secret = normalizeEnvValue(value);

  return (
    Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES &&
    !PLACEHOLDER_PATTERN.test(secret)
  );
}

function hasDistinctValues(env, keys) {
  const values = keys.map((key) => normalizeEnvValue(env[key]));

  return new Set(values).size === values.length;
}

function isLocalUrl(value, expectedPort) {
  try {
    const url = new URL(normalizeEnvValue(value));

    return (
      url.protocol === "http:" &&
      url.hostname === SAFE_LOCAL_HOST &&
      url.port === String(expectedPort) &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(normalizeEnvValue(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");

  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

  const [first, second] = parts.map(Number);

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isUnsafeProductionWebhookHost(hostname) {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".test") ||
    normalized.includes("example") ||
    isPrivateIpv4(normalized)
  );
}

function isStrictHttpsWebhookUrl(value) {
  try {
    const url = new URL(normalizeEnvValue(value));

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !isUnsafeProductionWebhookHost(url.hostname)
    );
  } catch {
    return false;
  }
}

function readOptionalInteger(env, key) {
  const value = normalizeEnvValue(env[key]);

  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

function isOptionalIntegerInRange(env, key, min, max) {
  const value = readOptionalInteger(env, key);

  return (
    value === null || (Number.isInteger(value) && value >= min && value <= max)
  );
}

function isOptionalIntegerEqual(env, key, expected) {
  const value = readOptionalInteger(env, key);

  return value === null || value === expected;
}

function isSafeProductionRateLimitPath(value) {
  const configuredPath = normalizeEnvValue(value);

  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    return false;
  }

  const segments = path
    .normalize(configuredPath)
    .split(/[\\/]+/)
    .map((segment) => segment.toLowerCase());

  if (segments.some((segment) => UNSAFE_ARTIFACT_PATH_SEGMENTS.has(segment))) {
    return false;
  }

  const relativeToWorkspace = path.relative(WORKSPACE_ROOT, configuredPath);

  return (
    relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace)
  );
}

function validateRequiredSecrets(env) {
  const checks = [];

  for (const key of REQUIRED_SECRETS) {
    checks.push(
      createCheck(
        `secret.${key}`,
        isStrongProductionSecret(env[key]),
        `${key} must be set, non-placeholder, and at least ${MIN_SECRET_BYTES} bytes.`,
        { field: key }
      )
    );
  }

  checks.push(
    createCheck(
      "secret.distinct",
      hasDistinctValues(env, REQUIRED_SECRETS),
      "AUTH_SECRET, PASSWORD_TOKEN_SECRET, and CREDENTIAL_COMPLETION_SECRET must be distinct.",
      { field: REQUIRED_SECRETS.join(",") }
    )
  );

  return checks;
}

function validatePortsAndUrls(env) {
  return [
    createCheck(
      "host.web",
      normalizeEnvValue(env.WEB_HOST) === SAFE_LOCAL_HOST,
      "WEB_HOST must be 127.0.0.1 for the PSMS local desktop runtime.",
      { field: "WEB_HOST" }
    ),
    createCheck(
      "host.api",
      normalizeEnvValue(env.API_HOST) === SAFE_LOCAL_HOST,
      "API_HOST must be 127.0.0.1 for the PSMS local desktop runtime.",
      { field: "API_HOST" }
    ),
    createCheck(
      "port.web",
      normalizeEnvValue(env.WEB_PORT) === WEB_PORT,
      "WEB_PORT must remain 5273 for the PSMS local desktop runtime.",
      { field: "WEB_PORT" }
    ),
    createCheck(
      "port.api",
      normalizeEnvValue(env.API_PORT) === API_PORT,
      "API_PORT must remain 4273 for the PSMS local desktop runtime.",
      { field: "API_PORT" }
    ),
    createCheck(
      "url.app",
      isLocalUrl(env.APP_URL, 5273),
      "APP_URL must be http://127.0.0.1:5273 for the local release target.",
      { field: "APP_URL" }
    ),
    createCheck(
      "url.api",
      isLocalUrl(env.PSMS_API_URL, 4273),
      "PSMS_API_URL must be http://127.0.0.1:4273 for the local release target.",
      { field: "PSMS_API_URL" }
    ),
  ];
}

function validateRuntimeFlags(env) {
  return [
    createCheck(
      "runtime.node-env",
      normalizeEnvValue(env.NODE_ENV) === "production",
      "NODE_ENV must be production for a production/release candidate.",
      { field: "NODE_ENV" }
    ),
    createCheck(
      "auth.dev-bypass",
      normalizeEnvValue(env.PSMS_DEV_AUTH_BYPASS).toLowerCase() !== "true",
      "PSMS_DEV_AUTH_BYPASS must not be true for a production/release candidate.",
      { field: "PSMS_DEV_AUTH_BYPASS" }
    ),
  ];
}

function validateRateLimitConfig(env) {
  return REQUIRED_RATE_LIMIT_CONFIGS.flatMap(({ store, file }) => [
    createCheck(
      `rate-limit.store.${store}`,
      normalizeEnvValue(env[store]) === "file",
      `${store} must be file for a production/release candidate.`,
      { field: store }
    ),
    createCheck(
      `rate-limit.file.${file}`,
      isSafeProductionRateLimitPath(env[file]),
      `${file} must be an absolute production file path outside the workspace and test artifact directories.`,
      { field: file }
    ),
  ]);
}

function validateDelivery(env) {
  const mode = normalizeEnvValue(env.PSMS_CREDENTIAL_DELIVERY_MODE);
  const webhookUrl = normalizeEnvValue(
    env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL
  );
  const webhookSecret = normalizeEnvValue(
    env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET
  );
  const timeoutMs = normalizeEnvValue(
    env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS
  );
  const maxAttempts = normalizeEnvValue(
    env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS
  );
  const configured = Boolean(
    mode || webhookUrl || webhookSecret || timeoutMs || maxAttempts
  );

  if (!configured) {
    return [
      createCheck(
        "delivery.configured",
        true,
        "Credential delivery is disabled; admin issue APIs remain unavailable until delivery is configured.",
        { field: "PSMS_CREDENTIAL_DELIVERY_MODE", warning: true }
      ),
    ];
  }

  return [
    createCheck(
      "delivery.mode",
      mode === "OUT_OF_BAND_APPROVED",
      "PSMS_CREDENTIAL_DELIVERY_MODE must be OUT_OF_BAND_APPROVED when credential delivery is configured.",
      { field: "PSMS_CREDENTIAL_DELIVERY_MODE" }
    ),
    createCheck(
      "delivery.webhook-url",
      isStrictHttpsWebhookUrl(webhookUrl),
      "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL must use https and must not include credentials, query string, fragment, or local/test host.",
      { field: "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL" }
    ),
    createCheck(
      "delivery.webhook-secret",
      isStrongProductionSecret(webhookSecret),
      `PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET must be set, non-placeholder, and at least ${MIN_SECRET_BYTES} bytes when delivery is configured.`,
      { field: "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET" }
    ),
    createCheck(
      "delivery.webhook-secret-distinct",
      webhookSecret.length > 0 &&
        hasDistinctValues(env, [
          ...REQUIRED_SECRETS,
          "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET",
        ]),
      "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET must be distinct from AUTH_SECRET, PASSWORD_TOKEN_SECRET, and CREDENTIAL_COMPLETION_SECRET.",
      { field: "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET" }
    ),
    createCheck(
      "delivery.webhook-timeout-ms",
      isOptionalIntegerInRange(
        env,
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS",
        MIN_DELIVERY_TIMEOUT_MS,
        MAX_DELIVERY_TIMEOUT_MS
      ),
      `PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS must be an integer between ${MIN_DELIVERY_TIMEOUT_MS} and ${MAX_DELIVERY_TIMEOUT_MS} when set.`,
      { field: "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS" }
    ),
    createCheck(
      "delivery.webhook-max-attempts",
      isOptionalIntegerEqual(
        env,
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS",
        REQUIRED_DELIVERY_MAX_ATTEMPTS
      ),
      "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS must remain 1 until the receiver idempotency contract is approved.",
      { field: "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS" }
    ),
  ];
}

export function validateProductionReleaseGate(env) {
  const checks = [
    ...validateRequiredSecrets(env),
    ...validateRuntimeFlags(env),
    ...validatePortsAndUrls(env),
    ...validateRateLimitConfig(env),
    ...validateDelivery(env),
  ];
  const failed = checks.filter((check) => !check.ok);
  const manualChecks = [
    "Run pnpm test:e2e:artifact-secret-scan after build/E2E/dev smoke artifacts are produced.",
    "Confirm reverse proxy/CDN/APM do not capture query strings, request bodies, Cookie, Set-Cookie, or Authorization headers for credential routes.",
    "Confirm credential delivery webhook receiver does not persist request body, raw token, or Authorization header.",
    "Confirm credential delivery webhook receiver deduplicates by X-PSMS-Delivery-Id before any production retry rollout.",
    "Confirm cleanup/release evidence artifacts follow docs/60_release/credential-cleanup-release-evidence-template.md naming, JSON shape, and forbidden field checklist.",
    "Confirm credential compensation failure cleanup runbook limbo token scan is recorded in the release report.",
    "Run pnpm pg:profile:preflight and record scaffold integrity output; readiness: BLOCK is not PostgreSQL execution PASS.",
    "For a PostgreSQL release candidate, run pnpm pg:profile:require-readiness and require PASS; local Electron SQLite-only releases may record N/A-SQLite-only.",
    "Confirm PostgreSQL credential cleanup rehearsal profile is PASS for PostgreSQL releases or explicitly N/A-SQLite-only for local Electron release.",
    "Confirm release report includes rollback, backup, DB path, and executed validation commands.",
  ];

  return {
    ok: failed.length === 0,
    code:
      failed.length === 0
        ? "PRODUCTION_RELEASE_GATE_OK"
        : "PRODUCTION_RELEASE_GATE_FAILED",
    stage: RELEASE_STAGE,
    checked: {
      nodeEnv: "NODE_ENV",
      hosts: ["WEB_HOST", "API_HOST"],
      ports: ["WEB_PORT", "API_PORT"],
      urls: ["APP_URL", "PSMS_API_URL"],
      secrets: REQUIRED_SECRETS,
      devBypass: "PSMS_DEV_AUTH_BYPASS",
      rateLimit: REQUIRED_RATE_LIMIT_CONFIGS,
      delivery: [
        "PSMS_CREDENTIAL_DELIVERY_MODE",
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL",
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET",
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS",
        "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS",
      ],
      logArtifacts: "pnpm release:gate:logs",
      manualChecks: manualChecks.length,
    },
    checks,
    failed,
    failures: failed.map(createFailure),
    manualChecks,
  };
}

function createErrorReport(error) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    ok: false,
    code: "PRODUCTION_RELEASE_GATE_ERROR",
    stage: RELEASE_STAGE,
    checked: {},
    failures: [
      {
        id: "gate.error",
        code: "PRODUCTION_RELEASE_GATE_ERROR",
        field: null,
        message,
      },
    ],
    message,
  };
}

async function loadEnvFromArgs(args) {
  const envFileIndex = args.indexOf("--env-file");

  if (envFileIndex >= 0) {
    const envFilePath = args[envFileIndex + 1];

    if (!envFilePath) {
      throw new Error("--env-file requires a path.");
    }

    return {
      ...process.env,
      ...parseEnvFileText(await readFile(envFilePath, "utf8")),
    };
  }

  if (process.env.PSMS_RELEASE_ENV_FILE) {
    return {
      ...process.env,
      ...parseEnvFileText(
        await readFile(process.env.PSMS_RELEASE_ENV_FILE, "utf8")
      ),
    };
  }

  return process.env;
}

async function main() {
  const env = await loadEnvFromArgs(process.argv.slice(2));
  const report = validateProductionReleaseGate(env);
  const payload = JSON.stringify(report, null, 2);

  if (!report.ok) {
    console.error(payload);
    process.exit(1);
  }

  console.log(payload);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify(createErrorReport(error), null, 2));
    process.exit(1);
  });
}
