import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  adminStaffCredentialIssueInputSchema,
  adminStaffCredentialIssueResultSchema,
  adminStaffCredentialRevokeResultSchema,
  assertPasswordTokenSecretConfigured,
  buildCredentialTokenActiveKey,
  CREDENTIAL_PASSWORD_MAX_LENGTH,
  CREDENTIAL_PASSWORD_MIN_LENGTH,
  createCredentialCompleteInputSchema,
  createCredentialTokenExpiresAt,
  credentialCompleteInputSchema,
  credentialCompleteResultSchema,
  credentialTokenPreviewSchema,
  credentialTokenVerifyInputSchema,
  generateCredentialToken,
  getCredentialPasswordPolicyIssues,
  hashCredentialToken,
  isCredentialPasswordPolicyCompliant,
  isCredentialTokenHash,
  PASSWORD_TOKEN_BYTES,
  PASSWORD_TOKEN_HASH_PREFIX,
  PASSWORD_TOKEN_SECRET_ENV,
  PASSWORD_TOKEN_TTL_SECONDS,
  verifyCredentialTokenHash,
} from "../../packages/shared/src/credential-token.ts";
import { toFieldErrors } from "../../packages/shared/src/auth.validation.ts";

const originalPasswordTokenSecret = process.env[PASSWORD_TOKEN_SECRET_ENV];
const originalAuthSecret = process.env.AUTH_SECRET;
const strongSecret = "local-password-token-secret-32-bytes-minimum";

function setPasswordTokenSecret(value: string | undefined) {
  if (value === undefined) {
    delete process.env[PASSWORD_TOKEN_SECRET_ENV];
    return;
  }

  process.env[PASSWORD_TOKEN_SECRET_ENV] = value;
}

afterEach(() => {
  setPasswordTokenSecret(originalPasswordTokenSecret);

  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
    return;
  }

  process.env.AUTH_SECRET = originalAuthSecret;
});

describe("credential token helper", () => {
  it("generates high-entropy base64url tokens and 30 minute expiry", () => {
    const token = generateCredentialToken();
    const secondToken = generateCredentialToken();

    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(token, "base64url").length, PASSWORD_TOKEN_BYTES);
    assert.notEqual(token, secondToken);

    const now = new Date("2026-05-07T00:00:00.000Z");
    assert.equal(
      createCredentialTokenExpiresAt(now).toISOString(),
      new Date(now.getTime() + PASSWORD_TOKEN_TTL_SECONDS * 1000).toISOString()
    );
  });

  it("fails closed without a dedicated strong PASSWORD_TOKEN_SECRET", () => {
    setPasswordTokenSecret(undefined);
    process.env.AUTH_SECRET = "auth-secret-that-must-not-be-used-for-tokens";

    assert.throws(
      () => assertPasswordTokenSecretConfigured(),
      /PASSWORD_TOKEN_SECRET/
    );
    assert.throws(
      () => hashCredentialToken("raw-token", "STAFF_ACTIVATION"),
      /PASSWORD_TOKEN_SECRET/
    );

    setPasswordTokenSecret("replace-with-local-token-secret");
    assert.throws(
      () => assertPasswordTokenSecretConfigured(),
      /PASSWORD_TOKEN_SECRET/
    );

    setPasswordTokenSecret("replace-with-anything");
    assert.throws(
      () => assertPasswordTokenSecretConfigured(),
      /PASSWORD_TOKEN_SECRET/
    );

    setPasswordTokenSecret("short");
    assert.throws(
      () => assertPasswordTokenSecretConfigured(),
      /at least 32 bytes/
    );
  });

  it("hashes tokens by purpose and verifies without exposing raw tokens", () => {
    setPasswordTokenSecret(strongSecret);
    const rawToken = generateCredentialToken();

    const activationHash = hashCredentialToken(rawToken, "STAFF_ACTIVATION");
    const repeatHash = hashCredentialToken(rawToken, "STAFF_ACTIVATION");
    const resetHash = hashCredentialToken(rawToken, "PASSWORD_RESET");

    assert.equal(activationHash, repeatHash);
    assert.notEqual(activationHash, resetHash);
    assert.ok(activationHash.startsWith(`${PASSWORD_TOKEN_HASH_PREFIX}:`));
    assert.equal(isCredentialTokenHash(activationHash), true);
    assert.equal(activationHash.includes(rawToken), false);
    assert.equal(
      verifyCredentialTokenHash(rawToken, "STAFF_ACTIVATION", activationHash),
      true
    );
    assert.equal(
      verifyCredentialTokenHash(rawToken, "PASSWORD_RESET", activationHash),
      false
    );
    assert.equal(
      verifyCredentialTokenHash(
        "wrong-token",
        "STAFF_ACTIVATION",
        activationHash
      ),
      false
    );
    assert.equal(
      verifyCredentialTokenHash(
        rawToken,
        "STAFF_ACTIVATION",
        "not-a-token-hash"
      ),
      false
    );
  });

  it("builds portable active token keys", () => {
    assert.equal(
      buildCredentialTokenActiveKey("user_123", "PASSWORD_RESET"),
      "user_123:PASSWORD_RESET"
    );
    assert.equal(
      buildCredentialTokenActiveKey(" user_123 ", "PASSWORD_RESET"),
      "user_123:PASSWORD_RESET"
    );
    assert.throws(
      () => buildCredentialTokenActiveKey(" ", "PASSWORD_RESET"),
      /userId/
    );
  });
});

