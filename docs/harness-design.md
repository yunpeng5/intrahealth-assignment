# Harness design

The design of the harness core: the ticket runner and review bot that every ticket from T1
onwards goes through.

The harness core is bootstrapped: a coding agent builds it in an interactive session from this
document (prompt: [process/harness-build-prompt.md](process/harness-build-prompt.md)), and the
implementation is reviewed before it is merged. It is not built through itself. T1 is the first
ticket run through the finished harness.

**Maintaining this document.** This is the implementation contract and stays part of the design
record. Any intentional change to the harness design updates this document in the same PR as
the implementation. How to *use* the harness is described in `harness/README.md`.

## Goals and non-goals

**Goals**
- One command takes a GitHub Issue to a reviewed PR.
- Deterministic gates decide pass or fail, not the agent.
- Failures are fed back to the agent, with stop rules so a stuck agent ends.
- A fresh-context review bot reviews every PR against the requirements.
- Each run leaves a small committed record: inputs, metrics, review.

**Non-goals:** dashboards, OpenTelemetry, parallel tickets or worktrees, CI triggers,
deterministic replay, a separate replay command.

## Layout

```
harness/
  package.json            scripts: ticket, review, metrics, test, typecheck
  config.json             models, limits (below)
  protected-paths.txt     protected invariant test files (D-13)
  prompts/
    maker.md              maker instructions, wrapped around the ticket
    feedback.md           template for gate/review failure feedback
    reviewer.md           review bot instructions, checklist, output schema
  src/
    run-ticket.ts         orchestration
    ticket.ts             fetch and parse an Issue or a ticket file
    claude.ts             spawn `claude -p`, stream the transcript, extract result/metrics
    gates.ts              scope check, protected-path check, acceptance commands
    review.ts             review bot: gather inputs, run, validate, render, post
    metrics.ts            aggregate run records into a markdown table
    git.ts / gh.ts        thin wrappers
    proc.ts / config.ts   process helpers (run, shell with timeout, kill tree); paths and config
  test/                   node:test unit tests: ticket parsing, failure signature, review validation
  runs/<run-id>/          one directory per run (see "Run record")
  README.md               how to use the harness
```

Node 24 with TypeScript. No build step: Node's built-in type stripping runs the `.ts` files
directly (so only erasable syntax: no enums or parameter properties). `tsc --noEmit` for
typechecking. The only dependencies are `typescript` and `@types/node`, as dev dependencies.

## config.json

```json
{
  "makerModel": "claude-opus-5-5",
  "reviewerModel": "claude-fable-5-1",
  "maxAttempts": 3,
  "maxTurnsPerCall": 60,
  "callTimeoutMinutes": 20,
  "reviewRevisionRounds": 1,
  "feedbackTailLines": 150
}
```

The reviewer uses a different model from the maker, in a fresh context. That separation is
the point; the reviewer is not required to be the stronger model. The model identifiers must be
confirmed to work with the installed `claude` CLI during the scratch runs, not assumed.

## Commands

The harness is a self-contained package with its own `package.json`, run from the repo root
with `--prefix`. It does not depend on the root `package.json`, which T1 creates.

```sh
npm --prefix harness install                                # once
npm --prefix harness run ticket -- <issue-number>           # full run
npm --prefix harness run ticket -- --ticket-file <path>     # same, from a saved ticket snapshot (re-run)
npm --prefix harness run review -- <pr-number | branch>     # review bot only (re-review, calibration branches)
npm --prefix harness run metrics                            # summary table across committed run records
```

Paths given to and reported by the harness are relative to the repo root, not `harness/`.

`ticket` also accepts `--base <branch>` (default `main`): preflight and the PR then use that
branch instead of `main`. It exists so the harness can be tested from its own unmerged branch;
tickets run from `main`.

A ticket file is the issue body under a small header (`issue:` optional, `title:` required),
the same format the harness writes as `ticket.md`. The `T<n>` in branch names, run IDs and
commit messages comes from the title's `T<n>:` prefix, falling back to the issue number. A
ticket file without `issue:` produces a PR without `Closes #<n>` (scratch tickets).

