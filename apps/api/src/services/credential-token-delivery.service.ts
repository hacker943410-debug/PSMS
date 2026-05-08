import type {
  CredentialDeliveryMode,
  CredentialTokenPurpose,
} from "@psms/shared";

const MIN_SECRET_BYTES = 32;
const CREDENTIAL_DELIVERY_MODE_ENV = "PSMS_CREDENTIAL_DELIVERY_MODE";
const CREDENTIAL_DELIVERY_WEBHOOK_URL_ENV =
  "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL";
const CREDENTIAL_DELIVERY_WEBHOOK_SECRET_ENV =
  "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET";
const CREDENTIAL_DELIVERY_TIMEOUT_MS_ENV =
  "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_TIMEOUT_MS";
const CREDENTIAL_DELIVERY_MAX_ATTEMPTS_ENV =
  "PSMS_CREDENTIAL_DELIVERY_WEBHOOK_MAX_ATTEMPTS";
const DEFAULT_DELIVERY_TIMEOUT_MS = 5_000;
const MIN_DELIVERY_TIMEOUT_MS = 1_000;
const MAX_DELIVERY_TIMEOUT_MS = 15_000;
const MAX_PRODUCTION_DELIVERY_TIMEOUT_MS = 5_000;
const DEFAULT_DELIVERY_MAX_ATTEMPTS = 1;
const MIN_DELIVERY_MAX_ATTEMPTS = 1;
const MAX_DELIVERY_MAX_ATTEMPTS = 3;
const CREDENTIAL_DELIVERY_ID_HEADER = "X-PSMS-Delivery-Id";
const CREDENTIAL_DELIVERY_ATTEMPT_HEADER = "X-PSMS-Delivery-Attempt";
const APPROVED_OUT_OF_BAND_MODE = "OUT_OF_BAND_APPROVED" as const;
const SECRET_PLACEHOLDER_PATTERN =
  /^(?:replace-with|change-me|changeme|todo|example|sample|local-|test-|e2e-)|(?:placeholder|dummy|example|replace-with|local-secret|test-secret|e2e)/i;

export type CredentialDeliveryRequest = {
  deliveryId: string;
  mode: CredentialDeliveryMode;
  rawToken: string;
  purpose: CredentialTokenPurpose;
  user: {
    id: string;
    loginId: string;
    name: string;
    role: "ADMIN" | "STAFF";
    storeId: string | null;
  };
  expiresAt: Date;
};

export type CredentialDeliveryConfig =
  | {
      ok: true;
      mode: CredentialDeliveryMode;
      timeoutMs: number;
      maxAttempts: number;
    }
  | {
      ok: false;
    };

export type CredentialDeliveryFailureCode =
  | "WEBHOOK_CONFIG_INVALID"
  | "WEBHOOK_HTTP_ERROR"
  | "WEBHOOK_NETWORK_ERROR"
  | "WEBHOOK_TIMEOUT"
  | "WEBHOOK_UNAVAILABLE";

export type CredentialDeliveryResult =
  | {
      ok: true;
      attemptCount: number;
      finalStatusCode: number | null;
    }
  | {
      ok: false;
      attemptCount: number;
      failureCode: CredentialDeliveryFailureCode;
      finalStatusCode: number | null;
    };

function readBoundedIntegerEnv(input: {
  defaultValue: number;
  envName: string;
  max: number;
  min: number;
}) {
  const rawValue = process.env[input.envName]?.trim();

  if (!rawValue) {
    return input.defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const value = Number(rawValue);

  return value >= input.min && value <= input.max ? value : null;
}

function isStrongSecret(value: string | undefined) {
  const secret = value?.trim() ?? "";

  return (
    Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES &&
    !SECRET_PLACEHOLDER_PATTERN.test(secret)
  );
}

function hasDistinctDeliverySecret() {
  const deliverySecret =
    process.env[CREDENTIAL_DELIVERY_WEBHOOK_SECRET_ENV]?.trim() ?? "";
  const otherSecrets = [
    process.env.AUTH_SECRET,
    process.env.PASSWORD_TOKEN_SECRET,
    process.env.CREDENTIAL_COMPLETION_SECRET,
  ]
    .map((secret) => secret?.trim() ?? "")
    .filter(Boolean);

  return !otherSecrets.includes(deliverySecret);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".");

  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

  const [first, second] = parts.map(Number);

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isUnsafeProductionWebhookHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".test") ||
    normalized.includes("example") ||
    isPrivateIpv4(normalized)
  );
}

function isLocalHttpWebhook(url: URL) {
  return (
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  );
}

function assertWebhookUrlAllowed(url: URL) {
  if (process.env.NODE_ENV === "production") {
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      isUnsafeProductionWebhookHost(url.hostname)
    ) {
      throw new Error(
        `${CREDENTIAL_DELIVERY_WEBHOOK_URL_ENV} must be a production https URL without credentials, query string, fragment, or local/test host.`
      );
    }
  }

  if (url.protocol === "https:") {
    return;
  }

  if (process.env.NODE_ENV !== "production" && isLocalHttpWebhook(url)) {
    return;
  }

  throw new Error(
    `${CREDENTIAL_DELIVERY_WEBHOOK_URL_ENV} must use https outside local test/development.`
  );
}

function getWebhookUrl() {
  const rawUrl = process.env[CREDENTIAL_DELIVERY_WEBHOOK_URL_ENV]?.trim();

  if (!rawUrl) {
    return null;
  }

  const url = new URL(rawUrl);

  assertWebhookUrlAllowed(url);

  return url;
}

