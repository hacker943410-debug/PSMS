import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WINDOW_MS = 15 * 60 * 1000;
const PENDING_WINDOW_MS = 10 * 1000;
const LOGIN_ID_IP_LIMIT = 5;
const IP_LIMIT = 20;
const STATE_VERSION = 1;
const CORRUPT_STATE_RETRY_AFTER_SECONDS = Math.ceil(WINDOW_MS / 1000);
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 15_000;
const LOCK_RETRY_MS = 20;
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

type PersistedLoginRateLimitState = LoginRateLimitState & {
  mac?: string;
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

class LoginRateLimitStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginRateLimitStateError";
  }
}

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

function isUsableProductionSecret(secret: string | null) {
  if (!secret || secret.length < 32) {
    return false;
  }

  const normalized = secret.toLowerCase();

  return (
    !normalized.startsWith("replace-with") &&
    !normalized.includes("changeme") &&
    normalized !== "password" &&
    normalized !== "secret"
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

function getLockDirPath() {
  return `${getStateFilePath()}.lock`;
}

function isBucket(value: unknown): value is Bucket {
  if (!value || typeof value !== "object") {
    return false;
  }

  const keys = Object.keys(value);
  const bucket = value as Partial<Bucket>;

  return (
    keys.length === 2 &&
    keys.includes("count") &&
    keys.includes("resetAt") &&
    Number.isFinite(bucket.count) &&
    Number.isFinite(bucket.resetAt) &&
    Number.isInteger(bucket.count) &&
    Number.isInteger(bucket.resetAt) &&
    (bucket.count ?? 0) >= 0 &&
    (bucket.resetAt ?? 0) >= 0
  );
}

function isBucketKey(key: string) {
  return /^(login-id-ip|login-id-ip-pending|ip|ip-pending|login-state-corrupt):[a-f0-9]{64}$/.test(
    key
  );
}

function canonicalBuckets(buckets: Record<string, Bucket>) {
  return Object.fromEntries(
    Object.entries(buckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, bucket]) => [
        key,
        {
          count: Math.trunc(bucket.count),
          resetAt: Math.trunc(bucket.resetAt),
        },
      ])
  );
}

function createStateMac(state: LoginRateLimitState) {
  return createHmac("sha256", getHashSecret())
    .update(
      JSON.stringify({
        version: STATE_VERSION,
        buckets: canonicalBuckets(state.buckets),
      })
    )
    .digest("hex");
}

