import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEV_AUTH_BYPASS_ENV,
  DEV_AUTH_BYPASS_SESSION,
  isDevAuthBypassEnabled,
} from "../../packages/shared/src/dev-auth-bypass.ts";

describe("dev auth bypass", () => {
  it("enables an admin session only when explicitly requested outside test and production", () => {
    assert.equal(
      isDevAuthBypassEnabled({
        [DEV_AUTH_BYPASS_ENV]: "true",
        NODE_ENV: "development",
      }),
      true
    );

    assert.equal(
      isDevAuthBypassEnabled({
        [DEV_AUTH_BYPASS_ENV]: "true",
      }),
      true
    );

    assert.equal(
      isDevAuthBypassEnabled({
        [DEV_AUTH_BYPASS_ENV]: "true",
        NODE_ENV: "test",
      }),
      false
    );

    assert.equal(
      isDevAuthBypassEnabled({
        [DEV_AUTH_BYPASS_ENV]: "true",
        NODE_ENV: "production",
      }),
      false
    );

    assert.equal(
      isDevAuthBypassEnabled({
        NODE_ENV: "development",
      }),
      true
    );

    assert.equal(
      isDevAuthBypassEnabled({
        [DEV_AUTH_BYPASS_ENV]: "false",
        NODE_ENV: "development",
      }),
      false
    );
  });

  it("uses an admin session so admin-only workspaces remain reachable in development", () => {
    assert.equal(DEV_AUTH_BYPASS_SESSION.role, "ADMIN");
    assert.equal(DEV_AUTH_BYPASS_SESSION.status, "ACTIVE");
    assert.equal(DEV_AUTH_BYPASS_SESSION.loginId, "dev-admin");
  });
});
