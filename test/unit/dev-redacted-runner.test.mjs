import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

describe("redacted dev runner", () => {
  it("reports selected API/Web dev ports without starting servers", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/dev-redacted-runner.mjs", "--preflight-report"],
      {
        encoding: "utf8",
      }
    );

    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);

    assert.equal(report.ok, true);
    assert.equal(report.mode, "preflight");
    assert.deepEqual(
      report.preflight.targets.map((target) => ({
        name: target.name,
        port: target.port,
      })),
      [
        { name: "api", port: 4273 },
        { name: "web", port: 5273 },
      ]
    );
  });

  it("supports API-only and Web-only preflight modes", () => {
    const apiResult = spawnSync(
      process.execPath,
      ["scripts/dev-redacted-runner.mjs", "--api-only", "--preflight-report"],
      { encoding: "utf8" }
    );
    const webResult = spawnSync(
      process.execPath,
      ["scripts/dev-redacted-runner.mjs", "--web-only", "--preflight-report"],
      { encoding: "utf8" }
    );

    assert.equal(apiResult.status, 0, apiResult.stderr);
    assert.equal(webResult.status, 0, webResult.stderr);
    assert.deepEqual(
      JSON.parse(apiResult.stdout).preflight.targets.map(
        (target) => target.name
      ),
      ["api"]
    );
    assert.deepEqual(
      JSON.parse(webResult.stdout).preflight.targets.map(
        (target) => target.name
      ),
      ["web"]
    );
  });

  it("rejects conflicting target modes", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/dev-redacted-runner.mjs",
        "--api-only",
        "--web-only",
        "--preflight-report",
      ],
      { encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Use only one of --api-only or --web-only/);
  });
});
