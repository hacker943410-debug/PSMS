import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import { createCredentialLogRedactor } from "./support/credential-log-redaction.mjs";

const WORKSPACE_ROOT = process.cwd();
const E2E_DB_PATH = path.resolve(WORKSPACE_ROOT, ".tmp/e2e/psms-e2e.db");
const E2E_RATE_LIMIT_PATH = path.resolve(
  WORKSPACE_ROOT,
  ".tmp/e2e/login-rate-limit.json"
);
const E2E_CREDENTIAL_RATE_LIMIT_PATH = path.resolve(
  WORKSPACE_ROOT,
  ".tmp/e2e/credential-token-rate-limit.json"
);
const E2E_ADMIN_CREDENTIAL_RATE_LIMIT_PATH = path.resolve(
  WORKSPACE_ROOT,
  ".tmp/e2e/admin-credential-rate-limit.json"
);
const E2E_DATABASE_URL = `file:${E2E_DB_PATH.replaceAll(path.sep, "/")}`;
const HOST = "127.0.0.1";
const WEB_PORT = 5273;
const API_PORT = 4273;
const WEB_URL = `http://${HOST}:${WEB_PORT}`;
const API_URL = `http://${HOST}:${API_PORT}`;
const E2E_AUTH_SECRET = "psms-e2e-managed-auth-secret-32-bytes";
const E2E_PASSWORD_TOKEN_SECRET =
  "psms-e2e-managed-password-token-secret-32-bytes";
const E2E_CREDENTIAL_COMPLETION_SECRET =
  "psms-e2e-managed-completion-secret-32-bytes";
const E2E_PASSWORDS = {
  admin: "LocalAdmin123!",
  staff: "LocalStaff123!",
};

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function prefixLogText(text, name) {
  if (!name || !text) {
    return text;
  }

  return text.replace(/(^|\r?\n)(?=.)/g, `$1[${name}] `);
}

function pipeRedactedOutput(source, target, name) {
  const redactor = createCredentialLogRedactor();
  let flushed = false;

  function write(text) {
    if (text) {
      target.write(prefixLogText(text, name));
    }
  }

  function flush() {
    if (flushed) {
      return;
    }

    flushed = true;
    write(redactor.flush());
  }

  source.on("data", (chunk) => write(redactor.write(chunk)));
  source.once("end", flush);
  source.once("close", flush);
}

function spawnCommand(command, args, env, options = {}) {
  const isWindows = process.platform === "win32";
  const shouldPipeOutput = options.background || options.redactOutput;
  const child = spawn(
    isWindows ? (process.env.ComSpec ?? "cmd.exe") : command,
    isWindows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args,
    {
      cwd: WORKSPACE_ROOT,
      env,
      stdio: shouldPipeOutput ? "pipe" : "inherit",
    }
  );

  if (shouldPipeOutput) {
    if (child.stdout) {
      pipeRedactedOutput(child.stdout, process.stdout, options.name);
    }

    if (child.stderr) {
      pipeRedactedOutput(child.stderr, process.stderr, options.name);
    }
  }

  return child;
}

function startCredentialDeliveryWebhook() {
  const deliveries = [];
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/deliveries") {
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ deliveries }));
      return;
    }

    if (request.method !== "POST" || request.url !== "/deliver") {
      response.writeHead(404).end();
      return;
    }

    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        deliveries.push(JSON.parse(body));
      } catch {
        deliveries.push({ malformed: true });
      }

      response.writeHead(204).end();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();

      if (!address || typeof address !== "object") {
        reject(new Error("Credential delivery webhook did not bind."));
        return;
      }

      resolve({
        close: () =>
          new Promise((closeResolve) => {
            server.close(() => closeResolve());
          }),
        url: `http://${HOST}:${address.port}/deliver`,
      });
    });
  });
}

function runCommand(command, args, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, env, options);

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function portPreflight() {
  const [webOccupied, apiOccupied, forbidden5173, forbidden4173] =
    await Promise.all([
      isPortListening(WEB_PORT),
      isPortListening(API_PORT),
      isPortListening(5173),
      isPortListening(4173),
    ]);

  return {
    web: { port: WEB_PORT, occupied: webOccupied },
    api: { port: API_PORT, occupied: apiOccupied },
    forbidden: [
      { port: 5173, occupied: forbidden5173 },
      { port: 4173, occupied: forbidden4173 },
    ],
    canRunManaged: !webOccupied && !apiOccupied,
  };
}

async function waitForHttp(url, label, timeoutMs = 60_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }

      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError ?? new Error(`${label} did not become ready.`);
}

