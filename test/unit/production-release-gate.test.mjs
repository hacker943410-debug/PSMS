import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseEnvFileText,
  validateProductionReleaseGate,
} from "../../scripts/production-release-gate.mjs";

function strongSecret(label) {
  return `${label}-release-secret-value-32-bytes-minimum`;
}

function validEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    AUTH_SECRET: strongSecret("auth"),
    PASSWORD_TOKEN_SECRET: strongSecret("password-token"),
    CREDENTIAL_COMPLETION_SECRET: strongSecret("completion"),
    WEB_HOST: "127.0.0.1",
    API_HOST: "127.0.0.1",
    WEB_PORT: "5273",
    API_PORT: "4273",
    APP_URL: "http://127.0.0.1:5273",
    PSMS_API_URL: "http://127.0.0.1:4273",
    PSMS_DEV_AUTH_BYPASS: "false",
    PSMS_LOGIN_RATE_LIMIT_STORE: "file",
    PSMS_LOGIN_RATE_LIMIT_FILE: "C:/ProgramData/PSMS/login-rate-limit.json",
    PSMS_CREDENTIAL_RATE_LIMIT_STORE: "file",
    PSMS_CREDENTIAL_RATE_LIMIT_FILE:
      "C:/ProgramData/PSMS/credential-rate-limit.json",
    PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE: "file",
    PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE:
      "C:/ProgramData/PSMS/admin-credential-rate-limit.json",
    ...overrides,
  };
}

function failedCheckIds(report) {
  return report.failed.map((check) => check.id);
}

