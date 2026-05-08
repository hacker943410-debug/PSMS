import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createExpiredCredentialTokenCompletionCookieOptions,
  createCredentialTokenCookieOptions,
  createExpiredCredentialTokenCookieOptions,
  getCredentialTokenCompletionCookieConfig,
  getCredentialTokenCookieConfig,
  getCredentialTokenPurposeForPath,
  normalizeCredentialUrlToken,
} from "./lib/credential-token-cookie";

function applyCredentialTokenSecurityHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
}

export function proxy(request: NextRequest) {
  const purpose = getCredentialTokenPurposeForPath(request.nextUrl.pathname);

  if (!purpose) {
    return NextResponse.next();
  }

  if (request.nextUrl.searchParams.has("token")) {
    const token = normalizeCredentialUrlToken(
      request.nextUrl.searchParams.get("token")
    );
    const cleanUrl = request.nextUrl.clone();

    cleanUrl.searchParams.delete("token");

    const response = NextResponse.redirect(cleanUrl);
    const { cookieName } = getCredentialTokenCookieConfig(purpose);
    const { cookieName: completionCookieName } =
      getCredentialTokenCompletionCookieConfig(purpose);

    applyCredentialTokenSecurityHeaders(response);

    if (token) {
      response.cookies.set(
        cookieName,
        token,
        createCredentialTokenCookieOptions(purpose)
      );
    } else {
      response.cookies.set(
        cookieName,
        "",
        createExpiredCredentialTokenCookieOptions(purpose)
      );
    }
    response.cookies.set(
      completionCookieName,
      "",
      createExpiredCredentialTokenCompletionCookieOptions(purpose)
    );

    return response;
  }

  const response = NextResponse.next();

  applyCredentialTokenSecurityHeaders(response);

  return response;
}

export const config = {
  matcher: ["/staff-activation", "/password-reset"],
};
