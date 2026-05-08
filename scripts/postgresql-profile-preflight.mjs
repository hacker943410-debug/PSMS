import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const FILES = {
  sqliteSchema: "packages/db/prisma/schema.prisma",
  sqliteMigrationLock: "packages/db/prisma/migrations/migration_lock.toml",
  sqliteClient: "packages/db/src/client.ts",
  dbIndex: "packages/db/src/index.ts",
  dbPackage: "packages/db/package.json",
  pgSchema: "packages/db/prisma/schema.postgresql.prisma",
  pgConfig: "packages/db/prisma.postgresql.config.ts",
};

function has(text, pattern) {
  return pattern.test(text);
}

function check(id, ok, message, severity = "block") {
  return { id, ok, message, severity };
}

async function readWorkspaceFile(relativePath) {
  return readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8");
}

async function optionalReadWorkspaceFile(relativePath) {
  try {
    return await readWorkspaceFile(relativePath);
  } catch {
    return null;
  }
}

export async function validatePostgresqlProfilePreflight() {
  const [
    sqliteSchema,
    sqliteMigrationLock,
    sqliteClient,
    dbIndex,
    dbPackageText,
    pgSchema,
    pgConfig,
  ] = await Promise.all([
    readWorkspaceFile(FILES.sqliteSchema),
    readWorkspaceFile(FILES.sqliteMigrationLock),
    readWorkspaceFile(FILES.sqliteClient),
    readWorkspaceFile(FILES.dbIndex),
    readWorkspaceFile(FILES.dbPackage),
    optionalReadWorkspaceFile(FILES.pgSchema),
    optionalReadWorkspaceFile(FILES.pgConfig),
  ]);
  const dbPackage = JSON.parse(dbPackageText);
  const packageDeps = {
    ...dbPackage.dependencies,
    ...dbPackage.devDependencies,
  };

  const checks = [
    check(
      "sqlite.schema.provider",
      has(sqliteSchema, /provider\s*=\s*"sqlite"/),
      "Default Prisma schema must remain SQLite."
    ),
    check(
      "sqlite.schema.output",
      has(sqliteSchema, /output\s*=\s*"\.\.\/src\/generated\/prisma"/),
      "Default generated client output must remain packages/db/src/generated/prisma."
    ),
    check(
      "sqlite.migration-lock",
      has(sqliteMigrationLock, /provider\s*=\s*"sqlite"/),
      "Default migration lock must remain SQLite."
    ),
    check(
      "sqlite.client.adapter",
      has(sqliteClient, /PrismaBetterSqlite3/) &&
        !has(sqliteClient, /adapter-pg|PrismaPg/),
      "Default DB client must remain better-sqlite3 only."
    ),
    check(
      "db.index.no-pg-export",
      !has(dbIndex, /postgresql-client|postgresql-prisma|PrismaPg/),
      "@psms/db root export must not expose PG rehearsal runtime."
    ),
    check(
      "pg.schema.exists",
      pgSchema !== null,
      "PostgreSQL rehearsal schema candidate must exist."
    ),
    check(
      "pg.schema.provider",
      Boolean(pgSchema && has(pgSchema, /provider\s*=\s*"postgresql"/)),
      "PostgreSQL rehearsal schema must use provider postgresql."
    ),
    check(
      "pg.schema.output",
      Boolean(
        pgSchema &&
        has(pgSchema, /output\s*=\s*"\.\.\/src\/generated\/postgresql-prisma"/)
      ),
      "PostgreSQL generated client output must be isolated."
    ),
    check(
      "pg.schema.parity",
      Boolean(
        pgSchema && normalizeSchema(sqliteSchema) === normalizeSchema(pgSchema)
      ),
      "PostgreSQL schema must match SQLite schema except provider/output/profile comments."
    ),
    check(
      "pg.config.exists",
      pgConfig !== null,
      "PostgreSQL Prisma config candidate must exist."
    ),
    check(
      "pg.config.env",
      Boolean(pgConfig && has(pgConfig, /PSMS_PG_REHEARSAL_DATABASE_URL/)),
      "PostgreSQL config must use PSMS_PG_REHEARSAL_DATABASE_URL, not DATABASE_URL."
    ),
    check(
      "pg.config.schema",
      Boolean(pgConfig && has(pgConfig, /schema\.postgresql\.prisma/)),
      "PostgreSQL config must point at schema.postgresql.prisma."
    ),
  ];

  const readinessChecks = [
    check(
      "pg.dependency.adapter-pg",
      Boolean(packageDeps["@prisma/adapter-pg"]),
      "@prisma/adapter-pg is not installed; PG execution readiness remains BLOCK.",
      "readiness"
    ),
    check(
      "pg.dependency.pg",
      Boolean(packageDeps.pg),
      "pg is not installed; PG execution readiness remains BLOCK.",
      "readiness"
    ),
    check(
      "pg.generated-client.absent",
      false,
      "PG generated client is intentionally absent in this scaffold; execution readiness remains BLOCK.",
      "readiness"
    ),
    check(
      "pg.migrations.absent",
      false,
      "PG migrations are intentionally absent in this scaffold; execution readiness remains BLOCK.",
      "readiness"
    ),
  ];
  const failedChecks = checks.filter((item) => !item.ok);
  const failedReadiness = readinessChecks.filter((item) => !item.ok);

  return {
    ok: failedChecks.length === 0,
    code:
      failedChecks.length === 0
        ? "POSTGRESQL_PROFILE_PREFLIGHT_OK"
        : "POSTGRESQL_PROFILE_PREFLIGHT_FAILED",
    readiness: failedReadiness.length === 0 ? "PASS" : "BLOCK",
    checkedFiles: FILES,
    checks,
    readinessChecks,
    failures: failedChecks,
    readinessBlockers: failedReadiness,
  };
}

function normalizeSchema(schemaText) {
  return schemaText
    .replace(/\/\/.*$/gm, "")
    .replace(/output\s*=\s*"\.\.\/src\/generated\/(?:postgresql-)?prisma"/g, "")
    .replace(/provider\s*=\s*"(?:sqlite|postgresql)"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const requireReadiness = process.argv.includes("--require-readiness");
  const report = await validatePostgresqlProfilePreflight();
  const payload = JSON.stringify(report, null, 2);

  if (!report.ok) {
    console.error(payload);
    process.exit(1);
  }

  if (requireReadiness && report.readiness !== "PASS") {
    console.error(payload);
    process.exit(1);
  }

  console.log(payload);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "POSTGRESQL_PROFILE_PREFLIGHT_ERROR",
          readiness: "BLOCK",
          message,
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}
