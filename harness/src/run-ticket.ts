import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addMetrics, runClaude, zeroMetrics, type CallMetrics, type CallResult } from "./claude.ts";
import { fill, loadConfig, readPrompt, REPO_ROOT, repoPath, RUNS_DIR, type Config } from "./config.ts";
import { excerpt, runGates, type GateRun } from "./gates.ts";
import { commentPr, createPr } from "./gh.ts";
import { changedFiles, currentBranch, diffStats, git, headSha, isClean } from "./git.ts";
import { tryRun } from "./proc.ts";
import { blockingFindings, renderReview, ReviewInvalidError, runReview, type Review } from "./review.ts";
import { loadTicket, serializeTicket, TicketError, type Ticket } from "./ticket.ts";

const MAKER_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "Bash"];
const MAKER_ALLOWED = [
  "Read", "Edit", "Write", "Glob", "Grep",
  "Bash(npm *)", "Bash(npx *)", "Bash(dotnet *)", "Bash(node *)",
  "Bash(git status*)", "Bash(git diff*)",
];
const MAKER_DENIED = ["Bash(git commit*)", "Bash(git push*)", "Bash(gh *)", "WebFetch", "WebSearch"];

interface AttemptRecord {
  loop: string;
  attempt: number;
  call: string;
  passed: boolean;
  gate?: string;
  signature?: string;
}

interface CallRecord {
  label: string;
  role: "maker" | "reviewer";
  model: string;
  sessionId: string | null;
  subtype: string;
  metrics: CallMetrics;
  toolCalls: number;
  permissionDenials: number;
}

/** Everything the run accumulates; most of it ends up in run.json. */
class Run {
  calls: CallRecord[] = [];
  attempts: AttemptRecord[] = [];
  gates: (ReturnType<typeof excerpt> & { loop: string; attempt: number })[] = [];
  reviews: Review[] = [];
  reviewDiffTruncated: boolean[] = [];
  trace: string[] = [];
  toolCallsByType: Record<string, number> = {};
  firstEditToolCall: number | null = null;
  feedbackCount = 0;
  makerSession: string | undefined;
  lastSummary = "";
  stopReason = "";
  error: string | undefined;
  prUrl: string | null = null;
  readonly config: Config;
  readonly ticket: Ticket;
  readonly id: string;
  readonly dir: string;
  readonly base: string;
  readonly baseBranch: string;
  readonly makerPrompt: string;

  constructor(o: {
    config: Config; ticket: Ticket; id: string; dir: string; base: string; baseBranch: string; makerPrompt: string;
  }) {
    this.config = o.config;
    this.ticket = o.ticket;
    this.id = o.id;
    this.dir = o.dir;
    this.base = o.base;
    this.baseBranch = o.baseBranch;
    this.makerPrompt = o.makerPrompt;
  }

  addCall(role: "maker" | "reviewer", c: CallResult): void {
    this.calls.push({
      label: c.label, role, model: c.model, sessionId: c.sessionId, subtype: c.subtype,
      metrics: c.metrics, toolCalls: c.toolCalls.length, permissionDenials: c.permissionDenials,
    });
    for (const t of c.toolCalls) {
      this.trace.push(`#${this.trace.length + 1} [${c.label}] ${t.name} ${t.target}`);
      this.toolCallsByType[t.name] = (this.toolCallsByType[t.name] ?? 0) + 1;
      if (this.firstEditToolCall === null && role === "maker" && ["Edit", "Write"].includes(t.name)) {
        this.firstEditToolCall = this.trace.length;
      }
    }
  }

  writeFeedback(text: string): void {
    this.feedbackCount++;
    writeFileSync(resolve(this.dir, `feedback-${this.feedbackCount}.md`), text);
  }
}

const log = (msg: string) => console.log(`[harness] ${msg}`);

function preflight(baseBranch: string): void {
  const problems: string[] = [];
  for (const tool of ["git", "gh", "claude", "node", "dotnet"]) {
    if (tryRun(tool, ["--version"]) === null) problems.push(`\`${tool}\` is not on PATH`);
  }
  if (!process.env.ANTHROPIC_API_KEY) problems.push("ANTHROPIC_API_KEY is not set");
  if (tryRun("gh", ["auth", "status"]) === null) problems.push("gh is not authenticated (run `gh auth login`)");
  if (problems.length === 0) {
    if (!isClean()) problems.push("the working tree is not clean");
    const remote = `origin/${baseBranch}`;
    if (currentBranch() !== baseBranch) problems.push(`not on ${baseBranch} (on ${currentBranch()})`);
    if (tryRun("git", ["fetch", "origin", baseBranch]) === null) problems.push(`could not fetch ${remote}`);
    else if (headSha() !== git("rev-parse", remote)) problems.push(`${baseBranch} is not at ${remote} (pull or push first)`);
  }
  if (problems.length) throw new Error(`preflight failed:\n- ${problems.join("\n- ")}`);
}

