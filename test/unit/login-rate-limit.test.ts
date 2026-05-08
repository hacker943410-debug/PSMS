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
  checkLoginRateLimit,
  clearLoginFailures,
  recordFailedLogin,
  resetLoginRateLimitForTest,
} from "../../apps/api/src/auth/login-rate-limit.ts";

const WINDOW_MS = 15 * 60 * 1000;
const PENDING_WINDOW_MS = 10 * 1000;
const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const tempRoot = path.resolve(
  workspaceRoot,
  ".tmp/login-rate-limit-unit",
  String(process.pid)
);
const originalEnv = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PSMS_LOGIN_RATE_LIMIT_FILE: process.env.PSMS_LOGIN_RATE_LIMIT_FILE,
  PSMS_LOGIN_RATE_LIMIT_SECRET: process.env.PSMS_LOGIN_RATE_LIMIT_SECRET,
  PSMS_LOGIN_RATE_LIMIT_STORE: process.env.PSMS_LOGIN_RATE_LIMIT_STORE,
};

function restoreEnv() {
  setEnv("AUTH_SECRET", originalEnv.AUTH_SECRET);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
  setEnv("PSMS_LOGIN_RATE_LIMIT_FILE", originalEnv.PSMS_LOGIN_RATE_LIMIT_FILE);
  setEnv(
    "PSMS_LOGIN_RATE_LIMIT_SECRET",
    originalEnv.PSMS_LOGIN_RATE_LIMIT_SECRET
  );
  setEnv(
    "PSMS_LOGIN_RATE_LIMIT_STORE",
    originalEnv.PSMS_LOGIN_RATE_LIMIT_STORE
  );
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function configureFileStore(name: string) {
  const testDir = path.resolve(tempRoot, name);
  const stateFile = path.resolve(testDir, "login-rate-limit.json");

  rmSync(testDir, { force: true, recursive: true });
  mkdirSync(testDir, { recursive: true });
  process.env.AUTH_SECRET = "local-login-rate-limit-unit-secret";
  process.env.NODE_ENV = "test";
  process.env.PSMS_LOGIN_RATE_LIMIT_STORE = "file";
  process.env.PSMS_LOGIN_RATE_LIMIT_FILE = stateFile;

  resetLoginRateLimitForTest();

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
    process.env.PSMS_LOGIN_RATE_LIMIT_SECRET?.trim() ||
      process.env.AUTH_SECRET?.trim() ||
      "psms-login-rate-limit-dev-secret"
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
  resetLoginRateLimitForTest();
  mock.reset();
  restoreEnv();
});

