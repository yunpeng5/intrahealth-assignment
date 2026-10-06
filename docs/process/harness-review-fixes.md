# Harness bootstrap: review fix round

The prompt given to the coding agent after PR #7 was reviewed by the review bot (comment on
PR #7) and by a design review against [../harness-design.md](../harness-design.md).

---

You are the coding agent that built the harness core on branch `harness/bootstrap` (PR #7).
PR #7 has been reviewed. Make the fixes below on the same branch, as logical commits with clear
messages (no attribution lines). Do not merge the PR, do not write product code, and do not run
T1. Keep changes minimal: nothing beyond this list.

## Fixes

1. **Design-doc accuracy (`docs/harness-design.md`).**
   - "Publishing" bullets: use `review-<round>.md` / `review-<round>.json`, matching the code.
   - Replace "Invalid JSON gets one retry, then the run fails" with what happens: the run stops
     with `review-invalid`.
   - Stop reasons: add `revision-maker-error` wherever the stop reasons are listed (design doc
     and README).
   - The review-diff description must match the corrected lock-file exclusion (fix 2).
2. **Root lock file.** In `review.ts`, `:(exclude)**/package-lock.json` does not match a
   `package-lock.json` at the repo root. Also exclude `package-lock.json` at the root, so all
   lock files are left out of the supplied diff as the note to the reviewer says.
3. **Visible truncation.** When the review diff is cut at `MAX_DIFF_CHARS`, say so in the
   rendered review (`review.md` / the PR comment), for example one line under the header.
   Record it in `run.json` as well.
4. **Cut-off maker calls.** When a maker call ends with a subtype other than `success` (for
   example `timeout` or `error_max_turns`), say so in the feedback sent on the next attempt, so
   the maker knows it was cut off and must finish and re-summarize.
5. **Remove `git log` from `.claude/settings.json`.** The maker does not need it; the documented
   maker permissions stay `git status` and `git diff`.
6. **Workflow containment.** Add `Edit(.claude/**)`, `Write(.claude/**)`, `Edit(.mcp.json)` and
   `Write(.mcp.json)` to the maker's disallowed tools, and pass `--strict-mcp-config` on agent
   calls (it is listed in `claude --help` for the installed CLI). Check the rule syntax against
   the CLI, and confirm once with a scratch call that the maker cannot edit
   `.claude/settings.json`. Clean up any scratch artifacts afterwards.
7. **Unit tests with `node:test`.** Add a `test` script to `harness/package.json` and a small test
   file (or a few) covering:
   - ticket parsing: the parsed sections, `(parsed)` headings, HTML comments, "None", a missing
     section and an empty acceptance block raising `TicketError`, ticket-file headers with and
     without `issue:`;
   - the failure signature: the same failure with different timings, timestamps or temp paths
     gives the same signature; a different failing command or error gives a different one;
     scope failures key on the file list;
   - `validateReview`: a valid review passes; the verdict rule; missing global invariants;
     invalid severity, category or line.
   Export what the tests need; do not restructure the modules.
8. **README: known limitations.** Add a short section to `harness/README.md`:
   - The tool restrictions (denied git commit/push/`gh`, the `.claude/**` and `.mcp.json`
     denies, `--strict-mcp-config`) are workflow containment, not a security boundary: allowed
     `node`, `npm` and `npx` execution can bypass them, use the network, read the environment
     and write outside the repo. Real isolation would be a container without credentials.
   - Not yet exercised end to end: a review revision round, the invalid-review-JSON retry, and a
     real timeout. Process-tree termination is platform-aware (`taskkill /T /F` on Windows,
     process-group `SIGKILL` on POSIX) but has only been run on Windows.
   - The harness starts `claude` without a shell, so on Windows it needs the native `claude`
     install; an npm-installed `claude.cmd` is not found.

## Done when

- `npm --prefix harness run typecheck` and `npm --prefix harness run test` pass.
- The scratch check for fix 6 showed the denial, and no scratch artifacts remain.
- The design doc and README describe what the code does.

## Hand back

Push to `harness/bootstrap` and reply with one line per fix (what changed, which commit), the
test and scratch-check commands you ran with their outcomes, and anything you were unsure about.
