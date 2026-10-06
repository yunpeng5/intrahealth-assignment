# Review bot output: PR #7, pass 1

PR: Build the harness core

Exported verbatim from the PR comment posted 2026-10-06T04:14:15Z (https://github.com/yunpeng5/intrahealth-assignment/pull/7#issuecomment-6009196952).
This PR was reviewed with the standalone review command, whose local output is gitignored.

---

## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 1 should-fix, 4 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| D-12 | met | The only pass/fail decision is the ticket's own acceptance `sh` block, run in order with exit codes checked (harness/src/gates.ts:84-99); 'Pending tests to promote' is parsed and recorded but never gated (harness/src/ticket.ts:88, run-ticket.ts parsed.pendingTests). Nothing hardcodes or gates verify:pending. |
| D-13 | met | harness/protected-paths.txt exists (empty, commented); protectedGate blocks any change matching it unless the ticket's 'Protected test changes' lists the path (harness/src/gates.ts:49-55), checked before and after acceptance commands; reviewer prompt item 4 makes unauthorized changes blocking (harness/prompts/reviewer.md:20-21). |
| D-14 | met | Reviewer prompt item 5 instructs the bot to treat section 3 behaviour as a finding without an authorizing ticket (harness/prompts/reviewer.md:22-23); the maker loads CLAUDE.md via --setting-sources project (harness/src/claude.ts:78-79). |
| S-1 | met | Every file in the diff stat sits under the ticket's allowed paths and traces to the design doc or build prompt. Extras (--base, --no-post, ticket files without issue:) are documented as deviations in docs/harness-design.md:88-95,194-197. None of the non-goals (dashboards, OTel, worktrees, CI triggers, replay) appear. |
| T-1 | n/a | No product code exists: Glob for backend/** and frontend/** returns nothing. No client-facing responses to check. |
| T-2 | n/a | No server exists yet. The harness's own writes are run records under harness/runs/, which are not visitor data. |
| D-1 | n/a | No questionnaire endpoints or browser code exist yet. |
| D-7 | n/a | No server or questionnaire handling exists yet. |
| D-8 | n/a | No scoring code exists yet. |

### Findings

#### should-fix

- **[tests]** `harness/src/ticket.ts` (CLAUDE.md definition of done 3): The harness has no automated tests; its deterministic core (ticket parsing, failure signatures, review validation) is verified only by typecheck and by scratch runs that are not in the repo.
  - Evidence: Glob harness/**/*.test.ts finds nothing; package.json scripts are ticket, review, metrics, typecheck only. parseTicket (ticket.ts:50-86), signature/normalize (gates.ts:111-138) and validateReview (review.ts:69-100) are pure functions whose bugs would silently misgate every future ticket.
  - Suggestion: Add a small node:test file covering parseTicket (parsed sections, 'None', missing section → TicketError), validateReview (verdict rule, missing invariants) and signature stability under normalize, and run it from the typecheck or a `test` script. The ticket's acceptance command does not demand this, so it is not blocking.

#### nit

- **[quality]** `docs/harness-design.md:234` (Ticket Behaviour: design doc describes what was built): The 'Publishing' bullets still say review.md / review.json while the run-record table and implementation use review-<round>.json / review-<round>.md; line 212 says an invalid review makes 'the run fail' but the run exits 0 with the record committed.
  - Evidence: docs/harness-design.md:234-237 vs :248 and harness/src/run-ticket.ts reviewLoop writing `review-${round}.json`; README.md:68-69 documents exit 0 whenever a PR was opened.
  - Suggestion: Change the two Publishing bullets to `review-<round>.md` / `review-<round>.json`, and reword line 212 to 'then the run stops with review-invalid'.
- **[quality]** `harness/src/run-ticket.ts:291`: The revision loop can produce the stop reason `revision-maker-error`, which is not in the documented list.
  - Evidence: `if (stop) return \`revision-${stop}\`` where makeUntilGreen can return "maker-error"; the design (docs/harness-design.md:172-173) and README list only revision-max-attempts and revision-no-progress.
  - Suggestion: Either add `revision-maker-error` to the documented stop reasons or map it to `maker-error`.
- **[quality]** `.claude/settings.json:10`: Project settings allow `git log`, which the maker inherits via --setting-sources project, while the maker prompt and README say only `git status` and `git diff` are allowed.
  - Evidence: .claude/settings.json:10 `Bash(git log*)`; harness/prompts/maker.md:8 and harness/README.md:45-46 list status and diff only. Read-only, so no safety issue; the documentation is just inaccurate.
  - Suggestion: Either add `Bash(git log*)` to MAKER_ALLOWED and mention it in maker.md and the README, or drop it from .claude/settings.json.
- **[correctness]** `harness/src/run-ticket.ts:170`: A maker call that times out or hits error_max_turns still proceeds to the gates, and the resulting feedback never tells the maker it was cut off; if the gates happen to pass, the PR body says the maker returned no summary.
  - Evidence: makeUntilGreen only stops when sessionId is missing; a timeout sets subtype "timeout" and isError true (claude.ts:161-164) but the flow continues to runGates, and gateFeedback mentions only the gate. lastSummary is skipped when isError (run-ticket.ts:132).
  - Suggestion: Include the call's subtype in the feedback heading when it is not "success" (for example 'Your previous call was cut off after N minutes'), so the maker knows to finish and re-summarize.
