import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS } from "../../apps/web/src/lib/credential-token-cookie.ts";
import {
  CREDENTIAL_COMPLETION_SECRET_ENV,
  createCredentialTokenCompletionMarker,
  verifyCredentialTokenCompletionMarker,
} from "../../apps/web/src/lib/credential-token-completion-core.ts";

const originalCompletionSecret = process.env[CREDENTIAL_COMPLETION_SECRET_ENV];
const originalAuthSecret = process.env.AUTH_SECRET;
const originalPasswordTokenSecret = process.env.PASSWORD_TOKEN_SECRET;
const strongCompletionSecret =
  "local-completion-marker-secret-32-bytes-minimum";

function setCompletionSecret(value: string | undefined) {
  if (value === undefined) {
    delete process.env[CREDENTIAL_COMPLETION_SECRET_ENV];
    return;
  }

  process.env[CREDENTIAL_COMPLETION_SECRET_ENV] = value;
}

function tamperLastCharacter(value: string) {
  const replacement = value.endsWith("A") ? "B" : "A";

  return `${value.slice(0, -1)}${replacement}`;
}

afterEach(() => {
  setCompletionSecret(originalCompletionSecret);

  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }

  if (originalPasswordTokenSecret === undefined) {
    delete process.env.PASSWORD_TOKEN_SECRET;
  } else {
    process.env.PASSWORD_TOKEN_SECRET = originalPasswordTokenSecret;
  }
});

describe("credential completion marker", () => {
  it("creates a signed purpose-bound marker without token material", () => {
    setCompletionSecret(strongCompletionSecret);

    const now = new Date("2026-05-07T00:00:00.000Z");
    const marker = createCredentialTokenCompletionMarker(
      "STAFF_ACTIVATION",
      now
    );
    const secondMarker = createCredentialTokenCompletionMarker(
      "STAFF_ACTIVATION",
      now
    );

    assert.match(marker, /^v1\.\d{13}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    assert.notEqual(marker, secondMarker);
    assert.equal(
      verifyCredentialTokenCompletionMarker(
        "STAFF_ACTIVATION",
        marker,
        new Date(now.getTime() + 1_000)
      ),
      true
    );
    assert.equal(
      verifyCredentialTokenCompletionMarker(
        "PASSWORD_RESET",
        marker,
        new Date(now.getTime() + 1_000)
      ),
      false
    );
    assert.equal(marker.includes(strongCompletionSecret), false);
  });

  it("fails closed for malformed and tampered markers", () => {
    setCompletionSecret(strongCompletionSecret);

    const now = new Date("2026-05-07T00:00:00.000Z");
    const marker = createCredentialTokenCompletionMarker("PASSWORD_RESET", now);

    for (const value of [
      undefined,
      "",
      "1",
      "random",
      "v0.1778112000000.abcdefghijklmnopqrstuv.signature",
      "v1.not-a-number.abcdefghijklmnopqrstuv.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "v1.1778112000000.bad-nonce.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "v1.1778112000000.abcdefghijklmnopqrstuv.bad-signature",
      "v1.1778112000000.abcdefghijklmnopqrstuv.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.extra",
      tamperLastCharacter(marker),
    ]) {
      assert.equal(
        verifyCredentialTokenCompletionMarker("PASSWORD_RESET", value, now),
        false
      );
    }
  });

  it("fails closed for expired and far future markers", () => {
    setCompletionSecret(strongCompletionSecret);

    const now = new Date("2026-05-07T00:00:00.000Z");
    const marker = createCredentialTokenCompletionMarker(
      "STAFF_ACTIVATION",
      now
    );
    const futureMarker = createCredentialTokenCompletionMarker(
      "STAFF_ACTIVATION",
      new Date(now.getTime() + 6_000)
    );

    assert.equal(
      verifyCredentialTokenCompletionMarker(
        "STAFF_ACTIVATION",
        marker,
        new Date(
          now.getTime() +
            (CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS + 6) * 1000
        )
      ),
      false
    );
    assert.equal(
      verifyCredentialTokenCompletionMarker(
        "STAFF_ACTIVATION",
        futureMarker,
        now
      ),
      false
    );
  });

  it("requires a dedicated strong completion secret", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");

    process.env.AUTH_SECRET = "auth-secret-that-must-not-sign-completion";
    process.env.PASSWORD_TOKEN_SECRET =
      "password-token-secret-that-must-not-sign-completion";
    setCompletionSecret(undefined);
    assert.throws(
      () => createCredentialTokenCompletionMarker("STAFF_ACTIVATION", now),
      /CREDENTIAL_COMPLETION_SECRET/
    );

    setCompletionSecret("replace-with-local-completion-secret");
    assert.throws(
      () => createCredentialTokenCompletionMarker("STAFF_ACTIVATION", now),
      /CREDENTIAL_COMPLETION_SECRET/
    );

    setCompletionSecret("short");
    assert.throws(
      () => createCredentialTokenCompletionMarker("STAFF_ACTIVATION", now),
      /at least 32 bytes/
    );
  });

  it("fails closed when verifying structurally valid markers without the dedicated secret", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");

    setCompletionSecret(strongCompletionSecret);
    const marker = createCredentialTokenCompletionMarker("PASSWORD_RESET", now);

    for (const invalidSecret of [
      undefined,
      "replace-with-local-completion-secret",
      "replace-with-anything",
      "short",
    ]) {
      setCompletionSecret(invalidSecret);
      assert.equal(
        verifyCredentialTokenCompletionMarker("PASSWORD_RESET", marker, now),
        false
      );
    }
  });
});
