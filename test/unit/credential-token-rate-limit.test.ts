import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { afterEach, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkCredentialTokenRateLimit,
  recordFailedCredentialTokenAttempt,
  releaseCredentialTokenRateLimitReservation,
  resetCredentialTokenRateLimitForTest,
} from "../../apps/api/src/auth/credential-token-rate-limit.ts";

const WINDOW_MS = 15 * 60 * 1000;
const PENDING_WINDOW_MS = 10 * 1000;
const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const tempRoot = path.resolve(
  workspaceRoot,
  ".tmp/credential-token-rate-limit-unit",
  String(process.pid)
);
const originalEnv = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PASSWORD_TOKEN_SECRET: process.env.PASSWORD_TOKEN_SECRET,
  PSMS_CREDENTIAL_RATE_LIMIT_FILE: process.env.PSMS_CREDENTIAL_RATE_LIMIT_FILE,
  PSMS_CREDENTIAL_RATE_LIMIT_SECRET:
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET,
  PSMS_CREDENTIAL_RATE_LIMIT_STORE:
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_STORE,
};

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function restoreEnv() {
  setEnv("AUTH_SECRET", originalEnv.AUTH_SECRET);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
  setEnv("PASSWORD_TOKEN_SECRET", originalEnv.PASSWORD_TOKEN_SECRET);
  setEnv(
    "PSMS_CREDENTIAL_RATE_LIMIT_FILE",
    originalEnv.PSMS_CREDENTIAL_RATE_LIMIT_FILE
  );
  setEnv(
    "PSMS_CREDENTIAL_RATE_LIMIT_SECRET",
    originalEnv.PSMS_CREDENTIAL_RATE_LIMIT_SECRET
  );
  setEnv(
    "PSMS_CREDENTIAL_RATE_LIMIT_STORE",
    originalEnv.PSMS_CREDENTIAL_RATE_LIMIT_STORE
  );
}

function configureFileStore(name: string) {
  const testDir = path.resolve(tempRoot, name);
  const stateFile = path.resolve(testDir, "credential-token-rate-limit.json");

  rmSync(testDir, { force: true, recursive: true });
  mkdirSync(testDir, { recursive: true });
  process.env.AUTH_SECRET = "local-credential-rate-limit-unit-secret";
  process.env.NODE_ENV = "test";
  process.env.PSMS_CREDENTIAL_RATE_LIMIT_STORE = "file";
  process.env.PSMS_CREDENTIAL_RATE_LIMIT_FILE = stateFile;

  resetCredentialTokenRateLimitForTest();

  return stateFile;
}

function readState(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as {
    version: number;
    buckets: Record<string, { count: number; resetAt: number }>;
    mac?: string;
  };
}

function createStateMacForTest(
  buckets: Record<string, { count: number; resetAt: number }>
) {
  const canonicalBuckets = Object.fromEntries(
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

  return createHmac(
    "sha256",
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET?.trim() ||
      process.env.PASSWORD_TOKEN_SECRET?.trim() ||
      process.env.AUTH_SECRET?.trim() ||
      "psms-credential-rate-limit-dev-secret"
  )
    .update(
      JSON.stringify({
        version: 1,
        buckets: canonicalBuckets,
      })
    )
    .digest("hex");
}

function assertSignedCorruptState(
  filePath: string,
  forbiddenStrings: string[],
  forbiddenBucketKeys: string[] = []
) {
  const payload = readFileSync(filePath, "utf8");
  const state = readState(filePath);

  assert.equal(state.version, 1);
  assert.equal(typeof state.mac, "string");
  assert.equal(Object.keys(state.buckets).length, 1);

  for (const forbidden of forbiddenStrings) {
    assert.equal(payload.includes(forbidden), false);
  }

  for (const key of forbiddenBucketKeys) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(state.buckets, key),
      false
    );
  }
}

afterEach(() => {
  resetCredentialTokenRateLimitForTest();
  mock.reset();
  restoreEnv();
});

