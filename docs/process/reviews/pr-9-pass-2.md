# Review bot output: PR #9, pass 2

PR: Add protected invariant tests (pending until T2/T3)

Exported verbatim from the PR comment posted 2026-10-06T06:28:30Z (https://github.com/yunpeng5/intrahealth-assignment/pull/9#issuecomment-6010714628).
This PR was reviewed with the standalone review command, whose local output is gitignored.

---

## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 3 should-fix, 3 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| T-1 | met | SubmissionInvariantTests.cs:19-77 asserts the 200 body is exactly {label, nextSteps} with the exact WC-6 strings, contains no JSON numbers, that non-standard headers carry no 13 and no score/band/severity/result header, and that the 400 body carries no partial score (15). No product code in this PR, so nothing to violate. |
| T-2 | met | NoServerStateInvariantTests.cs:35-48 snapshots the content root and test output before/after the full flow and fails on any created/changed/deleted file; NoPersistenceSourceTests.cs:22-49 scans backend/src for file-write, database, cache, session/cookie and concurrent/static-collection patterns. Grep of backend/src (excluding bin/obj) finds no matches, so the baseline test passes on current code. |
| 2.2 | met | SubmissionInvariantTests.cs:25-38 requires label "Under pressure" and the exact next-steps text for the score-13 answer set; :41-50 forbids any number in the 200 body. |
| 2.3 | met | NoServerStateInvariantTests.cs covers files (:35), cookies (:51) and answer-derived logs (:65) across load + valid submit + invalid submit; in-memory stores are covered heuristically by NoPersistenceSourceTests.cs:44-47 and the gap is stated in README.md Limits. |
| 2.4 | met | QuestionnaireContractInvariantTests.cs:29-37 forbids numbers in the GET body; :40-49 allows only the D-1 property names; SubmissionInvariantTests.cs:41-50 forbids numbers in the submission body. |
| D-1 | met | QuestionnaireContractInvariantTests.cs:17-18 allowlist equals the D-1 example's properties; :52-61 forbids band labels and next-steps text in the GET body; :64-72 guards against an empty response by requiring every WC-6 question and option ID. |
| D-2 | met | SubmissionInvariantTests.cs:27-29 checks the exact property set {label, nextSteps}; :70-77 checks the 400 body echoes no option ID, no partial score, no label, ignoring only ProblemDetails type/status (InvariantSupport.cs:95-135). |
| D-7 | met | NoServerStateInvariantTests.cs:65-94 captures every log level/category via a provider-specific Trace filter (:73) and fails on option IDs, labels or standalone 13/15; NoPersistenceSourceTests.cs:28-47 flags databases, caches, sessions, cookies, HTTP logging and visitor-state stores. |
| D-8 | met | Score checked in body (SubmissionInvariantTests.cs:41-50), headers (:53-68), error responses (:70-77) and logs (NoServerStateInvariantTests.cs:79-93). |
| D-12 | met | The three endpoint-dependent classes carry [Trait("Category", "Pending")] (NoServerStateInvariantTests.cs:17, QuestionnaireContractInvariantTests.cs:13, SubmissionInvariantTests.cs:13); frontend/scripts/run.mjs:33 excludes them from verify and :43 runs them under verify:pending. NoPersistenceSourceTests.cs has no trait and is baseline. They are marked, not skipped. |
| D-13 | met | docs/decisions.md:195-198 adds only the promotion-limit bullet the ticket allows; harness/protected-paths.txt is untouched (empty) as the ticket requires; README.md 'Promotion' states that the gate authorizes whole files and that the trait-only edit is checked by review. |

### Findings

#### should-fix

- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs:84` (D-7): The standalone 13/15 log check runs over every captured message, including app startup output and full exception stack traces, so framework text can trip it.
  - Evidence: capture is attached before the host starts (:68-74) and the flow runs at :77, but nothing clears capture.Messages in between, so 'Content root path: ...' and other startup lines are checked. CapturingLogger appends {exception} (InvariantSupport.cs:159), whose ToString() contains ':line N' for every frame; a logged exception whose trace hits line 13 or 15 matches \b(13|15)\b. Only elapsed times are stripped (:86-87); the Hosting.Diagnostics 'Request starting/finished' lines also carry request and response Content-Length, which are safe for WC-6 only by coincidence. The ticket asks explicitly whether 13/15 can match standard framework output.
  - Suggestion: Create the client (which starts the host), then call capture.Messages.Clear() before CompleteFlow so only flow-time logs are checked; extend the pre-match stripping to ':line \d+' alongside the elapsed-time pattern; mention the Content-Length coincidence in README Limits.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:26` (D-5): The 'file write' rule flags any `new FileStream`/`new StreamWriter`, so a read-only `new FileStream(path, FileMode.Open, FileAccess.Read)` for loading a questionnaire definition would fail the baseline.
  - Evidence: Pattern `\bnew\s+(FileStream|StreamWriter)\b` matches regardless of mode or access. The ticket's Behaviour says reading questionnaire definitions (D-5) must not trip the scan; the fix message ('Do not write files') would be wrong for that code.
  - Suggestion: Drop `FileStream` from that alternation (keep StreamWriter). Write modes are already caught by the FileMode.(Create|CreateNew|Append|Truncate|OpenOrCreate) alternative; add `\bFileAccess\.(Write|ReadWrite)\b` if you want to keep covering FileStream writes.
- **[quality]** `backend/tests/PulseCheck.Api.Tests/Invariants/README.md:24` (D-13): The tests hard-code question IDs (sleep, nervous, interest, concentration, piling-up) and option IDs that appear in neither D-1 nor the requirements; this binds T2, but the README says the IDs are 'fixed in T2' and nothing in the docs T2 reads states them.
  - Evidence: InvariantSupport.cs:19-21 and :38-56 define the IDs; QuestionnaireContractInvariantTests.cs:68-71 asserts each appears in the GET body. D-1 shows only `tired` and the four option IDs. InvariantSupport.cs will be protected, so if T2 chooses different IDs the pending tests fail for a reason other than missing endpoints and T2 cannot fix them.
  - Suggestion: Reword the README to say these tests fix the WC-6 IDs and list them as a contract T2 must implement, and record as an open question that T2's ticket (or D-1, under a ticket that may edit decisions.md) must state the same IDs before T2 starts.

#### nit

- **[quality]** `backend/tests/PulseCheck.Api.Tests/Invariants/README.md:4` (D-13): README states the five .cs files 'are listed in harness/protected-paths.txt', but that file is empty and the ticket puts the listing after review.
  - Evidence: harness/protected-paths.txt is empty; ticket Out of scope: 'protection is set up after review'.
  - Suggestion: Say the files 'are to be listed' or 'are listed once this PR is merged'.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:41` (D-7): Console/Debug/Trace writes of answers or scores are caught by neither the log capture (ILogger only) nor the static scan, and this gap is not in README Limits.
  - Evidence: CapturingLoggerProvider only sees ILogger calls; the scan's logging rule matches only AddHttpLogging/UseHttpLogging/W3CLogging. A leftover `Console.WriteLine(answers)` passes every test.
  - Suggestion: Add `\b(Console|Debug|Trace)\.Write` to the request/response logging rule (the API has no legitimate Console use), or state the gap under Limits.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs:40` (T-2): The file snapshot is taken after the host has started, so files written during startup are never detected; README Limits does not say so.
  - Evidence: factory.Services (:39) builds and starts the host before FileSnapshot.Take at :40.
  - Suggestion: Add one line to README Limits: the file check covers request handling, not startup; startup writes are left to review.
