---
title: T0c: Narrow the protected source scan
---

<!--
Ticket file for reviewing the source-scan narrowing PR with the standard review bot:
  npm --prefix harness run review -- <pr> --ticket-file docs/process/narrow-source-scan-ticket.md
A human-reviewed change to a protected test, made outside the feature tickets (D-13). No gate
results: this PR did not go through the ticket runner.
-->

## Goal

Stop the protected source scan from constraining legitimate implementation: it must not reject
a questionnaire-definition registry, while still flagging mechanisms that have no legitimate use
in this design.

## Requirements

- T-2, 2.3, D-7 (what the scan protects), D-5 (definitions are read-only files), D-13

## Behaviour

- The scan keeps only mechanisms that map directly to the requirements: file writes and
  databases (T-2) and sessions and cookies (2.3).
- No longer flagged: in-memory collections, caches (in-process and distributed), HTTP logging
  middleware and `Console`/`Debug`/`Trace` writes. They are technologies or channels, not visitor
  state (updated after the first review: the original version of this PR kept distributed
  caches, logging middleware and console writes).
- The test's comment and the README state that in-memory visitor state, direct console output
  and unlisted persistence mechanisms are not detected by any test and are left to review (D-7).
- No other protected file changes; the pending invariant tests are unchanged.

## Acceptance commands (parsed)

```sh
npm run verify
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- `backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs`: narrow the rules
  as described above.

## Allowed paths (parsed)

- backend/tests/PulseCheck.Api.Tests/Invariants/NoPersistenceSourceTests.cs
- backend/tests/PulseCheck.Api.Tests/Invariants/README.md
- docs/process/narrow-source-scan-ticket.md

## Out of scope

- Product code, other invariant tests, `harness/`.

## Notes for the reviewer

- Check that the remaining rules still cannot match legitimate T2/T3 code, and that the weakened
  coverage is stated accurately.
