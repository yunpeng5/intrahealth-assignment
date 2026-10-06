# Harness

Takes a ticket (a GitHub Issue) to a reviewed PR with one command. A coding agent (the maker)
changes the code. The harness decides pass or fail with deterministic gates, feeds failures back,
opens the PR, and has a review bot in a fresh context review it. Every run leaves a small
committed record. The design and its rationale are in
[../docs/harness-design.md](../docs/harness-design.md).

## Requirements

- Node 24, `git`, `gh` (authenticated), `claude` and `dotnet` on PATH.
- `ANTHROPIC_API_KEY` set in the environment.

## Commands

Run from the repo root. Paths given to and printed by the harness are relative to the repo root.

```sh
npm --prefix harness install                                # once
npm --prefix harness run ticket -- <issue-number>           # full run
npm --prefix harness run ticket -- --ticket-file <path>     # same, from a saved ticket snapshot (re-run)
npm --prefix harness run review -- <pr-number | branch>     # review bot only
npm --prefix harness run metrics                            # summary table across run records
npm --prefix harness run test                               # unit tests (node:test)
npm --prefix harness run typecheck
```

- `ticket` also takes `--base <branch>` (default `main`). It exists to test the harness from an
  unmerged branch; real tickets run from `main`.
- `review` takes `--ticket-file <path>` (otherwise the ticket is found from `Closes #<n>` in the
  PR body) and `--no-post` (do not comment on the PR). It needs a clean tree: it checks out the
  PR or branch, reviews it against `origin/<base>`, and switches back. Its output goes to
  `harness/runs/review-<ref>-<stamp>/`, which is gitignored.

## The flow

1. **Preflight.** Tools on PATH, API key set, `gh` authenticated, clean tree on `main` at
   `origin/main`. Any failure stops the run before anything changes.
2. **Ticket.** Loaded from the Issue (or a ticket file) and parsed: the `sh` block under
   "Acceptance commands", the bullets under "Allowed paths", "Pending tests to promote" and
   "Protected test changes". A missing or empty required section is a ticket error (exit 2),
   not an agent error.
3. **Set up.** Branch `ticket/T<n>-<slug>`, run ID `T<n>-<UTC stamp>`, record directory
   `harness/runs/<run-id>/`, ticket snapshot.
4. **Maker.** `claude -p` with `prompts/maker.md` wrapped around the ticket. Tools: Read, Edit,
   Write, Glob, Grep, and Bash limited to `npm`, `npx`, `dotnet`, `node`, `git status`,
   `git diff`. `git commit`, `git push`, `gh`, web tools and edits to `.claude/**` and
   `.mcp.json` are denied, and no MCP servers are loaded. Killed after `callTimeoutMinutes`.
5. **Gates**, in order, stopping at the first failure:
   1. scope: every changed, deleted or untracked file matches an allowed glob
      (`harness/runs/**` is ignored);
   2. protected paths: nothing in `protected-paths.txt` changed unless the ticket lists it;
   3. acceptance commands, one line at a time, through the platform shell, exit codes checked;
   then scope and protected paths again, since commands can create files.
6. **Retry.** On a failure the harness writes `feedback-<k>.md` from `prompts/feedback.md` and
   resumes the same maker session with it. It stops at `maxAttempts` (`max-attempts`) or when
   the failure signature repeats from the previous attempt (`no-progress`). If the previous
   maker call was cut off (timeout, turn limit), the feedback says so. On a stop the
   record is written and the branch is left unpushed, with the maker's changes uncommitted, for
   a human to inspect.
7. **PR.** On a pass: commit `T<n>: <title>`, push, `gh pr create` with `Closes #<n>`, the
   maker's summary, the gate results and the attempt count.
8. **Review.** The review bot (`prompts/reviewer.md`, `reviewerModel`, read-only tools, fresh
   context) returns JSON that the harness validates; an invalid answer gets one retry, then
   the run stops with `review-invalid`. The
   review is posted as a PR comment. On `request-changes` with revision rounds left, the
   blocking findings go back to the maker session, the gates run again (with a fresh
   `maxAttempts` budget), the fix is pushed and reviewed again. Then the run stops either way.
9. **Record.** The run record is committed to the PR branch as `T<n>: run record` and pushed.
   A human merges the PR; that merge is the approval.