describe("credential token rate limit", () => {
  it("persists token/IP and IP buckets without raw identifiers", () => {
    const stateFile = configureFileStore("persisted-buckets");
    const rawToken = "raw-public-credential-token";
    const ipAddress = "198.51.100.120";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.deepEqual(checkCredentialTokenRateLimit(rawToken, ipAddress), {
        allowed: true,
      });
      recordFailedCredentialTokenAttempt(rawToken, ipAddress);
    }

    const decision = checkCredentialTokenRateLimit(rawToken, ipAddress);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.ok(decision.retryAfterSeconds > 0);
      assert.ok(decision.retryAfterSeconds <= WINDOW_MS / 1000);
    }

    const payload = readFileSync(stateFile, "utf8");
    const state = readState(stateFile);

    assert.equal(state.version, 1);
    assert.equal(Object.keys(state.buckets).length, 2);
    assert.equal(typeof state.mac, "string");
    assert.equal(payload.includes(rawToken), false);
    assert.equal(payload.includes(ipAddress), false);
  });

  it("reserves allowed checks before failed records are written", () => {
    const stateFile = configureFileStore("pending-reservations");
    const rawToken = "pending-public-credential-token";
    const ipAddress = "198.51.100.121";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.deepEqual(checkCredentialTokenRateLimit(rawToken, ipAddress), {
        allowed: true,
      });
    }

    const decision = checkCredentialTokenRateLimit(rawToken, ipAddress);
    const state = readState(stateFile);

    assert.equal(decision.allowed, false);
    assert.equal(Object.keys(state.buckets).length, 2);
    assert.equal(
      Object.values(state.buckets).reduce(
        (total, bucket) => total + bucket.count,
        0
      ),
      20
    );
  });

  it("releases pending reservations after successful checks", () => {
    const stateFile = configureFileStore("release-pending-reservations");
    const rawToken = "released-public-credential-token";
    const ipAddress = "198.51.100.124";

    assert.deepEqual(checkCredentialTokenRateLimit(rawToken, ipAddress), {
      allowed: true,
    });
    releaseCredentialTokenRateLimitReservation(rawToken, ipAddress);

    const state = readState(stateFile);

    assert.equal(Object.keys(state.buckets).length, 0);
  });

  it("expires pending reservations without converting them into failures", () => {
    configureFileStore("pending-window-reset");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.deepEqual(
        checkCredentialTokenRateLimit(
          "pending-expired-token",
          "198.51.100.122"
        ),
        { allowed: true }
      );
    }

    assert.equal(
      checkCredentialTokenRateLimit("pending-expired-token", "198.51.100.122")
        .allowed,
      false
    );

    currentTime += PENDING_WINDOW_MS + 1;

    assert.deepEqual(
      checkCredentialTokenRateLimit("pending-expired-token", "198.51.100.122"),
      { allowed: true }
    );
  });

  it("keeps the failure window after pending reservations become failures", () => {
    configureFileStore("pending-to-failure-window");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.deepEqual(
        checkCredentialTokenRateLimit("pending-failed-token", "198.51.100.123"),
        { allowed: true }
      );
      recordFailedCredentialTokenAttempt(
        "pending-failed-token",
        "198.51.100.123"
      );
    }

    currentTime += PENDING_WINDOW_MS + 1;

    assert.equal(
      checkCredentialTokenRateLimit("pending-failed-token", "198.51.100.123")
        .allowed,
      false
    );

    currentTime += WINDOW_MS + 1;

    assert.deepEqual(
      checkCredentialTokenRateLimit("pending-failed-token", "198.51.100.123"),
      { allowed: true }
    );
  });

  it("does not let spoofed IP rotation bypass token+socket scope", () => {
    configureFileStore("ip-rotation");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      recordFailedCredentialTokenAttempt("rotated-public-token", "127.0.0.1");
    }

    assert.equal(
      checkCredentialTokenRateLimit("rotated-public-token", "127.0.0.1")
        .allowed,
      false
    );
  });

  it("fails closed and quarantines malformed JSON state", () => {
    const stateFile = configureFileStore("malformed-state");

    writeFileSync(stateFile, "{", "utf8");
    const decision = checkCredentialTokenRateLimit(
      "malformed-token",
      "198.51.100.130"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["malformed-token", "198.51.100.130"]);
    assert.equal(
      checkCredentialTokenRateLimit("another-token", "198.51.100.130").allowed,
      false
    );
  });

  it("fails closed and quarantines invalid state shape", () => {
    const stateFile = configureFileStore("invalid-shape-state");
    const staleBucketKey = "credential-token-ip:stale";

    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          version: 2,
          buckets: {
            [staleBucketKey]: {
              count: 99,
              resetAt: Date.now() + WINDOW_MS,
            },
          },
          mac: "stale",
        },
        null,
        2
      ),
      "utf8"
    );

    const decision = checkCredentialTokenRateLimit(
      "invalid-shape-token",
      "198.51.100.131"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      ["invalid-shape-token", "198.51.100.131"],
      [staleBucketKey]
    );
  });

  it("fails closed and quarantines state with a bad MAC", () => {
    const stateFile = configureFileStore("tampered-state");
    const tamperedBucketKey = "credential-token-ip:tampered";

    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          version: 1,
          buckets: {
            [tamperedBucketKey]: {
              count: 99,
              resetAt: Date.now() + WINDOW_MS,
            },
          },
          mac: "tampered",
        },
        null,
        2
      ),
      "utf8"
    );

    const decision = checkCredentialTokenRateLimit(
      "tampered-token",
      "198.51.100.132"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      ["tampered-token", "198.51.100.132"],
      [tamperedBucketKey]
    );
  });

  it("fails closed when signed state contains an unexpected bucket entry", () => {
    const stateFile = configureFileStore("unexpected-bucket-entry");
    const injectedBucketKey = "raw-injected-token-198.51.100.133";

    assert.deepEqual(
      checkCredentialTokenRateLimit("baseline-token", "198.51.100.133"),
      { allowed: true }
    );

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, { count: number; resetAt: number }>;
      mac?: string;
    };

    signedState.buckets[injectedBucketKey] = {
      count: 1,
      resetAt: Date.now() + WINDOW_MS,
    };
    signedState.mac = createStateMacForTest(signedState.buckets);
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkCredentialTokenRateLimit(
      "raw-injected-token",
      "198.51.100.133"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      ["raw-injected-token", "198.51.100.133"],
      [injectedBucketKey]
    );
  });

  it("fails closed when a signed state contains unexpected top-level raw fields", () => {
    const stateFile = configureFileStore("unexpected-top-level-fields");

    assert.deepEqual(
      checkCredentialTokenRateLimit("baseline-token", "198.51.100.135"),
      { allowed: true }
    );

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, { count: number; resetAt: number }>;
      mac?: string;
      rawToken?: string;
      ipAddress?: string;
    };

    signedState.rawToken = "raw-top-level-token";
    signedState.ipAddress = "198.51.100.135";
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkCredentialTokenRateLimit(
      "raw-top-level-token",
      "198.51.100.135"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      "raw-top-level-token",
      "198.51.100.135",
    ]);
  });

  it("fails closed when a signed bucket contains unexpected raw fields", () => {
    const stateFile = configureFileStore("unexpected-bucket-fields");

    assert.deepEqual(
      checkCredentialTokenRateLimit("baseline-token", "198.51.100.134"),
      { allowed: true }
    );

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, Record<string, unknown>>;
      mac?: string;
    };
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);

    signedState.buckets[bucketKey].rawToken = "raw-extra-token";
    signedState.buckets[bucketKey].ipAddress = "198.51.100.134";
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkCredentialTokenRateLimit(
      "raw-extra-token",
      "198.51.100.134"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["raw-extra-token", "198.51.100.134"]);
  });

  it("resets expired windows without sleeping", () => {
    configureFileStore("window-reset");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      recordFailedCredentialTokenAttempt("expired-token", "198.51.100.140");
    }

    assert.equal(
      checkCredentialTokenRateLimit("expired-token", "198.51.100.140").allowed,
      false
    );

    currentTime += WINDOW_MS + 1;

    assert.deepEqual(
      checkCredentialTokenRateLimit("expired-token", "198.51.100.140"),
      { allowed: true }
    );
  });

  it("blocks production when the memory store is explicitly selected", () => {
    process.env.NODE_ENV = "production";
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_STORE = "memory";

    assert.throws(
      () => checkCredentialTokenRateLimit("prod-token", "198.51.100.150"),
      /Persistent credential token rate limit storage is required/
    );
  });

  it("blocks production when the file path is not explicit", () => {
    process.env.AUTH_SECRET = "local-credential-rate-limit-unit-secret";
    process.env.NODE_ENV = "production";
    delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_FILE;
    delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_STORE;

    assert.throws(
      () => checkCredentialTokenRateLimit("prod-token", "198.51.100.151"),
      /Explicit PSMS_CREDENTIAL_RATE_LIMIT_FILE/
    );
  });

  it("blocks production when a hash secret is not configured", () => {
    configureFileStore("production-secret-required");

    delete process.env.AUTH_SECRET;
    delete process.env.PASSWORD_TOKEN_SECRET;
    delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET;
    process.env.NODE_ENV = "production";

    assert.throws(
      () => checkCredentialTokenRateLimit("prod-token", "198.51.100.152"),
      /PASSWORD_TOKEN_SECRET, AUTH_SECRET, or PSMS_CREDENTIAL_RATE_LIMIT_SECRET/
    );
  });

  it("blocks production when the hash secret is a placeholder or too short", () => {
    const cases = [
      ["AUTH_SECRET", "replace-with-auth-secret-value-32-bytes"],
      ["PASSWORD_TOKEN_SECRET", "replace-with-password-token-secret-32-bytes"],
      [
        "PSMS_CREDENTIAL_RATE_LIMIT_SECRET",
        "replace-with-credential-rate-limit-secret",
      ],
      ["PSMS_CREDENTIAL_RATE_LIMIT_SECRET", "short-secret"],
    ] as const;

    for (const [name, value] of cases) {
      configureFileStore(`production-weak-secret-${name}`);

      delete process.env.AUTH_SECRET;
      delete process.env.PASSWORD_TOKEN_SECRET;
      delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET;
      process.env.NODE_ENV = "production";
      process.env[name] = value;

      assert.throws(
        () => checkCredentialTokenRateLimit("prod-token", "198.51.100.154"),
        /non-placeholder production secret of at least 32 characters/
      );
    }
  });

  it("uses a configured file store in production-like configuration", () => {
    const stateFile = configureFileStore("production-file");

    delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_STORE;
    process.env.NODE_ENV = "production";

    recordFailedCredentialTokenAttempt("prod-token", "198.51.100.153");

    assert.equal(existsSync(stateFile), true);
    assert.deepEqual(
      checkCredentialTokenRateLimit("prod-token", "198.51.100.153"),
      { allowed: true }
    );
  });
});
