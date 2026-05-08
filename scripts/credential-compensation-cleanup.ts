import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCredentialCompensationCleanup } from "../apps/api/src/services/admin/credential-compensation-cleanup.service";

type CliOptions = {
  confirm: boolean;
  tokenIds: string[];
  databaseUrl?: string;
  detectionWindowMinutes?: number;
  expectedCandidateCount?: number;
  actorUserId?: string | null;
  operator?: string | null;
  ticketId?: string | null;
  reason?: string | null;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const resolvedDatabase = resolveDatabaseUrl(
    options.databaseUrl ?? process.env.DATABASE_URL
  );

  assertSupportedDatabase(resolvedDatabase);

  if (options.databaseUrl) {
    process.env.DATABASE_URL = options.databaseUrl;
  }

  const { createPrismaClient } = await import("@psms/db");
  const prisma = createPrismaClient(options.databaseUrl);

  try {
    const result = await runCredentialCompensationCleanup(prisma, {
      confirm: options.confirm,
      tokenIds: options.tokenIds,
      expectedCandidateCount: options.expectedCandidateCount,
      detectionWindowMinutes: options.detectionWindowMinutes,
      actorUserId: options.actorUserId,
      operator: options.operator,
      ticketId: options.ticketId,
      reason: options.reason,
    });

    process.stdout.write(
      `${JSON.stringify({ database: resolvedDatabase, ...result }, null, 2)}\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    confirm: false,
    tokenIds: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--confirm") {
      options.confirm = true;
      continue;
    }

    if (arg === "--token-id") {
      options.tokenIds.push(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--database-url") {
      options.databaseUrl = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--detection-window-minutes") {
      const value = Number(readValue(args, index, arg));

      if (!Number.isInteger(value) || value < 1) {
        throw new Error(
          "--detection-window-minutes must be a positive integer."
        );
      }

      options.detectionWindowMinutes = value;
      index += 1;
      continue;
    }

    if (arg === "--expected-count") {
      const value = Number(readValue(args, index, arg));

      if (!Number.isInteger(value) || value < 0) {
        throw new Error("--expected-count must be a non-negative integer.");
      }

      options.expectedCandidateCount = value;
      index += 1;
      continue;
    }

    if (arg === "--actor-user-id") {
      options.actorUserId = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--operator") {
      options.operator = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--ticket-id") {
      options.ticketId = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--reason") {
      options.reason = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readValue(args: string[], index: number, name: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function printHelp() {
  process.stdout.write(`Credential compensation cleanup command

Dry-run:
  pnpm ops:credential-compensation-cleanup

Confirm selected limbo tokens:
  pnpm ops:credential-compensation-cleanup --confirm --token-id <id> --expected-count <n> --actor-user-id <admin-id> --operator <name> --ticket-id <ticket>

Options:
  --confirm                         Revoke selected limbo tokens and write AuditLog rows.
  --token-id <id>                   Token id to clean up. Repeat for multiple ids.
  --expected-count <n>              Required with --confirm. Must match selected limbo row count.
  --operator <ticket-or-name>       Required with --confirm.
  --ticket-id <id>                  Required with --confirm.
  --actor-user-id <user-id>         Required with --confirm. Must be an active ADMIN user.
  --database-url <url>              Optional DATABASE_URL override.
  --detection-window-minutes <n>    Limbo grace window. Default: 10.
  --reason <text>                   Optional AuditLog reason override.
`);
}

function resolveDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    return {
      provider: null,
      identifier: null,
      sqlitePath: null,
    };
  }

  const filePrefix = "file:";

  if (!databaseUrl.startsWith(filePrefix)) {
    return {
      provider: inferDatabaseProvider(databaseUrl),
      identifier: redactDatabaseUrl(databaseUrl),
      sqlitePath: null,
    };
  }

  const sqlitePath = databaseUrl.slice(filePrefix.length);
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(currentDir, "../packages/db");
  const resolvedPath = (
    path.isAbsolute(sqlitePath)
      ? path.resolve(sqlitePath)
      : path.resolve(packageRoot, sqlitePath)
  ).replaceAll(path.sep, "/");

  return {
    provider: "sqlite",
    identifier: "file:<redacted>",
    sqlitePath: resolvedPath,
  };
}

function assertSupportedDatabase(
  database: ReturnType<typeof resolveDatabaseUrl>
) {
  if (database.provider && database.provider !== "sqlite") {
    throw new Error(
      `Credential compensation cleanup supports SQLite in this build. ${database.provider} rehearsal is BLOCK until a PostgreSQL Prisma profile/client is added. Database identifier: ${database.identifier}.`
    );
  }
}

function inferDatabaseProvider(databaseUrl: string) {
  const protocol = databaseUrl.split(":", 1)[0]?.toLowerCase();

  if (protocol === "postgres" || protocol === "postgresql") {
    return "postgresql";
  }

  return protocol || "unknown";
}

function redactDatabaseUrl(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);

    url.username = url.username ? "<redacted>" : "";
    url.password = url.password ? "<redacted>" : "";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return "<redacted>";
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
