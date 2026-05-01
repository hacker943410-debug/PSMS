import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBaseSettingsCloseHref,
  createBaseSettingsHref,
  createPoliciesCloseHref,
  createPoliciesHref,
  createStaffsCloseHref,
  createStaffsHref,
  parseBaseSettingsSearchParams,
  parsePoliciesSearchParams,
  parseStaffsSearchParams,
} from "../../apps/web/src/lib/admin-foundation-url.ts";

describe("admin foundation URL helpers", () => {
  it("parses default staffs params safely", () => {
    assert.deepEqual(parseStaffsSearchParams({}), {
      role: "all",
      storeId: "all",
      status: "all",
      q: undefined,
      page: 1,
      pageSize: 10,
      detail: undefined,
      mode: undefined,
    });
  });

  it("normalizes staffs enums, duplicate params, text, and pagination", () => {
    const state = parseStaffsSearchParams(
      new URLSearchParams(
        "role=staff&role=ADMIN&storeId=gangnam&status=active&q=%20%20kim%20%20min%20%20&page=2&pageSize=20&detail=ST-001"
      )
    );

    assert.deepEqual(state, {
      role: "STAFF",
      storeId: "gangnam",
      status: "ACTIVE",
      q: "kim min",
      page: 2,
      pageSize: 20,
      detail: "ST-001",
      mode: undefined,
    });
  });

  it("clamps invalid staffs params and keeps create mode non-resource-specific", () => {
    const state = parseStaffsSearchParams({
      role: "MANAGER",
      status: "deleted",
      page: "0",
      pageSize: "999",
      detail: "ST-001",
      mode: "create",
    });

    assert.equal(state.role, "all");
    assert.equal(state.status, "all");
    assert.equal(state.page, 1);
    assert.equal(state.pageSize, 10);
    assert.equal(state.detail, undefined);
    assert.equal(state.mode, "create");
  });

  it("builds canonical staffs hrefs and close hrefs", () => {
    const state = parseStaffsSearchParams({
      role: "STAFF",
      status: "ACTIVE",
      q: "park",
      page: "2",
      detail: "ST-003",
      mode: "edit",
    });

    assert.equal(
      createStaffsHref(state),
      "/staffs?role=STAFF&status=ACTIVE&q=park&page=2&detail=ST-003&mode=edit"
    );
    assert.equal(
      createStaffsCloseHref(state),
      "/staffs?role=STAFF&status=ACTIVE&q=park&page=2"
    );
  });

  it("parses base settings tab state and excludes staffs tab from the contract", () => {
    const state = parseBaseSettingsSearchParams({
      tab: "staffs",
      q: "iphone",
      page: "3",
      detail: "device-001",
    });

    assert.equal(state.tab, "deviceModels");
    assert.equal(state.q, "iphone");
    assert.equal(state.page, 3);
    assert.equal(state.detail, "device-001");
  });

  it("ignores CRUD params for backup and restore tabs", () => {
    assert.deepEqual(
      parseBaseSettingsSearchParams({
        tab: "backup",
        status: "ACTIVE",
        q: "device",
        page: "4",
        pageSize: "20",
        detail: "device-001",
        mode: "edit",
      }),
      {
        tab: "backup",
        status: "all",
        q: undefined,
        page: 1,
        pageSize: 10,
        detail: undefined,
        mode: undefined,
      }
    );
  });

  it("builds base settings hrefs and close hrefs", () => {
    const state = parseBaseSettingsSearchParams({
      tab: "deviceModels",
      q: "Galaxy",
      pageSize: "20",
      detail: "device-005",
      mode: "edit",
    });

    assert.equal(
      createBaseSettingsHref({ tab: "deviceModels", mode: "create" }),
      "/settings/base?mode=create"
    );
    assert.equal(
      createBaseSettingsHref(state),
      "/settings/base?q=Galaxy&pageSize=20&detail=device-005&mode=edit"
    );
    assert.equal(
      createBaseSettingsCloseHref(state),
      "/settings/base?q=Galaxy&pageSize=20"
    );
  });

  it("parses policies filters, dates, and legacy tab aliases", () => {
    const state = parsePoliciesSearchParams({
      tab: "carrier-support",
      carrierId: "skt",
      salesType: "new",
      status: "reserved",
      from: "2026-05-01",
      to: "2026-05-31",
      q: "standard",
      page: "2",
      pageSize: "50",
      detail: "POL-001",
      confirm: "activate",
    });

    assert.deepEqual(state, {
      tab: "saleProfit",
      carrierId: "skt",
      salesType: "NEW",
      status: "SCHEDULED",
      from: "2026-05-01",
      to: "2026-05-31",
      q: "standard",
      page: 2,
      pageSize: 50,
      detail: "POL-001",
      mode: undefined,
      confirm: "activate",
    });
  });

  it("drops invalid policies dates and confirm intents without detail", () => {
    const state = parsePoliciesSearchParams({
      from: "2026-06-01",
      to: "2026-05-01",
      confirm: "activate",
      page: "-1",
    });

    assert.equal(state.from, undefined);
    assert.equal(state.to, undefined);
    assert.equal(state.confirm, undefined);
    assert.equal(state.page, 1);
  });

  it("builds canonical policies hrefs and close hrefs", () => {
    const state = parsePoliciesSearchParams({
      tab: "staffCommission",
      carrierId: "kt",
      status: "ACTIVE",
      from: "2026-05-01",
      to: "2026-05-31",
      detail: "POL-003",
      confirm: "activate",
    });

    assert.equal(
      createPoliciesHref(state),
      "/settings/policies?tab=staffCommission&carrierId=kt&status=ACTIVE&from=2026-05-01&to=2026-05-31&detail=POL-003&confirm=activate"
    );
    assert.equal(
      createPoliciesCloseHref(state),
      "/settings/policies?tab=staffCommission&carrierId=kt&status=ACTIVE&from=2026-05-01&to=2026-05-31"
    );
  });
});