async function callMaker(r: Run, label: string, prompt: string): Promise<CallResult> {
  log(`${label}: calling ${r.config.makerModel}${r.makerSession ? ` (resume ${r.makerSession})` : ""}`);
  const c = await runClaude({
    label,
    prompt,
    resume: r.makerSession,
    model: r.config.makerModel,
    maxTurns: r.config.maxTurnsPerCall,
    timeoutMs: r.config.callTimeoutMinutes * 60_000,
    tools: MAKER_TOOLS,
    allowedTools: MAKER_ALLOWED,
    disallowedTools: MAKER_DENIED,
    permissionMode: "acceptEdits",
    transcriptPath: resolve(r.dir, `transcript-${label}.jsonl`),
  });
  r.addCall("maker", c);
  if (c.sessionId) r.makerSession = c.sessionId;
  if (c.result && !c.isError) r.lastSummary = c.result;
  log(`${label}: ${c.subtype}, ${c.metrics.turns} turns, $${c.metrics.costUsd.toFixed(2)}`);
  return c;
}

function gateFeedback(r: Run, g: GateRun, attempt: number): string {
  const f = g.failure!;
  const heading = `Gate failed: ${f.gate} (attempt ${attempt} of ${r.config.maxAttempts})`;
  const list = (xs: string[]) => xs.map((x) => `- \`${x}\``).join("\n");
  if (f.gate === "acceptance") {
    const cmd = f.commands!.at(-1)!;
    return fill(readPrompt("feedback.md"), {
      heading,
      details:
        `\`${f.failedCommand}\` ${cmd.timedOut ? "timed out" : `exited ${cmd.exitCode}`}. ` +
        `Last ${r.config.feedbackTailLines} lines of its output:\n\n\`\`\`\n${f.tail}\n\`\`\``,
      instruction: "Find the cause and fix it. Do not weaken, skip or delete tests to make the command pass.",
    });
  }
  const what = f.gate === "scope" ? "outside the ticket's allowed paths" : "protected, and the ticket does not authorize changing them";
  return fill(readPrompt("feedback.md"), {
    heading,
    details: `These files are ${what}:\n\n${list(f.files!)}\n\nAllowed paths:\n\n${list(r.ticket.allowedPaths)}`,
    instruction: `Revert your changes to ${f.files!.map((x) => `\`${x}\``).join(", ")}. Delete any of them you created.`,
  });
}

/**
 * Maker call, gates, and retries with feedback in the same session until the gates pass or a stop
 * rule fires. Returns the stop reason, or null when the gates passed.
 */
async function makeUntilGreen(r: Run, loop: string, firstPrompt: string): Promise<string | null> {
  const expectedHead = headSha();
  let prompt = firstPrompt;
  let previous: string | undefined;
  for (let attempt = 1; ; attempt++) {
    const label = `maker-${loop}-${attempt}`;
    const call = await callMaker(r, label, prompt);
    if (!call.sessionId) {
      r.error = call.result;
      return "maker-error";
    }
    if (headSha() !== expectedHead || currentBranch() !== `ticket/${branchName(r.ticket)}`) {
      r.error = "the maker moved HEAD or switched branches";
      return "maker-error";
    }

    log(`${label}: running gates`);
    const g = await runGates({
      ticket: r.ticket,
      base: r.base,
      rawDir: resolve(r.dir, "gates-raw", `${loop}-${attempt}`),
      timeoutMs: r.config.callTimeoutMinutes * 60_000,
      tailLines: r.config.feedbackTailLines,
    });
    r.gates.push({ loop, attempt, ...excerpt(g) });
    r.attempts.push({ loop, attempt, call: label, passed: g.passed, gate: g.failure?.gate, signature: g.signature });
    if (g.passed) {
      log(`${label}: gates passed`);
      return null;
    }
    log(`${label}: ${g.failure!.gate} gate failed (${g.signature})`);
    if (g.signature === previous) return "no-progress";
    if (attempt >= r.config.maxAttempts) return "max-attempts";
    previous = g.signature;
    prompt = gateFeedback(r, g, attempt);
    r.writeFeedback(prompt);
  }
}

function branchName(t: Ticket): string {
  const slug = t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "");
  return `${t.id}-${slug}`;
}

function gatesSummary(r: Run): string {
  const rows = r.gates.map((g) => {
    const last = g.results.at(-1)!;
    let detail: string;
    if (g.passed) {
      const acc = g.results.find((x) => x.gate === "acceptance");
      detail = `scope, protected paths and ${acc?.commands?.length ?? 0} acceptance command(s) passed`;
    } else if (last.gate === "acceptance") {
      const c = last.commands!.at(-1)!;
      detail = `\`${c.command}\` ${c.timedOut ? "timed out" : `exited ${c.exitCode}`}`;
    } else {
      detail = last.files!.map((f) => `\`${f}\``).join(", ");
    }
    return `| ${g.loop} | ${g.attempt} | ${g.passed ? "passed" : `failed: ${last.gate}`} | ${detail} |`;
  });
  return ["| Loop | Attempt | Result | Detail |", "|---|---|---|---|", ...rows].join("\n");
}

