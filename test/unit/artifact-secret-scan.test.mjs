import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const workspaceRoot = process.cwd();
const evidenceRoot = path.join(workspaceRoot, "release-evidence");
const testEvidenceDir = path.join(evidenceRoot, "scan-test");

function runSecretScan() {
  const isWindows = process.platform === "win32";

  return spawnSync(
    isWindows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm",
    isWindows
      ? ["/d", "/s", "/c", "pnpm.cmd release:gate:logs"]
      : ["release:gate:logs"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    }
  );
}

describe("artifact secret scan", () => {
  it("scans release-evidence artifacts and blocks full PostgreSQL DSNs", async () => {
    await rm(testEvidenceDir, { force: true, recursive: true });
    await mkdir(testEvidenceDir, { recursive: true });

    try {
      await writeFile(
        path.join(testEvidenceDir, "leaky-postgresql-dsn.json"),
        JSON.stringify({
          databaseUrl:
            "postgresql://release_user:super-secret-password@db.example.test:5432/psms?sslmode=require",
        })
      );

      const result = runSecretScan();

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /CREDENTIAL_SECRET_ARTIFACT_LEAK/);
      assert.match(result.stderr, /postgresql dsn/);
      assert.match(result.stderr, /release-evidence/);
      assert.equal(result.stderr.includes("super-secret-password"), false);
    } finally {
      await rm(testEvidenceDir, { force: true, recursive: true });
    }
  });
});
