import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { CredentialTokenPurpose } from "@psms/shared";

import { CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS } from "./credential-token-cookie";

const COMPLETION_MARKER_VERSION = "v1";
const COMPLETION_MARKER_CONTEXT = "psms:credential-token-completion-cookie";
export const CREDENTIAL_COMPLETION_SECRET_ENV = "CREDENTIAL_COMPLETION_SECRET";
const CREDENTIAL_COMPLETION_SECRET_PLACEHOLDER =
  "replace-with-local-completion-secret";
const MIN_CREDENTIAL_COMPLETION_SECRET_BYTES = 32;
const CLOCK_SKEW_MS = 5_000;
const signaturePattern = /^[A-Za-z0-9_-]{43}$/;
const noncePattern = /^[A-Za-z0-9_-]{22}$/;

function getSigningSecret() {
  const secret = process.env[CREDENTIAL_COMPLETION_SECRET_ENV]?.trim();

  if (
    !secret ||
    secret === CREDENTIAL_COMPLETION_SECRET_PLACEHOLDER ||
    secret.startsWith("replace-with")
  ) {
    throw new Error(
      `${CREDENTIAL_COMPLETION_SECRET_ENV} must be set before creating credential completion markers.`
    );
  }

  if (
    Buffer.byteLength(secret, "utf8") < MIN_CREDENTIAL_COMPLETION_SECRET_BYTES
  ) {
    throw new Error(
      `${CREDENTIAL_COMPLETION_SECRET_ENV} must be at least 32 bytes.`
    );
  }

  return secret;
}

function markerPayload(
  purpose: CredentialTokenPurpose,
  issuedAtMs: number,
  nonce: string
) {
  return [COMPLETION_MARKER_CONTEXT, purpose, String(issuedAtMs), nonce].join(
    "\0"
  );
}

function signMarker(
  purpose: CredentialTokenPurpose,
  issuedAtMs: number,
  nonce: string
) {
  return createHmac("sha256", getSigningSecret())
    .update(markerPayload(purpose, issuedAtMs, nonce), "utf8")
    .digest("base64url");
}

function safeSignMarker(
  purpose: CredentialTokenPurpose,
  issuedAtMs: number,
  nonce: string
) {
  try {
    return signMarker(purpose, issuedAtMs, nonce);
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createCredentialTokenCompletionMarker(
  purpose: CredentialTokenPurpose,
  now = new Date()
) {
  const issuedAtMs = now.getTime();
  const nonce = randomBytes(16).toString("base64url");
  const signature = signMarker(purpose, issuedAtMs, nonce);

  return [COMPLETION_MARKER_VERSION, issuedAtMs, nonce, signature].join(".");
}

export function verifyCredentialTokenCompletionMarker(
  purpose: CredentialTokenPurpose,
  value: string | undefined,
  now = new Date()
) {
  if (!value) {
    return false;
  }

  const [version, issuedAtRaw, nonce, signature, extra] = value.split(".");

  if (
    extra !== undefined ||
    version !== COMPLETION_MARKER_VERSION ||
    !issuedAtRaw ||
    !nonce ||
    !signature ||
    !noncePattern.test(nonce) ||
    !signaturePattern.test(signature)
  ) {
    return false;
  }

  const issuedAtMs = Number(issuedAtRaw);

  if (!Number.isSafeInteger(issuedAtMs)) {
    return false;
  }

  const ageMs = now.getTime() - issuedAtMs;
  const maxAgeMs = CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS * 1000;

  if (ageMs < -CLOCK_SKEW_MS || ageMs > maxAgeMs + CLOCK_SKEW_MS) {
    return false;
  }

  const expectedSignature = safeSignMarker(purpose, issuedAtMs, nonce);

  return expectedSignature
    ? constantTimeEqual(signature, expectedSignature)
    : false;
}