## run-ticket flow

1. **Preflight.** Stop with a clear message if any of these fail:
   - `git`, `gh`, `claude`, `node` and `dotnet` are on PATH.
   - `ANTHROPIC_API_KEY` is set.
   - `gh` is authenticated.
   - The working tree is clean, on `main`, and fast-forwarded to `origin/main`.
2. **Load the ticket.** Use `gh issue view <n> --json number,title,body`, or the ticket file.
   Parse these sections:
   - "Acceptance commands" (the `sh` block)
   - "Allowed paths" (bullet globs)
   - "Pending tests to promote"
   - "Protected test changes"

   If a required section is missing, stop: that's a ticket error, not an agent error.
3. **Set up.**
   - Create branch `ticket/T<n>-<slug>` from `main`.
   - Run ID: `T<n>-<UTC timestamp>`.
   - Record the base SHA. The harness SHA is the same commit.
   - Save the ticket snapshot.
4. **Maker call.**
   - Prompt: `prompts/maker.md` with the ticket body inserted. `CLAUDE.md` is loaded by
     Claude Code automatically, so it isn't pasted in.
   - Invocation: `claude -p` with `--model`, `--max-turns`, streamed JSON output, a permission
     mode that allows file edits, and allowed tools limited to:
     - read, search and edit tools
     - `npm`, `npx`, `dotnet`, `node`
     - read-only `git` commands (`git status`, `git diff`)
   - Denied: `git commit`, `git push`, `gh`, network fetches. The harness owns git and GitHub.
     Also denied: edits to `.claude/**` and `.mcp.json` (`Edit(...)`/`Write(...)` rules), and
     no MCP servers are loaded (`--strict-mcp-config` with no `--mcp-config`), so the maker
     cannot change its own permissions, hooks or tools. This is workflow containment, not a
     security boundary: allowed `node`/`npm`/`npx` execution can get around it.
   - The harness enforces a wall-clock timeout by killing the process.
   - Exact flag names are checked against `claude --help`, not assumed.
   - As built (CLI 2.1.290): `claude -p --output-format stream-json --verbose --model <m>
     --max-turns <n> --permission-mode acceptEdits --permission-prompts none
     --setting-sources project --strict-mcp-config --tools Read,Edit,Write,Glob,Grep,Bash
     --allowedTools ...
     --disallowedTools ...`, with the prompt on stdin. `--max-turns` is not listed in
     `claude --help` but is accepted and enforced (result subtype `error_max_turns`).
     `--tools` removes every other built-in tool (including PowerShell and web tools).
     `--permission-prompts none` denies anything not allowed instead of asking.
     `--setting-sources project` loads `CLAUDE.md` and `.claude/settings.json` but not
     per-user settings; with no sources at all, `CLAUDE.md` is not loaded. The prompt goes on
     stdin because `--allowedTools` is variadic and would swallow a positional prompt.
   - After each maker call the harness checks that HEAD and the branch are unchanged; if the
     maker managed to commit or switch branches, the run stops with `maker-error`.
5. **Gates**, run by the harness in this order. Stop at the first failure.
   1. Scope: every changed or untracked file matches an allowed glob. `harness/runs/**` is
      ignored.
   2. Protected paths: no changes under `protected-paths.txt` unless the ticket's
      "Protected test changes" section lists them (it accepts globs; tickets use exact paths).
      The gate authorizes whole files, not specific edits: whether an authorized change is
      only what the ticket intends (for example removing a `Pending` trait) is checked by the
      review bot and the human merge review (D-13).
   3. Acceptance commands, in order, through the platform shell, with exit codes checked.
      Each non-empty, non-comment line of the `sh` block is one command. Each command is
      killed (with its process tree) after `callTimeoutMinutes`.
   4. Scope and protected paths again, because acceptance commands can create files and
      everything left in the tree is committed.
