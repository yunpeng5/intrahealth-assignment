# Interview notes

Pulse Check, built through a ticket harness. Project overview and how to run everything:
[README.md](README.md).

**Status:** requirements sections 1 and 2 are implemented, merged and verified end to end (a
fresh clone passes `npm run setup` and `npm run verify`, and I walked through the flow in a
browser). Section 3 (stretch: save and resume) was intentionally not attempted: with the
deadline close, I spent the remaining time on the required deliverables, reproducibility and
the walkthrough. Section 3 also changes what the server may store, so doing it properly would
mean revising the protected no-persistence invariants under an authorizing ticket (D-14), not
just adding endpoints.

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

Design and rationale: [docs/harness-design.md](docs/harness-design.md). Usage:
[harness/README.md](harness/README.md). Every number below comes from the committed run records
in `harness/runs/` (`npm --prefix harness run metrics` prints the totals).

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

**Result: the second ticket did not cost less in dollars.** T2 cost $2.76 against T1's $2.25,
with fewer turns. I did not re-run T2 to improve the number; the run was valid.

| | T1 (initialization) | T2 (first feature) | T3 (follow-on, context) | T4 (follow-on, context) | T5 (follow-on, context) |
|---|---|---|---|---|---|
| Run | `T1-20261006T050512Z`, PR #8 | `T2-20261006T072615Z`, PR #11 | `T3-20261006T075113Z`, PR #12 | `T4-20261006T080718Z`, PR #13 | `T5-20261006T082539Z`, PR #14 |
| Outcome | approved, 1 attempt, 1 review round | approved, 1 attempt, 1 review round | approved, 1 attempt, 1 review round | approved after 1 revision: 2 attempts, 2 review rounds | approved, 1 attempt, 1 review round |
| Human interventions | none | none | none | none | none |
| Review findings | 3 nit | none | 1 nit | round 1: 1 blocking; round 2: 1 nit | 2 nit |
| **Total cost** | **$2.25** | **$2.76** | **$2.00** | **$1.73** | **$1.34** |
| Maker cost / duration | $1.10 / 11.2 min | $1.65 / 9.2 min | $0.73 / 3.1 min | $0.61 / 4.7 min (initial $0.48, revision $0.14) | $0.54 / 3.3 min |
| Reviewer cost / duration | $1.14 / 2.2 min | $1.10 / 1.8 min | $1.26 / 2.4 min | $1.11 / 2.1 min (two rounds, $0.59 + $0.52) | $0.79 / 2.2 min |
| Model responses / tool calls (`num_turns`) | 42 / 70 (71) | 28 / 50 (51) | 15 / 21 (22) | 19 / 30 (32) | 22 / 32 (33) |
| Most tool calls in one response | 5 | 8 | 3 | 5 | 4 |
| Bash / Read / Write+Edit calls | 39 / 11 / 23 | 18 / 17 / 21 | 7 / 17 / 11 | 9 / 18 / 7 | 11 / 12 / 10 |
| First edit at tool call | 15 | 15 | 6 | 14 | 13 |
| Maker output tokens (incl. thinking) | 22.2k | 46.3k | 15.5k | 16.6k | 12.3k |
| Maker cache reads / cache writes | 1.73M / 62k | 1.57M / 83k | 0.67M / 58k | 0.53M / 36k | 0.63M / 34k |
| Maker context per response (avg / max) | 43k / 67k | 59k / 88k | 48k / 63k | 30k / 41k | 30k / 39k |
| Diff | 29 files, +4326 −4 (3809 lines are `frontend/package-lock.json`) | 17 files, +960 −2 | 8 files, +326 −2 | 7 files, +511 −2 | 4 files, +231 −3 |

**Why fewer turns but higher cost**
- **Turns measure tool round trips, not work.** T2 batched more tool calls per response (up to 8)
  and ran far fewer shell commands (18 vs 39): T1's shell work was environment setup
  (`dotnet new`, `npm create vite`, installs, repeated verify runs).
