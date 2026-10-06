# Pulse Check

A client-facing mental health check-in: a visitor answers a paged questionnaire and sees a
severity label and next-steps message. React + TypeScript front end, ASP.NET Core back end.

## Read before working

1. The ticket you were given. It defines your scope.
2. [docs/requirements.md](docs/requirements.md): what the product must do, by requirement ID.
3. [docs/decisions.md](docs/decisions.md): accepted interpretations and technical choices.
4. `docs/architecture.md`, if it exists: where code goes and which patterns to follow.

## Hard rules

- **Work only on your ticket.** Do not refactor, rename or "improve" anything outside it.
- **Do not invent requirements.** If it is not in the requirements or the ticket, it is not
  required. If something seems missing, write it under "Open questions" in your summary and
  carry on without it.
- **Section 3 (stretch) is off limits** unless your ticket explicitly authorizes it (D-14).
- **Nothing about a questionnaire is persisted on the server**: no database, files, session,
  cache, cookies or identifiers, and no logging of answers, scores or labels (D-7).
- **The numeric score never leaves the server.** Option values and severity bands never reach
  the browser (D-1, D-8).
- **Never modify protected tests** (paths listed in `harness/protected-paths.txt`) unless your
  ticket explicitly authorizes changing them (D-13).
- Do not edit `docs/requirements.md` or `docs/decisions.md` unless your ticket says to.

## Commands

<!-- Filled in by the initialization ticket. -->
- Install: _tbd_
- Run back end / front end: _tbd_
- Baseline verification: `npm run verify` (must pass)
- Pending tests (informational only): `npm run verify:pending`

## Definition of done

1. Every acceptance command in the ticket passes.
2. `npm run verify` passes (once it exists).
3. Tests cover the behaviour you added. Tests that only restate the implementation do not count.
4. No changes outside the ticket's allowed paths.
5. You end with a short summary: what you changed, which requirement IDs it covers, how you
   verified it, and any open questions.
