# Protected invariant tests

The critical product invariants, written outside the feature tickets and reviewed by a human
(D-13). Feature agents must not change these files unless their ticket's "Protected test
changes" section explicitly authorizes it.

All tests are **black-box**: they use only URLs and the JSON contract in
`docs/decisions.md` (D-1, D-2) and never reference application types, so they compile before
the features exist. Tests that need endpoints not built yet carry `[Trait("Category", "Pending")]`
(D-12) and are red until their ticket.

| File | Protects | Status |
|---|---|---|
| `NoPersistenceSourceTests.cs` | T-2, D-7: no file writes, databases, caches, sessions/cookies, request-body logging or in-memory stores in `backend/src` (static scan; reading files is allowed) | baseline |
| `QuestionnaireContractInvariantTests.cs` | D-1, 2.4: the GET questionnaire response has no numbers, no scoring properties, no severity labels or next-steps text, and still offers every question and option by ID | pending until T2 |
| `SubmissionInvariantTests.cs` | T-1, 2.2, 2.4, D-2, D-8: the submission response is exactly `{ label, nextSteps }`, contains no numbers or score, no score in headers; an invalid submission echoes no option IDs, partial score or label | pending until T3 |
| `NoServerStateInvariantTests.cs` | T-2, 2.3, D-7: completing the flow (load, valid submit, invalid submit) writes no files, sets no cookies, and logs nothing derived from answers (all log levels captured) | pending until T3 |
| `InvariantSupport.cs` | shared WC-6 fixture (IDs, labels, answers scoring 13 and a partial 15), JSON helpers, log capture, file snapshots | — |

**Promotion.** T2 and T3 make their pending tests pass and then remove the `Pending` trait from
exactly the files listed above. That edit is the only change their tickets authorize to these
files.

**Limits.** In-memory state between requests is checked only statically (concurrent collections,
mutable static collections) and by review. The file check covers the app's content root and the
test output directory, not the whole disk. The tests use WC-6 data; their score checks rely on
WC-6's labels and messages containing no digits.

**How they were checked.** Before review, the pending tests were run against a throwaway
`Program.cs` (not committed): a correct fake implementation passed all 11, and seven deliberate
leaks (option values in the GET response, score in the body, partial score in an error, score in
a header, score in a log, a cookie, a file write) each failed exactly the intended test. The
same run exposed a false positive, now fixed: ProblemDetails' standard `type` URI
(`...rfc9110#section-15.5.1`) matched the partial-score check. The static scan caught the fake's
file write and cookie.
