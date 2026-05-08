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
import type { CredentialTokenPurpose } from "@psms/shared";

const WINDOW_MS = 15 * 60 * 1000;
const ACTOR_TARGET_LIMIT = 4;
const ACTOR_LIMIT = 30;
const ACTOR_IP_LIMIT = 30;
const TARGET_LIMIT = 10;
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
  "admin-credential-rate-limit.json"
);

type Bucket = {
  count: number;
  resetAt: number;
};

type AdminCredentialRateLimitState = {
  version: typeof STATE_VERSION;
  buckets: Record<string, Bucket>;
};

type PersistedAdminCredentialRateLimitState = AdminCredentialRateLimitState & {
  mac?: string;
};

export type AdminCredentialMutationRateLimitInput = {
  actorUserId: string;
  targetUserId: string;
  purpose: CredentialTokenPurpose;
  mutation: "issue" | "revoke";
  ipAddress: string | null;
};

export type AdminCredentialMutationRateLimitDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

const memoryState: AdminCredentialRateLimitState = createEmptyState();

class AdminCredentialRateLimitStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminCredentialRateLimitStateError";
  }
}

function nowMs() {
  return Date.now();
}

function createEmptyState(): AdminCredentialRateLimitState {
  return {
    version: STATE_VERSION,
    buckets: {},
  };
}

function getConfiguredHashSecret() {
  return (
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET?.trim() ||
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET?.trim() ||
    process.env.PASSWORD_TOKEN_SECRET?.trim() ||
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
  return getConfiguredHashSecret() ?? "psms-admin-credential-rate-limit-dev";
}

function getStoreMode() {
  const mode =
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE?.trim().toLowerCase();

  if (!mode || mode === "file") {
    return "file";
  }

  if (mode === "memory") {
    return "memory";
  }

  throw new Error(`Unsupported admin credential rate limit store: ${mode}`);
}

function getStateFilePath() {
  return resolve(
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE?.trim() ||
      DEFAULT_RATE_LIMIT_FILE
  );
}

function getLockDirPath() {
  return `${getStateFilePath()}.lock`;
}

function assertAdminCredentialRateLimitReady() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (getStoreMode() === "memory") {
    throw new Error(
      "Persistent admin credential rate limit storage is required in production. Set PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE=file."
    );
  }

  if (!process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE?.trim()) {
    throw new Error(
      "Explicit PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE is required in production."
    );
  }

  if (!isUsableProductionSecret(getConfiguredHashSecret())) {
    throw new Error(
      "AUTH_SECRET, PASSWORD_TOKEN_SECRET, PSMS_CREDENTIAL_RATE_LIMIT_SECRET, or PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET must be a non-placeholder production secret of at least 32 characters for admin credential rate limit storage."
    );
  }
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
    (bucket.count ?? 0) >= 0 &&
    (bucket.resetAt ?? 0) >= 0
  );
}

function isBucketKey(key: string) {
  return /^(admin-credential-actor-target|admin-credential-actor|admin-credential-actor-ip|admin-credential-target|admin-credential-state-corrupt):[a-f0-9]{64}$/.test(
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

function createStateMac(state: AdminCredentialRateLimitState) {
  return createHmac("sha256", getHashSecret())
    .update(
      JSON.stringify({
        version: STATE_VERSION,
        buckets: canonicalBuckets(state.buckets),
      })
    )
    .digest("hex");
}

function parseState(payload: string): AdminCredentialRateLimitState {
  let parsed: Partial<PersistedAdminCredentialRateLimitState>;

  try {
    parsed = JSON.parse(
      payload
    ) as Partial<PersistedAdminCredentialRateLimitState>;
  } catch {
    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit state is not valid JSON."
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
    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit state shape is invalid."
    );
  }

  if (parsed.version !== STATE_VERSION) {
    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit state version is invalid."
    );
  }

  if (!parsed.buckets || typeof parsed.buckets !== "object") {
    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit buckets are invalid."
    );
  }

  for (const [key, value] of Object.entries(parsed.buckets)) {
    if (!isBucketKey(key) || !isBucket(value)) {
      throw new AdminCredentialRateLimitStateError(
        "Admin credential rate limit bucket entry is invalid."
      );
    }

    buckets[key] = {
      count: Math.trunc(value.count),
      resetAt: Math.trunc(value.resetAt),
    };
  }

  const state: AdminCredentialRateLimitState = {
    version: STATE_VERSION,
    buckets,
  };

  if (parsed.mac !== createStateMac(state)) {
    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit state MAC is invalid."
    );
  }

  return state;
}

function pruneExpiredBuckets(
  state: AdminCredentialRateLimitState,
  now = nowMs()
) {
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
    if (error instanceof AdminCredentialRateLimitStateError) {
      throw error;
    }

    throw new AdminCredentialRateLimitStateError(
      "Admin credential rate limit state could not be read."
    );
  }
}

