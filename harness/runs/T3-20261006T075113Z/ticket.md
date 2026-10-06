---
issue: 3
title: T3: Submission endpoint with server-side scoring
---

## Goal

A completed questionnaire can be submitted. The server scores it, maps the score to a severity
band, and returns only the label and next-steps message, keeping nothing.

## Requirements

- 1.2, 1.6, 2.2, 2.3, 2.4, T-1, T-2
- D-2, D-6, D-7, D-8, D-13

## Behaviour

- `POST /api/questionnaires/{id}/submissions` behaves exactly as in D-2.
- The score is the integer sum of the selected options' values (D-6). It is mapped to the band
  whose inclusive `min`–`max` range contains it.
- The response body is exactly `{ "label": ..., "nextSteps": ... }`, with the band's label and
  message unchanged.
- `400` cases: a question with no answer, an unknown question ID, and an option ID that does
  not belong to its question. Error messages refer to question IDs only.
- `404` for an unknown questionnaire.
- No questionnaire answers, scores, labels, submission identifiers or submission state are
  stored, cached or logged (D-7, D-8). Log through `ILogger` only, and nothing derived from
  answers.

**Tests**
- WC-6 band boundaries give the right label and message at scores 0, 4, 5, 9, 10, 14, 15 and
  18.
- Each `400` case, and the `404` case.
- Unit tests for the scoring and band lookup.

**Promotion (D-12, D-13)**
- Make the protected pending test classes `SubmissionInvariantTests` and
  `NoServerStateInvariantTests` pass without changing their assertions, then remove the
  `[Trait("Category", "Pending")]` line from each. That one-line removal per file is the only
  change allowed to those files. Do not change any other protected file.

## Acceptance commands (parsed)

```sh
npm run verify
dotnet test backend/PulseCheck.slnx --nologo --filter "FullyQualifiedName~PulseCheck.Api.Tests.Invariants.SubmissionInvariantTests"
dotnet test backend/PulseCheck.slnx --nologo --filter "FullyQualifiedName~PulseCheck.Api.Tests.Invariants.NoServerStateInvariantTests"
```

## Pending tests to promote

- `backend/tests/PulseCheck.Api.Tests/Invariants/SubmissionInvariantTests.cs`: all tests in
  `SubmissionInvariantTests` (T-1, D-2, D-8)
- `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs`: all tests in
  `NoServerStateInvariantTests` (T-2, D-7)

## Protected test changes (parsed)

- `backend/tests/PulseCheck.Api.Tests/Invariants/SubmissionInvariantTests.cs`: remove the
  `[Trait("Category", "Pending")]` line only (promotion). No other change.
- `backend/tests/PulseCheck.Api.Tests/Invariants/NoServerStateInvariantTests.cs`: remove the
  `[Trait("Category", "Pending")]` line only (promotion). No other change.

## Allowed paths (parsed)

- backend/**
- docs/architecture.md

## Out of scope

- Any front-end change.
- Storing submissions, rate limiting, analytics, or any other scoring method.
- Section 3 (save and resume).
- Any change to the other protected invariant files, including `InvariantSupport.cs`.

## Notes for the reviewer

- Look for the score escaping through the response, headers, exception messages,
  ProblemDetails, logs, or a field on any object that outlives the request.
- Check the boundary tests use the exact band edges.
- The diffs to `SubmissionInvariantTests.cs` and `NoServerStateInvariantTests.cs` must be
  exactly the removal of the `Pending` trait line. Any other change to a protected file is
  blocking (D-13).
