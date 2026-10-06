# Protected invariant tests

The critical product invariants, written outside the feature tickets and reviewed by a human
(D-13). The five `.cs` files are listed in `harness/protected-paths.txt` (from the PR that added
them): feature agents must not change them unless their ticket's "Protected test changes"
section explicitly authorizes it. This README is not protected.

All tests are **black-box**: they use only URLs and the JSON contract in
`docs/decisions.md` (D-1, D-2) and never reference application types, so they compile before
the features exist. Tests that need endpoints not built yet carry `[Trait("Category", "Pending")]`
(D-12) and are red until their ticket.

| File | Protects | Status |
|---|---|---|
| `NoPersistenceSourceTests.cs` | T-2, 2.3: no known file-write, database, session or cookie APIs in `backend/src` (static, heuristic scan) | baseline |
| `QuestionnaireContractInvariantTests.cs` | D-1, 2.4: the GET questionnaire response has only the properties D-1 defines, no numbers, no severity labels or next-steps text, and still offers every question and option by ID | pending until T2 |
| `SubmissionInvariantTests.cs` | T-1, 2.2, 2.4, D-2, D-8: a known WC-6 answer set returns exactly `{ label, nextSteps }` with the expected values and no JSON numbers; no score in non-standard headers; an invalid submission echoes no option IDs, partial score or label | pending until T3 |
| `NoServerStateInvariantTests.cs` | T-2, 2.3, D-7: completing the flow (load, valid submit, invalid submit) writes no files, sets no cookies, and logs nothing derived from answers (all log levels captured) | pending until T3 |
| `InvariantSupport.cs` | shared WC-6 fixture, JSON helpers, log capture, file snapshots | — |

## Contract on the shipped WC-6 definition

The tests run against the app's **default configuration**, which must serve the shipped WC-6
definition at `/api/questionnaires/wc-6`. These tests fix the WC-6 IDs below; T2's ticket
(Issue #2) lists the same IDs, and its shipped `wc-6.json` must use them. The expected result
text comes from `docs/requirements.md`:

- Questionnaire `wc-6`; questions `tired`, `sleep`, `nervous`, `interest`, `concentration`,
  `piling-up`; options `not-at-all` (0), `several-days` (1), `more-than-half` (2),
  `nearly-every-day` (3).
- The answer set scoring 13 must return exactly `Under pressure` and
  `It may help to talk to someone. You can request care from this portal.`

## Promotion

T2 and T3 make their pending tests pass, then remove the `Pending` trait from exactly the files
listed above. Their tickets authorize those files in "Protected test changes" for that purpose
only. **Limit:** the protected-path gate authorizes whole files, not the exact edit. That the
change is only the trait removal is checked by the review bot and the human merge review, not
mechanically.

## Limits

- **The source scan covers only mechanisms that map directly to the requirements:** file writes
  and databases (T-2: "nothing is written on the server") and sessions and cookies (2.3: no
  identifier). It does not ban technologies or output channels as proxies for what they might
  contain, so caches (in-process or distributed), logging middleware, console output and
  in-memory collections are allowed. Reading files, including a read-only `FileStream`, is
  allowed; write modes and write access are flagged. It is a denylist of common APIs, not an
  exhaustive proof. Comment lines are ignored.
- **Left to review (D-7), not detected by any test:**
  - in-memory visitor state between requests (a static or singleton collection of answers, an
    in-process or distributed cache of results);
  - direct console output (`Console`/`Debug`/`Trace`), which bypasses the runtime log check;
  - persistence mechanisms the scan's list does not name.

  The review bot checks D-7 on every PR. Logging through `ILogger`, including HTTP logging
  middleware, is covered by content in the runtime log check below.
- **The file check** covers request handling, not startup (the snapshot is taken after the
  host starts; startup writes are left to the source scan and review). It covers the app's
  content root and the test output directory (both including `bin`/`obj`), not the whole disk.
  A build running at the same time as the tests (an IDE background build, `dotnet watch`) can
  cause a spurious failure; re-run without it.
- **Score checks use WC-6 values:** the score 13 and partial score 15. The log check covers
  only logs written while handling the flow, not startup output (which includes
  machine-specific paths). In those logs, elapsed times (`13.4ms`) and stack-frame locations
  (`in ...\Program.cs:line 13`) are removed before matching a standalone `13` or `15`.
  Framework request logs also contain request and response sizes; for WC-6's payloads these
  cannot be 13 or 15, but that is a property of the fixture, not a guarantee. In error
  responses, the standard ProblemDetails `type` URI and `status` code are ignored.

## How they were checked

Before review, the pending tests were run against a throwaway `Program.cs` (not committed): a
correct fake implementation passed all of them, and deliberate leaks each failed exactly the
intended test. Leaks covered: option values, a string-valued `points` property, the score in the
body, a band range appended to `nextSteps`, a partial score in an error, the score in a header,
the score in logs in three wordings, a cookie and a file write. The first spike exposed a false
positive, since fixed: ProblemDetails' standard `type` URI (`...rfc9110#section-15.5.1`) matched
the partial-score check. Before T2, the source scan was narrowed: it had also flagged in-memory
collections, caches, HTTP logging middleware and console output. Those rules banned technologies
or channels rather than visitor state, could not tell a definition registry from a store of
answers, and would have forced implementation choices the requirements do not make.