function commitAndPush(message: string): void {
  git("add", "-A", "--", ".", ":(exclude)harness/runs");
  git("commit", "-m", message);
  git("push", "-u", "origin", "HEAD");
}

function openPr(r: Run): string {
  const t = r.ticket;
  const body = [
    ...(t.issue !== null ? [`Closes #${t.issue}\n`] : []),
    "## Agent summary\n",
    r.lastSummary.trim() || "_The maker returned no summary._",
    "\n## Gates\n",
    gatesSummary(r),
    `\nAttempts: ${r.attempts.length}. Run ID: \`${r.id}\`.`,
  ].join("\n");
  const file = join(mkdtempSync(join(tmpdir(), "harness-")), "pr-body.md");
  writeFileSync(file, body);
  return createPr(`${t.id}: ${t.title}`, file, r.baseBranch);
}

async function reviewLoop(r: Run): Promise<string> {
  for (let round = 1; ; round++) {
    log(`review round ${round}: calling ${r.config.reviewerModel}`);
    let result;
    try {
      result = await runReview({
        config: r.config,
        ticketText: serializeTicket(r.ticket),
        gatesSummary: gatesSummary(r),
        base: r.base,
        label: `review-${round}`,
        transcriptPath: resolve(r.dir, `transcript-review-${round}.jsonl`),
      });
    } catch (err) {
      for (const c of (err as { calls?: CallResult[] }).calls ?? []) r.addCall("reviewer", c);
      if (err instanceof ReviewInvalidError) {
        r.error = err.message;
        return "review-invalid";
      }
      throw err;
    }
    for (const c of result.calls) r.addCall("reviewer", c);
    const review = result.review;
    r.reviews.push(review);
    r.reviewDiffTruncated.push(result.diffTruncated);
    const md = renderReview(review, { round, model: r.config.reviewerModel, diffTruncated: result.diffTruncated });
    writeFileSync(resolve(r.dir, `review-${round}.json`), JSON.stringify(review, null, 2) + "\n");
    writeFileSync(resolve(r.dir, `review-${round}.md`), md);
    commentPr(r.prUrl!, resolve(r.dir, `review-${round}.md`));
    const blocking = blockingFindings(review);
    log(`review round ${round}: ${review.verdict} (${blocking.length} blocking)`);

    if (review.verdict === "approve") return "approved";
    if (round > r.config.reviewRevisionRounds) return "changes-requested";

    const items = blocking.map((f) =>
      `- **${f.file}${f.line ? `:${f.line}` : ""}** (${f.category}${f.requirement ? `, ${f.requirement}` : ""}): ${f.summary}\n` +
      `  - Evidence: ${f.evidence}\n  - Suggestion: ${f.suggestion}`,
    );
    const feedback = fill(readPrompt("feedback.md"), {
      heading: `Review: changes requested (round ${round})`,
      details: `The review bot found these blocking problems:\n\n${items.join("\n")}`,
      instruction: "Fix each blocking finding. Change nothing else.",
    });
    r.writeFeedback(feedback);
    const stop = await makeUntilGreen(r, `revision${round}`, feedback);
    if (stop) return `revision-${stop}`;
    commitAndPush(`${r.ticket.id}: address review round ${round}`);
  }
}