describe("login rate limit", () => {
  it("persists loginId and IP buckets without raw identifiers", () => {
    const stateFile = configureFileStore("persisted-buckets");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.deepEqual(checkLoginRateLimit("admin1001", "198.51.100.10"), {
        allowed: true,
      });
      recordFailedLogin("admin1001", "198.51.100.10");
    }

    const decision = checkLoginRateLimit("admin1001", "198.51.100.10");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.ok(decision.retryAfterSeconds > 0);
      assert.ok(decision.retryAfterSeconds <= WINDOW_MS / 1000);
    }

    const statePayload = readFileSync(stateFile, "utf8");
    const state = readState(stateFile);

    assert.equal(state.version, 1);
    assert.equal(Object.keys(state.buckets).length, 2);
    assert.equal(typeof state.mac, "string");
    assert.equal(statePayload.includes("admin1001"), false);
    assert.equal(statePayload.includes("198.51.100.10"), false);
  });

  it("reserves allowed checks before failed records are written", () => {
    const stateFile = configureFileStore("pending-reservations");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.deepEqual(checkLoginRateLimit("pending-user", "198.51.100.11"), {
        allowed: true,
      });
    }

    const decision = checkLoginRateLimit("pending-user", "198.51.100.11");
    const state = readState(stateFile);

    assert.equal(decision.allowed, false);
    assert.equal(Object.keys(state.buckets).length, 2);
    assert.equal(
      Object.values(state.buckets).reduce(
        (total, bucket) => total + bucket.count,
        0
      ),
      10
    );
  });

  it("releases pending reservations after a successful login clear", () => {
    const stateFile = configureFileStore("release-pending-reservation");

    assert.deepEqual(checkLoginRateLimit("released-user", "198.51.100.12"), {
      allowed: true,
    });
    clearLoginFailures("released-user", "198.51.100.12");

    const state = readState(stateFile);

    assert.equal(Object.keys(state.buckets).length, 0);
  });

  it("expires pending reservations without converting them into failures", () => {
    configureFileStore("pending-window-reset");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.deepEqual(
        checkLoginRateLimit("pending-expired", "198.51.100.13"),
        {
          allowed: true,
        }
      );
    }

    assert.equal(
      checkLoginRateLimit("pending-expired", "198.51.100.13").allowed,
      false
    );

    currentTime += PENDING_WINDOW_MS + 1;

    assert.deepEqual(checkLoginRateLimit("pending-expired", "198.51.100.13"), {
      allowed: true,
    });
  });

  it("keeps the failure window after pending reservations become failures", () => {
    configureFileStore("pending-to-failure-window");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.deepEqual(checkLoginRateLimit("pending-failed", "198.51.100.14"), {
        allowed: true,
      });
      recordFailedLogin("pending-failed", "198.51.100.14");
    }

    currentTime += PENDING_WINDOW_MS + 1;

    assert.equal(
      checkLoginRateLimit("pending-failed", "198.51.100.14").allowed,
      false
    );

    currentTime += WINDOW_MS + 1;

    assert.deepEqual(checkLoginRateLimit("pending-failed", "198.51.100.14"), {
      allowed: true,
    });
  });

  it("resets expired windows without sleeping", () => {
    configureFileStore("window-reset");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordFailedLogin("staff1001", "198.51.100.20");
    }

    assert.equal(
      checkLoginRateLimit("staff1001", "198.51.100.20").allowed,
      false
    );

    currentTime += WINDOW_MS + 1;

    assert.deepEqual(checkLoginRateLimit("staff1001", "198.51.100.20"), {
      allowed: true,
    });
  });

  it("clears only the loginId and IP bucket after a successful login", () => {
    const stateFile = configureFileStore("success-clear");

    recordFailedLogin("admin1001", "198.51.100.30");
    clearLoginFailures("admin1001", "198.51.100.30");

    const state = readState(stateFile);

    assert.equal(Object.keys(state.buckets).length, 1);
    assert.deepEqual(checkLoginRateLimit("admin1001", "198.51.100.30"), {
      allowed: true,
    });
  });

  it("fails closed and quarantines malformed JSON state", () => {
    const stateFile = configureFileStore("malformed-state");

    writeFileSync(stateFile, "{", "utf8");
    const decision = checkLoginRateLimit("malformed-user", "198.51.100.60");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["malformed-user", "198.51.100.60"]);
    assert.equal(
      checkLoginRateLimit("another-user", "198.51.100.60").allowed,
      false
    );
  });

  it("fails closed and quarantines non-object persisted state", () => {
    const stateFile = configureFileStore("non-object-state");

    writeFileSync(stateFile, "[]", "utf8");
    const decision = checkLoginRateLimit("array-state-user", "198.51.100.67");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["array-state-user", "198.51.100.67"]);
  });

  it("fails closed and quarantines invalid state shape", () => {
    const stateFile = configureFileStore("invalid-shape-state");
    const staleBucketKey = "login-id-ip:stale";

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

    const decision = checkLoginRateLimit("invalid-shape-user", "198.51.100.61");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      ["invalid-shape-user", "198.51.100.61"],
      [staleBucketKey]
    );
  });

  it("fails closed and quarantines invalid buckets containers", () => {
    const cases = [
      ["array-buckets", []],
      ["null-buckets", null],
    ] as const;

    for (const [name, buckets] of cases) {
      const stateFile = configureFileStore(name);

      writeFileSync(
        stateFile,
        JSON.stringify(
          {
            version: 1,
            buckets,
            mac: createStateMacForTest({}),
          },
          null,
          2
        ),
        "utf8"
      );

      const decision = checkLoginRateLimit(
        `invalid-${name}-user`,
        "198.51.100.68"
      );

      assert.equal(decision.allowed, false);

      if (!decision.allowed) {
        assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
      }

      assertSignedCorruptState(stateFile, [
        `invalid-${name}-user`,
        "198.51.100.68",
      ]);
    }
  });

  it("fails closed and quarantines state with a bad MAC", () => {
    const stateFile = configureFileStore("bad-mac-state");

    assert.deepEqual(checkLoginRateLimit("bad-mac-user", "198.51.100.62"), {
      allowed: true,
    });

    const signedState = readState(stateFile);
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);
    signedState.buckets[bucketKey].count = 99;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkLoginRateLimit("bad-mac-user", "198.51.100.62");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["bad-mac-user", "198.51.100.62"]);
  });

  it("fails closed when signed state contains an unexpected bucket entry", () => {
    const stateFile = configureFileStore("unexpected-bucket-entry");
    const injectedBucketKey = "raw-login-user-198.51.100.63";

    assert.deepEqual(checkLoginRateLimit("baseline-user", "198.51.100.63"), {
      allowed: true,
    });

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

    const decision = checkLoginRateLimit("raw-login-user", "198.51.100.63");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      ["raw-login-user", "198.51.100.63"],
      [injectedBucketKey]
    );
  });

  it("fails closed when a signed state contains unexpected top-level raw fields", () => {
    const stateFile = configureFileStore("unexpected-top-level-fields");

    assert.deepEqual(checkLoginRateLimit("baseline-user", "198.51.100.64"), {
      allowed: true,
    });

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, { count: number; resetAt: number }>;
      mac?: string;
      loginId?: string;
      ipAddress?: string;
    };

    signedState.loginId = "raw-top-level-login";
    signedState.ipAddress = "198.51.100.64";
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkLoginRateLimit(
      "raw-top-level-login",
      "198.51.100.64"
    );

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      "raw-top-level-login",
      "198.51.100.64",
    ]);
  });

  it("fails closed when a signed bucket contains unexpected raw fields", () => {
    const stateFile = configureFileStore("unexpected-bucket-fields");

    assert.deepEqual(checkLoginRateLimit("baseline-user", "198.51.100.65"), {
      allowed: true,
    });

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, Record<string, unknown>>;
      mac?: string;
    };
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);

    signedState.buckets[bucketKey].loginId = "raw-extra-login";
    signedState.buckets[bucketKey].ipAddress = "198.51.100.65";
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkLoginRateLimit("raw-extra-login", "198.51.100.65");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, ["raw-extra-login", "198.51.100.65"]);
  });

  it("fails closed when a signed bucket contains invalid values", () => {
    const stateFile = configureFileStore("invalid-bucket-values");

    assert.deepEqual(
      checkLoginRateLimit("invalid-value-user", "198.51.100.66"),
      {
        allowed: true,
      }
    );

    const signedState = readState(stateFile);
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);

    signedState.buckets[bucketKey].count = -1;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = checkLoginRateLimit("invalid-value-user", "198.51.100.66");

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      "invalid-value-user",
      "198.51.100.66",
    ]);
  });

  it("fails closed when a bucket contains missing or non-integer values", () => {
    const cases = [
      ["missing-count", { resetAt: Date.now() + WINDOW_MS }],
      ["string-count", { count: "1", resetAt: Date.now() + WINDOW_MS }],
      ["fractional-count", { count: 1.5, resetAt: Date.now() + WINDOW_MS }],
      ["missing-reset", { count: 1 }],
      ["fractional-reset", { count: 1, resetAt: Date.now() + 0.5 }],
    ] as const;

    for (const [name, bucket] of cases) {
      const stateFile = configureFileStore(`invalid-bucket-${name}`);

      assert.deepEqual(
        checkLoginRateLimit(`invalid-${name}-user`, "198.51.100.69"),
        { allowed: true }
      );

      const signedState = readState(stateFile) as {
        version: number;
        buckets: Record<string, unknown>;
        mac?: string;
      };
      const bucketKey = Object.keys(signedState.buckets)[0];

      assert.ok(bucketKey);

      signedState.buckets[bucketKey] = bucket;
      writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

      const decision = checkLoginRateLimit(
        `invalid-${name}-user`,
        "198.51.100.69"
      );

      assert.equal(decision.allowed, false);

      if (!decision.allowed) {
        assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
      }

      assertSignedCorruptState(stateFile, [
        `invalid-${name}-user`,
        "198.51.100.69",
      ]);
    }
  });

  it("blocks production when the memory store is explicitly selected", () => {
    process.env.NODE_ENV = "production";
    process.env.PSMS_LOGIN_RATE_LIMIT_STORE = "memory";

    assert.throws(
      () => checkLoginRateLimit("admin1001", "198.51.100.40"),
      /Persistent login rate limit storage is required/
    );
  });

  it("blocks production when the file path is not explicit", () => {
    process.env.AUTH_SECRET = "local-login-rate-limit-unit-secret";
    process.env.NODE_ENV = "production";
    delete process.env.PSMS_LOGIN_RATE_LIMIT_FILE;
    delete process.env.PSMS_LOGIN_RATE_LIMIT_STORE;

    assert.throws(
      () => checkLoginRateLimit("admin1001", "198.51.100.45"),
      /Explicit PSMS_LOGIN_RATE_LIMIT_FILE/
    );
  });

  it("blocks production when a hash secret is not configured", () => {
    configureFileStore("production-secret-required");

    delete process.env.AUTH_SECRET;
    delete process.env.PSMS_LOGIN_RATE_LIMIT_SECRET;
    process.env.NODE_ENV = "production";

    assert.throws(
      () => checkLoginRateLimit("admin1001", "198.51.100.46"),
      /AUTH_SECRET or PSMS_LOGIN_RATE_LIMIT_SECRET/
    );
  });

  it("blocks production when the hash secret is a placeholder or too short", () => {
    const cases = [
      ["AUTH_SECRET", "replace-with-auth-secret-value-32-bytes"],
      ["PSMS_LOGIN_RATE_LIMIT_SECRET", "replace-with-login-rate-limit-secret"],
      ["PSMS_LOGIN_RATE_LIMIT_SECRET", "short-secret"],
    ] as const;

    for (const [name, value] of cases) {
      configureFileStore(`production-weak-secret-${name}`);

      delete process.env.AUTH_SECRET;
      delete process.env.PSMS_LOGIN_RATE_LIMIT_SECRET;
      process.env.NODE_ENV = "production";
      process.env[name] = value;

      assert.throws(
        () => checkLoginRateLimit("admin1001", "198.51.100.47"),
        /non-placeholder production secret of at least 32 characters/
      );
    }
  });

  it("uses a configured file store in production-like configuration", () => {
    const stateFile = configureFileStore("production-file-default");

    delete process.env.PSMS_LOGIN_RATE_LIMIT_STORE;
    process.env.NODE_ENV = "production";

    recordFailedLogin("admin1001", "198.51.100.50");

    assert.equal(existsSync(stateFile), true);
    assert.deepEqual(checkLoginRateLimit("admin1001", "198.51.100.50"), {
      allowed: true,
    });
  });
});
