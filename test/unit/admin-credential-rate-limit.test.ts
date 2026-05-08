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
  consumeAdminCredentialMutationRateLimit,
  resetAdminCredentialMutationRateLimitForTest,
} from "../../apps/api/src/auth/admin-credential-rate-limit.ts";

const WINDOW_MS = 15 * 60 * 1000;
const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), "../..");
const tempRoot = path.resolve(
  workspaceRoot,
  ".tmp/admin-credential-rate-limit-unit",
  String(process.pid)
);
const originalEnv = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PASSWORD_TOKEN_SECRET: process.env.PASSWORD_TOKEN_SECRET,
  PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE:
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE,
  PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET:
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET,
  PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE:
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE,
  PSMS_CREDENTIAL_RATE_LIMIT_SECRET:
    process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET,
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
    "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE",
    originalEnv.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE
  );
  setEnv(
    "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET",
    originalEnv.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET
  );
  setEnv(
    "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE",
    originalEnv.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE
  );
  setEnv(
    "PSMS_CREDENTIAL_RATE_LIMIT_SECRET",
    originalEnv.PSMS_CREDENTIAL_RATE_LIMIT_SECRET
  );
}

function configureFileStore(name: string) {
  const testDir = path.resolve(tempRoot, name);
  const stateFile = path.resolve(testDir, "admin-credential-rate-limit.json");

  rmSync(testDir, { force: true, recursive: true });
  mkdirSync(testDir, { recursive: true });
  process.env.AUTH_SECRET = "local-admin-credential-rate-limit-unit-secret";
  process.env.NODE_ENV = "test";
  process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE = "file";
  process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE = stateFile;

  resetAdminCredentialMutationRateLimitForTest();

  return stateFile;
}

function createInput(overrides?: {
  actorUserId?: string;
  targetUserId?: string;
  mutation?: "issue" | "revoke";
  ipAddress?: string | null;
}) {
  return {
    actorUserId: overrides?.actorUserId ?? "admin-user-1",
    targetUserId: overrides?.targetUserId ?? "staff-user-1",
    purpose: "STAFF_ACTIVATION" as const,
    mutation: overrides?.mutation ?? "issue",
    ipAddress: overrides?.ipAddress ?? "198.51.100.80",
  };
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
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET?.trim() ||
      process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET?.trim() ||
      process.env.PASSWORD_TOKEN_SECRET?.trim() ||
      process.env.AUTH_SECRET?.trim() ||
      "psms-admin-credential-rate-limit-dev"
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
  resetAdminCredentialMutationRateLimitForTest();
  mock.reset();
  restoreEnv();
});

