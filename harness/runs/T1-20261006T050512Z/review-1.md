## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 0 should-fix, 3 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| D-10 | met | backend/ (PulseCheck.slnx, src/PulseCheck.Api, tests/PulseCheck.Api.Tests), frontend/ (Vite app), docs/architecture.md match the D-10 layout; harness/, .claude/, .github/ untouched. |
| D-11 | met | backend/src/PulseCheck.Api/PulseCheck.Api.csproj:4 targets net10.0 with Microsoft.NET.Sdk.Web; Program.cs uses minimal API MapGet; tests use xunit 2.9.3 + Microsoft.AspNetCore.Mvc.Testing (PulseCheck.Api.Tests.csproj:11-15, HealthEndpointTests.cs:7-8). Front end: vite, react, typescript, vitest, @testing-library/react in frontend/package.json; frontend/vite.config.ts:10-14 proxies /api to http://localhost:5132, matching launchSettings.json:8. No router or styling library. |
| D-12 | met | frontend/scripts/run.mjs:27-36 verify runs format check, build, tests with --filter Category!=Pending, lint, typecheck, vitest baseline project and exits at the first failure naming the step (line 71-73). pending mode (lines 38-44) runs Category=Pending and the vitest pending project, prints PASS/FAIL summary and never gates (gate:false). Pending tests are marked by trait / *.pending.test file name (vite.config.ts:20-35), not Skip. Gate log cmd-3.log shows verify:pending exits 0 with no pending tests. Promotion documented in docs/architecture.md:46-48. |
| T-1 | n/a | No questionnaire or scoring code exists yet; the only endpoint is GET /api/health returning { status: "ok" } (Program.cs:4). |
| T-2 | n/a | No questionnaire code exists. The health endpoint writes nothing; no database, file or session code is added anywhere in backend/. |
| D-1 | n/a | No questionnaire GET endpoint exists yet; nothing is sent to the browser beyond the health status. |
| D-7 | n/a | No questionnaire endpoints, stores, cookies or session middleware. appsettings.json logging is default framework logging only. |
| D-8 | n/a | No score is computed anywhere in this PR. |

### Findings

#### nit

- **[quality]** `frontend/vite.config.ts:25` (D-12): The baseline project's explicit `exclude` replaces Vitest's default exclude list (node_modules, .git, dist).
  - Evidence: vite.config.ts:25 sets exclude to only ['src/**/*.pending.test.{ts,tsx}']; the pending project (which does not set exclude) still shows the defaults in the gate log (cmd-3.log:32). Harmless today because include is scoped to src/**, but it silently drops the defaults.
  - Suggestion: Spread the defaults: `exclude: [...configDefaults.exclude, 'src/**/*.pending.test.{ts,tsx}']` with `configDefaults` imported from 'vitest/config'.
- **[quality]** `backend/tests/PulseCheck.Api.Tests/PulseCheck.Api.Tests.csproj:1`: Test csproj has a UTF-8 BOM, no final newline, and an unused coverlet.collector package; the other csproj and .editorconfig (insert_final_newline, charset utf-8) do not.
  - Evidence: Diff shows `﻿<Project` at line 1 and `\ No newline at end of file`; PulseCheck.Api.csproj has neither. coverlet.collector (line 11) is a template leftover not used by any verify step.
  - Suggestion: Save the file without BOM and with a trailing newline; drop the coverlet.collector reference since no step collects coverage.
- **[quality]** `frontend/scripts/run.mjs:1`: The repo-wide task runner lives under frontend/ although it orchestrates the back end too.
  - Evidence: package.json scripts call `node frontend/scripts/run.mjs`; the script runs dotnet format/build/test. The author flagged this as an open question; a root scripts/ path is not in this ticket's allowed paths, so the placement is a constraint rather than a mistake.
  - Suggestion: Leave as is for this ticket; a later ticket that allows a root `scripts/` path can move it with a one-line change in package.json.
