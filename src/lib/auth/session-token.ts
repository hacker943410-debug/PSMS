import "server-only";

import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "psms_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const SESSION_HASH_PREFIX = "v1:hmac-sha256";
const AUTH_SECRET_PLACEHOLDER = "replace-with-local-secret";
const MIN_AUTH_SECRET_BYTES = 32;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (
    !secret ||
    secret === AUTH_SECRET_PLACEHOLDER ||
    secret.startsWith("replace-with")
  ) {
    throw new Error("AUTH_SECRET must be set before using auth sessions.");
  }

  if (Buffer.byteLength(secret, "utf8") < MIN_AUTH_SECRET_BYTES) {
    throw new Error("AUTH_SECRET must be at least 32 bytes.");
  }

  return secret;
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(sessionToken: string) {
  const digest = createHmac("sha256", getAuthSecret())
    .update(sessionToken, "utf8")
    .digest("base64url");

  return `${SESSION_HASH_PREFIX}:${digest}`;
}

export function createSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}

export function createSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export function createExpiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}
