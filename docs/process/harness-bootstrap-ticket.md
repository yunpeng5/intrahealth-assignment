---
title: T0: Build the harness core (bootstrap)
---

<!--
Ticket file for reviewing the harness bootstrap PR with the standard review bot:
  npm --prefix harness run review -- <pr> --ticket-file docs/process/harness-bootstrap-ticket.md
The harness core could not be built through itself; it was built interactively from
docs/process/harness-build-prompt.md. This ticket restates that scope so the review bot can
review the PR like any other. No gates were run by the harness for this PR.
-->

## Goal

Build the harness core (ticket runner and review bot) described in `docs/harness-design.md`,
following `docs/process/harness-build-prompt.md`. No product code.

## Requirements

- D-12 (verification model), D-13 (protected invariant tests), D-14 (stretch needs an
  authorizing ticket), S-1 (nothing beyond what is specified)
- The global invariants do not apply yet: there is no product code.

## Behaviour

- The implementation matches `docs/harness-design.md`. Every deviation from the design as it
  stood before this PR is reflected in the design doc in this PR.
- The constraints in `docs/process/harness-build-prompt.md` hold: no product code, no changes
  to `docs/requirements.md`, `docs/decisions.md` or the hard rules in `CLAUDE.md`, nothing from
  the design's non-goals, no platform-specific `gh` lookup, the API key is never printed.
- Gates decide pass or fail; failures go back to the maker with bounded retries and the
  max-attempts and no-progress stops; the maker cannot commit, push or run `gh`.
- The review bot runs in a fresh context with read-only tools and a different model, and its
  output is validated against the schema and the verdict rule.
- `harness/runs/` contains no scratch records.

## Acceptance commands (parsed)

```sh
npm --prefix harness run typecheck
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- None

## Allowed paths (parsed)

- harness/**
- docs/harness-design.md
- docs/process/harness-bootstrap-ticket.md
- .claude/settings.json
- .gitignore
- .gitattributes

## Out of scope

- Product code under `backend/` or `frontend/`, and running T1.
- Anything in the design's non-goals.

## Notes for the reviewer

- This PR was built outside the harness, so there are no gate results or run record.
- Check that the design doc changes describe what was actually built.