describe("credential token validation schemas", () => {
  it("normalizes admin issue input and redacts unknown field names", () => {
    const parsed = adminStaffCredentialIssueInputSchema.parse({
      userId: " user_123 ",
      expectedUpdatedAt: "2026-05-07T00:00:00.000Z",
      reason: "  reset    request  ",
    });

    assert.deepEqual(parsed, {
      userId: "user_123",
      expectedUpdatedAt: "2026-05-07T00:00:00.000Z",
      reason: "reset request",
    });

    const result = adminStaffCredentialIssueInputSchema.safeParse({
      userId: "user_123",
      password: "NeverReflectThis1!",
    });

    assert.equal(result.success, false);

    if (!result.success) {
      assert.deepEqual(toFieldErrors(result.error), {
        form: "허용되지 않는 입력값입니다.",
      });
    }
  });

  it("validates token-holder verify and complete inputs", () => {
    const token = generateCredentialToken();

    assert.deepEqual(credentialTokenVerifyInputSchema.parse({ token }), {
      token,
    });

    assert.equal(
      credentialTokenVerifyInputSchema.safeParse({ token: "not a token" })
        .success,
      false
    );
    assert.equal(
      credentialCompleteInputSchema.safeParse({
        token,
        password: "Short1!",
        confirmPassword: "Short1!",
      }).success,
      false
    );
    assert.equal(
      credentialCompleteInputSchema.safeParse({
        token,
        password: "StrongReset123!",
        confirmPassword: "DifferentReset123!",
      }).success,
      false
    );
    assert.deepEqual(
      credentialCompleteInputSchema.parse({
        token: ` ${token} `,
        password: "StrongReset123!",
        confirmPassword: "StrongReset123!",
      }),
      {
        token,
        password: "StrongReset123!",
        confirmPassword: "StrongReset123!",
      }
    );

    assert.equal(
      createCredentialCompleteInputSchema({
        loginId: "staff1001",
        name: "홍길동",
      }).safeParse({
        token,
        password: "staff-1001Reset!",
        confirmPassword: "staff-1001Reset!",
      }).success,
      false
    );
    assert.equal(
      createCredentialCompleteInputSchema({
        loginId: "staff1001",
        name: "홍길동",
      }).safeParse({
        token,
        password: "홍-길동Reset123!",
        confirmPassword: "홍-길동Reset123!",
      }).success,
      false
    );
  });

  it("keeps public result schemas strict against secret fields", () => {
    const forbiddenFields = [
      "rawToken",
      "token",
      "resetUrl",
      "activationUrl",
      "tokenHash",
      "password",
      "passwordHash",
      "temporaryPassword",
      "sessionTokenHash",
    ];

    for (const field of forbiddenFields) {
      assert.equal(
        adminStaffCredentialIssueResultSchema.safeParse({
          userId: "user_123",
          purpose: "STAFF_ACTIVATION",
          expiresAt: "2026-05-07T00:30:00.000Z",
          delivery: { mode: "OUT_OF_BAND_APPROVED" },
          revokedTokenCount: 0,
          [field]: "secret-value",
        }).success,
        false,
        `${field} must be rejected from issue result`
      );
      assert.equal(
        adminStaffCredentialRevokeResultSchema.safeParse({
          userId: "user_123",
          purpose: "PASSWORD_RESET",
          revokedTokenCount: 1,
          [field]: "secret-value",
        }).success,
        false,
        `${field} must be rejected from revoke result`
      );
      assert.equal(
        credentialTokenPreviewSchema.safeParse({
          purpose: "PASSWORD_RESET",
          loginId: "staff1001",
          name: "Seed Staff",
          expiresAt: "2026-05-07T00:30:00.000Z",
          passwordPolicy: {
            minLength: CREDENTIAL_PASSWORD_MIN_LENGTH,
            maxLength: CREDENTIAL_PASSWORD_MAX_LENGTH,
          },
          [field]: "secret-value",
        }).success,
        false,
        `${field} must be rejected from preview result`
      );
      assert.equal(
        credentialCompleteResultSchema.safeParse({
          redirectTo: "/login",
          activated: true,
          revokedSessionCount: 0,
          [field]: "secret-value",
        }).success,
        false,
        `${field} must be rejected from complete result`
      );
    }
  });
});

describe("credential password policy", () => {
  it("accepts strong passwords and rejects weak or account-derived passwords", () => {
    assert.equal(
      isCredentialPasswordPolicyCompliant("StrongReset123!", {
        loginId: "staff1001",
        name: "홍길동",
      }),
      true
    );

    assert.deepEqual(
      getCredentialPasswordPolicyIssues("", {}).map((issue) => issue.code),
      ["PASSWORD_REQUIRED"]
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("lowercaseonly", {}).some(
        (issue) => issue.code === "PASSWORD_MIXED_CLASSES_REQUIRED"
      )
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("staff1001Reset!", {
        loginId: "staff1001",
      }).some((issue) => issue.code === "PASSWORD_CONTAINS_LOGIN_ID")
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("STAFF-1001.Reset!", {
        loginId: "staff1001",
      }).some((issue) => issue.code === "PASSWORD_CONTAINS_LOGIN_ID")
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("홍길동Reset123!", {
        name: "홍길동",
      }).some((issue) => issue.code === "PASSWORD_CONTAINS_NAME")
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("홍_길.동Reset123!", {
        name: "홍길동",
      }).some((issue) => issue.code === "PASSWORD_CONTAINS_NAME")
    );
    assert.ok(
      getCredentialPasswordPolicyIssues("Password123!", {}).some(
        (issue) => issue.code === "PASSWORD_WEAK_COMMON_VALUE"
      )
    );
  });

  it("exports stable password policy bounds", () => {
    assert.equal(CREDENTIAL_PASSWORD_MIN_LENGTH, 12);
    assert.equal(CREDENTIAL_PASSWORD_MAX_LENGTH, 128);
  });
});
