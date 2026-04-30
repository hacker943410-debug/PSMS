import "server-only";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_IP_LIMIT = 5;
const IP_LIMIT = 20;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

function getBucket(key: string, now = nowMs()) {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = {
      count: 0,
      resetAt: now + WINDOW_MS,
    };
    buckets.set(key, bucket);
    return bucket;
  }

  return existing;
}

function normalizeIp(ipAddress: string | null) {
  return ipAddress?.trim() || "unknown";
}

function emailIpKey(email: string, ipAddress: string | null) {
  return `email-ip:${email}:${normalizeIp(ipAddress)}`;
}

function ipKey(ipAddress: string | null) {
  return `ip:${normalizeIp(ipAddress)}`;
}

export function assertLoginRateLimitReady() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Persistent login rate limit storage is required before production login is enabled."
    );
  }
}

export function canAttemptLogin(email: string, ipAddress: string | null) {
  assertLoginRateLimitReady();

  const now = nowMs();
  const emailIpBucket = getBucket(emailIpKey(email, ipAddress), now);
  const ipBucket = getBucket(ipKey(ipAddress), now);

  return emailIpBucket.count < EMAIL_IP_LIMIT && ipBucket.count < IP_LIMIT;
}

export function recordFailedLogin(email: string, ipAddress: string | null) {
  const now = nowMs();
  getBucket(emailIpKey(email, ipAddress), now).count += 1;
  getBucket(ipKey(ipAddress), now).count += 1;
}

export function clearLoginFailures(email: string, ipAddress: string | null) {
  buckets.delete(emailIpKey(email, ipAddress));
}
