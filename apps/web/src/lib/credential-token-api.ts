import "server-only";

import type {
  ActionResult,
  CredentialCompleteInput,
  CredentialCompleteResult,
  CredentialTokenPreview,
  CredentialTokenPurpose,
  CredentialTokenVerifyInput,
} from "@psms/shared";

const credentialTokenRoutes = {
  STAFF_ACTIVATION: {
    verify: "/auth/staff-activation/verify",
    complete: "/auth/staff-activation/complete",
  },
  PASSWORD_RESET: {
    verify: "/auth/password-reset/verify",
    complete: "/auth/password-reset/complete",
  },
} as const satisfies Record<
  CredentialTokenPurpose,
  {
    verify: string;
    complete: string;
  }
>;

function getApiBaseUrl() {
  return process.env.PSMS_API_URL ?? "http://127.0.0.1:4273";
}

function getApiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

async function readJsonResult<T>(response: Response): Promise<ActionResult<T>> {
  try {
    return (await response.json()) as ActionResult<T>;
  } catch {
    return {
      ok: false,
      code: "API_INVALID_RESPONSE",
      message: "API 응답을 확인할 수 없습니다.",
    };
  }
}

async function postPublicCredentialApi<T>(
  path: string,
  body: unknown
): Promise<ActionResult<T>> {
  try {
    const response = await fetch(getApiUrl(path), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return readJsonResult<T>(response);
  } catch {
    return {
      ok: false,
      code: "API_UNAVAILABLE",
      message: "API 서버에 연결할 수 없습니다.",
    };
  }
}

export function verifyCredentialTokenViaApi(
  purpose: CredentialTokenPurpose,
  input: CredentialTokenVerifyInput
) {
  return postPublicCredentialApi<CredentialTokenPreview>(
    credentialTokenRoutes[purpose].verify,
    input
  );
}

export function completeCredentialTokenViaApi(
  purpose: CredentialTokenPurpose,
  input: CredentialCompleteInput
) {
  return postPublicCredentialApi<CredentialCompleteResult>(
    credentialTokenRoutes[purpose].complete,
    input
  );
}
