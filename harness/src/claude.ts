import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { isAbsolute } from "node:path";
import { REPO_ROOT, repoPath } from "./config.ts";
import { killTree } from "./proc.ts";

export interface CallMetrics {
  costUsd: number;
  turns: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface ToolCall {
  name: string;
  target: string;
}

export interface CallResult {
  label: string;
  model: string;
  sessionId: string | null;
  /** Result subtype from the CLI: "success", "error_max_turns", ...; "timeout" or "no-result" if none arrived. */
  subtype: string;
  isError: boolean;
  result: string;
  structuredOutput: unknown;
  metrics: CallMetrics;
  toolCalls: ToolCall[];
  permissionDenials: number;
}

export interface CallOptions {
  label: string;
  prompt: string;
  model: string;
  maxTurns: number;
  timeoutMs: number;
  resume?: string;
  tools: string[];
  allowedTools: string[];
  disallowedTools?: string[];
  permissionMode: string;
  jsonSchema?: object;
  transcriptPath: string;
}

/**
 * total_cost_usd in the result event is cumulative for the session, also across --resume, while
 * usage and num_turns cover only the current invocation. Track the last total per session so each
 * call reports its own cost.
 */
const sessionCost = new Map<string, number>();

export const zeroMetrics = (): CallMetrics => ({
  costUsd: 0, turns: 0, durationMs: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
});

export function addMetrics(a: CallMetrics, b: CallMetrics): CallMetrics {
  const out = zeroMetrics();
  for (const k of Object.keys(out) as (keyof CallMetrics)[]) out[k] = a[k] + b[k];
  return out;
}

/** Run `claude -p` with the prompt on stdin, streaming the JSON transcript to a file. */
export function runClaude(o: CallOptions): Promise<CallResult> {
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--model", o.model,
    "--max-turns", String(o.maxTurns),
    "--permission-mode", o.permissionMode,
    "--permission-prompts", "none",
    // CLAUDE.md and the project's .claude/settings.json, but not per-user settings.
    "--setting-sources", "project",
    // Only MCP servers from --mcp-config, which the harness never passes: none.
    "--strict-mcp-config",
    "--tools", o.tools.join(","),
    "--allowedTools", ...o.allowedTools,
  ];
  if (o.disallowedTools?.length) args.push("--disallowedTools", ...o.disallowedTools);
  if (o.resume) args.push("--resume", o.resume);
  if (o.jsonSchema) args.push("--json-schema", JSON.stringify(o.jsonSchema));

  const started = Date.now();
  const out: CallResult = {
    label: o.label,
    model: o.model,
    sessionId: o.resume ?? null,
    subtype: "no-result",
    isError: true,
    result: "",
    structuredOutput: undefined,
    metrics: zeroMetrics(),
    toolCalls: [],
    permissionDenials: 0,
  };

  return new Promise((resolvePromise, reject) => {
    const child = spawn("claude", args, {
      cwd: REPO_ROOT,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const transcript = createWriteStream(o.transcriptPath, { flags: "a" });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, o.timeoutMs);

    child.stderr.on("data", (d) => (stderr += d));
    createInterface({ input: child.stdout }).on("line", (line) => {
      transcript.write(line + "\n");
      let ev: any;
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (ev.session_id) out.sessionId = ev.session_id;
      if (ev.type === "assistant") {
        for (const block of ev.message?.content ?? []) {
          if (block.type !== "tool_use") continue;
          const call = { name: block.name, target: toolTarget(block.input ?? {}) };
          out.toolCalls.push(call);
          console.log(`[${o.label}] #${out.toolCalls.length} ${call.name} ${call.target}`);
        }
      } else if (ev.type === "result") {
        const prev = sessionCost.get(ev.session_id) ?? 0;
        sessionCost.set(ev.session_id, ev.total_cost_usd ?? prev);
        out.subtype = ev.subtype;
        out.isError = Boolean(ev.is_error);
        out.result = ev.result ?? (ev.errors ?? []).join("\n");
        out.structuredOutput = ev.structured_output;
        out.permissionDenials = ev.permission_denials?.length ?? 0;
        const u = ev.usage ?? {};
        out.metrics = {
          costUsd: (ev.total_cost_usd ?? prev) - prev,
          turns: ev.num_turns ?? 0,
          durationMs: ev.duration_ms ?? 0,
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
          cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
        };
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`could not start claude: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      transcript.end();
      if (timedOut) {
        out.subtype = "timeout";
        out.isError = true;
        out.metrics.durationMs = Date.now() - started;
      } else if (out.subtype === "no-result") {
        out.result = `claude exited ${code} without a result event.\n${stderr.trim().split("\n").slice(-20).join("\n")}`;
      }
      resolvePromise(out);
    });

    child.stdin.end(o.prompt);
  });
}

function toolTarget(input: Record<string, unknown>): string {
  const raw = input.file_path ?? input.notebook_path ?? input.command ?? input.pattern ?? input.path ?? input.url ?? "";
  let s = String(raw).split("\n")[0];
  if ((input.file_path || input.notebook_path) && isAbsolute(s)) s = repoPath(s);
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}
