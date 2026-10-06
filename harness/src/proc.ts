import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { REPO_ROOT } from "./config.ts";

/** Run a program (no shell) and return trimmed stdout. Throws on non-zero exit. */
export function run(cmd: string, args: string[], opts: { input?: string; cwd?: string } = {}): string {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    input: opts.input,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw new Error(`${cmd} failed to start: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}\n${(r.stderr || r.stdout).trim()}`);
  }
  return r.stdout.trim();
}

/** Like run(), but returns null instead of throwing. */
export function tryRun(cmd: string, args: string[], opts: { cwd?: string } = {}): string | null {
  try {
    return run(cmd, args, opts);
  } catch {
    return null;
  }
}

/** Kill a child and everything it started (shells start grandchildren). */
export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

export interface ShellResult {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  durationMs: number;
}

/** Run a command line through the platform shell, capturing stdout and stderr interleaved. */
export function runShell(command: string, timeoutMs: number): Promise<ShellResult> {
  const started = Date.now();
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd: REPO_ROOT,
      shell: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code, output, timedOut, durationMs: Date.now() - started });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: null, output: output + String(err), timedOut, durationMs: Date.now() - started });
    });
  });
}