describe("admin credential mutation rate limit", () => {
  it("limits repeated actor and target credential mutations without raw identifiers", () => {
    const stateFile = configureFileStore("actor-target-limit");
    const input = createInput();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
        allowed: true,
      });
    }

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.ok(decision.retryAfterSeconds > 0);
      assert.ok(decision.retryAfterSeconds <= WINDOW_MS / 1000);
    }

    const statePayload = readFileSync(stateFile, "utf8");
    const state = readState(stateFile);

    assert.equal(state.version, 1);
    assert.equal(Object.keys(state.buckets).length, 4);
    assert.equal(typeof state.mac, "string");
    assert.equal(statePayload.includes(input.actorUserId), false);
    assert.equal(statePayload.includes(input.targetUserId), false);
    assert.equal(statePayload.includes(input.ipAddress ?? ""), false);
  });

  it("does not let spoofed IP rotation bypass actor-target scope", () => {
    configureFileStore("ip-rotation");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.deepEqual(
        consumeAdminCredentialMutationRateLimit(
          createInput({ ipAddress: `198.51.100.${attempt + 90}` })
        ),
        {
          allowed: true,
        }
      );
    }

    assert.equal(
      consumeAdminCredentialMutationRateLimit(
        createInput({ ipAddress: "203.0.113.90" })
      ).allowed,
      false
    );
  });

  it("keeps issue and revoke mutation buckets independent", () => {
    configureFileStore("issue-revoke");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.deepEqual(consumeAdminCredentialMutationRateLimit(createInput()), {
        allowed: true,
      });
    }

    assert.equal(
      consumeAdminCredentialMutationRateLimit(createInput()).allowed,
      false
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.deepEqual(
        consumeAdminCredentialMutationRateLimit(
          createInput({ mutation: "revoke" })
        ),
        { allowed: true }
      );
    }

    assert.equal(
      consumeAdminCredentialMutationRateLimit(
        createInput({ mutation: "revoke" })
      ).allowed,
      false
    );
  });

  it("fails closed and quarantines malformed JSON state", () => {
    const stateFile = configureFileStore("malformed-state");
    const input = createInput({
      actorUserId: "admin-malformed",
      targetUserId: "staff-malformed",
      ipAddress: "198.51.100.181",
    });

    writeFileSync(stateFile, "{", "utf8");
    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      input.actorUserId,
      input.targetUserId,
      input.ipAddress ?? "",
    ]);
    assert.equal(consumeAdminCredentialMutationRateLimit(input).allowed, false);
  });

  it("fails closed and quarantines invalid state shape", () => {
    const stateFile = configureFileStore("invalid-shape-state");
    const staleBucketKey = "admin-credential-target:stale";
    const input = createInput({
      actorUserId: "admin-shape",
      targetUserId: "staff-shape",
      ipAddress: "198.51.100.182",
    });

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

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      [input.actorUserId, input.targetUserId, input.ipAddress ?? ""],
      [staleBucketKey]
    );
  });

  it("fails closed and quarantines state with a bad MAC", () => {
    const stateFile = configureFileStore("bad-mac-state");
    const input = createInput({
      actorUserId: "admin-bad-mac",
      targetUserId: "staff-bad-mac",
      ipAddress: "198.51.100.183",
    });

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
      allowed: true,
    });

    const signedState = readState(stateFile);
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);
    signedState.buckets[bucketKey].count = 99;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      input.actorUserId,
      input.targetUserId,
      input.ipAddress ?? "",
    ]);
  });

  it("fails closed when signed state contains an unexpected bucket entry", () => {
    const stateFile = configureFileStore("unexpected-bucket-entry");
    const input = createInput({
      actorUserId: "admin-injected-key",
      targetUserId: "staff-injected-key",
      ipAddress: "198.51.100.184",
    });
    const injectedBucketKey = "raw-admin-injected-198.51.100.184";

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
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

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(
      stateFile,
      [input.actorUserId, input.targetUserId, input.ipAddress ?? ""],
      [injectedBucketKey]
    );
  });

  it("fails closed when a signed state contains unexpected top-level raw fields", () => {
    const stateFile = configureFileStore("unexpected-top-level-fields");
    const input = createInput({
      actorUserId: "admin-top-level",
      targetUserId: "staff-top-level",
      ipAddress: "198.51.100.187",
    });

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
      allowed: true,
    });

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, { count: number; resetAt: number }>;
      mac?: string;
      actorUserId?: string;
      targetUserId?: string;
      ipAddress?: string | null;
    };

    signedState.actorUserId = input.actorUserId;
    signedState.targetUserId = input.targetUserId;
    signedState.ipAddress = input.ipAddress;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      input.actorUserId,
      input.targetUserId,
      input.ipAddress ?? "",
    ]);
  });

  it("fails closed when a signed bucket contains unexpected raw fields", () => {
    const stateFile = configureFileStore("unexpected-bucket-fields");
    const input = createInput({
      actorUserId: "admin-extra-field",
      targetUserId: "staff-extra-field",
      ipAddress: "198.51.100.185",
    });

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
      allowed: true,
    });

    const signedState = readState(stateFile) as {
      version: number;
      buckets: Record<string, Record<string, unknown>>;
      mac?: string;
    };
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);

    signedState.buckets[bucketKey].actorUserId = input.actorUserId;
    signedState.buckets[bucketKey].targetUserId = input.targetUserId;
    signedState.buckets[bucketKey].ipAddress = input.ipAddress;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      input.actorUserId,
      input.targetUserId,
      input.ipAddress ?? "",
    ]);
  });

  it("fails closed when a signed bucket contains invalid values", () => {
    const stateFile = configureFileStore("invalid-bucket-values");
    const input = createInput({
      actorUserId: "admin-invalid-value",
      targetUserId: "staff-invalid-value",
      ipAddress: "198.51.100.186",
    });

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(input), {
      allowed: true,
    });

    const signedState = readState(stateFile);
    const bucketKey = Object.keys(signedState.buckets)[0];

    assert.ok(bucketKey);

    signedState.buckets[bucketKey].count = -1;
    writeFileSync(stateFile, JSON.stringify(signedState, null, 2), "utf8");

    const decision = consumeAdminCredentialMutationRateLimit(input);

    assert.equal(decision.allowed, false);

    if (!decision.allowed) {
      assert.equal(decision.retryAfterSeconds, WINDOW_MS / 1000);
    }

    assertSignedCorruptState(stateFile, [
      input.actorUserId,
      input.targetUserId,
      input.ipAddress ?? "",
    ]);
  });

  it("resets expired windows without sleeping", () => {
    configureFileStore("window-reset");

    let currentTime = 1_800_000_000_000;
    mock.method(Date, "now", () => currentTime);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      consumeAdminCredentialMutationRateLimit(createInput());
    }

    assert.equal(
      consumeAdminCredentialMutationRateLimit(createInput()).allowed,
      false
    );

    currentTime += WINDOW_MS + 1;

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(createInput()), {
      allowed: true,
    });
  });

  it("blocks production when the memory store is explicitly selected", () => {
    process.env.NODE_ENV = "production";
    process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE = "memory";

    assert.throws(
      () => consumeAdminCredentialMutationRateLimit(createInput()),
      /Persistent admin credential rate limit storage is required/
    );
  });

  it("blocks production when the file path is not explicit", () => {
    process.env.AUTH_SECRET = "local-admin-credential-rate-limit-unit-secret";
    process.env.NODE_ENV = "production";
    delete process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE;
    delete process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE;

    assert.throws(
      () => consumeAdminCredentialMutationRateLimit(createInput()),
      /Explicit PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE/
    );
  });

  it("blocks production when a hash secret is not configured", () => {
    configureFileStore("production-secret-required");

    delete process.env.AUTH_SECRET;
    delete process.env.PASSWORD_TOKEN_SECRET;
    delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET;
    delete process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET;
    process.env.NODE_ENV = "production";

    assert.throws(
      () => consumeAdminCredentialMutationRateLimit(createInput()),
      /AUTH_SECRET, PASSWORD_TOKEN_SECRET, PSMS_CREDENTIAL_RATE_LIMIT_SECRET, or PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET/
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
      [
        "PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET",
        "replace-with-admin-credential-rate-limit-secret",
      ],
      ["PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET", "short-secret"],
    ] as const;

    for (const [name, value] of cases) {
      configureFileStore(`production-weak-secret-${name}`);

      delete process.env.AUTH_SECRET;
      delete process.env.PASSWORD_TOKEN_SECRET;
      delete process.env.PSMS_CREDENTIAL_RATE_LIMIT_SECRET;
      delete process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_SECRET;
      process.env.NODE_ENV = "production";
      process.env[name] = value;

      assert.throws(
        () => consumeAdminCredentialMutationRateLimit(createInput()),
        /non-placeholder production secret of at least 32 characters/
      );
    }
  });

  it("uses a configured file store in production-like configuration", () => {
    const stateFile = configureFileStore("production-file");

    delete process.env.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE;
    process.env.NODE_ENV = "production";

    assert.deepEqual(consumeAdminCredentialMutationRateLimit(createInput()), {
      allowed: true,
    });
    assert.equal(existsSync(stateFile), true);
  });
});
