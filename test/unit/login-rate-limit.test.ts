import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
  PSMS_LOGIN_RATE_LIMIT_STORE: process.env.PSMS_LOGIN_RATE_LIMIT_STORE,
};

function restoreEnv() {
  setEnv("AUTH_SECRET", originalEnv.AUTH_SECRET);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
  setEnv("PSMS_LOGIN_RATE_LIMIT_FILE", originalEnv.PSMS_LOGIN_RATE_LIMIT_FILE);
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
  };
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
    assert.equal(statePayload.includes("admin1001"), false);
    assert.equal(statePayload.includes("198.51.100.10"), false);
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
    process.env.NODE_ENV = "production";

    assert.throws(
      () => checkLoginRateLimit("admin1001", "198.51.100.46"),
      /AUTH_SECRET or PSMS_LOGIN_RATE_LIMIT_SECRET/
    );
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