function parseState(payload: string): LoginRateLimitState {
  let parsed: Partial<PersistedLoginRateLimitState>;

  try {
    parsed = JSON.parse(payload) as Partial<PersistedLoginRateLimitState>;
  } catch {
    throw new LoginRateLimitStateError(
      "Login rate limit state is not valid JSON."
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LoginRateLimitStateError(
      "Login rate limit state shape is invalid."
    );
  }

  const stateKeys = Object.keys(parsed);
  const buckets: Record<string, Bucket> = {};

  if (
    stateKeys.length !== 3 ||
    !stateKeys.includes("version") ||
    !stateKeys.includes("buckets") ||
    !stateKeys.includes("mac")
  ) {
    throw new LoginRateLimitStateError(
      "Login rate limit state shape is invalid."
    );
  }

  if (parsed.version !== STATE_VERSION) {
    throw new LoginRateLimitStateError(
      "Login rate limit state version is invalid."
    );
  }

  if (
    !parsed.buckets ||
    typeof parsed.buckets !== "object" ||
    Array.isArray(parsed.buckets)
  ) {
    throw new LoginRateLimitStateError("Login rate limit buckets are invalid.");
  }

  for (const [key, value] of Object.entries(parsed.buckets)) {
    if (!isBucketKey(key) || !isBucket(value)) {
      throw new LoginRateLimitStateError(
        "Login rate limit bucket entry is invalid."
      );
    }

    buckets[key] = {
      count: Math.trunc(value.count),
      resetAt: Math.trunc(value.resetAt),
    };
  }

  const state: LoginRateLimitState = {
    version: STATE_VERSION,
    buckets,
  };

  if (parsed.mac !== createStateMac(state)) {
    throw new LoginRateLimitStateError(
      "Login rate limit state MAC is invalid."
    );
  }

  return state;
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

  try {
    return pruneExpiredBuckets(parseState(readFileSync(filePath, "utf8")), now);
  } catch (error) {
    if (error instanceof LoginRateLimitStateError) {
      throw error;
    }

    throw new LoginRateLimitStateError(
      "Login rate limit state could not be read."
    );
  }
}

function writeFileState(state: LoginRateLimitState) {
  const filePath = getStateFilePath();
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const persisted: PersistedLoginRateLimitState = {
    version: STATE_VERSION,
    buckets: canonicalBuckets(state.buckets),
  };

  persisted.mac = createStateMac(persisted);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(persisted, null, 2)}\n`, {
    encoding: "utf8",
  });
  rmSync(filePath, { force: true });
  renameSync(tempPath, filePath);
}

function waitSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeStaleLock(lockDirPath: string, now = nowMs()) {
  try {
    const lock = statSync(lockDirPath);

    if (now - lock.mtimeMs > LOCK_STALE_MS) {
      rmSync(lockDirPath, { force: true, recursive: true });
    }
  } catch {
    return;
  }
}

function acquireFileLock() {
  const lockDirPath = getLockDirPath();
  const startedAt = nowMs();

  mkdirSync(dirname(lockDirPath), { recursive: true });

  while (true) {
    try {
      mkdirSync(lockDirPath);

      return () => rmSync(lockDirPath, { force: true, recursive: true });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (code !== "EEXIST") {
        throw error;
      }

      const now = nowMs();

      removeStaleLock(lockDirPath, now);

      if (now - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error("Timed out acquiring login rate limit lock.");
      }

      waitSync(LOCK_RETRY_MS);
    }
  }
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
  now = nowMs(),
  windowMs = WINDOW_MS
) {
  const existing = getActiveBucket(state, key, now);

  if (existing) {
    return existing;
  }

  const bucket = {
    count: 0,
    resetAt: now + windowMs,
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

function loginIdIpPendingKey(loginId: string, ipAddress: string | null) {
  return hashBucketKey("login-id-ip-pending", [
    normalizeLoginId(loginId),
    normalizeIp(ipAddress),
  ]);
}

function ipKey(ipAddress: string | null) {
  return hashBucketKey("ip", [normalizeIp(ipAddress)]);
}

function ipPendingKey(ipAddress: string | null) {
  return hashBucketKey("ip-pending", [normalizeIp(ipAddress)]);
}

function corruptStateKey() {
  return hashBucketKey("login-state-corrupt", ["global"]);
}

function bucketCount(bucket: Bucket | null) {
  return bucket?.count ?? 0;
}

function decrementBucket(state: LoginRateLimitState, key: string, now: number) {
  const bucket = getActiveBucket(state, key, now);

  if (!bucket) {
    return;
  }

  bucket.count -= 1;

  if (bucket.count <= 0) {
    delete state.buckets[key];
  }
}

function toRetryAfterSeconds(...buckets: Array<Bucket | null>) {
  const now = nowMs();
  const resetAt = Math.max(...buckets.map((bucket) => bucket?.resetAt ?? now));

  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function corruptStateDecision(): LoginRateLimitDecision {
  return {
    allowed: false,
    retryAfterSeconds: CORRUPT_STATE_RETRY_AFTER_SECONDS,
  };
}

function createCorruptState(now: number) {
  const state = createEmptyState();

  state.buckets[corruptStateKey()] = {
    count: 1,
    resetAt: now + WINDOW_MS,
  };

  return state;
}

function writeCorruptState(now: number) {
  try {
    writeFileState(createCorruptState(now));
  } catch {
    return;
  }
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

  if (!isUsableProductionSecret(getConfiguredHashSecret())) {
    throw new Error(
      "AUTH_SECRET or PSMS_LOGIN_RATE_LIMIT_SECRET must be a non-placeholder production secret of at least 32 characters for login rate limit storage."
    );
  }
}

export function checkLoginRateLimit(
  loginId: string,
  ipAddress: string | null
): LoginRateLimitDecision {
  const now = nowMs();
  assertLoginRateLimitReady();

  if (getStoreMode() === "memory") {
    return checkLoginRateLimitState(
      pruneExpiredBuckets(memoryState, now),
      loginId,
      ipAddress,
      now
    );
  }

  const releaseLock = acquireFileLock();

  try {
    const state = loadFileState(now);
    const decision = checkLoginRateLimitState(state, loginId, ipAddress, now);

    if (decision.allowed) {
      writeFileState(pruneExpiredBuckets(state, now));
    }

    return decision;
  } catch (error) {
    if (error instanceof LoginRateLimitStateError) {
      writeCorruptState(now);

      return corruptStateDecision();
    }

    throw error;
  } finally {
    releaseLock();
  }
}

function checkLoginRateLimitState(
  state: LoginRateLimitState,
  loginId: string,
  ipAddress: string | null,
  now: number
): LoginRateLimitDecision {
  const corruptBucket = getActiveBucket(state, corruptStateKey(), now);

  if (corruptBucket) {
    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(corruptBucket),
    };
  }

  const loginIdIpBucket = getActiveBucket(
    state,
    loginIdIpKey(loginId, ipAddress),
    now
  );
  const loginIdIpPendingBucket = getActiveBucket(
    state,
    loginIdIpPendingKey(loginId, ipAddress),
    now
  );
  const ipBucket = getActiveBucket(state, ipKey(ipAddress), now);
  const ipPendingBucket = getActiveBucket(state, ipPendingKey(ipAddress), now);
  const loginIdIpCount =
    bucketCount(loginIdIpBucket) + bucketCount(loginIdIpPendingBucket);
  const ipCount = bucketCount(ipBucket) + bucketCount(ipPendingBucket);
  const loginIdIpAllowed = loginIdIpCount < LOGIN_ID_IP_LIMIT;
  const ipAllowed = ipCount < IP_LIMIT;

  if (loginIdIpAllowed && ipAllowed) {
    getOrCreateBucket(
      state,
      loginIdIpPendingKey(loginId, ipAddress),
      now,
      PENDING_WINDOW_MS
    ).count += 1;
    getOrCreateBucket(
      state,
      ipPendingKey(ipAddress),
      now,
      PENDING_WINDOW_MS
    ).count += 1;

    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: toRetryAfterSeconds(
      loginIdIpBucket,
      loginIdIpPendingBucket,
      ipBucket,
      ipPendingBucket
    ),
  };
}

export function canAttemptLogin(loginId: string, ipAddress: string | null) {
  return checkLoginRateLimit(loginId, ipAddress).allowed;
}

export function recordFailedLogin(loginId: string, ipAddress: string | null) {
  const now = nowMs();

  assertLoginRateLimitReady();

  if (getStoreMode() === "memory") {
    recordFailedLoginState(
      pruneExpiredBuckets(memoryState, now),
      loginId,
      ipAddress,
      now
    );

    return;
  }

  const releaseLock = acquireFileLock();

  try {
    const state = loadFileState(now);

    recordFailedLoginState(state, loginId, ipAddress, now);
    writeFileState(pruneExpiredBuckets(state, now));
  } catch (error) {
    if (error instanceof LoginRateLimitStateError) {
      writeCorruptState(now);
      return;
    }

    throw error;
  } finally {
    releaseLock();
  }
}

export function clearLoginFailures(loginId: string, ipAddress: string | null) {
  const now = nowMs();

  assertLoginRateLimitReady();

  if (getStoreMode() === "memory") {
    clearLoginFailuresState(
      pruneExpiredBuckets(memoryState, now),
      loginId,
      ipAddress,
      now
    );

    return;
  }

  const releaseLock = acquireFileLock();

  try {
    const state = loadFileState(now);

    clearLoginFailuresState(state, loginId, ipAddress, now);
    writeFileState(pruneExpiredBuckets(state, now));
  } catch (error) {
    if (error instanceof LoginRateLimitStateError) {
      writeCorruptState(now);
      return;
    }

    throw error;
  } finally {
    releaseLock();
  }
}

function releasePendingLoginReservationState(
  state: LoginRateLimitState,
  loginId: string,
  ipAddress: string | null,
  now: number
) {
  if (getActiveBucket(state, corruptStateKey(), now)) {
    return;
  }

  decrementBucket(state, loginIdIpPendingKey(loginId, ipAddress), now);
  decrementBucket(state, ipPendingKey(ipAddress), now);
}

function recordFailedLoginState(
  state: LoginRateLimitState,
  loginId: string,
  ipAddress: string | null,
  now: number
) {
  if (getActiveBucket(state, corruptStateKey(), now)) {
    return;
  }

  releasePendingLoginReservationState(state, loginId, ipAddress, now);
  getOrCreateBucket(state, loginIdIpKey(loginId, ipAddress), now).count += 1;
  getOrCreateBucket(state, ipKey(ipAddress), now).count += 1;
}

function clearLoginFailuresState(
  state: LoginRateLimitState,
  loginId: string,
  ipAddress: string | null,
  now: number
) {
  if (getActiveBucket(state, corruptStateKey(), now)) {
    return;
  }

  releasePendingLoginReservationState(state, loginId, ipAddress, now);
  delete state.buckets[loginIdIpKey(loginId, ipAddress)];
}

export function resetLoginRateLimitForTest() {
  for (const key of Object.keys(memoryState.buckets)) {
    delete memoryState.buckets[key];
  }

  if (getStoreMode() === "file") {
    rmSync(getStateFilePath(), { force: true });
    rmSync(getLockDirPath(), { force: true, recursive: true });
  }
}
