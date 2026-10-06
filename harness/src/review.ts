import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude, type CallResult } from "./claude.ts";
import { fill, loadConfig, readPrompt, REPO_ROOT, RUNS_DIR, type Config } from "./config.ts";
import { protectedPatterns } from "./gates.ts";
import { commentPr, viewIssue, viewPr, type PrInfo } from "./gh.ts";
import { currentBranch, git, isClean } from "./git.ts";
import { run } from "./proc.ts";

export const INVARIANTS = ["T-1", "T-2", "D-1", "D-7", "D-8"];
const SEVERITIES = ["blocking", "should-fix", "nit"];
const CATEGORIES = ["requirement", "invariant", "scope", "protected", "tests", "correctness", "quality"];
const STATUSES = ["met", "not-met", "n/a"];
const MAX_DIFF_CHARS = 300_000;

export interface Finding {
  severity: string;
  category: string;
  file: string;
  line: number;
  requirement: string;
  summary: string;
  evidence: string;
  suggestion: string;
}

export interface Review {
  verdict: "approve" | "request-changes";
  requirements: { id: string; status: string; evidence: string }[];
  findings: Finding[];
}

const str = { type: "string" };
export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "requirements", "findings"],
  properties: {
    verdict: { type: "string", enum: ["approve", "request-changes"] },
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "evidence"],
        properties: { id: str, status: { type: "string", enum: STATUSES }, evidence: str },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "category", "file", "line", "requirement", "summary", "evidence", "suggestion"],
        properties: {
          severity: { type: "string", enum: SEVERITIES },
          category: { type: "string", enum: CATEGORIES },
          file: str,
          line: { type: "integer" },
          requirement: str,
          summary: str,
          evidence: str,
          suggestion: str,
        },
      },
    },
  },
};

/** The harness's own check of the reviewer's output; returns the problems found. */
export function validateReview(x: any): string[] {
  if (!x || typeof x !== "object") return ["output is not a JSON object"];
  const errors: string[] = [];
  if (!["approve", "request-changes"].includes(x.verdict)) errors.push(`verdict must be approve or request-changes`);
  if (!Array.isArray(x.requirements)) errors.push("requirements must be an array");
  if (!Array.isArray(x.findings)) errors.push("findings must be an array");
  if (errors.length) return errors;
  x.requirements.forEach((r: any, i: number) => {
    if (typeof r?.id !== "string" || !STATUSES.includes(r.status) || typeof r.evidence !== "string") {
      errors.push(`requirements[${i}] needs id, status (${STATUSES.join(" | ")}) and evidence`);
    }
  });
  x.findings.forEach((f: any, i: number) => {
    if (!SEVERITIES.includes(f?.severity)) errors.push(`findings[${i}].severity is invalid`);
    if (!CATEGORIES.includes(f?.category)) errors.push(`findings[${i}].category is invalid`);
    for (const k of ["file", "requirement", "summary", "evidence", "suggestion"]) {
      if (typeof f?.[k] !== "string") errors.push(`findings[${i}].${k} must be a string`);
    }
    if (!Number.isInteger(f?.line)) errors.push(`findings[${i}].line must be an integer`);
  });
  const ids = new Set(x.requirements.map((r: any) => r.id));
  const missing = INVARIANTS.filter((id) => !ids.has(id));
  if (missing.length) errors.push(`requirements is missing the global invariants: ${missing.join(", ")}`);
  const blocking = x.findings.some((f: any) => f.severity === "blocking");
  if (blocking !== (x.verdict === "request-changes")) {
    errors.push("verdict must be request-changes if and only if there is at least one blocking finding");
  }
  return errors;
}

export const blockingFindings = (r: Review) => r.findings.filter((f) => f.severity === "blocking");

