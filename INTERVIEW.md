# Interview notes

> **Working draft.** This file is built from run evidence as the project progresses (PRs, run
> records under `harness/runs/`, review-bot comments). Sections marked _pending_ are filled
> in as the remaining tickets run.

## Decisions

What the requirements left open, and what I chose. Full list with reasons:
[docs/decisions.md](docs/decisions.md).

**Product**
- **The browser only gets display data** (D-1). Option values, scoring method and severity
  bands stay on the server; the GET response has IDs, labels and text only. If the browser had
  values and bands it could compute the score, which works against 2.4.
- **Submission returns exactly `{ label, nextSteps }`** (D-2): no score, band index or range
  (a range would reveal the score), and errors never echo answers.
- **No server call per page** (D-3); **answers live only in React state** (D-4), so a reload
  loses progress. Saving is stretch requirement 3.1.
- **Questionnaires are JSON files validated at startup** (D-5), checking only what correct
  behaviour depends on (unique IDs, answerable questions, integer values, bands covering every
  possible score). I removed shape rules (minimum questions per page, minimum options) that the
  brief does not require.
- **Integer scoring with inclusive `min`/`max` bands** (D-6). The brief says "numeric", but the
  supplied model is entirely integer (values 0–3, total 0–18, bands 0–4 … 15–18); integers avoid
  inventing fractional-score rules.
- **Strict non-persistence of visitor data** (D-7): no stores, cookies or identifiers, and
  nothing derived from answers in logs. Questionnaire definitions are read-only data and are not
  affected.
- **A questionnaire is opened by `?questionnaire=<id>`, default `wc-6`** (D-9). This keeps 1.3
  ("a second questionnaire needs no code change") without adding a list endpoint or picker,
  which the brief does not ask for.
- **An incomplete page simply disables moving forward** (D-15); pointing out unanswered
  questions is not required.

**Process**
- **Protected invariant tests** (D-13): the critical tests (score never returned, nothing
  persisted, no scoring data in the GET response) are written outside the feature tickets,
  reviewed by me, and listed in `harness/protected-paths.txt`. A ticket may change them only if
  it explicitly authorizes it.
- **Stretch needs an authorizing ticket** (D-14).

## Harness

_Sections below are filled in with run evidence; design: [docs/harness-design.md](docs/harness-design.md),
usage: [harness/README.md](harness/README.md)._

### How it works

`npm --prefix harness run ticket -- <issue>` takes a GitHub Issue to a reviewed PR:

1. Preflight, then parse the ticket (acceptance commands, allowed paths, protected-test
   authorization). A malformed ticket is a ticket error, not an agent error.
2. **Maker** (`claude -p`, Opus 5.5) changes files only; the harness owns git and GitHub.
3. **Deterministic gates** decide pass/fail: scope, protected paths, the ticket's acceptance
   commands, then scope again.
4. **Retry** with the failure fed back into the same maker session, bounded by max attempts (3)
   and a no-progress stop (same failure signature twice).
5. Commit, push, open the PR.
6. **Review bot** (`claude -p`, Fable 5.1, fresh context, read-only tools) reviews against the
   ticket, requirements, decisions and global invariants; schema-validated JSON, posted to the
   PR. One revision round on blocking findings.
7. A small **run record** is committed to the PR; I merge.

### Bootstrap