function e2eEnv(deliveryWebhookUrl) {
  return {
    ...process.env,
    APP_ENV: "e2e",
    DATABASE_URL: E2E_DATABASE_URL,
    AUTH_SECRET: E2E_AUTH_SECRET,
    PASSWORD_TOKEN_SECRET: E2E_PASSWORD_TOKEN_SECRET,
    CREDENTIAL_COMPLETION_SECRET: E2E_CREDENTIAL_COMPLETION_SECRET,
    API_HOST: HOST,
    API_PORT: String(API_PORT),
    WEB_HOST: HOST,
    WEB_PORT: String(WEB_PORT),
    APP_URL: WEB_URL,
    PSMS_API_URL: API_URL,
    PSMS_WEB_URL: WEB_URL,
    PSMS_DEV_AUTH_BYPASS: "false",
    PSMS_LOGIN_RATE_LIMIT_STORE: "file",
    PSMS_LOGIN_RATE_LIMIT_FILE: E2E_RATE_LIMIT_PATH,
    PSMS_CREDENTIAL_RATE_LIMIT_STORE: "file",
    PSMS_CREDENTIAL_RATE_LIMIT_FILE: E2E_CREDENTIAL_RATE_LIMIT_PATH,
    PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_STORE: "file",
    PSMS_ADMIN_CREDENTIAL_RATE_LIMIT_FILE: E2E_ADMIN_CREDENTIAL_RATE_LIMIT_PATH,
    PSMS_CREDENTIAL_DELIVERY_MODE: "OUT_OF_BAND_APPROVED",
    PSMS_CREDENTIAL_DELIVERY_WEBHOOK_URL: deliveryWebhookUrl,
    PSMS_E2E_CREDENTIAL_DELIVERY_CAPTURE_URL: deliveryWebhookUrl.replace(
      /\/deliver$/,
      "/deliveries"
    ),
    PSMS_CREDENTIAL_DELIVERY_WEBHOOK_SECRET:
      "psms-e2e-managed-delivery-secret-32-bytes",
    PSMS_E2E_DB_MODE: "isolated",
    PSMS_SKIP_E2E_SEED_RESET: "true",
    PSMS_SEED_ADMIN_LOGIN_ID: "admin1001",
    PSMS_SEED_STAFF_LOGIN_ID: "staff1001",
    PSMS_SEED_ADMIN_PASSWORD: E2E_PASSWORDS.admin,
    PSMS_SEED_STAFF_PASSWORD: E2E_PASSWORDS.staff,
    SEED_RESET_PASSWORDS: "true",
    SEED_RESET_PASSWORD_LOGIN_IDS: "admin1001,staff1001",
  };
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const taskkill = spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `taskkill /pid ${child.pid} /t /f`],
        { stdio: "inherit" }
      );

      taskkill.on("exit", resolve);
      taskkill.on("error", resolve);
    });
    return;
  }

  child.kill("SIGTERM");
}

async function main() {
  const preflight = await portPreflight();

  if (process.argv.includes("--preflight-report")) {
    console.log(
      JSON.stringify({ ok: true, mode: "preflight", preflight }, null, 2)
    );
    return;
  }

  if (!preflight.canRunManaged) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "E2E_PORT_OCCUPIED",
          message:
            "Managed E2E requires PSMS Web 5273 and API 4273 to be free. Existing processes were not stopped.",
          preflight,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const children = [];
  let credentialDeliveryWebhook = null;

  try {
    credentialDeliveryWebhook = await startCredentialDeliveryWebhook();
    const env = e2eEnv(credentialDeliveryWebhook.url);

    await rm(E2E_RATE_LIMIT_PATH, { force: true });
    await rm(E2E_CREDENTIAL_RATE_LIMIT_PATH, { force: true });
    await rm(E2E_ADMIN_CREDENTIAL_RATE_LIMIT_PATH, { force: true });
    await runCommand(pnpmCommand(), ["test:e2e:db:reset"], env, {
      name: "db",
      redactOutput: true,
    });

    children.push(
      spawnCommand(pnpmCommand(), ["--filter", "@psms/api", "dev"], env, {
        background: true,
        name: "api",
      })
    );
    await waitForHttp(`${API_URL}/health`, "API");

    children.push(
      spawnCommand(pnpmCommand(), ["--filter", "@psms/web", "dev"], env, {
        background: true,
        name: "web",
      })
    );
    await waitForHttp(`${WEB_URL}/login`, "Web");

    await runCommand(
      pnpmCommand(),
      [
        "exec",
        "playwright",
        "test",
        "test/e2e/auth-browser.spec.ts",
        "test/e2e/admin-staff-mutation-ui.spec.ts",
        "test/e2e/credential-token-browser.spec.ts",
        "test/e2e/route-guards.spec.ts",
      ],
      env,
      {
        name: "playwright",
        redactOutput: true,
      }
    );
  } finally {
    await Promise.all(children.map((child) => stopChild(child)));
    await credentialDeliveryWebhook?.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
