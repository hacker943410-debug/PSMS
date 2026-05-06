import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ID_IP_LIMIT = 5;
const IP_LIMIT = 20;
const STATE_VERSION = 1;
const DEFAULT_RATE_LIMIT_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  ".tmp",
  "runtime",
  "login-rate-limit.json"
);

type Bucket = {
  count: number;
  resetAt: number;
};

type LoginRateLimitState = {
  version: typeof STATE_VERSION;
  buckets: Record<string, Bucket>;
};

export type LoginRateLimitDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

const memoryState: LoginRateLimitState = createEmptyState();

function nowMs() {
  return Date.now();
}

function createEmptyState(): LoginRateLimitState {
  return {
    version: STATE_VERSION,
    buckets: {},
  };
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function getConfiguredHashSecret() {
  return (
    process.env.PSMS_LOGIN_RATE_LIMIT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    null
  );
}

function getHashSecret() {
  return getConfiguredHashSecret() ?? "psms-login-rate-limit-dev-secret";
}

function getStoreMode() {
  const mode = process.env.PSMS_LOGIN_RATE_LIMIT_STORE?.trim().toLowerCase();

  if (!mode || mode === "file") {
    return "file";
  }

  if (mode === "memory") {
    return "memory";
  }

  throw new Error(`Unsupported login rate limit store: ${mode}`);
}

function getStateFilePath() {
  return resolve(
    process.env.PSMS_LOGIN_RATE_LIMIT_FILE?.trim() || DEFAULT_RATE_LIMIT_FILE
  );
}

function isBucket(value: unknown): value is Bucket {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bucket = value as Partial<Bucket>;

  return (
    Number.isFinite(bucket.count) &&
    Number.isFinite(bucket.resetAt) &&
    (bucket.count ?? 0) >= 0 &&
    (bucket.resetAt ?? 0) >= 0
  );
}

function parseState(payload: string): LoginRateLimitState {
  const parsed = JSON.parse(payload) as Partial<LoginRateLimitState>;
  const buckets: Record<string, Bucket> = {};

  if (!parsed.buckets || typeof parsed.buckets !== "object") {
    return createEmptyState();
  }

  for (const [key, value] of Object.entries(parsed.buckets)) {
    if (isBucket(value)) {
      buckets[key] = {
        count: Math.trunc(value.count),
        resetAt: Math.trunc(value.resetAt),
      };
    }
  }

  return {
    version: STATE_VERSION,
    buckets,
  };
}

function pruneExpiredBuckets(state: LoginRateLimitState, now = nowMs()) {
  for (const [key, bucket] of Object.entries(state.buckets)) {
    if (bucket.resetAt <= now) {
      delete state.buckets[key];
    }
  }

  return state;
}

function loadFileState(now = nowMs()) {
  const filePath = getStateFilePath();

  if (!existsSync(filePath)) {
    return createEmptyState();
  }

  return pruneExpiredBuckets(parseState(readFileSync(filePath, "utf8")), now);
}

function writeFileState(state: LoginRateLimitState) {
  const filePath = getStateFilePath();
  const tempPath = `${filePath}.${process.pid}.tmp`;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
  });
  renameSync(tempPath, filePath);
}

function loadState(now = nowMs()) {
  assertLoginRateLimitReady();

  if (getStoreMode() === "memory") {
    return pruneExpiredBuckets(memoryState, now);
  }

  return loadFileState(now);
}

function saveState(state: LoginRateLimitState) {
  if (getStoreMode() === "memory") {
    return;
  }

  writeFileState(state);
}

function getActiveBucket(
  state: LoginRateLimitState,
  key: string,
  now = nowMs()
) {
  const existing = state.buckets[key];

  if (!existing || existing.resetAt <= now) {
    return null;
  }

  return existing;
}

function getOrCreateBucket(
  state: LoginRateLimitState,
  key: string,
  now = nowMs()
) {
  const existing = getActiveBucket(state, key, now);

  if (existing) {
    return existing;
  }

  const bucket = {
    count: 0,
    resetAt: now + WINDOW_MS,
  };

  state.buckets[key] = bucket;

  return bucket;
}

function normalizeIp(ipAddress: string | null) {
  return ipAddress?.trim() || "unknown";
}

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

function hashBucketKey(scope: string, values: string[]) {
  const digest = createHmac("sha256", getHashSecret())
    .update(scope)
    .update("\0")
    .update(values.join("\0"))
    .digest("hex");

  return `${scope}:${digest}`;
}

function loginIdIpKey(loginId: string, ipAddress: string | null) {
  return hashBucketKey("login-id-ip", [
    normalizeLoginId(loginId),
    normalizeIp(ipAddress),
  ]);
}

function ipKey(ipAddress: string | null) {
  return hashBucketKey("ip", [normalizeIp(ipAddress)]);
}

function toRetryAfterSeconds(...buckets: Array<Bucket | null>) {
  const now = nowMs();
  const resetAt = Math.max(...buckets.map((bucket) => bucket?.resetAt ?? now));

  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function assertLoginRateLimitReady() {
  if (!isProductionRuntime()) {
    return;
  }

  if (getStoreMode() === "memory") {
    throw new Error(
      "Persistent login rate limit storage is required in production. Set PSMS_LOGIN_RATE_LIMIT_STORE=file."
    );
  }

  if (!process.env.PSMS_LOGIN_RATE_LIMIT_FILE?.trim()) {
    throw new Error(
      "Explicit PSMS_LOGIN_RATE_LIMIT_FILE is required in production."
    );
  }

  if (!getConfiguredHashSecret()) {
    throw new Error(
      "AUTH_SECRET or PSMS_LOGIN_RATE_LIMIT_SECRET is required for production login rate limit storage."
    );
  }
}

export function checkLoginRateLimit(
  loginId: string,
  ipAddress: string | null
): LoginRateLimitDecision {
  const now = nowMs();
  const state = loadState(now);
  const loginIdIpBucket = getActiveBucket(
    state,
    loginIdIpKey(loginId, ipAddress),
    now
  );
  const ipBucket = getActiveBucket(state, ipKey(ipAddress), now);
  const loginIdIpAllowed =
    !loginIdIpBucket || loginIdIpBucket.count < LOGIN_ID_IP_LIMIT;
  const ipAllowed = !ipBucket || ipBucket.count < IP_LIMIT;

  if (loginIdIpAllowed && ipAllowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: toRetryAfterSeconds(loginIdIpBucket, ipBucket),
  };
}

export function canAttemptLogin(loginId: string, ipAddress: string | null) {
  return checkLoginRateLimit(loginId, ipAddress).allowed;
}

export function recordFailedLogin(loginId: string, ipAddress: string | null) {
  const now = nowMs();
  const state = loadState(now);

  getOrCreateBucket(state, loginIdIpKey(loginId, ipAddress), now).count += 1;
  getOrCreateBucket(state, ipKey(ipAddress), now).count += 1;
  saveState(pruneExpiredBuckets(state, now));
}

export function clearLoginFailures(loginId: string, ipAddress: string | null) {
  const now = nowMs();
  const state = loadState(now);

  delete state.buckets[loginIdIpKey(loginId, ipAddress)];
  saveState(pruneExpiredBuckets(state, now));
}

export function resetLoginRateLimitForTest() {
  for (const key of Object.keys(memoryState.buckets)) {
    delete memoryState.buckets[key];
  }

  if (getStoreMode() === "file") {
    rmSync(getStateFilePath(), { force: true });
  }
}