describe("production release gate", () => {
  it("accepts a strict local production release environment", () => {
    const report = validateProductionReleaseGate(validEnv());

    assert.equal(report.ok, true);
    assert.equal(report.stage, "prod-env");
    assert.equal(report.failures.length, 0);
    assert.equal(report.checked.logArtifacts, "pnpm release:gate:logs");
    assert.equal(report.failed.length, 0);
    assert.ok(report.manualChecks.length >= 3);
    assert.ok(
      report.manualChecks.some((check) =>
        check.includes("credential-cleanup-release-evidence-template.md")
      )
    );
    assert.ok(
      report.manualChecks.some((check) =>
        check.includes("compensation failure cleanup runbook")
      )
    );
    assert.ok(
      report.manualChecks.some((check) =>
        check.includes("pnpm pg:profile:preflight")
      )
    );
    assert.ok(
      report.manualChecks.some((check) =>
        check.includes("pnpm pg:profile:require-readiness")
      )
    );
    assert.ok(
      report.manualChecks.some((check) =>
        check.includes("PostgreSQL credential cleanup rehearsal profile")
      )
    );
  });

  it("rejects missing, placeholder, short, and reused secrets", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        AUTH_SECRET: "replace-with-local-secret",
        PASSWORD_TOKEN_SECRET: "short",
        CREDENTIAL_COMPLETION_SECRET: "short",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(
      failedCheckIds(report).filter((id) => id.startsWith("secret.")),
      [
        "secret.AUTH_SECRET",
        "secret.PASSWORD_TOKEN_SECRET",
        "secret.CREDENTIAL_COMPLETION_SECRET",
        "secret.distinct",
      ]
    );
  });

  it("rejects unsafe runtime, host, ports, and local URLs", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        NODE_ENV: "development",
        WEB_HOST: "0.0.0.0",
        API_HOST: "localhost",
        WEB_PORT: "5173",
        API_PORT: "4173",
        APP_URL: "http://127.0.0.1:5173",
        PSMS_API_URL: "http://127.0.0.1:4173",
        PSMS_DEV_AUTH_BYPASS: "true",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "runtime.node-env",
      "auth.dev-bypass",
      "host.web",
      "host.api",
      "port.web",
      "port.api",
      "url.app",
      "url.api",
    ]);
    assert.ok(
      report.failures.some(
        (failure) =>
          failure.code === "RUNTIME_NODE_ENV" && failure.field === "NODE_ENV"
      )
    );
  });

  it("requires exact local application and API URLs", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        APP_URL: "http://127.0.0.1:5273/workspace?debug=true#top",
        PSMS_API_URL: "http://user:pass@127.0.0.1:4273/api",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), ["url.app", "url.api"]);
  });

  it("requires file-backed production-safe rate-limit paths", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        PSMS_LOGIN_RATE_LIMIT_STORE: "memory",
        PSMS_LOGIN_RATE_LIMIT_FILE: ".tmp/login-rate-limit.json",
        PSMS_CREDENTIAL_RATE_LIMIT_STORE: "",
        PSMS_CREDENTIAL_RATE_LIMIT_FILE:
          "C:/Projects/Active/PSMS/test-results/credential-rate-limit.json",
        PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE: "memory",
        PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE:
          "C:/Projects/Active/PSMS/admin-rate-limit.json",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "rate-limit.store.PSMS_LOGIN_RATE_LIMIT_STORE",
      "rate-limit.file.PSMS_LOGIN_RATE_LIMIT_FILE",
      "rate-limit.store.PSMS_CREDENTIAL_RATE_LIMIT_STORE",
      "rate-limit.file.PSMS_CREDENTIAL_RATE_LIMIT_FILE",
      "rate-limit.store.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE",
      "rate-limit.file.PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE",
    ]);
  });

  it("requires secure delivery webhook configuration when delivery is enabled", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL: "http://127.0.0.1:9000/hook",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: "replace-with-secret",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "delivery.webhook-url",
      "delivery.webhook-secret",
    ]);
  });

  it("accepts secure delivery only with a distinct webhook secret", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://credential-delivery.psms.co.kr/psms",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: strongSecret("webhook"),
      })
    );

    assert.equal(report.ok, true);
  });

  it("rejects webhook secrets that reuse another production secret", () => {
    const authSecret = strongSecret("auth");
    const report = validateProductionReleaseGate(
      validEnv({
        AUTH_SECRET: authSecret,
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://credential-delivery.psms.co.kr/psms",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: authSecret,
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "delivery.webhook-secret-distinct",
    ]);
  });

  it("rejects unsafe webhook URL forms and hosts", () => {
    const withCredentials = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://user:pass@credential-delivery.psms.co.kr/psms?debug=true#top",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: strongSecret("webhook"),
      })
    );
    const localHost = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://127.0.0.1/credential-delivery",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: strongSecret("webhook"),
      })
    );
    const exampleLocalHost = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://credential-delivery.example.local/psms",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: strongSecret("webhook"),
      })
    );

    assert.equal(withCredentials.ok, false);
    assert.equal(localHost.ok, false);
    assert.equal(exampleLocalHost.ok, false);
    assert.deepEqual(failedCheckIds(withCredentials), ["delivery.webhook-url"]);
    assert.deepEqual(failedCheckIds(localHost), ["delivery.webhook-url"]);
    assert.deepEqual(failedCheckIds(exampleLocalHost), [
      "delivery.webhook-url",
    ]);
  });

  it("rejects delivery retry and timeout values outside the production contract", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
          "https://credential-delivery.psms.co.kr/psms",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: strongSecret("webhook"),
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS: "15000",
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS: "2",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "delivery.webhook-timeout-ms",
      "delivery.webhook-max-attempts",
    ]);
  });

  it("treats retry-only delivery settings as partial delivery configuration", () => {
    const report = validateProductionReleaseGate(
      validEnv({
        PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS: "2",
      })
    );

    assert.equal(report.ok, false);
    assert.deepEqual(failedCheckIds(report), [
      "delivery.mode",
      "delivery.webhook-url",
      "delivery.webhook-secret",
      "delivery.webhook-secret-distinct",
      "delivery.webhook-max-attempts",
    ]);
  });

  it("parses simple dotenv files without loading commented example values", () => {
    assert.deepEqual(
      parseEnvFileText(`
        # AUTH_SECRET="ignore-me"
        AUTH_SECRET="auth-release-secret-value-32-bytes-minimum"
        WEB_PORT=5273
      `),
      {
        AUTH_SECRET: "auth-release-secret-value-32-bytes-minimum",
        WEB_PORT: "5273",
      }
    );
  });
});
