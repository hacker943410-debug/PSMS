import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import {
  createCredentialLogRedactor,
  redactCredentialSecretsFromLog,
} from "./support/credential-log-redaction.mjs";

const WORKSPACE_ROOT = process.cwd();
const HOST = "127.0.0.1";
const WEB_PORT = 5273;
const API_PORT = 4273;
const LOG_PATH = path.resolve(WORKSPACE_ROOT, ".tmp/dev/psms-dev-current.log");
const TARGETS = {
  api: {
    args: ["--filter", "@psms/api", "dev"],
    port: API_PORT,
  },
  web: {
    args: ["--filter", "@psms/web", "dev"],
    port: WEB_PORT,
  },
};

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function selectedTargets() {
  const onlyApi = process.argv.includes("--api-only");
  const onlyWeb = process.argv.includes("--web-only");

  if (onlyApi && onlyWeb) {
    throw new Error("Use only one of --api-only or --web-only.");
  }

  if (onlyApi) {
    return ["api"];
  }

  if (onlyWeb) {
    return ["web"];
  }

  return ["api", "web"];
}

function prefixLogText(text, name) {
  if (!text) {
    return text;
  }

  return text.replace(/(^|\r?\n)(?=.)/g, `$1[${name}] `);
}

function pipeRedactedOutput(source, targets, name) {
  const redactor = createCredentialLogRedactor();
  let flushed = false;

  function write(text) {
    if (!text) {
      return;
    }

    const prefixedText = prefixLogText(text, name);

    for (const target of targets) {
      target.write(prefixedText);
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

function spawnDevTarget(name, outputTargets) {
  const isWindows = process.platform === "win32";
  const target = TARGETS[name];
  const command = pnpmCommand();
  const child = spawn(
    isWindows ? (process.env.ComSpec ?? "cmd.exe") : command,
    isWindows
      ? ["/d", "/s", "/c", `${command} ${target.args.join(" ")}`]
      : target.args,
    {
      cwd: WORKSPACE_ROOT,
      env: { ...process.env },
      stdio: "pipe",
      windowsHide: true,
    }
  );

  if (child.stdout) {
    pipeRedactedOutput(child.stdout, outputTargets.stdout, name);
  }

  if (child.stderr) {
    pipeRedactedOutput(child.stderr, outputTargets.stderr, name);
  }

  return child;
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

async function portPreflight(targetNames) {
  const entries = await Promise.all(
    targetNames.map(async (name) => ({
      name,
      port: TARGETS[name].port,
      occupied: await isPortListening(TARGETS[name].port),
    }))
  );

  return {
    targets: entries,
    canRun: entries.every((entry) => !entry.occupied),
  };
}

async function createFileLogTarget() {
  if (process.env.PSMS_DEV_NO_FILE_LOG === "1") {
    return null;
  }

  await mkdir(path.dirname(LOG_PATH), { recursive: true });

  const stream = createWriteStream(LOG_PATH, {
    encoding: "utf8",
    flags: "w",
  });

  stream.write(
    `PSMS redacted dev log started at ${new Date().toISOString()}\n`
  );

  return stream;
}

function closeFileLogTarget(fileLog) {
  return new Promise((resolve) => {
    if (!fileLog) {
      resolve();
      return;
    }

    fileLog.end(() => resolve());
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const taskkill = spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `taskkill /pid ${child.pid} /t /f`],
        { stdio: "ignore", windowsHide: true }
      );

      taskkill.on("exit", resolve);
      taskkill.on("error", resolve);
    });
    return;
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }

      resolve();
    }, 4000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const targetNames = selectedTargets();
  const preflight = await portPreflight(targetNames);

  if (process.argv.includes("--preflight-report")) {
    console.log(
      JSON.stringify({ ok: true, mode: "preflight", preflight }, null, 2)
    );
    return;
  }

  if (!preflight.canRun) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "DEV_PORT_OCCUPIED",
          message:
            "PSMS redacted dev runner requires selected local ports to be free.",
          preflight,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const fileLog = await createFileLogTarget();
  const outputTargets = {
    stdout: fileLog ? [process.stdout, fileLog] : [process.stdout],
    stderr: fileLog ? [process.stderr, fileLog] : [process.stderr],
  };
  const children = targetNames.map((name) =>
    spawnDevTarget(name, outputTargets)
  );
  let shuttingDown = false;

  console.log(
    `Starting PSMS redacted dev runner for ${targetNames.join(", ")}.`
  );

  async function shutdown(exitCode) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await Promise.all(children.map((child) => stopChild(child)));
    await closeFileLogTarget(fileLog);
    process.exit(exitCode);
  }

  process.once("SIGINT", () => void shutdown(130));
  process.once("SIGTERM", () => void shutdown(143));
  process.once("SIGHUP", () => void shutdown(129));
  process.once("uncaughtException", (error) => {
    console.error(
      redactCredentialSecretsFromLog(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      )
    );
    void shutdown(1);
  });
  process.once("unhandledRejection", (error) => {
    console.error(
      redactCredentialSecretsFromLog(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      )
    );
    void shutdown(1);
  });

  for (const child of children) {
    child.once("error", () => void shutdown(1));
    child.once("exit", (code) => {
      if (!shuttingDown) {
        void shutdown(code ?? 1);
      }
    });
  }
}

main().catch((error) => {
  console.error(
    redactCredentialSecretsFromLog(
      error instanceof Error ? error.message : String(error)
    )
  );
  process.exit(1);
});