Stop reasons: `approved`, `changes-requested`, `max-attempts`, `no-progress`, `maker-error`,
`review-invalid`, `revision-max-attempts`, `revision-no-progress`, `revision-maker-error`,
`error`. The exit code is 0
when a PR was opened, 1 otherwise, 2 for a ticket error.

## Ticket files

`--ticket-file` takes the snapshot format the harness writes to `ticket.md`: the issue body
under a small header. Without an `issue:` line the PR gets no `Closes #<n>`, which is what you
want for scratch tickets.

```markdown
---
issue: 1
title: T1: Initialize the project and verification baseline
---

## Goal
...
```

## The run record

`harness/runs/<run-id>/`:

| File | Committed | Contents |
|---|---|---|
| `ticket.md` | yes | ticket snapshot as run (re-runnable with `--ticket-file`) |
| `run.json` | yes | run ID, issue, base/harness SHA, models, config, parsed sections, rendered maker prompt, attempts, per-call metrics, totals, stop reason, PR URL, whether each review's diff was cut |
| `feedback-<k>.md` | yes | feedback sent on retry or revision k |
| `gates.json` | yes | gate results per attempt, failure excerpts (last 60 lines) |
| `review-<round>.json`, `review-<round>.md` | yes | review bot output per round |
| `notes.md` | yes | human notes, filled in by hand |
| `trace.txt` | yes | one line per tool call: `#12 [maker-initial-1] Edit backend/...` |
| `transcript-*.jsonl` | no (gitignored) | full stream-json transcripts per call |
| `gates-raw/` | no (gitignored) | full output of every acceptance command |

`run.json` metrics come from each call's `result` event: cost, turns, duration, tokens
(input, output, cache read, cache write). The CLI reports `total_cost_usd` cumulatively per
session, including across `--resume`, so the harness stores each call's own share. Also
recorded: attempts, review rounds, blocking findings per round, diff stats, tool calls by type,
and the index of the first Edit or Write.

## Files

| Path | Role |
|---|---|
| `config.json` | models and limits |
| `protected-paths.txt` | protected test paths (D-13), one path or glob per line |
| `prompts/maker.md` | maker instructions wrapped around the ticket |
| `prompts/feedback.md` | template for gate and review feedback |
| `prompts/reviewer.md` | review bot instructions, checklist and inputs |
| `src/run-ticket.ts` | orchestration |
| `src/ticket.ts` | fetch and parse an Issue or a ticket file |
| `src/claude.ts` | spawn `claude -p`, stream the transcript, extract result and metrics |
| `src/gates.ts` | scope, protected paths, acceptance commands, failure signature |
| `src/review.ts` | review bot: inputs, call, validation, rendering; standalone `review` command |
| `src/metrics.ts` | markdown table across run records |
| `src/git.ts`, `src/gh.ts`, `src/proc.ts`, `src/config.ts` | thin wrappers and shared paths |
| `test/*.test.ts` | unit tests: ticket parsing, failure signature, review validation |

## Settings for agent calls

Every `claude -p` call uses `--setting-sources project`, so it loads `CLAUDE.md` and
`.claude/settings.json` but not per-user settings. That keeps runs the same across machines.
It also passes `--strict-mcp-config` without `--mcp-config`, so no MCP servers are loaded.
The harness passes `--permission-prompts none`, so anything not allowed is denied, not asked.

## Known limitations

- The tool restrictions (denied `git commit`, `git push` and `gh`, the `.claude/**` and
  `.mcp.json` denies, `--strict-mcp-config`) are workflow containment, not a security
  boundary. Allowed `node`, `npm` and `npx` execution can bypass them, use the network, read
  the environment and write outside the repo. Real isolation would be a container without
  credentials.
- Exercised end to end: a review revision round (T4: review round 1 requested changes, the
  resumed maker fixed it, round 2 approved). Not yet exercised end to end: the
  invalid-review-JSON retry and a real timeout. Process-tree termination is platform-aware
  (`taskkill /T /F` on Windows, process-group `SIGKILL` on POSIX) but has only been run on
  Windows.
- Background processes the maker starts are not stopped when its call ends. In T5 the maker
  left `npm run dev:api` and `npm run dev:web` running, and the API process locked the back-end
  build until stopped by hand. Stop any such processes before the next run.
- The harness starts `claude` without a shell, so on Windows it needs the native `claude`
  install; an npm-installed `claude.cmd` is not found.