function writeRecord(r: Run, startedAt: string): void {
  const totals = r.calls.reduce((s, c) => addMetrics(s, c.metrics), zeroMetrics());
  const byRole = (role: string) => r.calls.filter((c) => c.role === role).reduce((s, c) => addMetrics(s, c.metrics), zeroMetrics());
  const record = {
    runId: r.id,
    ticket: { issue: r.ticket.issue, id: r.ticket.id, title: r.ticket.title },
    branch: `ticket/${branchName(r.ticket)}`,
    baseSha: r.base,
    harnessSha: r.base,
    startedAt,
    finishedAt: new Date().toISOString(),
    models: { maker: r.config.makerModel, reviewer: r.config.reviewerModel },
    config: r.config,
    parsed: {
      acceptance: r.ticket.acceptance,
      allowedPaths: r.ticket.allowedPaths,
      pendingTests: r.ticket.pendingTests,
      protectedChanges: r.ticket.protectedChanges,
    },
    makerPrompt: r.makerPrompt,
    stopReason: r.stopReason,
    error: r.error,
    prUrl: r.prUrl,
    attempts: r.attempts,
    reviewRounds: r.reviews.length,
    blockingFindings: r.reviews.map((rv) => blockingFindings(rv).length),
    reviewDiffTruncated: r.reviewDiffTruncated,
    diffStats: r.prUrl ? diffStats(r.base) : { files: changedFiles(r.base).filter((f) => !f.startsWith("harness/runs/")).length },
    metrics: { total: totals, maker: byRole("maker"), reviewer: byRole("reviewer") },
    toolCallsByType: r.toolCallsByType,
    firstEditToolCall: r.firstEditToolCall,
    calls: r.calls,
  };
  const write = (name: string, text: string) => writeFileSync(resolve(r.dir, name), text);
  write("run.json", JSON.stringify(record, null, 2) + "\n");
  write("gates.json", JSON.stringify(r.gates, null, 2) + "\n");
  write("trace.txt", r.trace.join("\n") + "\n");
  write("notes.md", `# ${r.id} notes\n\nHuman notes: interventions, corrections, observations.\n\n- \n`);
}

function parseArgs(argv: string[]): { source: { issue: number } | { file: string }; baseBranch: string } {
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv.splice(i, 2)[1];
  };
  // --base exists to test the harness from a branch before it is merged. Tickets use main.
  const baseBranch = opt("--base") ?? "main";
  const file = opt("--ticket-file");
  if (file) return { source: { file: resolve(REPO_ROOT, file) }, baseBranch };
  const n = Number(argv.find((a) => /^\d+$/.test(a)));
  if (Number.isInteger(n) && n > 0) return { source: { issue: n }, baseBranch };
  throw new Error("usage: npm run ticket -- <issue-number> | --ticket-file <path> [--base <branch>]");
}

async function main(): Promise<number> {
  const { source, baseBranch } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  preflight(baseBranch);

  let ticket: Ticket;
  try {
    ticket = loadTicket(source);
  } catch (err) {
    if (err instanceof TicketError) {
      console.error(`Ticket error (fix the ticket, not the agent): ${err.message}`);
      return 2;
    }
    throw err;
  }

  const startedAt = new Date().toISOString();
  const stamp = startedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const id = `${ticket.id}-${stamp}`;
  const base = headSha();
  const branch = `ticket/${branchName(ticket)}`;
  git("checkout", "-b", branch);
  const dir = resolve(RUNS_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "ticket.md"), serializeTicket(ticket));
  const makerPrompt = fill(readPrompt("maker.md"), {
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    ticketBody: ticket.body.trim(),
    maxAttempts: String(config.maxAttempts),
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  const r = new Run({ config, ticket, id, dir, base, baseBranch, makerPrompt });
  log(`run ${id} on ${branch} (base ${base.slice(0, 7)}), record in ${repoPath(dir)}`);

  try {
    const stop = await makeUntilGreen(r, "initial", makerPrompt);
    if (stop) {
      r.stopReason = stop;
    } else {
      commitAndPush(`${ticket.id}: ${ticket.title}`);
      r.prUrl = openPr(r);
      log(`opened ${r.prUrl}`);
      r.stopReason = await reviewLoop(r);
    }
  } catch (err) {
    r.stopReason = "error";
    r.error = (err as Error).stack ?? String(err);
  }

  writeRecord(r, startedAt);
  if (r.prUrl) {
    git("add", "--", repoPath(dir));
    git("commit", "-m", `${ticket.id}: run record`);
    git("push");
    log(`run record committed to ${branch}`);
  } else {
    log(`stopped before a PR; branch ${branch} left unpushed with the record in ${repoPath(dir)}`);
  }
  log(`stop reason: ${r.stopReason}${r.error ? `\n${r.error}` : ""}`);
  const cost = r.calls.reduce((s, c) => s + c.metrics.costUsd, 0);
  log(`attempts ${r.attempts.length}, review rounds ${r.reviews.length}, cost $${cost.toFixed(2)}`);
  return r.prUrl ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`run-ticket: ${err.message}`);
    process.exit(1);
  },
);