export function getCredentialDeliveryConfig(): CredentialDeliveryConfig {
  const configuredMode = process.env[CREDENTIAL_DELIVERY_MODE_ENV]?.trim();
  let webhookUrl: URL | null;

  try {
    webhookUrl = getWebhookUrl();
  } catch {
    return {
      ok: false,
    };
  }

  const productionSecretReady =
    process.env.NODE_ENV !== "production" ||
    (isStrongSecret(process.env[CREDENTIAL_DELIVERY_WEBHOOK_SECRET_ENV]) &&
      hasDistinctDeliverySecret());
  const timeoutMs = readBoundedIntegerEnv({
    defaultValue: DEFAULT_DELIVERY_TIMEOUT_MS,
    envName: CREDENTIAL_DELIVERY_TIMEOUT_MS_ENV,
    min: MIN_DELIVERY_TIMEOUT_MS,
    max: MAX_DELIVERY_TIMEOUT_MS,
  });
  const maxAttempts = readBoundedIntegerEnv({
    defaultValue: DEFAULT_DELIVERY_MAX_ATTEMPTS,
    envName: CREDENTIAL_DELIVERY_MAX_ATTEMPTS_ENV,
    min: MIN_DELIVERY_MAX_ATTEMPTS,
    max: MAX_DELIVERY_MAX_ATTEMPTS,
  });
  const productionRetryDisabled =
    process.env.NODE_ENV === "production" &&
    (maxAttempts !== DEFAULT_DELIVERY_MAX_ATTEMPTS ||
      Number(timeoutMs) > MAX_PRODUCTION_DELIVERY_TIMEOUT_MS);

  if (
    configuredMode === APPROVED_OUT_OF_BAND_MODE &&
    webhookUrl &&
    timeoutMs !== null &&
    maxAttempts !== null &&
    productionSecretReady &&
    !productionRetryDisabled
  ) {
    return {
      ok: true,
      mode: configuredMode,
      timeoutMs,
      maxAttempts,
    };
  }

  return {
    ok: false,
  };
}

function shouldRetryDelivery(input: {
  attempt: number;
  maxAttempts: number;
  failureCode: CredentialDeliveryFailureCode;
  statusCode: number | null;
}) {
  if (input.attempt >= input.maxAttempts) {
    return false;
  }

  if (
    input.failureCode === "WEBHOOK_NETWORK_ERROR" ||
    input.failureCode === "WEBHOOK_TIMEOUT"
  ) {
    return true;
  }

  return input.statusCode === 429 || Number(input.statusCode) >= 500;
}

function toFailureCode(error: unknown): CredentialDeliveryFailureCode {
  if (error instanceof Error && error.name === "AbortError") {
    return "WEBHOOK_TIMEOUT";
  }

  return "WEBHOOK_NETWORK_ERROR";
}

export async function deliverCredentialToken(input: CredentialDeliveryRequest) {
  const config = getCredentialDeliveryConfig();

  if (!config.ok) {
    return {
      ok: false,
      attemptCount: 0,
      failureCode: "WEBHOOK_CONFIG_INVALID",
      finalStatusCode: null,
    } satisfies CredentialDeliveryResult;
  }

  let webhookUrl: URL | null;

  try {
    webhookUrl = getWebhookUrl();
  } catch {
    webhookUrl = null;
  }

  if (!webhookUrl) {
    return {
      ok: false,
      attemptCount: 0,
      failureCode: "WEBHOOK_UNAVAILABLE",
      finalStatusCode: null,
    } satisfies CredentialDeliveryResult;
  }

  const webhookSecret =
    process.env[CREDENTIAL_DELIVERY_WEBHOOK_SECRET_ENV]?.trim();
  const headers: Record<string, string> = {
    [CREDENTIAL_DELIVERY_ID_HEADER]: input.deliveryId,
    "content-type": "application/json",
  };

  if (webhookSecret) {
    headers.authorization = `Bearer ${webhookSecret}`;
  }

  let lastFailureCode: CredentialDeliveryFailureCode = "WEBHOOK_UNAVAILABLE";
  let lastStatusCode: number | null = null;
  let attemptedCount = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    attemptedCount = attempt;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          ...headers,
          [CREDENTIAL_DELIVERY_ATTEMPT_HEADER]: String(attempt),
        },
        body: JSON.stringify({
          mode: input.mode,
          token: input.rawToken,
          purpose: input.purpose,
          user: input.user,
          expiresAt: input.expiresAt.toISOString(),
        }),
        signal: controller.signal,
      });

      lastStatusCode = response.status;

      if (response.ok) {
        return {
          ok: true,
          attemptCount: attempt,
          finalStatusCode: response.status,
        } satisfies CredentialDeliveryResult;
      }

      lastFailureCode = "WEBHOOK_HTTP_ERROR";

      if (
        !shouldRetryDelivery({
          attempt,
          maxAttempts: config.maxAttempts,
          failureCode: lastFailureCode,
          statusCode: response.status,
        })
      ) {
        break;
      }
    } catch (error) {
      lastFailureCode = toFailureCode(error);
      lastStatusCode = null;

      if (
        !shouldRetryDelivery({
          attempt,
          maxAttempts: config.maxAttempts,
          failureCode: lastFailureCode,
          statusCode: lastStatusCode,
        })
      ) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    attemptCount: attemptedCount,
    failureCode: lastFailureCode,
    finalStatusCode: lastStatusCode,
  } satisfies CredentialDeliveryResult;
}
