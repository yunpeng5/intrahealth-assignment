# Architecture

How the code is laid out and which conventions to follow. Product rules live in
[requirements.md](requirements.md) and [decisions.md](decisions.md).

## Layout (D-10)

```
backend/PulseCheck.slnx                 solution
backend/src/PulseCheck.Api/             ASP.NET Core minimal API (net10.0)
backend/tests/PulseCheck.Api.Tests/     xUnit integration tests (WebApplicationFactory)
frontend/                               Vite + React + TypeScript app
frontend/src/                           components and their tests, side by side
frontend/src/test/setup.ts              Vitest setup (jest-dom matchers, cleanup)
frontend/scripts/run.mjs                runner behind the root setup/verify scripts
package.json                            root scripts (below)
global.json, .nvmrc                     pin .NET 10 SDK (newer feature bands allowed) and Node 24
```

## Back end

- Endpoints are mapped in `Program.cs` under `/api/...`. As the API grows, group related
  endpoints in a static class per feature (e.g. `Questionnaires/QuestionnaireEndpoints.cs`)
  with a `Map...` extension method called from `Program.cs`.
- Namespaces follow folders (`PulseCheck.Api.<Folder>`). File-scoped namespaces, nullable on.
- Questionnaires (`Questionnaires/`, D-5, D-6): one JSON file per questionnaire in the directory
  set by `Questionnaires:DefinitionsPath` (relative paths resolve against the content root;
  default `Questionnaires/Definitions`, which ships `wc-6.json`). `QuestionnaireDefinitionLoader`
  reads and checks every `*.json` file there at startup; an invalid file stops startup with a
  `QuestionnaireDefinitionException` naming the file and the rule. `QuestionnaireCatalog` holds
  the full definitions (values, bands) for back-end use. Responses use the display-only
  `QuestionnaireView` records (D-1); never serialize a `QuestionnaireDefinition`.
- Submissions (`POST /api/questionnaires/{id}/submissions`, D-2): `QuestionnaireScoring` validates
  the answers (errors keyed by question ID, never echoing option IDs), sums the option values and
  looks up the band. The score is a local value in the request handler only (D-7, D-8): it is
  never returned, logged, put in an exception message or stored on any object. The response is a
  `SubmissionResult` (label and next steps only); a `400` is a `ValidationProblem`.
- Tests use `WebApplicationFactory<Program>` and exercise the API over HTTP. One test class
  per endpoint or feature, named `<Feature>Tests`; methods read as behaviour
  (`Get_health_returns_ok_status`).
- Formatting is enforced by `dotnet format --verify-no-changes` (settings in `.editorconfig`).
  Fix locally with `dotnet format backend/PulseCheck.slnx`.

## Front end

- Components are `PascalCase.tsx` in `frontend/src/`; a test sits next to its subject as
  `<Name>.test.tsx`. Tests use React Testing Library queries by role/label, not internals.
- Import `describe`/`it`/`expect` from `vitest` explicitly (no globals).
- Calls to the back end use relative `/api/...` URLs. In development the Vite dev server
  proxies `/api` to `http://localhost:5132` (D-11), so no CORS setup is needed.
- ESLint (`eslint.config.js`) runs with `--max-warnings 0`; TypeScript is checked with `tsc -b`.

## Pending tests (D-12)

Pending tests describe behaviour that is not built yet. They are marked, never skipped.

- Back end: add `[Trait("Category", "Pending")]` to the test method or class.
- Front end: name the file `*.pending.test.ts` or `*.pending.test.tsx`.

`npm run verify` excludes them (`--filter Category!=Pending` and the Vitest `baseline`
project). `npm run verify:pending` runs only them on both sides, prints a PASS/FAIL summary and
always exits 0 unless the runner itself is misused: it is never a gate.

**Promoting** a pending test once its ticket makes it pass: remove the trait (back end) or
rename the file to drop `.pending` (front end), then run `npm run verify`. Promoted tests do
not go back to pending.

## Commands

All from the repository root; they work on Windows and POSIX.

| Command | What it does |
| --- | --- |
| `npm run setup` | `npm ci` in `frontend/`, `dotnet restore` of the solution |
| `npm run verify` | back-end format check, build, tests; front-end lint, typecheck, tests (pending excluded). Stops at the first failing step, names it and exits non-zero |
| `npm run verify:pending` | pending tests on both sides, with a summary; not a gate |
| `npm run dev:api` | runs the API on http://localhost:5132 |
| `npm run dev:web` | runs the Vite dev server (proxies `/api` to the API) |

Per side: `dotnet test backend/PulseCheck.slnx`, and in `frontend/`: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run test:pending`, `npm run build`.
