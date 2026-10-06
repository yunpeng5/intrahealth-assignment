# Review bot output: PR #9, pass 1

PR: Add protected invariant tests (pending until T2/T3)

Exported verbatim from the PR comment posted 2026-10-06T06:05:13Z (https://github.com/yunpeng5/intrahealth-assignment/pull/9#issuecomment-6010418547).
This PR was reviewed with the standalone review command, whose local output is gitignored.

---

## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 4 should-fix, 2 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| T-1 | met | SubmissionInvariantTests.cs:36-47 (no numbers, no `\b13\b` in the 200 body), :49-66 (headers), :68-84 (no partial 15 in the 400 body); NoServerStateInvariantTests.cs:84 (score in logs). Tests are pending until T3 and fail now only on status code (endpoint missing). |
| T-2 | met | NoPersistenceSourceTests.cs:41-68 static scan of backend/src (baseline, passes on current Program.cs/csproj/appsettings: no rule matches); NoServerStateInvariantTests.cs:35-49 file snapshot of content root and test output, :51-63 no Set-Cookie, :65-91 log capture at Trace. |
| 2.2 | met | SubmissionInvariantTests.cs:18-34 asserts the 200 body is exactly {label, nextSteps}, both strings, label one of the WC-6 labels; :36-47 asserts no score. |
| 2.3 | met | NoServerStateInvariantTests.cs runs load + valid submit + invalid submit and asserts no file changes, no cookies, no answer-derived log lines; NoPersistenceSourceTests.cs bans session/cookie/cache/db APIs in source. |
| 2.4 | met | QuestionnaireContractInvariantTests.cs:28-37 (no numbers in GET) and :39-48 (no scoring property names) keep values/bands off the browser; SubmissionInvariantTests.cs:36-47 keeps the score out of the response. |
| D-1 | met | QuestionnaireContractInvariantTests.cs: no numbers, no scoring property names, no severity label/next-steps text (:50-59), and :61-72 guards against an empty response by requiring every question and option ID. Uses only the URL and JSON shape from D-1, no application types. |
| D-2 | met | SubmissionInvariantTests.cs posts `{ answers }` to /api/questionnaires/wc-6/submissions (InvariantSupport.cs:54-55); asserts exact 200 shape, 400 for an incomplete submission with no option-ID echo, no partial score, no label (:68-84). |
| D-7 | met | NoServerStateInvariantTests.cs (files, cookies, logs at every level via CapturingLoggerProvider + provider-specific Trace filter, :70-75) and NoPersistenceSourceTests.cs (db, cache, session, cookie, HttpLogging, concurrent/static stores). Reading definition files is not matched by the file-write rule (:22). |
| D-8 | met | Score checked in body (SubmissionInvariantTests.cs:44-46), headers (:49-66), error body (:78-79) and logs (NoServerStateInvariantTests.cs:84). |
| D-12 | met | Pending classes carry [Trait("Category", "Pending")] (QuestionnaireContractInvariantTests.cs:11, SubmissionInvariantTests.cs:14, NoServerStateInvariantTests.cs:18); frontend/scripts/run.mjs:33 excludes them from verify and :43 runs them in verify:pending. NoPersistenceSourceTests is baseline and has no trait. |
| D-13 | met | Tests live under backend/tests/PulseCheck.Api.Tests/Invariants/, are black-box, and README.md:1-5,21-23 states the protection and promotion rule. harness/protected-paths.txt is unchanged, as the ticket's Out of scope requires. |

### Findings

#### should-fix

- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:37` (D-7): The in-memory-store rule misses `static readonly` collections (the most common store shape) and flags legitimate concurrent collections holding definitions.
  - Evidence: Pattern `\bstatic\s+(List|Dictionary|HashSet|Queue|Stack)<` requires the type right after `static`, so `private static readonly Dictionary<string, Answers> Store = new();` is not matched, although README.md:25-26 claims mutable static collections are checked. Conversely `\bConcurrent(Dictionary|...)\b` trips on a `ConcurrentDictionary<string, QuestionnaireDefinition>` used only for D-5 definitions, and the scan reads comments too.
  - Suggestion: Change the pattern to `\bstatic\s+(readonly\s+)?(List|Dictionary|HashSet|Queue|Stack)<` and state in README Limits that the rule is syntactic: any concurrent collection or static mutable collection in backend/src (including in comments) trips it, so definition registries must use a plain or frozen dictionary held by a singleton.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs:84` (D-8): The score-in-logs regex misses natural log wording such as "scored 13" or "Score for wc-6: 13".
  - Evidence: `(score|total|sum|result)\W{0,3}(13|15)\b` requires at most three non-word characters between the keyword and the number; `_logger.LogInformation("Submission scored {Score}", 13)` renders "scored 13" (a word character follows "score") and `"Score for {Id}: {Score}"` renders "Score for wc-6: 13", neither matches. A bare `\b13\b` would false-positive on hosting's elapsed-time logs ("13.4ms"), which is presumably why the prefix exists.
  - Suggestion: Use `(score|total|sum|result|points)\w*\W{0,3}(13|15)\b|\b(13|15)\s*(points|/\s*18)` or match `\b(13|15)\b` on messages after stripping `\d+(\.\d+)?ms`. Note the limit in README.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/QuestionnaireContractInvariantTests.cs:15` (D-1): The GET contract is checked with a property-name denylist, so a string-valued option value under an unlisted name passes.
  - Evidence: ForbiddenPropertyNames lists value/score/band/min/max/range/nextSteps/severity/weight. An option `{ "id": "nearly-every-day", "label": "Nearly every day", "points": "3" }` contains no JSON number (passes :28-37) and no listed name (passes :39-48). D-1 defines the full property set (id, title, instructions, pages, questions, prompt, options, label), and SubmissionInvariantTests.cs:24-27 already uses an exact allowlist for the POST response.
  - Suggestion: Replace the denylist with an allowlist: assert `Json.PropertyNames(json)` is a subset of {id, title, instructions, pages, questions, prompt, options, label}, keeping the existing text and number checks.
- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/InvariantSupport.cs:19` (D-1): The tests fix WC-6 question IDs that no requirement or decision defines, and this contract on the shipped definition is not documented.
  - Evidence: QuestionIds hard-codes sleep, nervous, interest, concentration and piling-up; D-1 only shows `tired` and the option IDs. Grep finds these IDs nowhere else in the repo. Questionnaire_response_still_offers_every_option_by_id (:61-72) and every submission test fail unless T2's shipped wc-6.json uses exactly these IDs and is served by the default configuration (the tests never set the D-5 definitions directory). README.md:19 mentions only "shared WC-6 fixture (IDs, ...)".
  - Suggestion: Add a short "Contract on the shipped WC-6 definition" paragraph to README.md listing the required questionnaire, question and option IDs and noting that the default configuration must serve wc-6, so T2 sees it before its tests fail.

#### nit

- **[tests]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:25` (T-2): The static denylist is incomplete and case-sensitive, and README does not say it is a denylist.
  - Evidence: `Sqlite` misses `System.Data.SQLite`; no rule covers SqlServer/Cosmos/MySql/Oracle, `AddDistributedSqlServerCache`, Azure Blob or S3 clients, `File.Open(path, FileMode.Create)`, `FileInfo.CreateText/OpenWrite`, or `Path.GetTempFileName()`. README.md Limits (:25-28) mentions in-memory and file-check scope but not that the db/file rules are a non-exhaustive list.
  - Suggestion: Add RegexOptions.IgnoreCase to the database rule, add `FileMode\.(Create|Append|Truncate)|GetTempFileName` to the file-write rule, and add one sentence to README Limits: the scan is a denylist of common APIs and does not replace review.
- **[quality]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs:41` (T-2): The file snapshot includes the API project's bin/ and obj/ because WebApplicationFactory's content root is the project directory.
  - Evidence: FileSnapshot.Take(contentRoot, AppContext.BaseDirectory) enumerates everything under backend/src/PulseCheck.Api, including build outputs. Harmless under `dotnet test --no-build`, but an IDE background build or `dotnet watch` running during the test would produce spurious "changed:" failures.
  - Suggestion: Skip path segments named bin or obj in FileSnapshot.Take, mirroring the filter in NoPersistenceSourceTests.cs:44.