The harness could not be built through itself. A coding agent built it from the committed
design ([docs/process/harness-build-prompt.md](docs/process/harness-build-prompt.md)); once
the reviewer existed, the bootstrap PR (#7) was reviewed by it twice and by a design review
before merge. T1 was the first ticket run end to end through the harness.

### First vs second ticket

| | T1 (initialization) | T2 (first feature) |
|---|---|---|
| Run | `T1-20261006T050512Z`, PR #8 | _pending_ |
| Outcome | approved, 1 attempt, 1 review round | |
| Human interventions | none | |
| Maker cost / duration | $1.10 / 11.2 min | |
| Reviewer cost / duration | $1.14 / 2.2 min | |
| Total cost | $2.25 | |
| Model responses / tool calls | 42 / 70 (`num_turns` 71) | |
| First edit at tool call | 15 | |
| Diff | 29 files, +4326 −4 (3809 lines are `frontend/package-lock.json`) | |

Notes on the metrics:
- `num_turns` from the CLI is roughly one per tool call; `--max-turns` limits model round trips.
  T1 reported 71 turns under a 60-turn limit without hitting it (42 model responses).
- The comparison is T1 (setup) vs T2 (first feature): T1 paid for the environment, test setup
  and conventions; T2 should show what it got for free. Later tickets are context, not a claim
  that every ticket gets cheaper.

## Review bot

| PR | Pass | Verdict | Findings | Caught | Missed / wrong |
|---|---|---|---|---|---|
| #7 harness bootstrap | 1 | approve | 1 should-fix, 4 nit | missing harness unit tests; 3 design-doc inaccuracies; undocumented stop reason; settings/docs mismatch on `git log`; cut-off maker calls not reported in feedback | **Missed** that root `package-lock.json` was not excluded from the review diff (pathspec `**/package-lock.json` matches nested files only), while the note to the reviewer said lock files were excluded. Found in design review. |
| #7 harness bootstrap | 2 | approve | 2 should-fix, 3 nit | standalone review reads `--ticket-file` before checkout; no tests for scope/protected gates; protected-test authorization accepts globs | **Partly wrong:** cited a README use case for the ticket-file problem that does not apply. Found issues pass 1 had not raised: one pass is not exhaustive. |
| #8 T1 | 1 | approve | 3 nit | Vitest default excludes dropped; BOM and unused package in test `.csproj`; script location | Correctly judged the script location a ticket constraint, not an agent mistake. Cited a gitignored gate log as evidence (not reproducible from the repo). |

| #9 invariant tests | 1 | approve | 4 should-fix, 2 nit | `static readonly` stores missed by the source scan; log check missed "scored 13" wording; GET check was a denylist (a string `points` property passed); database/file denylist incomplete and case-sensitive | **Partly wrong:** said the WC-6 question IDs are "defined nowhere"; they are in Issue #2, which the bot cannot see (the underlying gap, an undocumented default-configuration assumption, was real). **Would have weakened a test:** suggested skipping `bin`/`obj` in the file snapshot, but the test output folder is a `bin` folder and the likeliest leak location. **Missed:** a band range added as text (`"10 to 14: ..."`) passed every check. Note: the review ticket pointed the bot at the scan and score checks. |

_Calibration on planted bugs in a feature PR: pending (after T3)._

### Testing the protected tests

The invariant tests (PR #9) were checked against a throwaway `Program.cs` before they became
protected, with a correct fake implementation and deliberate leaks:

- **First spike:** the correct fake failed one test, which was a false positive. ASP.NET's
  standard ProblemDetails body contains `"type": "...rfc9110#section-15.5.1"`, which matched the
  "partial score 15" check. Fixed by ignoring the standard `type` URI and `status` code. Without
  the spike, T3 would have met a red protected test it may not change.
- **After the review fix round:** the correct fake passed 11/11 on three runs. 11 leaks each
  failed exactly the intended test: option values, a string `points` property, score in the
  body, a range appended to `nextSteps`, partial score in an error, score in a header, score in
  logs in three wordings, a cookie, a file write. The source scan caught a `static readonly`
  store and passed immutable definition storage.
- **Human correction:** the proposed fix for the text-range gap was "no digits at all in the
  success body". I rejected it as an invented product constraint (a future questionnaire could
  say "check again in 2 weeks"); the test instead asserts the exact expected
  `{ label, nextSteps }` for a known answer set.

## AI usage

**Tools**
- Claude Code (Opus 5.5) as a design assistant: studying the course material, drafting
  requirements, decisions, tickets and the harness design, and reviewing PRs. I reviewed every
  proposal and made the scope and design decisions.
- Claude Code (Opus 5.5) as the coding agent that built the harness core from the design.
- Inside the harness: Opus 5.5 as maker, Fable 5.1 as reviewer (a different model in a fresh
  context).

**Corrections I made** (to AI proposals, before or during implementation)
- Removed invented scope: a questionnaire list endpoint and picker proposed for 1.3; a
  "which questions are unanswered" message for 1.4; a visible Submit button that did nothing in
  T4.
- Rejected fractional-score semantics and kept integer scoring (D-6).
- Removed invented validation rules from D-5.
- Narrowed over-broad rules: "nothing about a questionnaire is persisted" would have banned
  reading questionnaire definitions; "severity bands never reach the browser" contradicted the
  required result label.
- Moved the harness design into the repo: it had been kept outside "on purpose", which hurt
  auditability once an agent was building from it.
- Found a bootstrap dependency: harness commands assumed a root `package.json` that T1 creates
  (now run with `npm --prefix harness`).
- Asked for platform-aware process termination to be confirmed rather than assumed, and for the
  review record to match the actual review comment.

## Run observations

- **T1 script location — a ticket defect.** T1 asked for orchestration in a Node script but its
  allowed paths had no root `scripts/` folder, so the agent put the runner in
  `frontend/scripts/run.mjs` and raised it as an open question instead of breaking scope.
- **Effective Bash permissions were wider than documented.** The maker ran `ls`, `cat`, `find`,
  `mkdir` and `rm` without denial, though the docs list only `npm`, `npx`, `dotnet`, `node`,
  `git status` and `git diff` (likely the CLI's read-only allowances plus `acceptEdits`). The
  deterministic gates remained the enforcement layer.

## Known debt

**Harness**
- Tool restrictions are workflow containment, not a security boundary: allowed `node`/`npm`
  execution can bypass them. Real isolation would be a container without credentials.
- Not yet exercised end to end: a review revision round, the invalid-review-JSON retry, a real
  timeout. Process-tree termination has only run on Windows.
- Harness docs understate the maker's effective Bash permissions (see Run observations).
- Standalone `review` reads `--ticket-file` before checking out the PR.
- Scope and protected-path gates have no unit tests (signature, parsing and review validation
  do).
- Protected-test authorization accepts globs, not exact paths.
- Re-running a stopped ticket fails at `git checkout -b` if its branch still exists.
- Windows needs the native `claude` install (`claude.cmd` is not found).
- Promotion of protected pending tests: the gate authorizes whole files; that the change is only
  the `Pending` trait removal is checked by review, not mechanically (D-13).

**Invariant tests**
- The source scan is heuristic (known patterns, not exhaustive); in-memory state is otherwise
  covered only by review.
- Score checks use WC-6 values (13, partial 15); the file check covers the app's directories,
  not the whole disk, and can fail spuriously if a build runs during the tests.

**Product**
- Root task runner lives in `frontend/scripts/run.mjs` (T1 allowed paths).
- Vitest baseline project drops the default excludes; test `.csproj` has a BOM and an unused
  coverlet package.
- Scoring method is fixed to `sum` (D-6): a questionnaire that scores differently needs code.

## What I would do with two more hours

_pending_
