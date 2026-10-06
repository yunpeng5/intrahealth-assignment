import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RUNS_DIR } from "./config.ts";

/** npm run metrics: one markdown table row per committed run record (harness/runs/<run-id>/run.json). */
const records = readdirSync(RUNS_DIR)
  .map((d) => resolve(RUNS_DIR, d, "run.json"))
  .filter(existsSync)
  .map((f) => JSON.parse(readFileSync(f, "utf8")))
  .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

if (records.length === 0) {
  console.log("No run records in harness/runs/.");
  process.exit(0);
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : String(n));
const minutes = (ms: number) => `${(ms / 60_000).toFixed(1)}`;

const header = [
  "Run", "Stop", "Attempts", "Review rounds", "Blocking", "Turns", "Duration (min)",
  "Cost (USD)", "Input tok", "Output tok", "Cache read tok", "Diff (files +/-)",
];
const rows = records.map((r) => {
  const m = r.metrics.total;
  const d = r.diffStats ?? {};
  const diff = d.insertions === undefined ? `${d.files ?? "?"}` : `${d.files} +${d.insertions}/-${d.deletions}`;
  return [
    r.runId,
    r.stopReason,
    r.attempts.length,
    r.reviewRounds,
    r.blockingFindings.length ? r.blockingFindings.join(" → ") : "-",
    m.turns,
    minutes(m.durationMs),
    m.costUsd.toFixed(2),
    k(m.inputTokens + m.cacheCreationTokens),
    k(m.outputTokens),
    k(m.cacheReadTokens),
    diff,
  ];
});

console.log(`| ${header.join(" | ")} |`);
console.log(`|${header.map(() => "---").join("|")}|`);
for (const row of rows) console.log(`| ${row.join(" | ")} |`);
console.log("\nInput tok includes cache writes. Duration is the sum of agent call durations, not wall clock.");
