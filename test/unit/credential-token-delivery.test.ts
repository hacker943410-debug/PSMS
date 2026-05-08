import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  deliverCredentialToken,
  getCredentialDeliveryConfig,
} from "../../apps/api/src/services/credential-token-delivery.service";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function resetEnv() {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
}

function setBaseDeliveryEnv(
  overrides: Record<string, string | undefined> = {}
) {
  process.env.NODE_ENV = "test";
  process.env.PSMS_CREDENTIAL_DELIVERY_MODE = "OUT_OF_BAND_APPROVED";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL =
    "http://127.0.0.1:1/deliver";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET =
    "test-delivery-webhook-secret-32-bytes";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS = "1000";
  process.env.PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS = "1";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

function deliveryRequest() {
  return {
    deliveryId: "delivery-token-id-1",
    mode: "OUT_OF_BAND_APPROVED" as const,
    rawToken: "abcdefghijklmnopqrstuvwxyzABCDEF0123456789_-",
    purpose: "STAFF_ACTIVATION" as const,
    user: {
      id: "user-1",
      loginId: "staff1001",
      name: "Staff One",
      role: "STAFF" as const,
      storeId: "store-1",
    },
    expiresAt: new Date("2026-05-08T00:30:00.000Z"),
  };
}

describe("credential token delivery runtime contract", () => {
  afterEach(resetEnv);

  it("fails closed in production without a strong distinct webhook secret", async () => {
    setBaseDeliveryEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "auth-production-secret-value-32-bytes",
      PASSWORD_TOKEN_SECRET: "password-token-secret-value-32-bytes",
      CREDENTIAL_COMPLETION_SECRET: "completion-secret-value-32-bytes",
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
        "https://credential-delivery.psms.co.kr/psms",
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET: undefined,
    });

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(null, { status: 204 });
    };

    assert.equal(getCredentialDeliveryConfig().ok, false);

    const result = await deliverCredentialToken(deliveryRequest());

    assert.equal(result.ok, false);
    assert.equal(result.attemptCount, 0);
    assert.equal(fetchCalled, false);
  });

  it("fails closed in production when retry attempts are enabled", async () => {
    setBaseDeliveryEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "auth-production-secret-value-32-bytes",
      PASSWORD_TOKEN_SECRET: "password-token-secret-value-32-bytes",
      CREDENTIAL_COMPLETION_SECRET: "completion-secret-value-32-bytes",
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL:
        "https://credential-delivery.psms.co.kr/psms",
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET:
        "webhook-production-secret-value-32-bytes",
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS: "2",
    });

    assert.equal(getCredentialDeliveryConfig().ok, false);
  });

  it("retries transient webhook errors in non-production without changing the raw token", async () => {
    setBaseDeliveryEnv({
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS: "2",
    });

    const tokens: string[] = [];
    const deliveryIds: string[] = [];
    const deliveryAttempts: string[] = [];
    const statuses = [500, 204];
    globalThis.fetch = async (_url, init) => {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body)) as { token: string };

      deliveryIds.push(headers.get("x-psms-delivery-id") ?? "");
      deliveryAttempts.push(headers.get("x-psms-delivery-attempt") ?? "");
      tokens.push(body.token);

      return new Response(null, { status: statuses.shift() ?? 500 });
    };

    const result = await deliverCredentialToken(deliveryRequest());

    assert.equal(result.ok, true);
    assert.equal(result.attemptCount, 2);
    assert.equal(result.finalStatusCode, 204);
    assert.deepEqual(tokens, [
      deliveryRequest().rawToken,
      deliveryRequest().rawToken,
    ]);
    assert.deepEqual(deliveryIds, [
      deliveryRequest().deliveryId,
      deliveryRequest().deliveryId,
    ]);
    assert.deepEqual(deliveryAttempts, ["1", "2"]);
    assert.equal(
      JSON.stringify({ deliveryAttempts, deliveryIds }).includes(
        deliveryRequest().rawToken
      ),
      false
    );
  });

  it("returns bounded non-secret failure metadata after retry exhaustion", async () => {
    setBaseDeliveryEnv({
      PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS: "2",
    });

    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;

      return new Response(null, { status: 500 });
    };

    const result = await deliverCredentialToken(deliveryRequest());

    assert.equal(result.ok, false);
    assert.equal(result.attemptCount, 2);
    assert.equal(result.failureCode, "WEBHOOK_HTTP_ERROR");
    assert.equal(result.finalStatusCode, 500);
    assert.equal(requestCount, 2);
    assert.equal(
      JSON.stringify(result).includes(deliveryRequest().rawToken),
      false
    );
  });
});

describe("admin credential transaction conflict classifier", () => {
  afterEach(resetEnv);

  it("treats unique conflicts and transaction conflicts as credential issue conflicts", async () => {
    process.env.DATABASE_URL = "file:./dev.db";

    const { Prisma } = await import("../../packages/db/src/index");
    const {
      credentialTokenConflictRollbackCode,
      isCredentialTokenPrismaConflictError,
    } =
      await import("../../apps/api/src/services/admin/staff-credentials.service");
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
      }
    );
    const transactionConflict = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock.",
      {
        code: "P2034",
        clientVersion: "test",
      }
    );
    const missingRecord = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      {
        code: "P2025",
        clientVersion: "test",
      }
    );

    assert.equal(isCredentialTokenPrismaConflictError(uniqueConflict), true);
    assert.equal(
      isCredentialTokenPrismaConflictError(transactionConflict),
      true
    );
    assert.equal(isCredentialTokenPrismaConflictError(missingRecord), false);
    assert.equal(
      isCredentialTokenPrismaConflictError(new Error("plain failure")),
      false
    );
    assert.equal(
      credentialTokenConflictRollbackCode(uniqueConflict),
      "ACTIVE_KEY_CONFLICT_AFTER_DELIVERY"
    );
    assert.equal(
      credentialTokenConflictRollbackCode(transactionConflict),
      "TRANSACTION_CONFLICT_AFTER_DELIVERY"
    );
  });
});