function writeFileState(state: AdminCredentialRateLimitState) {
  const filePath = getStateFilePath();
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const persisted: PersistedAdminCredentialRateLimitState = {
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
        throw new Error(
          "Timed out acquiring admin credential rate limit lock."
        );
      }

      waitSync(LOCK_RETRY_MS);
    }
  }
}

function getActiveBucket(
  state: AdminCredentialRateLimitState,
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
  state: AdminCredentialRateLimitState,
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

function hashBucketKey(scope: string, values: string[]) {
  const digest = createHmac("sha256", getHashSecret())
    .update(scope)
    .update("\0")
    .update(values.join("\0"))
    .digest("hex");

  return `${scope}:${digest}`;
}

function actorTargetKey(input: AdminCredentialMutationRateLimitInput) {
  return hashBucketKey("admin-credential-actor-target", [
    input.actorUserId,
    input.targetUserId,
    input.purpose,
    input.mutation,
  ]);
}

function actorKey(input: AdminCredentialMutationRateLimitInput) {
  return hashBucketKey("admin-credential-actor", [
    input.actorUserId,
    input.purpose,
    input.mutation,
  ]);
}

function actorIpKey(input: AdminCredentialMutationRateLimitInput) {
  return hashBucketKey("admin-credential-actor-ip", [
    input.actorUserId,
    input.purpose,
    input.mutation,
    normalizeIp(input.ipAddress),
  ]);
}

function targetKey(input: AdminCredentialMutationRateLimitInput) {
  return hashBucketKey("admin-credential-target", [
    input.targetUserId,
    input.purpose,
    input.mutation,
  ]);
}

function corruptStateKey() {
  return hashBucketKey("admin-credential-state-corrupt", ["global"]);
}

function toRetryAfterSeconds(...buckets: Array<Bucket | null>) {
  const now = nowMs();
  const resetAt = Math.max(...buckets.map((bucket) => bucket?.resetAt ?? now));

  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function corruptStateDecision(): AdminCredentialMutationRateLimitDecision {
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

export function consumeAdminCredentialMutationRateLimit(
  input: AdminCredentialMutationRateLimitInput
): AdminCredentialMutationRateLimitDecision {
  const now = nowMs();

  assertAdminCredentialRateLimitReady();

  if (getStoreMode() === "memory") {
    return consumeAdminCredentialMutationState(
      pruneExpiredBuckets(memoryState, now),
      input,
      now
    );
  }

  const releaseLock = acquireFileLock();

  try {
    const state = loadFileState(now);
    const decision = consumeAdminCredentialMutationState(state, input, now);

    if (decision.allowed) {
      writeFileState(pruneExpiredBuckets(state, now));
    }

    return decision;
  } catch (error) {
    if (error instanceof AdminCredentialRateLimitStateError) {
      writeCorruptState(now);

      return corruptStateDecision();
    }

    throw error;
  } finally {
    releaseLock();
  }
}

function consumeAdminCredentialMutationState(
  state: AdminCredentialRateLimitState,
  input: AdminCredentialMutationRateLimitInput,
  now: number
): AdminCredentialMutationRateLimitDecision {
  const corruptBucket = getActiveBucket(state, corruptStateKey(), now);

  if (corruptBucket) {
    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(corruptBucket),
    };
  }

  const actorTargetBucket = getActiveBucket(state, actorTargetKey(input), now);
  const actorBucket = getActiveBucket(state, actorKey(input), now);
  const actorIpBucket = getActiveBucket(state, actorIpKey(input), now);
  const targetBucket = getActiveBucket(state, targetKey(input), now);

  if (
    (actorTargetBucket && actorTargetBucket.count >= ACTOR_TARGET_LIMIT) ||
    (actorBucket && actorBucket.count >= ACTOR_LIMIT) ||
    (actorIpBucket && actorIpBucket.count >= ACTOR_IP_LIMIT) ||
    (targetBucket && targetBucket.count >= TARGET_LIMIT)
  ) {
    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(
        actorTargetBucket,
        actorBucket,
        actorIpBucket,
        targetBucket
      ),
    };
  }

  getOrCreateBucket(state, actorTargetKey(input), now).count += 1;
  getOrCreateBucket(state, actorKey(input), now).count += 1;
  getOrCreateBucket(state, actorIpKey(input), now).count += 1;
  getOrCreateBucket(state, targetKey(input), now).count += 1;

  return { allowed: true };
}

export function resetAdminCredentialMutationRateLimitForTest() {
  for (const key of Object.keys(memoryState.buckets)) {
    delete memoryState.buckets[key];
  }

  if (getStoreMode() === "file") {
    rmSync(getStateFilePath(), { force: true });
    rmSync(getLockDirPath(), { force: true, recursive: true });
  }
}