- **Cost followed output tokens, which doubled** (22k to 46k, including reasoning). Output is
  the expensive token type; cache reads, which fell slightly, are cheap.
- **The work was different.** Most of T1's diff was generated by templates and package
  managers, which cost no model tokens. All of T2's 960 lines were written by the model:
  the definition file, a validating loader, the display-only view and 20 tests covering every
  D-5/D-6 rule. It was also the first ticket with real domain rules to reason about.
- **Each response carried more context** (59k vs 43k on average): T2 read the protected
  invariant tests, which are its contract, and wrote larger files.
- **The review cost is a fixed overhead per ticket** (about $1.10 both times), around 40–50% of
  each total.

**T3 as a follow-on data point** (it does not change the T1/T2 result)
- T3 is the closest comparison to T2: another back-end feature on the same code. It cost
  $2.00, with the maker at $0.73 and 3.1 minutes, and its first edit came at tool call 6.
- Most of the difference is the work itself: 326 lines against T2's 960, extending an
  existing feature folder rather than creating one, with the invariant tests already written as
  its contract. Orientation was short: five batched reads of the docs, the existing
  questionnaire code and the invariants.
- The review cost more than the maker for the first time ($1.26 vs $0.73). The review is close
  to a fixed cost per ticket (about $1.10–1.30), so for small tickets it dominates the total.

**T4: the first real review-revision round** (front end, context like T3)
- The initial maker passed every gate, but review round 1 requested changes with one valid
  blocking finding: the new questionnaire flow was **never mounted in `App.tsx`**. Every
  component and its tests passed, yet a visitor could not reach the feature. The deterministic
  gates could not see this; the fresh-context reviewer did.
- The harness fed the finding back into the same maker session. It changed only `App.tsx` and
  `App.test.tsx`, passed the gates again, and review round 2 approved. No human intervention.
- The fix round cost $0.66: $0.14 for the resumed maker, which reused its context mostly as
  cheap cache reads, and $0.52 for the second review. This was the previously unexercised
  revision path, now exercised by a real ticket rather than a staged test.

**T5** (front end, context): the cheapest run ($1.34), a small change to an existing component
(+231 lines, mostly tests). The maker checked the live API through the Vite proxy but could not
drive a browser, so the browser-level walkthrough stays a human step (see Known debt).

**What T2 did get from T1** (not visible in dollars)
- It started from a green baseline with `npm run verify`, the test project, the
  pending-test mechanism and `docs/architecture.md` already in place, and followed them: tests
  next to the feature, endpoints in a feature folder, the documented promotion.
- First-attempt gate pass, no human intervention, and a review with no findings. It promoted
  the protected invariant test with exactly the authorized one-line change.
- Its first 14 tool calls read the existing repo (requirements, decisions, architecture, the
  invariant tests) instead of creating it.

**Honest limits of the comparison**
- One pair of tickets of different kinds cannot separate the harness's effect from the work's
  size and difficulty. There was no controlled experiment (the same ticket with and without the
  harness), by choice.
- "First edit at tool call" is not comparable either: T1's first 14 calls included scaffolding
  commands, while T2's were reading.
- `num_turns` from the CLI is roughly one per tool call; `--max-turns` limits model round trips.
  T1 reported 71 turns under a 60-turn limit without hitting it. The table's turn, token and
  context rows are the maker's; `npm run metrics` adds the reviewer's turns and tokens.

## Review bot

The review bot is a separate `claude -p` call (Fable 5.1, a different model from the maker) in a
fresh context with read-only tools. It reviews each PR against the ticket, the requirements,
the decisions and the global invariants, returns schema-validated JSON, and posts it to the PR.
Outputs: `harness/runs/<run-id>/review-*.md` for ticket PRs, and
[docs/process/reviews/](docs/process/reviews/) for the three PRs reviewed with the standalone
command.

