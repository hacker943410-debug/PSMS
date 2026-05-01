import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminBaseDetailQuerySchema,
  adminBaseListQuerySchema,
  adminPolicyDetailQuerySchema,
  adminPolicyListQuerySchema,
  adminStaffDetailQuerySchema,
  adminStaffListQuerySchema,
} from "../../packages/shared/src/admin.validation.ts";

describe("admin read query validation", () => {
  it("normalizes staff list defaults and query strings", () => {
    assert.deepEqual(adminStaffListQuerySchema.parse({}), {
      role: "all",
      storeId: "all",
      status: "all",
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      adminStaffListQuerySchema.parse({
        role: "STAFF",
        storeId: " store-001 ",
        status: "ACTIVE",
        q: "  kim   min  ",
        page: "2",
        pageSize: "20",
        detail: " user-001 ",
      }),
      {
        role: "STAFF",
        storeId: "store-001",
        status: "ACTIVE",
        q: "kim min",
        page: 2,
        pageSize: 20,
        detail: "user-001",
      }
    );
  });

  it("rejects non-canonical staff filters and requires detail id", () => {
    assert.equal(
      adminStaffListQuerySchema.safeParse({ role: "staff" }).success,
      false
    );
    assert.equal(adminStaffDetailQuerySchema.safeParse({}).success, false);
    assert.deepEqual(adminStaffDetailQuerySchema.parse({ userId: " U-1 " }), {
      userId: "U-1",
    });
  });

  it("keeps base tab routing on an explicit allowlist", () => {
    assert.deepEqual(adminBaseListQuerySchema.parse({}), {
      tab: "deviceModels",
      status: "all",
      page: 1,
      pageSize: 10,
    });

    assert.equal(
      adminBaseListQuerySchema.safeParse({ tab: "backup" }).success,
      false
    );
    assert.equal(
      adminBaseListQuerySchema.safeParse({ tab: "staffs" }).success,
      false
    );
    assert.deepEqual(
      adminBaseDetailQuerySchema.parse({ tab: "stores", id: " store-001 " }),
      {
        tab: "stores",
        id: "store-001",
      }
    );
  });

  it("validates policy filters with canonical subscription values", () => {
    assert.deepEqual(adminPolicyListQuerySchema.parse({}), {
      policyType: "saleProfit",
      carrierId: "all",
      subscriptionType: "all",
      status: "all",
      page: 1,
      pageSize: 10,
    });

    assert.deepEqual(
      adminPolicyListQuerySchema.parse({
        policyType: "saleProfit",
        carrierId: "all",
        subscriptionType: "CHANGE_DEVICE",
        status: "SCHEDULED",
        from: "2026-05-01",
        to: "2026-05-31",
        page: "3",
        pageSize: "50",
      }),
      {
        policyType: "saleProfit",
        carrierId: "all",
        subscriptionType: "CHANGE_DEVICE",
        status: "SCHEDULED",
        from: "2026-05-01",
        to: "2026-05-31",
        page: 3,
        pageSize: 50,
      }
    );

    assert.equal(
      adminPolicyListQuerySchema.safeParse({ subscriptionType: "CHANGE" })
        .success,
      false
    );
  });

  it("rejects reversed policy date ranges and requires policy detail id", () => {
    assert.equal(
      adminPolicyListQuerySchema.safeParse({
        from: "2026-06-01",
        to: "2026-05-01",
      }).success,
      false
    );
    assert.equal(
      adminPolicyDetailQuerySchema.safeParse({
        policyType: "discount",
      }).success,
      false
    );
    assert.deepEqual(
      adminPolicyDetailQuerySchema.parse({
        policyType: "discount",
        policyId: " policy-001 ",
      }),
      {
        policyType: "discount",
        policyId: "policy-001",
      }
    );
  });
});
