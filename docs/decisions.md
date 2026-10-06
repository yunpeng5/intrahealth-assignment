# Decisions

How we interpret [requirements.md](requirements.md) where it leaves room, plus project-level
technical and process choices. Agents follow accepted decisions and do not change this file
unless a ticket says so. If a decision conflicts with a requirement, the requirement wins.

Each decision has a status: **Accepted**, **Proposed**, or **Superseded by D-n**.

---

## Product and API

### D-1 The browser gets only display data — Accepted
Requirements: 1.1, 2.4

The full questionnaire definition (option values, scoring method, severity bands) stays on the
server. The browser receives only what it needs to display the questionnaire.

`GET /api/questionnaires/{id}` → `200`, or `404` if unknown

```json
{
  "id": "wc-6",
  "title": "Wellbeing Check (WC-6)",
  "instructions": "Over the past two weeks, how often have you been bothered by the following?",
  "pages": [
    {
      "id": "energy-sleep",
      "title": "Energy and sleep",
      "questions": [
        {
          "id": "tired",
          "prompt": "Feeling tired or having little energy",
          "options": [
            { "id": "not-at-all", "label": "Not at all" },
            { "id": "several-days", "label": "Several days" },
            { "id": "more-than-half", "label": "More than half the days" },
            { "id": "nearly-every-day", "label": "Nearly every day" }
          ]
        }
      ]
    }
  ]
}
```

- No option values, score ranges, band labels or next-steps messages in any GET response.
  If the browser had values and bands, it could compute the score, which goes against 2.4.
- IDs are stable strings, not array positions, so re-paging a questionnaire (1.3) never changes
  what a submitted answer means.

### D-2 Submission contract — Accepted
Requirements: 1.2, 1.6, 2.2, 2.4

`POST /api/questionnaires/{id}/submissions`

```json
{ "answers": { "tired": "several-days", "sleep": "not-at-all" } }
```

- `200` → `{ "label": "Some strain", "nextSteps": "Consider a self-guided resource. ..." }` and
  nothing else. No score, band index, band range or answer echo, in the body or the headers.
- `400` when answers are incomplete or invalid: a missing question, an unknown question ID, or
  an option ID that does not belong to that question. The error says what is wrong in terms of
  question IDs. It never echoes option IDs, values or any partial score.
- `404` when the questionnaire ID is unknown.

### D-3 Page completeness is checked only in the browser — Accepted
Requirements: 1.4, 1.6, 2.3

There is no server call per page. Moving between pages is purely client-side; the browser
contacts the server once to load the questionnaire and once to submit. The server checks
completeness again on submission (D-2).

### D-4 Answers live only in browser memory — Accepted
Requirements: 2.3, S-1

Answers are held in React state only. No `localStorage`, `sessionStorage`, cookies or URL
parameters. Reloading the page loses progress. That is acceptable: saving is stretch
requirement 3.1.

### D-5 Questionnaire definitions are JSON files — Accepted
Requirements: 1.1, 1.2, 1.3

- One JSON file per questionnaire, in a configurable directory in the back end. Tests point it
  at fixture directories. Adding or re-paging a questionnaire means adding or editing a file.
- All files are loaded and checked when the app starts. An invalid definition stops startup
  with an error naming the file and the problem.
- Startup checks are limited to what correct behaviour depends on: unique IDs (questionnaire,
  page, question, option within a question) so answers map unambiguously; every question has at
  least one option, so it can be answered (2.1); option values are integers (D-6); bands follow
  the rules in D-6, so every possible score has a label (2.2). Other shape rules (minimum
  questions per page, minimum options per question) are not required and are not enforced.
- Reading definition files at startup is not persistence. The server never writes them.

### D-6 Integer scoring, declared in the data — Accepted
Requirements: 1.1, 1.2, 1.3

- **Option values and scores are integers.** 1.1 says only "numeric", but the supplied scoring
  model is entirely whole numbers: option values 0–3, a total of 0–18, and bands 0–4, 5–9,
  10–14 and 15–18. Using integers matches that model and avoids inventing rules for fractional
  scores, which the requirements do not define (S-1). A definition with a non-integer value
  fails startup validation.
