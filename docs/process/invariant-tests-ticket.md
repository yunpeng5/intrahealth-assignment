---
title: T0b: Protected invariant tests
---

<!--
Ticket file for reviewing the invariant-tests PR with the standard review bot:
  npm --prefix harness run review -- <pr> --ticket-file docs/process/invariant-tests-ticket.md
These tests are written outside the feature tickets and reviewed by a human before they are
protected (D-13), so this PR did not go through the ticket runner and has no gate results.
-->

## Goal

Add the critical invariant tests that later feature tickets must satisfy and may not weaken:
the score never reaches the client, nothing about a visitor's questionnaire is persisted, and
the browser receives display data only. No product code.

## Requirements

- T-1, T-2, 2.2, 2.3, 2.4
- D-1, D-2, D-7, D-8 (the contracts and rules the tests check)
- D-12 (pending tests are marked, not skipped), D-13 (protected invariant tests)

## Behaviour

- Tests are black-box: only URLs and the JSON contract in D-1/D-2, no application types, so
  they compile and the baseline stays green before the features exist.
- Tests needing endpoints that don't exist yet carry `[Trait("Category", "Pending")]` and fail
  for that reason only; the rest are part of the baseline and pass now.
- A correct implementation of D-1/D-2/D-7/D-8 passes every test; an implementation that leaks
  the score, option values, band text, answers, cookies, files or answer-derived logs fails.
- Tests do not block legitimate code: reading questionnaire definitions (D-5) and ordinary
  in-memory code unrelated to visitor state must not trip them.
- `Invariants/README.md` describes what each file protects, how pending tests are promoted, and
  the tests' limits.

## Acceptance commands (parsed)

```sh
npm run verify
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- None

## Allowed paths (parsed)

- backend/tests/PulseCheck.Api.Tests/Invariants/**
- docs/process/invariant-tests-ticket.md
- docs/decisions.md (D-13 only: the promotion limit, added after the first review)

## Out of scope

- Product code, feature tests, `harness/protected-paths.txt` (protection is set up after review).

## Notes for the reviewer

- Check whether the static scan's patterns could block legitimate T2/T3 code, and whether they
  miss common persistence mechanisms.
- Check whether the fixed score values (13, partial 15) could match coincidental numeric text or
  standard framework output, causing false positives, or miss a real leak.
- Promotion requires T2/T3 to edit these files (remove the `Pending` trait). Check whether the
  promotion model is sound and its limits are stated.