**Summary**
- **Caught:** its most valuable catch was in T4. The questionnaire flow was built and fully
  tested but never mounted in the app, so a visitor could not reach it. The gates passed; the
  reviewer blocked it, and the revision fixed it with no human involved. On the invariant tests
  it found real gaps, including two false-positive risks that my own leak spike could not show.
- **Missed:** that the root `package-lock.json` was not excluded from its own review diff
  (found in design review), and a score range added as text to a response (found while
  checking its findings).
- **Wrong or partly wrong:** twice it said the WC-6 IDs were defined nowhere (they are in Issue
  #2, which it cannot see); it suggested skipping `bin` in the file check, which would have
  hidden the likeliest leak location; and it suggested widening a technology denylist that I
  chose to remove instead.
- **Passes vary:** a second pass on the same PR found issues the first had not raised. A bot
  pass is a strong check, not a replacement for a human merge review.

| PR | Pass | Verdict | Findings | Caught | Missed / wrong |
|---|---|---|---|---|---|
| #7 harness bootstrap | 1 | approve | 1 should-fix, 4 nit | missing harness unit tests; 3 design-doc inaccuracies; undocumented stop reason; settings/docs mismatch on `git log`; cut-off maker calls not reported in feedback | **Missed** that root `package-lock.json` was not excluded from the review diff (pathspec `**/package-lock.json` matches nested files only), while the note to the reviewer said lock files were excluded. Found in design review. |
| #7 harness bootstrap | 2 | approve | 2 should-fix, 3 nit | standalone review reads `--ticket-file` before checkout; no tests for scope/protected gates; protected-test authorization accepts globs | **Partly wrong:** cited a README use case for the ticket-file problem that does not apply. Found issues pass 1 had not raised: one pass is not exhaustive. |
| #8 T1 | 1 | approve | 3 nit | Vitest default excludes dropped; BOM and unused package in test `.csproj`; script location | Correctly judged the script location a ticket constraint, not an agent mistake. Cited a gitignored gate log as evidence (not reproducible from the repo). |
| #9 invariant tests | 1 | approve | 4 should-fix, 2 nit | `static readonly` stores missed by the source scan; log check missed "scored 13" wording; GET check was a denylist (a string `points` property passed); database/file denylist incomplete and case-sensitive | **Partly wrong:** said the WC-6 question IDs are "defined nowhere"; they are in Issue #2, which the bot cannot see (the underlying gap, an undocumented default-configuration assumption, was real). **Would have weakened a test:** suggested skipping `bin`/`obj` in the file snapshot, but the test output folder is a `bin` folder and the likeliest leak location. **Missed:** a band range added as text (`"10 to 14: ..."`) passed every check. Note: the review ticket pointed the bot at the scan and score checks. |
| #9 invariant tests | 2 (after fix round) | approve | 3 should-fix, 3 nit | Two false-positive risks that the leak spike could not show: the log check also scans startup lines and exception stack traces (`:line 13`, machine-specific paths), and the file rule flags a read-only `new FileStream` for loading definitions (D-5). Also: `Console`/`Debug` writes escape both log capture and the source scan; startup file writes are not covered. | **Repeated the partly-wrong ID finding:** said nothing T2 reads states the WC-6 IDs; Issue #2 lists them. _Outcome:_ both false-positive risks and the Console gap were fixed before the tests were protected, verified by a targeted spike rather than a third review pass. |
| #10 narrow source scan | 1 | approve | 1 should-fix, 1 nit | A Redis-backed output cache (`AddStackExchangeRedisOutputCache`) slipped through the narrowed distributed-cache pattern; the test comment did not say in-memory visitor state is undetected by any test | _Outcome:_ the suggested fix (widen the Redis pattern) was rejected: it would have expanded a technology denylist. The scan was narrowed further instead. |
| #11 T2 | 1 | approve | none | Checked the protected promotion (one-line trait removal), D-1 display-only mapping and the D-5/D-6 validation; no findings. A design review found nothing it missed. | — |
| #12 T3 | 1 | approve | 1 nit | Correctly noted that WC-6's questions share option IDs, so a "cross-question option" cannot be tested over HTTP with WC-6 (a unit test covers it). Checked both protected promotions. | — |
| #13 T4 | 1 | request-changes | 1 blocking | **Valid blocking catch:** the questionnaire flow was built and tested but never mounted in `App.tsx`, so the running app showed only a heading; the acceptance tests passed because they rendered the component directly. | — |
| #13 T4 | 2 (after revision) | approve | 1 nit | Page completeness uses `question.id in answers`, so a question ID like `constructor` would count as answered (exotic but real for data-defined IDs). | — |
| #14 T5 | 1 | approve | 2 nit | The failure alert stays visible after navigating Back; and, correctly, that the maker's "manual check" was an API call through the proxy, not a browser walkthrough, so a human should still check the result screen in a browser. | — |

I planned to calibrate the bot on deliberately bugged feature PRs but did not get to it (see
"two more hours"). The closest evidence is the leak spike on the invariant tests below.

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
- **Final round (after review pass 2):** a correct implementation that also logs a startup
  path containing a `13` folder, a handled exception thrown from line 13, and a stack frame
  with a `13` folder in its path now passes. Disabling either new filter makes it fail, which confirms
  each filter is what prevents the false positive. A read-only `FileStream` passes the source
  scan; `FileAccess.Write` and `Console`/`Debug`/`Trace` writes fail it.
- **Protected-path gate exercised** with the harness's real gate code on a promotion-style edit
  (removing the `Pending` trait from a protected file): it failed with no authorization and
  with a different protected file authorized, and passed only with the exact file authorized.
  Whether an authorized edit is *only* the trait removal is left to review (D-13).
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

**What I delegated, and what I kept**
- Delegated: drafting the requirements, decisions, tickets and harness design for my review;
  building the harness core (a coding agent working from the committed design); implementing
  every ticket (the maker); reviewing every PR (the review bot); writing the invariant tests
  (the design assistant, independently of the ticket agents).
- Kept: scope and design decisions, approving tickets, reviewing every PR before merge, the
  final call on every review finding, and the browser walkthrough. No product code was written
  by hand.

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
- Rejected steering the T2 maker toward immutable collections just to satisfy the protected
  source scan, and then rejected the review bot's suggestion to widen a Redis pattern. A static
  scan cannot tell a questionnaire-definition registry from a store of answers, and rules on
  caches, logging middleware or console output ban technologies and channels rather than
  visitor state. Before T2 the scan was narrowed to what maps directly to the requirements:
  file writes and databases (T-2), sessions and cookies (2.3) (PR #10, a reviewed change to a
  protected test). Everything else is explicitly left to review.

## Run observations

- **T1 script location — a ticket defect.** T1 asked for orchestration in a Node script but its
  allowed paths had no root `scripts/` folder, so the agent put the runner in
  `frontend/scripts/run.mjs` and raised it as an open question instead of breaking scope.
- **Effective Bash permissions were wider than documented.** The maker ran `ls`, `cat`, `find`,
  `mkdir` and `rm` without denial, though the docs list only `npm`, `npx`, `dotnet`, `node`,
  `git status` and `git diff` (likely the CLI's read-only allowances plus `acceptEdits`). The
  deterministic gates remained the enforcement layer.
- **Leftover processes from the maker (T5).** For its live check the maker started
  `npm run dev:api` and `npm run dev:web` and left both running after the run. The API process
  locked the back-end build output, so a later `npm run verify` failed until I stopped them. The
  gate itself passed only because T5 changed no back-end code. Had they still been running at
  the next ticket's gate, its build would have failed and the failure would have been blamed on
  that ticket's maker.

## Known debt

Each item says where it falls short and how I would fix it.

**Harness**
- **Not a security boundary.** Tool restrictions are workflow containment: allowed `node`/`npm`
  execution can bypass them, use the network and read the environment. Fix: run the maker in a
  container without credentials, with the network limited to package registries.
- **Leftover background processes.** The harness does not stop processes the maker starts (dev
  servers left running after T5). Fix: kill the maker's process tree after each call, and check
  for listening ports before the gates.
- **Untested paths.** The invalid-review-JSON retry and a real timeout have not run end to end;
  process-tree termination has only run on Windows. Fix: a fake `claude` executable in the
  harness tests that returns invalid JSON or hangs.
- **The docs understate the maker's shell permissions** (see Run observations). Fix: document
  the CLI's built-in allowances, or deny the extra commands explicitly.
- **Protected-test promotion is checked by review, not mechanically:** the gate authorizes whole
  files (D-13), and authorization accepts globs. Fix: a gate check that an authorized
  protected-file diff only removes the `Pending` trait line, and exact-path matching.
- **Smaller gaps:** the scope and protected-path gates have no unit tests (fix: test them like
  the signature and parser); standalone `review` reads `--ticket-file` before checking out the
  PR (fix: read it after checkout); re-running a stopped ticket fails if its branch exists (fix:
  check in preflight); Windows needs the native `claude` install (fix: spawn through the shell
  on Windows).

**Invariant tests**
- **In-memory visitor state, direct console output and unlisted persistence APIs** are not
  detected by any test and are left to review (D-7); the source scan covers only file writes,
  databases, sessions and cookies. Fix: a runtime check needs a seam in the app (for example,
  asserting that no singleton service holds request data); until then, review.
- **WC-6-specific checks:** the score checks use WC-6's values (13, partial 15), and the file
  check covers the app's directories, not the whole disk. Fix: generate answer sets from the
  definition so any questionnaire can be checked.
- **A stale comment** in the protected `NoServerStateInvariantTests.cs` says in-memory state is
  covered by the source scan, which stopped being true in PR #10. Fix: correct it under a ticket
  that authorizes that file.

**Product**
- **No automated browser-level test.** The flow is covered by API and React Testing Library
  tests and was checked in a browser by hand. Fix: one Playwright happy-path test in `verify`.
- **Front-end nits from review:** page completeness uses `question.id in answers`, so a question
  ID like `constructor` would count as answered (fix: `Object.hasOwn`); the submission-failure
  alert stays visible after navigating Back (fix: clear it on navigation).
- **Scoring is fixed to `sum`** (D-6): a questionnaire that scores differently needs code. Fix:
  named scoring methods selected by the definition, added when a second method is needed.
- **Housekeeping:** the root task runner lives in `frontend/scripts/run.mjs` because T1's
  allowed paths had no root `scripts/` folder (fix: move it in a ticket that allows it);
  Vitest's baseline project drops the default excludes; the test `.csproj` has a BOM and an
  unused coverlet package.

## What I would do with two more hours

In order:

1. **Fix the leftover-process bug in the harness** (about 30 min): kill the maker's process tree
   after each call and check for listening ports before the gates. It is the one harness
   defect a real run exposed, and it could make a later ticket fail for someone else's mistake.
2. **Calibrate the review bot on planted bugs** (about 45 min): three branches with one known
   bug each (the score in a response, answers in a log, an invented extra feature), run the bot,
   and record the catch rate. That turns "the bot found real issues" into a measured number.
3. **Add one Playwright happy-path test to `verify`** (about 30 min): load WC-6, page through,
   submit, and see only the label and message. It automates the browser check I did by hand.
4. **Run one small ticket for the two front-end nits** (about 15 min): the `in` check and the
   stale failure alert.

I would not start section 3 in two hours: it changes the persistence invariants, which should be
revised deliberately first.