6. **Retry.** On a gate failure:
   - Build feedback from `prompts/feedback.md`: which gate, the command, the last N lines of
     output, and what to do. For a scope failure, the feedback is "revert changes to X".
     If the maker call before it ended with anything other than `success` (`timeout`,
     `error_max_turns`, ...), the feedback says the maker was cut off and must finish the work
     and re-summarize.
   - Resume the same maker session (`--resume <session-id>`) and send the feedback into it. The
     maker keeps its context; only the reviewer needs fresh context.
   - **Stop** when attempts reach `maxAttempts`, or when the failure signature (gate + hash of
     the normalized first error lines) repeats from the previous attempt (`no-progress`).
   - On stop, write the run record. Leave the branch unpushed for a human to inspect. The
     maker's changes and the record stay uncommitted in the working tree.
   - The failure signature for scope and protected-path failures is the list of offending
     files. For acceptance failures it is the failing command plus its first five error-like
     lines, normalized (lowercase; timings, timestamps, hashes and temp paths removed).
7. **Open the PR.** On a gate pass:
   - Commit the changes as `T<n>: <title>` and push.
   - `gh pr create` with a body containing: `Closes #<n>`, the agent's summary, the gate
     results, and the attempt count.
8. **Review** (see "Review bot").
   - If the verdict is `request-changes` and revision rounds remain, feed the blocking findings
     back to the maker (resume), re-run the gates, push, and re-review. The revision gets its
     own gate-retry loop with a fresh `maxAttempts` budget. If that loop stops, the revision is
     not pushed and the run ends with `revision-max-attempts`, `revision-no-progress` or
     `revision-maker-error`.
   - After that, stop either way. A human decides.
   - Stop reasons: `approved`, `changes-requested`, `max-attempts`, `no-progress`,
     `maker-error`, `review-invalid`, `revision-max-attempts`, `revision-no-progress`,
     `revision-maker-error`, `error`.
9. **Write the run record.**
   - Write the committed files (below) and commit them to the PR branch as
     `T<n>: run record`.
   - The human merges the PR. That merge is the approval step.

## Review bot

- **Inputs:**
  - the PR diff, from `gh pr diff` or `git diff <base>...<branch>`
  - the ticket body
  - `docs/requirements.md`, `docs/decisions.md`, `CLAUDE.md`
  - the gate results
  - `protected-paths.txt`
- **Invocation:** a separate `claude -p` with fresh context, `reviewerModel`, and read-only
  tools only (read and search, no shell, no edits), so it can open files beyond the diff.
  As built: `--tools Read,Glob,Grep --permission-mode dontAsk --json-schema <review schema>`,
  same settings sources as the maker. Requirements and decisions are pasted into the prompt;
  `CLAUDE.md` is loaded automatically. The diff excludes `harness/runs/` and every
  `package-lock.json`, at the root and in subdirectories (they still appear in the diff
  stat). It is cut at 300,000 characters with a note telling the reviewer to read the rest
  directly; a cut is also stated under the header of the rendered review and recorded per
  round in `run.json` (`reviewDiffTruncated`).
- **Standalone `review`:** needs a clean tree; checks out the PR (`gh pr checkout`) or branch,
  reviews it against `origin/<base>`, posts to the PR if there is one (unless `--no-post`), and
  switches back. The ticket comes from `--ticket-file` or `Closes #<n>` in the PR body. Output
  goes to `harness/runs/review-<ref>-<stamp>/`, which is gitignored: it is not a ticket run.
- **What it checks:**
  1. Every requirement and decision ID the ticket cites: met, not met, or not applicable, with
     evidence.
  2. **Always** the global invariants (T-1, T-2, D-1, D-7, D-8), whatever the ticket says.
     Each gets a status in `requirements`; `n/a` with a reason is valid when the code it
     constrains doesn't exist yet (for example, no questionnaire endpoints in T1).
  3. Scope: any change that doesn't trace back to the ticket is a finding (invented
     requirement or tangent). The bot must **not** propose features or polish beyond the
     requirements (S-1).
  4. Protected tests: unauthorized changes are blocking.
  5. Which requirement section is in force (D-14): section 3 behaviour without an
     authorizing ticket is a finding.
  6. Test quality: do the tests assert the behaviour, and could they fail?
  7. Correctness, then maintainability.