export function renderReview(r: Review, meta: { round: number; model: string }): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  const count = (sev: string) => r.findings.filter((f) => f.severity === sev).length;
  const lines = [
    `## Review bot: ${r.verdict === "approve" ? "approve" : "request changes"}`,
    "",
    `Round ${meta.round} · \`${meta.model}\` · ${count("blocking")} blocking, ${count("should-fix")} should-fix, ${count("nit")} nit`,
    "",
    "### Requirements",
    "",
    "| ID | Status | Evidence |",
    "|---|---|---|",
    ...r.requirements.map((q) => `| ${cell(q.id)} | ${q.status} | ${cell(q.evidence)} |`),
    "",
    "### Findings",
    "",
  ];
  if (r.findings.length === 0) lines.push("None.", "");
  for (const sev of SEVERITIES) {
    const group = r.findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`#### ${sev}`, "");
    for (const f of group) {
      const where = f.file ? ` \`${f.file}${f.line ? `:${f.line}` : ""}\`` : "";
      const req = f.requirement ? ` (${f.requirement})` : "";
      lines.push(`- **[${f.category}]**${where}${req}: ${f.summary}`);
      if (f.evidence) lines.push(`  - Evidence: ${f.evidence}`);
      if (f.suggestion) lines.push(`  - Suggestion: ${f.suggestion}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export class ReviewInvalidError extends Error {}

/** Run the review bot on the current checkout (HEAD) against `base`. */
export async function runReview(o: {
  config: Config;
  ticketText: string;
  gatesSummary: string;
  base: string;
  label: string;
  transcriptPath: string;
}): Promise<{ review: Review; calls: CallResult[] }> {
  const range = `${o.base}...HEAD`;
  const noRecords = ":(exclude)harness/runs";
  const diffStat = git("diff", "--stat", range, "--", ".", noRecords);
  let diff = git("diff", range, "--", ".", noRecords, ":(exclude)**/package-lock.json");
  let diffNote = "Lock files (`package-lock.json`) are left out of the diff below; they are in the diff stat.";
  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.slice(0, MAX_DIFF_CHARS);
    diffNote += ` The diff is cut at ${MAX_DIFF_CHARS} characters: read the remaining files directly.`;
  }
  const read = (p: string) => readFileSync(resolve(REPO_ROOT, p), "utf8");
  const prompt = fill(readPrompt("reviewer.md"), {
    ticket: o.ticketText,
    gates: o.gatesSummary,
    protectedPaths: protectedPatterns().join("\n") || "(empty)",
    base: o.base,
    diffStat: diffStat || "(no changes)",
    diffNote,
    diff,
    requirements: read("docs/requirements.md"),
    decisions: read("docs/decisions.md"),
  });

  const call = (prompt: string, resume?: string) =>
    runClaude({
      label: o.label,
      prompt,
      resume,
      model: o.config.reviewerModel,
      maxTurns: o.config.maxTurnsPerCall,
      timeoutMs: o.config.callTimeoutMinutes * 60_000,
      tools: ["Read", "Glob", "Grep"],
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "dontAsk",
      jsonSchema: REVIEW_SCHEMA,
      transcriptPath: o.transcriptPath,
    });

  const calls = [await call(prompt)];
  let errors = validateReview(calls[0].structuredOutput);
  if (errors.length && calls[0].sessionId) {
    console.log(`[review] invalid output, retrying once: ${errors.join("; ")}`);
    const fix = `Your output was rejected:\n${errors.map((e) => `- ${e}`).join("\n")}\n\nReturn the corrected JSON object.`;
    calls.push(await call(fix, calls[0].sessionId));
    errors = validateReview(calls[1].structuredOutput);
  }
  const last = calls[calls.length - 1];
  if (errors.length) {
    throw Object.assign(new ReviewInvalidError(`review output invalid after retry: ${errors.join("; ")} (${last.subtype})`), { calls });
  }
  return { review: last.structuredOutput as Review, calls };
}

/**
 * Standalone: npm run review -- <pr-number | branch> [--ticket-file <path>] [--no-post]
 * Checks out the PR or branch, reviews it against origin/<base>, posts the review to the PR (if
 * there is one) and writes it to harness/runs/review-<ref>-<stamp>/ (gitignored), then returns
 * to the original branch.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ref = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--ticket-file");
  const ticketFileArg = args[args.indexOf("--ticket-file") + 1];
  const ticketFile = args.includes("--ticket-file") ? ticketFileArg : undefined;
  const post = !args.includes("--no-post");
  if (!ref) throw new Error("usage: npm run review -- <pr-number | branch> [--ticket-file <path>] [--no-post]");
  if (!isClean()) throw new Error("working tree is not clean; commit or stash first");

  const config = loadConfig();
  let pr: PrInfo | null = null;
  try {
    pr = viewPr(ref);
  } catch {
    if (/^\d+$/.test(ref)) throw new Error(`no PR #${ref}`);
  }

  let ticketText = "No ticket was found. Review against the requirements, decisions and global invariants.";
  if (ticketFile) {
    ticketText = readFileSync(resolve(REPO_ROOT, ticketFile), "utf8");
  } else {
    const issue = /\bCloses #(\d+)/i.exec(pr?.body ?? "")?.[1];
    if (issue) {
      const i = viewIssue(Number(issue));
      ticketText = `# ${i.title}\n\n${i.body}`;
    }
  }

  const original = currentBranch();
  run("git", ["fetch", "origin"]);
  if (pr) run("gh", ["pr", "checkout", String(pr.number)]);
  else git("checkout", ref);
  try {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const dir = resolve(RUNS_DIR, `review-${(pr ? `pr${pr.number}` : ref).replace(/[^\w.-]+/g, "-")}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    const { review, calls } = await runReview({
      config,
      ticketText,
      gatesSummary: "Not available: this review was run outside the ticket runner.",
      base: `origin/${pr?.baseRefName ?? "main"}`,
      label: "review",
      transcriptPath: resolve(dir, "transcript-review.jsonl"),
    });
    const md = renderReview(review, { round: 1, model: config.reviewerModel });
    writeFileSync(resolve(dir, "review.json"), JSON.stringify(review, null, 2) + "\n");
    writeFileSync(resolve(dir, "review.md"), md);
    if (pr && post) commentPr(String(pr.number), resolve(dir, "review.md"));
    console.log(md);
    const cost = calls.reduce((s, c) => s + c.metrics.costUsd, 0);
    console.log(`\nWritten to ${dir}${pr && post ? `; posted to ${pr.url}` : ""}. Cost $${cost.toFixed(2)}.`);
  } finally {
    git("checkout", original);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`review: ${err.message}`);
    process.exit(1);
  });
}
