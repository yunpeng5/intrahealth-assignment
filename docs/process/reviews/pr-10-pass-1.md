# Review bot output: PR #10, pass 1

PR: Narrow the protected source scan before T2

Exported verbatim from the PR comment posted 2026-10-06T07:12:16Z (https://github.com/yunpeng5/intrahealth-assignment/pull/10#issuecomment-6011297016).
This PR was reviewed with the standalone review command, whose local output is gitignored.

---

## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 1 should-fix, 1 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| T-2 | met | NoPersistenceSourceTests.cs:26-52 still flags file writes, databases, distributed caches, sessions/cookies, HTTP logging and Console/Debug/Trace writes; backend/src currently matches none of them (Program.cs is a health endpoint only). The runtime check NoServerStateInvariantTests.cs is unchanged per the diff stat. |
| 2.3 | met | The scan still rejects every persistence mechanism with no legitimate use in this design (NoPersistenceSourceTests.cs:26-52); the dropped in-memory rule could not distinguish a D-5 definition registry from visitor state, and the gap is handed to review explicitly (README.md:52-54). |
| D-7 | met | The narrowed scan keeps the D-7 mechanisms (database, file writes, session, cookies, out-of-process cache, body logging). D-7's 'in-memory store holding answers' clause is now review-only, and both the test summary (NoPersistenceSourceTests.cs:11-13) and README.md:52-54 say so accurately. |
| D-5 | met | Read-only file access remains allowed (NoPersistenceSourceTests.cs:28-31 flags only write modes/access); the in-memory collection rule that would have rejected a loaded-definition registry is gone (NoPersistenceSourceTests.cs:53-54). |
| D-13 | met | Diff stat touches one protected path, backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs, which the ticket's 'Protected test changes' section names. InvariantSupport.cs, QuestionnaireContractInvariantTests.cs, SubmissionInvariantTests.cs and NoServerStateInvariantTests.cs are not in the diff. |
| T-1 | n/a | No product code changes and no scoring endpoints exist yet (backend/src/PulseCheck.Api/Program.cs:1-6 is a health endpoint only). |
| D-1 | n/a | No questionnaire GET endpoint exists and the PR changes no product code. |
| D-8 | n/a | No submission endpoint or scoring code exists; the PR changes only a test, its README and a ticket file. |

### Findings

#### should-fix

- **[requirement]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:43` (D-7): A Redis-backed output cache is no longer detected, although the ticket says out-of-process caches stay flagged.
  - Evidence: The old rule matched `(Add|Use)OutputCache`, which caught `app.UseOutputCache()` regardless of backing store. The new `distributed cache` rule is `\bIDistributedCache\b|\bAddDistributed\w*Cache\b|\bAdd\w*RedisCache\b`. `AddStackExchangeRedisOutputCache(...)` does not contain the substring `RedisCache`, and the package name `Microsoft.AspNetCore.OutputCaching.StackExchangeRedis` has no dot, so the database rule's `StackExchange\.Redis` (line 35) misses it too. Result: a Redis output cache passes the scan.
  - Suggestion: Widen the third alternative to `\bAdd\w*Redis\w*Cache\b` (catches AddStackExchangeRedisCache, AddStackExchangeRedisOutputCache, AddRedisOutputCache). Optionally also add `StackExchangeRedis` (no dot) to the database rule so the package reference in the .csproj is caught.

#### nit

- **[requirement]** `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs:12`: The test comment says in-memory visitor state is 'left to review' but not that no test detects it, which the ticket's Behaviour section asks for.
  - Evidence: Ticket: 'The test's comment and the README state that in-memory visitor state is not detected by any test and is left to review.' README.md:52-54 says both; the test summary (lines 11-13) and the inline comment (lines 53-54) say only 'left to review'.
  - Suggestion: Change line 13 to '...and in-memory visitor state is not detected by any test and is left to review.'
