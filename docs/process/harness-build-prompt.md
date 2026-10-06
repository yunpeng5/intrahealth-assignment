# Harness build prompt

The prompt given to the coding agent that built the harness core. The design it implements is
[../harness-design.md](../harness-design.md).

---

You are the coding agent building the harness core for the Pulse Check repository
(GitHub: yunpeng5/intrahealth-assignment).

## Read first

1. `docs/harness-design.md`: the design you are implementing.
2. `CLAUDE.md`, `docs/requirements.md`, `docs/decisions.md` (especially D-12 to D-14),
   `.github/ISSUE_TEMPLATE/ticket.md`, and Issue #1 (`gh issue view 1`), so you know what the
   runner has to parse.

## Your job

Build `harness/` as designed, following the design's "Order of work". Work on a branch named
`harness/bootstrap` and make logical implementation commits with clear messages (no
attribution lines).

## Constraints

- Do not write product code (`backend/`, `frontend/`) and do not run T1. T1 runs only after
  the harness is reviewed and merged.
- Do not change `docs/requirements.md`, `docs/decisions.md`, or the hard rules in `CLAUDE.md`.
- Before relying on any `claude` CLI flag, check it with `claude --help`. If a flag in the
  design does not exist, choose the closest supported mechanism.
- Confirm in your scratch runs that both configured model identifiers are accepted by the CLI.
- The harness runs from its own package (`npm --prefix harness ...`) and must not depend on a
  root `package.json`, which T1 creates later.
- If you deviate from the design for any reason, update `docs/harness-design.md` in the same PR
  so it describes what you built, and list the deviation in your hand-back.
- Keep it small and readable. No dependencies beyond TypeScript tooling unless clearly needed.
  Nothing in the design's non-goals.
- Items the design marks best-effort are optional; skip them if they add significant
  complexity.
- Use scratch ticket files (not new GitHub Issues) to test. If you open a scratch PR to test PR
  creation or the review bot, close it and delete its branch afterwards.
- `gh` must be on PATH. If it is not, stop and say so; do not add platform-specific lookups.
- Never print or log `ANTHROPIC_API_KEY`.

## Done when

- A scratch ticket with a deliberately failing acceptance command shows the retry and both stop
  rules (max attempts and no-progress) working, with the run record written correctly.
- A scratch ticket that passes goes all the way to a PR, gets a review comment from the review
  bot, and has its run record committed.
- `npm run metrics` renders a table from the scratch run records.
- `harness/README.md` explains how to run the harness, the flow, and the run record.
- Scratch runs, PRs and branches are cleaned up; `harness/runs/` contains no scratch records.

## Hand back

Open a PR from `harness/bootstrap` to `main` (do not merge it) and end with:
- what you built, file by file, in one line each
- every deviation from the design and why
- the exact commands you used to test, and their outcome
- anything you are unsure about