- **Output:** JSON validated by the harness. Invalid output gets one retry; if it is still
  invalid, the run stops with `review-invalid`.

  ```json
  {
    "verdict": "approve | request-changes",
    "requirements": [{ "id": "2.4", "status": "met | not-met | n/a", "evidence": "..." }],
    "findings": [{
      "severity": "blocking | should-fix | nit",
      "category": "requirement | invariant | scope | protected | tests | correctness | quality",
      "file": "path", "line": 0,
      "requirement": "D-8",
      "summary": "...", "evidence": "...", "suggestion": "..."
    }]
  }
  ```

  Rule: `verdict` is `request-changes` if and only if there is at least one blocking finding.

  The CLI enforces the shape through `--json-schema` (the result arrives as
  `structured_output`). The harness validates it again, including the verdict rule and that
  every global invariant has an entry in `requirements`. On failure it resumes the reviewer
  session once with the list of problems.
- **Publishing:**
  - Render to `review-<round>.md`.
  - Post it with `gh pr comment`. GitHub doesn't let you "request changes" on your own PR.
  - Save `review-<round>.json` and `review-<round>.md` in the run record.
- The reviewer prompt lives only in `harness/prompts/reviewer.md`.

## Run record

| File | Committed | Contents |
|---|---|---|
| `ticket.md` | yes | ticket snapshot as run |
| `run.json` | yes | run ID, issue, base SHA, harness SHA, models, config, rendered maker prompt, attempts, per-call metrics, stop reason, PR URL |
| `feedback-<k>.md` | yes | feedback sent on retry or revision k |
| `gates.json` | yes | gate results per attempt, failure excerpts (truncated) |
| `review-<round>.json`, `review-<round>.md` | yes | review bot output, per review round |
| `notes.md` | yes | human notes: interventions, corrections (filled in by hand) |
| `trace.txt` | yes, best-effort | one line per tool call (`#12 Edit backend/...`), from the transcript |
| `transcript-*.jsonl`, `gates-raw/` | **no** (gitignored) | full transcripts and raw command output, for debugging |

**Metrics.** Required, per call from the `claude` result event and summed per run:
- cost (USD), turns, duration, tokens including cache reads
- attempts, review rounds, number of blocking findings
- diff stats

Best-effort, only if cheap to extract from the transcript: `trace.txt`, tool calls by type,
and the turn of the first edit. These must not add significant complexity. As built, all three
are recorded; "turn of the first edit" is the index of the first Edit or Write tool call in the
run's trace (`firstEditToolCall`).

The CLI's `total_cost_usd` is cumulative per session, including across `--resume`, while
`usage` and `num_turns` cover only the current invocation. The harness therefore records each
call's cost as the difference from the session's previous total.

`npm run metrics` renders the table for INTERVIEW.md. The main comparison is T1 vs T2.

## Repository changes made with the harness

- **`.gitignore`:** transcripts, raw gate output, standalone review output
  (`harness/runs/review-*/`) and `harness/node_modules/`.
- **`.gitattributes`:** `* text=auto eol=lf`, so line endings stay stable on Windows.
- **`.claude/settings.json`:** permissions for interactive work in the repo: allows `npm`,
  `npx`, `dotnet`, `node` and read-only git (`status`, `diff`). Harness agent calls load
  it too, so it must not allow anything the maker is denied.

## Order of work

1. `ticket.ts`, `gates.ts`, `claude.ts`: try them on a throwaway ticket file, such as
   "add a line to a scratch file", with a deliberately failing acceptance command to exercise
   the retry and no-progress stops.
2. `run-ticket.ts` end to end, including the PR on a scratch branch. Close the scratch PR and
   delete its branch afterwards.
3. `review.ts`, tried on the scratch PR.
4. `metrics.ts`.
5. Hand back the harness PR for review. T1 runs only after the harness is reviewed and merged.

## Design decisions

- Models: Opus 5.5 maker, Fable 5.1 reviewer. Separation by model and fresh context.
- Retries resume the maker session, bounded by `maxAttempts` and the no-progress stop.
- The maker owns code changes only; the harness owns git, GitHub, gates and state transitions.
- Human approval is the PR merge.
