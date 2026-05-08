import type { CredentialTokenPurpose } from "@psms/shared";

export const CREDENTIAL_TOKEN_COOKIE_MAX_AGE_SECONDS = 30 * 60;
export const CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS = 60;

const tokenPattern = /^[A-Za-z0-9_-]{32,256}$/;

type CredentialTokenCookieOptions = {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: "strict";
  secure: boolean;
  expires?: Date;
};

const credentialTokenCookieConfig = {
  STAFF_ACTIVATION: {
    cookieName: "psms_staff_activation_token",
    completionCookieName: "psms_staff_activation_completed",
    path: "/staff-activation",
  },
  PASSWORD_RESET: {
    cookieName: "psms_password_reset_token",
    completionCookieName: "psms_password_reset_completed",
    path: "/password-reset",
  },
} as const satisfies Record<
  CredentialTokenPurpose,
  {
    cookieName: string;
    completionCookieName: string;
    path: string;
  }
>;

export function getCredentialTokenCookieConfig(
  purpose: CredentialTokenPurpose
) {
  return credentialTokenCookieConfig[purpose];
}

export function getCredentialTokenPurposeForPath(pathname: string) {
  if (pathname === credentialTokenCookieConfig.STAFF_ACTIVATION.path) {
    return "STAFF_ACTIVATION";
  }

  if (pathname === credentialTokenCookieConfig.PASSWORD_RESET.path) {
    return "PASSWORD_RESET";
  }

  return null;
}

export function normalizeCredentialUrlToken(value: string | null | undefined) {
  const token = value?.trim();

  if (!token || !tokenPattern.test(token)) {
    return null;
  }

  return token;
}

export function createCredentialTokenCookieOptions(
  purpose: CredentialTokenPurpose
): CredentialTokenCookieOptions {
  return {
    httpOnly: true,
    maxAge: CREDENTIAL_TOKEN_COOKIE_MAX_AGE_SECONDS,
    path: getCredentialTokenCookieConfig(purpose).path,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  };
}

export function createExpiredCredentialTokenCookieOptions(
  purpose: CredentialTokenPurpose
): CredentialTokenCookieOptions {
  return {
    ...createCredentialTokenCookieOptions(purpose),
    expires: new Date(0),
    maxAge: 0,
  };
}

export function getCredentialTokenCompletionCookieConfig(
  purpose: CredentialTokenPurpose
) {
  const { completionCookieName, path } = credentialTokenCookieConfig[purpose];

  return {
    cookieName: completionCookieName,
    path,
  };
}

export function createCredentialTokenCompletionCookieOptions(
  purpose: CredentialTokenPurpose
): CredentialTokenCookieOptions {
  return {
    httpOnly: true,
    maxAge: CREDENTIAL_TOKEN_COMPLETION_COOKIE_MAX_AGE_SECONDS,
    path: getCredentialTokenCookieConfig(purpose).path,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  };
}

export function createExpiredCredentialTokenCompletionCookieOptions(
  purpose: CredentialTokenPurpose
): CredentialTokenCookieOptions {
  return {
    ...createCredentialTokenCompletionCookieOptions(purpose),
    expires: new Date(0),
    maxAge: 0,
  };
}
