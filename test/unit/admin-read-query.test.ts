import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isApiBackedBaseSettingsTab,
  toAdminBaseListQuery,
  toAdminPolicyListQuery,
  toAdminQueryString,
  toAdminStaffListQuery,
} from "../../apps/web/src/lib/admin-read-query.ts";

describe("admin read query mapping", () => {
  it("maps staffs URL state to the existing admin staff API query", () => {
    assert.deepEqual(
      toAdminStaffListQuery({
        role: "STAFF",
        storeId: "store-1",
        status: "ACTIVE",
        q: "kim",
        page: 2,
        pageSize: 20,
        detail: "user-1",
        mode: undefined,
      }),
      {
        role: "STAFF",
        storeId: "store-1",
        status: "ACTIVE",
        q: "kim",
        page: 2,
        pageSize: 20,
        detail: "user-1",
      }
    );
  });

  it("maps only API-backed base tabs and excludes backup or restore", () => {
    assert.equal(isApiBackedBaseSettingsTab("deviceModels"), true);
    assert.equal(isApiBackedBaseSettingsTab("backup"), false);
    assert.equal(
      toAdminBaseListQuery({
        tab: "backup",
        status: "all",
        q: undefined,
        page: 1,
        pageSize: 10,
        detail: undefined,
        mode: undefined,
      }),
      null
    );
    assert.deepEqual(
      toAdminBaseListQuery({
        tab: "stores",
        status: "INACTIVE",
        q: "gangnam",
        page: 3,
        pageSize: 50,
        detail: "store-1",
        mode: "edit",
      }),
      {
        tab: "stores",
        status: "INACTIVE",
        q: "gangnam",
        page: 3,
        pageSize: 50,
        detail: "store-1",
      }
    );
  });

  it("maps policies tab and salesType to the Fastify policy query contract", () => {
    assert.deepEqual(
      toAdminPolicyListQuery({
        tab: "saleProfit",
        carrierId: "carrier-1",
        salesType: "CHANGE",
        status: "SCHEDULED",
        from: "2026-05-01",
        to: "2026-05-31",
        q: "standard",
        page: 2,
        pageSize: 20,
        detail: "policy-1",
        mode: undefined,
        confirm: "activate",
      }),
      {
        policyType: "saleProfit",
        carrierId: "carrier-1",
        subscriptionType: "CHANGE_DEVICE",
        status: "SCHEDULED",
        from: "2026-05-01",
        to: "2026-05-31",
        q: "standard",
        page: 2,
        pageSize: 20,
        detail: "policy-1",
      }
    );
  });

  it("drops undefined values from admin query strings", () => {
    assert.equal(
      toAdminQueryString({
        policyType: "saleProfit",
        q: undefined,
        page: 1,
        pageSize: 10,
      }),
      "policyType=saleProfit&page=1&pageSize=10"
    );
  });
});
