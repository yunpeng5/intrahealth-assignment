---
issue: 1
title: T1: Initialize the project and verification baseline
---

## Goal

Make the repository runnable and verifiable so later tickets start on a green baseline with the
test setup and conventions already in place. No questionnaire functionality.

## Requirements

- D-10 (layout), D-11 (stack), D-12 (verification model)
- Enabler for all later tickets. Implements no product requirement.

## Behaviour

**Back end**
- `backend/` contains a solution with an ASP.NET Core minimal-API project (`PulseCheck.Api`,
  net10.0) and an xUnit integration test project (`PulseCheck.Api.Tests`) using
  `WebApplicationFactory`.
- A `global.json` pins the .NET 10 SDK, allowing newer feature bands.
- `GET /api/health` returns `200` with `{ "status": "ok" }`. One integration test covers it.

**Front end**
- `frontend/` is a Vite + React + TypeScript app with Vitest, React Testing Library (jsdom)
  and ESLint.
- One smoke test renders the app.
- The Vite dev server proxies `/api` to the back end (D-11).
- `.nvmrc` pins Node 24.

**Root**
- A root `package.json` with:
  - `npm run setup`: installs front-end dependencies and restores the back end.
  - `npm run verify`: back-end format check, back-end build and tests (excluding pending),
    front-end lint, typecheck and tests (excluding pending). Stops with a non-zero exit code on
    the first failure, and makes clear which step failed.
  - `npm run verify:pending`: runs only pending tests on both sides and reports the results.
    Must work when there are no pending tests yet.
  - `npm run dev:api` and `npm run dev:web`: run each side locally.
- Root npm scripts used by acceptance commands must work on both Windows and POSIX
  environments. Keep shell-specific logic out of package scripts; put non-trivial orchestration
  in a small Node script.
- Pending-test mechanism (D-12):
  - Back end: tests with the xUnit trait `Category=Pending`.
  - Front end: files named `*.pending.test.ts(x)`.
  - Both are excluded from `verify` and included in `verify:pending`. Not implemented with
    `Skip`.
- `.gitignore` covers `bin/`, `obj/`, `node_modules/`, `dist/` and `harness/runs/**/transcript*`.

**Docs**
- `docs/architecture.md` (about 80 lines at most): the layout, where back-end and front-end
  code goes, naming and test conventions, how pending tests work and how to promote one, and
  every command.
- Fill in the "Commands" section of `CLAUDE.md`. Change nothing else in it.

**Proof that the gate can fail**
- In your final summary, show that `npm run verify` exits non-zero when one test is
  temporarily broken. Do not commit the broken test.

## Acceptance commands (parsed)

```sh
npm run setup
npm run verify
npm run verify:pending
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- None

## Allowed paths (parsed)

- backend/**
- frontend/**
- package.json
- package-lock.json
- global.json
- .nvmrc
- .gitignore
- .editorconfig
- docs/architecture.md
- CLAUDE.md

## Out of scope

- Any questionnaire model, data, endpoint, scoring or UI.
- Styling, routing, state libraries, CI workflows, Docker.
- Writing invariant tests (they are written separately; see D-13).
- Changes to `harness/`, `docs/requirements.md` or `docs/decisions.md`.

## Notes for the reviewer

- Check that `verify` passes exit codes through on Windows (Node calling `dotnet`), and that
  pending tests are excluded by marking, not by skipping.
- In `CLAUDE.md`, only the Commands section should change.
