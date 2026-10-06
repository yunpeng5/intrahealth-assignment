# Pulse Check

Pulse Check is a client-facing mental health check-in. A visitor answers a short questionnaire,
one page at a time, and sees a plain-language severity label and a next-steps message. The
numeric score is computed on the server and never sent to the browser, and nothing about the
visitor's answers is stored on the server.

This repository contains the web app (React + TypeScript), the API (C# ASP.NET Core), and the
**harness** that built them: a ticket runner that takes a GitHub Issue to a reviewed pull
request with a coding agent, deterministic checks and a fresh-context review bot.

Interview notes (decisions, harness results, review-bot findings, AI usage, known debt):
**[INTERVIEW.md](INTERVIEW.md)**.

## Scope

Requirements sections 1 and 2 ([docs/requirements.md](docs/requirements.md)) are implemented and
verified end to end. Section 3 (stretch: save and resume) is intentionally not implemented.

## Layout

```
backend/     ASP.NET Core API (.NET 10) and its xUnit tests
  src/PulseCheck.Api/Questionnaires/Definitions/   questionnaire definitions (JSON)
  tests/PulseCheck.Api.Tests/Invariants/           protected invariant tests (see below)
frontend/    React + TypeScript web app (Vite), Vitest + React Testing Library tests
harness/     ticket runner and review bot (Node + TypeScript)
  runs/      one committed record per ticket run, including the review-bot output
docs/        requirements, decisions, architecture, harness design
  process/   prompts and ticket files used outside the ticket runner, exported reviews
CLAUDE.md    instructions and hard rules for coding agents
.claude/     Claude Code project settings
.github/     ticket (issue) template
```

## Prerequisites

- Node 24 (`.nvmrc`)
- .NET 10 SDK (`global.json`)

For running the harness, also: `git`, the GitHub CLI `gh` (authenticated), the Claude Code CLI
`claude` (native install on Windows), and `ANTHROPIC_API_KEY` in the environment.

## Build and verify

From the repository root:

```sh
npm run setup            # install front-end dependencies, restore the back end
npm run verify           # back end: format check, build, tests; front end: lint, typecheck, tests
```

`npm run verify` is the baseline every change must pass. It stops at the first failing step and
names it. `npm run verify:pending` runs tests that describe behaviour not built yet; there are
none at the moment.

## Run

In two terminals:

```sh
npm run dev:api          # API on http://localhost:5132
npm run dev:web          # web app on http://localhost:5173 (proxies /api to the API)
```

Open http://localhost:5173. The app loads the questionnaire named by `?questionnaire=<id>` and
defaults to `wc-6` (the Wellbeing Check), so http://localhost:5173/?questionnaire=wc-6 is the
same page.

**Questionnaires are data.** Each questionnaire is one JSON file in
`backend/src/PulseCheck.Api/Questionnaires/Definitions/` (setting `Questionnaires:DefinitionsPath`).
To add one or change its paging, add or edit a file and restart the API; no code change is
needed. Definitions are validated at startup (unique IDs, integer option values, bands covering
every possible score), and an invalid file stops the API with a message naming the problem.

**API**

| Endpoint | Purpose |
|---|---|
| `GET /api/questionnaires/{id}` | The questionnaire for display: IDs, titles, prompts and option labels only. No option values or bands. `404` if unknown. |
| `POST /api/questionnaires/{id}/submissions` | Body `{ "answers": { "<questionId>": "<optionId>" } }`. Returns only `{ "label", "nextSteps" }`; `400` names unanswered or invalid questions; `404` if unknown. |
| `GET /api/health` | Liveness check. |

## Tests

- `backend/tests/PulseCheck.Api.Tests/`: API integration tests (`WebApplicationFactory`) and unit
  tests for loading, validation and scoring.
- `backend/tests/PulseCheck.Api.Tests/Invariants/`: the **protected invariant tests**: the
  numeric score never appears in a client-facing response, the browser gets no scoring data, and
  nothing is written on the server. They are written independently of the feature tickets and
  listed in `harness/protected-paths.txt`. Their [README](backend/tests/PulseCheck.Api.Tests/Invariants/README.md)
  explains what each one checks and its limits.
- `frontend/src/*.test.tsx`: React Testing Library tests for the paged flow and submission.

## Harness

The harness turns a ticket (a GitHub Issue labelled `ticket`) into a reviewed pull request:
a coding agent changes the code; deterministic gates (allowed paths, protected tests, the
ticket's acceptance commands) decide pass or fail and feed failures back; a separate review bot
in a fresh context reviews the PR against the requirements and posts its findings; a human
merges.

```sh
npm --prefix harness ci                                    # once
npm --prefix harness run ticket -- <issue-number>          # run a ticket end to end
npm --prefix harness run review -- <pr-number>             # run the review bot on a PR
npm --prefix harness run metrics                           # cost and execution table across runs
npm --prefix harness run test                              # harness unit tests
```

Tickets must start from a clean `main`. Details: [harness/README.md](harness/README.md);
design and rationale: [docs/harness-design.md](docs/harness-design.md).

**Tickets.** The tickets are GitHub Issues #1–#5 (template:
[.github/ISSUE_TEMPLATE/ticket.md](.github/ISSUE_TEMPLATE/ticket.md)). Each run also stores the
ticket text it ran with.

**Run and review records.** Each ticket run commits a record to its pull request under
`harness/runs/<run-id>/`: the ticket snapshot (`ticket.md`), inputs and metrics (`run.json`),
gate results (`gates.json`), feedback sent back to the agent (`feedback-<n>.md`), the review-bot
output per round (`review-<n>.md`, `review-<n>.json`), a tool-call trace and human notes. Full
transcripts are not committed. The review bot also posts each review as a PR comment.

| Pull request | Review-bot output |
|---|---|
| #8 T1, #11 T2, #12 T3, #13 T4, #14 T5 | `harness/runs/T<n>-…/review-*.md` |
| #7 harness bootstrap, #9 invariant tests, #10 source-scan change | [docs/process/reviews/](docs/process/reviews/) (these PRs were reviewed with the standalone `review` command) |

## Documentation

- [docs/requirements.md](docs/requirements.md): requirements by ID
- [docs/decisions.md](docs/decisions.md): interpretations and technical choices
- [docs/architecture.md](docs/architecture.md): code layout, conventions, commands
- [docs/harness-design.md](docs/harness-design.md): harness design
- [docs/process/](docs/process/): the harness build prompt, ticket files for PRs reviewed
  outside the ticket runner, exported reviews

Agent instructions and conventions live in [CLAUDE.md](CLAUDE.md),
[docs/architecture.md](docs/architecture.md) and [harness/prompts/](harness/prompts/) (maker,
reviewer and feedback prompts); [.claude/settings.json](.claude/settings.json) holds the
project permissions. There are no separate Claude Code skills: the harness prompts play that
role.
