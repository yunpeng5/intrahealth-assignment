# Review bot output: PR #7, pass 2

PR: Build the harness core

Exported verbatim from the PR comment posted 2026-10-06T04:52:17Z (https://github.com/yunpeng5/intrahealth-assignment/pull/7#issuecomment-6009583602).
This PR was reviewed with the standalone review command, whose local output is gitignored.

---

## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 2 should-fix, 3 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| D-12 | met | harness/src/gates.ts:84-101 runs each line of the ticket's sh block through the platform shell and fails the gate on a non-zero exit or timeout; harness/prompts/maker.md tells the maker to run the acceptance commands before finishing. `npm run verify` becomes a gate as soon as a ticket lists it. |
| D-13 | met | harness/protected-paths.txt exists (empty, as D-13 allows before the invariant tests); harness/src/gates.ts:49-54 blocks changes under those paths unless the ticket's parsed "Protected test changes" lists them (harness/src/ticket.ts:78); the gate runs before and after the acceptance commands; harness/prompts/reviewer.md item 4 makes the review bot treat the same thing as blocking. |
| D-14 | met | harness/prompts/reviewer.md item 5 instructs the bot to treat section 3 behaviour as a finding without an authorizing ticket. The PR contains no product code, so no section 3 behaviour exists. |
| S-1 | met | Every command, flag and file in the diff traces to docs/harness-design.md (including --base, --ticket-file, --no-post, the .claude/.mcp.json denies, review-<round> files). Nothing from the non-goals list (dashboards, OpenTelemetry, parallel runs, CI triggers, replay) is present. docs/requirements.md, docs/decisions.md and CLAUDE.md are untouched per the diff stat. |
| T-1 | n/a | No product code or client-facing responses exist yet; the diff touches only harness/, docs and repo config. |
| T-2 | n/a | No server exists yet. The harness writes only its own run records, which the design requires. |
| D-1 | n/a | No questionnaire endpoints or browser code exist yet. |
| D-7 | n/a | No questionnaire handling exists yet; nothing visitor-related is stored or logged. |
| D-8 | n/a | No scoring code exists yet. |

### Findings

#### should-fix

- **[correctness]** `harness/src/review.ts:231`: Standalone review reads --ticket-file from the original branch, before checking out the PR, so ticket files that exist only on the PR branch cannot be used.
  - Evidence: review.ts:231 reads the ticket file, review.ts:240-243 checks out the PR afterwards. The ticket's own instruction (`--ticket-file docs/process/harness-bootstrap-ticket.md`) and the README's re-review use case (`harness/runs/<id>/ticket.md`, committed to the PR branch) both point at files that are not on main; run from main the command fails with ENOENT before any review.
  - Suggestion: Move the ticket-file read inside the try block after `gh pr checkout` / `git checkout`, or read it from the PR ref with `git show <ref>:<path>`.
- **[tests]** `harness/src/gates.ts:49` (D-13): The scope and protected-path gates, which enforce D-13, have no unit tests; only the failure signature is covered in gates.ts.
  - Evidence: harness/test/signature.test.ts tests `signature` only. `scopeGate`, `protectedGate` and the `matches` helper (gates.ts:34-54) are not exported and never exercised by a test, so a glob-matching regression (for example `backend/**` not matching nested files, or an authorized path not suppressing the protected failure) would go unnoticed until a real run.
  - Suggestion: Export the two gate functions (or a pure `fileGates(files, ticket, protectedPatterns)`) and add cases for: nested path under an allowed glob, file outside scope, protected file without authorization (fails), protected file with authorization (passes), and `harness/runs/**` being ignored.

#### nit

- **[quality]** `harness/src/gates.ts:52` (D-13): Protected-path authorization accepts globs from the ticket, while the design and reviewer prompt say the ticket must authorize "exactly those paths".
  - Evidence: gates.ts:52 uses `matches(f, p)` for `ticket.protectedChanges`, so a ticket listing `backend/**` under "Protected test changes" would unlock every protected test.
  - Suggestion: Compare authorized entries by exact path (`f === p`), or state in docs/harness-design.md that authorization entries may be globs.
- **[tests]** `docs/process/harness-bootstrap-ticket.md:40`: The acceptance command only typechecks; the unit tests this PR adds are not run by any gate for this PR.
  - Evidence: The sh block contains only `npm --prefix harness run typecheck`; `npm --prefix harness test` exists in harness/package.json but nothing in the ticket runs it, and no gate results are available for this review.
  - Suggestion: Add `npm --prefix harness test` to the acceptance block so the tests are part of the pass/fail decision.
- **[quality]** `harness/src/run-ticket.ts:388`: A re-run for the same ticket fails at `git checkout -b` if the branch from a previous stopped run still exists, with only git's error as guidance.
  - Evidence: run-ticket.ts:388 always creates `ticket/T<n>-<slug>`; the design (step 6) leaves that branch unpushed on a stop, and the README advertises `--ticket-file` re-runs.
  - Suggestion: Check for the branch in preflight and report "branch X exists from an earlier run; delete or rename it" instead of letting git fail mid-setup.