- Each definition declares `"scoring": "sum"`. Sum is the only supported method; any other value
  fails startup validation. **Known debt:** a questionnaire that scores differently would need
  code, which pushes against 1.3.
- Each band has an inclusive integer `min` and `max`, a `label` and a `nextSteps` message,
  matching the sample table. Startup validation requires that bands do not overlap and together
  cover every integer from the lowest to the highest possible score, with no gaps.

### D-7 Strict non-persistence — Accepted
Requirements: 2.3, T-2

In sections 1 and 2, the server keeps nothing about a visitor's questionnaire. This covers
answers and anything derived from them or tied to them; questionnaire definitions are read-only
data (D-5) and are not affected.

- No database, no file writes, and no server-side session, cache or in-memory store holding
  answers, scores, labels or progress.
- No identifiers for visitors or submissions, and no cookies.
- Logs never contain answers, scores, labels or request bodies of questionnaire endpoints.
  Ordinary framework logging that carries none of these is fine.

### D-8 The score never leaves the server — Accepted
Requirements: 2.2, 2.4, T-1

The score is not returned, not put in headers or error messages, not logged, and not kept
beyond the request that computed it.

### D-9 The front end opens a questionnaire by ID — Accepted
Requirements: 1.3, S-1

The front end loads the questionnaire named by the `?questionnaire=<id>` query parameter,
falling back to a configured default (`wc-6`). A second questionnaire is reachable by URL with
no code change. There is no list endpoint, picker or start page; 1.3 does not require one.

### D-15 An incomplete page simply blocks moving forward — Accepted
Requirements: 1.4, S-1

The forward control (and, on the last page, the Submit control) is disabled until every question
on the current page is answered. 1.4 only requires that moving forward is blocked; pointing out
which questions are unanswered is not required.

### Considered, not adopted
- **A questionnaire list endpoint and picker.** 1.3 asks that questionnaires be data; it does
  not ask for a way to browse them (S-1).
- **`Cache-Control: no-store` on the submission response.** Browser caching is not server
  persistence, and S-1 says unspecified means not required. Possible later hardening.

---

## Technical

### D-10 Repository layout — Accepted

```
backend/    ASP.NET Core API and its tests
frontend/   React + TypeScript app and its tests
harness/    ticket runner and review bot (Node + TypeScript)
docs/       requirements, decisions, architecture
.claude/    Claude Code settings and skills
.github/    issue template
```

### D-11 Stack — Accepted

- Back end: .NET 10, ASP.NET Core minimal APIs, xUnit with `WebApplicationFactory`
  for integration tests.
- Front end: Node 24, Vite, React, TypeScript, Vitest, React Testing Library. No router or
  styling library unless a ticket needs one.
- In development, the Vite dev server proxies `/api` to the back end, so no CORS setup is needed.

### D-12 Verification model — Accepted

- `npm run verify` (from the repo root) is the baseline. It must stay green on `main` and is
  part of every ticket's definition of done.
- `npm run verify:pending` runs tests that describe behaviour not built yet. It reports them but
  is never a gate. Pending tests are clearly marked (an xUnit trait on the back end, a separate
  test location on the front end) and are never silently skipped.
- When a ticket makes its pending tests pass, it moves them into the baseline ("promotion").
  Promoted tests do not go back to pending.

---

## Process

### D-13 Protected invariant tests — Accepted

- The critical invariant tests (T-1, T-2, D-1, D-7, D-8) are written separately from the
  feature tickets, independently of the agents that implement features, and reviewed by a human.
- They become protected before T2 starts: their paths are listed in
  `harness/protected-paths.txt`.
- A ticket may change protected tests only if it explicitly authorizes changing them. Both the
  ticket runner and the review bot treat any other change as blocking.

### D-14 Stretch needs an authorizing ticket — Accepted
Requirements: S-3

We decide whether to attempt section 3 only after sections 1 and 2 work end to end. Until a
ticket explicitly authorizes section 3 work, agents treat sections 1 and 2 as the rules in
force, and the review bot treats section 3 behaviour as out of scope.
