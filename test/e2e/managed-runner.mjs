import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const E2E_DB_PATH = path.resolve(WORKSPACE_ROOT, ".tmp/e2e/psms-e2e.db");
const E2E_DATABASE_URL = `file:${E2E_DB_PATH.replaceAll(path.sep, "/")}`;
const HOST = "127.0.0.1";
const WEB_PORT = 5273;
const API_PORT = 4273;
const WEB_URL = `http://${HOST}:${WEB_PORT}`;
const API_URL = `http://${HOST}:${API_PORT}`;
const E2E_AUTH_SECRET = "psms-e2e-managed-auth-secret-32-bytes";
const E2E_PASSWORDS = {
  admin: "LocalAdmin123!",
  staff: "LocalStaff123!",
};

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function spawnCommand(command, args, env, options = {}) {
  const isWindows = process.platform === "win32";
  const child = spawn(
    isWindows ? (process.env.ComSpec ?? "cmd.exe") : command,
    isWindows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args,
    {
      cwd: WORKSPACE_ROOT,
      env,
      stdio: options.background ? "pipe" : "inherit",
    }
  );

  if (options.background) {
    child.stdout?.on("data", (chunk) =>
      process.stdout.write(`[${options.name}] ${chunk}`)
    );
    child.stderr?.on("data", (chunk) =>
      process.stderr.write(`[${options.name}] ${chunk}`)
    );
  }

  return child;
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, env);

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

function e2eEnv() {
  return {
    ...process.env,
    APP_ENV: "e2e",
    DATABASE_URL: E2E_DATABASE_URL,
    AUTH_SECRET: E2E_AUTH_SECRET,
    API_HOST: HOST,
    API_PORT: String(API_PORT),
    WEB_HOST: HOST,
    WEB_PORT: String(WEB_PORT),
    APP_URL: WEB_URL,
    PSMS_API_URL: API_URL,
    PSMS_WEB_URL: WEB_URL,
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

  const env = e2eEnv();
  const children = [];

  try {
    await runCommand(pnpmCommand(), ["test:e2e:db:reset"], env);

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
      ["exec", "playwright", "test", "test/e2e/route-guards.spec.ts"],
      env
    );
  } finally {
    await Promise.all(children.map((child) => stopChild(child)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
