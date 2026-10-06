import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { HARNESS_DIR, repoPath } from "./config.ts";
import { changedFiles } from "./git.ts";
import { runShell } from "./proc.ts";
import type { Ticket } from "./ticket.ts";

export type GateName = "scope" | "protected" | "acceptance";

export interface GateResult {
  gate: GateName;
  passed: boolean;
  /** Out-of-scope or protected files, for those gates. */
  files?: string[];
  /** Acceptance gate only. */
  commands?: { command: string; exitCode: number | null; timedOut: boolean; durationMs: number; log: string }[];
  /** Failing acceptance command and the tail of its output. */
  failedCommand?: string;
  tail?: string;
}

export interface GateRun {
  passed: boolean;
  results: GateResult[];
  failure?: GateResult;
  /** Gate + hash of the normalized first error lines; equal signatures mean no progress. */
  signature?: string;
}

const IGNORED = "harness/runs/**";
const EXCERPT_LINES = 60;

const matches = (file: string, pattern: string) =>
  posix.matchesGlob(file, pattern) || file === pattern || file.startsWith(pattern.replace(/\/+$/, "") + "/");

export function protectedPatterns(): string[] {
  return readFileSync(resolve(HARNESS_DIR, "protected-paths.txt"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function scopeGate(ticket: Ticket, files: string[]): GateResult {
  const bad = files.filter((f) => !ticket.allowedPaths.some((p) => matches(f, p)));
  return { gate: "scope", passed: bad.length === 0, files: bad };
}

function protectedGate(ticket: Ticket, files: string[]): GateResult {
  const patterns = protectedPatterns();
  const bad = files.filter(
    (f) => patterns.some((p) => matches(f, p)) && !ticket.protectedChanges.some((p) => matches(f, p)),
  );
  return { gate: "protected", passed: bad.length === 0, files: bad };
}

/**
 * Run the gates in order, stopping at the first failure: scope, protected paths, acceptance
 * commands. Scope and protected paths are checked again after the acceptance commands, since
 * those commands can create files too and everything left in the tree gets committed.
 */
export async function runGates(opts: {
  ticket: Ticket;
  base: string;
  rawDir: string;
  timeoutMs: number;
  tailLines: number;
}): Promise<GateRun> {
  const results: GateResult[] = [];
  const fail = (r: GateResult): GateRun => ({ passed: false, results, failure: r, signature: signature(r) });

  const fileGates = (): GateResult | undefined => {
    const files = changedFiles(opts.base).filter((f) => !posix.matchesGlob(f, IGNORED));
    for (const r of [scopeGate(opts.ticket, files), protectedGate(opts.ticket, files)]) {
      results.push(r);
      if (!r.passed) return r;
    }
  };

  const early = fileGates();
  if (early) return fail(early);

  mkdirSync(opts.rawDir, { recursive: true });
  const acceptance: GateResult = { gate: "acceptance", passed: true, commands: [] };
  results.push(acceptance);
  for (const [i, command] of opts.ticket.acceptance.entries()) {
    console.log(`[gate] $ ${command}`);
    const r = await runShell(command, opts.timeoutMs);
    const log = resolve(opts.rawDir, `cmd-${i + 1}.log`);
    writeFileSync(log, `$ ${command}\n${r.output}\n[exit ${r.exitCode}${r.timedOut ? ", timed out" : ""}]\n`);
    acceptance.commands!.push({ command, exitCode: r.exitCode, timedOut: r.timedOut, durationMs: r.durationMs, log: repoPath(log) });
    if (r.exitCode !== 0 || r.timedOut) {
      acceptance.passed = false;
      acceptance.failedCommand = command;
      acceptance.tail = tail(r.output, opts.tailLines) + (r.timedOut ? `\n[timed out after ${opts.timeoutMs / 60000} min]` : "");
      return fail(acceptance);
    }
  }

  const late = fileGates();
  if (late) return fail(late);
  return { passed: true, results };
}

export function tail(text: string, lines: number): string {
  return text.replace(/\r\n/g, "\n").trimEnd().split("\n").slice(-lines).join("\n");
}

/** A gate run for gates.json: output tails cut down; the failure, if any, is the last result. */
export function excerpt(run: GateRun): Omit<GateRun, "failure"> {
  const cut = (r: GateResult): GateResult => (r.tail ? { ...r, tail: tail(r.tail, EXCERPT_LINES) } : r);
  return { passed: run.passed, signature: run.signature, results: run.results.map(cut) };
}

function signature(r: GateResult): string {
  let key: string;
  if (r.gate !== "acceptance") {
    key = (r.files ?? []).join("\n");
  } else {
    const lines = (r.tail ?? "").split("\n").map(normalize).filter(Boolean);
    const errors = lines.filter((l) => /error|fail|exception|cannot|not found|expected/.test(l));
    key = `${r.failedCommand}\n${(errors.length ? errors : lines).slice(0, 5).join("\n")}`;
  }
  return `${r.gate}:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

/** Drop what varies between identical failures: timings, timestamps, hashes, temp paths. */
function normalize(line: string): string {
  return line
    .toLowerCase()
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\d{4}-\d\d-\d\dt?[\d:.]*z?/g, "<time>")
    .replace(/\b\d+(\.\d+)?\s*(ms|s|sec|seconds|m|min)\b/g, "<dur>")
    .replace(/\b[0-9a-f]{7,}\b/g, "<hex>")
    .replace(/[a-z]:\\[^\s]*|\/tmp\/[^\s]*/g, "<path>")
    .replace(/\s+/g, " ")
    .trim();
}
