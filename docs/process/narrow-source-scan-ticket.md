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

- In-memory collections (static, mutable or concurrent) and in-process caches are no longer
  flagged; a static scan cannot tell a definition registry from visitor state.
- Still flagged: file writes, databases, out-of-process caches, sessions and cookies,
  request-body logging, direct `Console`/`Debug`/`Trace` writes.
- The test's comment and the README state that in-memory visitor state is not detected by any
  test and is left to review (D-7).
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
