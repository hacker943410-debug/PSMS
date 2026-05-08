import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

import { validatePostgresqlProfilePreflight } from "../../scripts/postgresql-profile-preflight.mjs";

describe("PostgreSQL Prisma profile preflight", () => {
  it("keeps the PG scaffold isolated while execution readiness remains blocked", async () => {
    const report = await validatePostgresqlProfilePreflight();

    assert.equal(report.ok, true);
    assert.equal(report.code, "POSTGRESQL_PROFILE_PREFLIGHT_OK");
    assert.equal(report.readiness, "BLOCK");
    assert.equal(report.failures.length, 0);
    assert.ok(
      report.checks.some(
        (check) => check.id === "sqlite.schema.provider" && check.ok
      )
    );
    assert.ok(
      report.checks.some(
        (check) => check.id === "pg.schema.provider" && check.ok
      )
    );
    assert.ok(
      report.readinessBlockers.some(
        (check) => check.id === "pg.dependency.adapter-pg"
      )
    );
    assert.equal(JSON.stringify(report).includes("PSMS_PG_REHEARSAL"), true);
    assert.equal(JSON.stringify(report).includes("postgresql://"), false);
  });

  it("fails closed when release readiness is required before PG runtime exists", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/postgresql-profile-preflight.mjs", "--require-readiness"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /"readiness": "BLOCK"/);
    assert.match(result.stderr, /pg\.dependency\.adapter-pg/);
    assert.equal(result.stderr.includes("postgresql://"), false);
  });
});
