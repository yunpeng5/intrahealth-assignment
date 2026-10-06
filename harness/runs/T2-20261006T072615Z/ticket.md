---
issue: 2
title: T2: Questionnaire definitions as data, with a read endpoint
---

## Goal

Questionnaires are loaded from JSON definition files and served to the browser without any
scoring data. WC-6 is the first definition.

## Requirements

- 1.1, 1.2 (bands stored as data), 1.3
- D-1, D-5, D-6, D-7, D-13

## Behaviour

- `wc-6.json` matches the sample in `docs/requirements.md`: title, instructions, pages,
  prompts, options, values, bands and messages. It uses these IDs (the protected invariant tests
  rely on them):
  - Pages: `energy-sleep`, `mood`, `focus`.
  - Questions: `tired`, `sleep`, `nervous`, `interest`, `concentration`, `piling-up`.
  - Options: `not-at-all` (0), `several-days` (1), `more-than-half` (2),
    `nearly-every-day` (3).
  - Bands: `min`/`max` 0–4, 5–9, 10–14, 15–18 (D-6).
- The definitions directory is configurable, and the **default configuration serves the shipped
  `wc-6.json`** (the invariant tests run against the default configuration). At startup, every
  `*.json` file in the directory is loaded and checked against the rules in D-5 and D-6. An
  invalid definition stops startup with a message naming the file and the rule it breaks.
- `GET /api/questionnaires/{id}` behaves exactly as in D-1, including `404` for an unknown ID.
- The full definition, including values and bands, is available inside the back end for the
  scoring work in T3. It is never serialized to a response.

**Tests**
- Integration tests for the endpoint, including `404`.
- Point the app at a fixture directory holding a second questionnaire with different paging,
  and show it is served with no code change (1.3).
- Startup-validation tests: a test per D-5/D-6 rule, showing it rejects a bad definition.

**Promotion (D-12, D-13)**
- Make the protected pending test class `QuestionnaireContractInvariantTests` pass without
  changing its assertions, then remove its `[Trait("Category", "Pending")]` line. That one-line
  removal is the only change allowed to that file. Do not change any other protected file.

## Acceptance commands (parsed)

```sh
npm run verify
dotnet test backend/PulseCheck.slnx --nologo --filter "FullyQualifiedName~PulseCheck.Api.Tests.Invariants.QuestionnaireContractInvariantTests"
```

## Pending tests to promote

- `backend/tests/PulseCheck.Api.Tests/Invariants/QuestionnaireContractInvariantTests.cs`: all
  tests in `QuestionnaireContractInvariantTests` (D-1)

## Protected test changes (parsed)

- `backend/tests/PulseCheck.Api.Tests/Invariants/QuestionnaireContractInvariantTests.cs`:
  remove the `[Trait("Category", "Pending")]` line only (promotion). No other change.

## Allowed paths (parsed)

- backend/**
- docs/architecture.md

## Out of scope

- The submission endpoint and scoring (T3).
- Any front-end change.
- A questionnaire list endpoint, authoring tools, admin endpoints, file watching or hot reload.
- Any change to the other protected invariant files, including `InvariantSupport.cs`.

## Notes for the reviewer

- Verify `wc-6.json` faithfully represents the WC-6 questionnaire data in `docs/requirements.md`.
- Make sure no DTO or serializer path can leak option values, bands or next-steps messages into
  the GET response.
- The diff to `QuestionnaireContractInvariantTests.cs` must be exactly the removal of the
  `Pending` trait line. Any other change to a protected file is blocking (D-13).
