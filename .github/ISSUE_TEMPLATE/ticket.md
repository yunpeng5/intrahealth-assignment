---
name: Ticket
about: A unit of work executed by the ticket runner
title: "T<n>: <short title>"
labels: ticket
---

<!--
The ticket runner parses the sections marked (parsed). Keep their headings exactly.
One ticket = one reviewable PR that fits in a single agent session.
-->

## Goal

<!-- One or two sentences: what changes for the user or the project. -->

## Requirements

<!-- Requirement and decision IDs from docs/requirements.md and docs/decisions.md. -->
- 

## Behaviour

<!-- What "done" looks like, as observable behaviour. Specific and checkable. -->
- 

## Acceptance commands (parsed)

<!-- Run from the repo root, in order. All must exit 0. -->
```sh
npm run verify
```

## Pending tests to promote

<!-- Pending tests this ticket must make pass and move into the baseline. "None" if none. -->
- None

## Protected test changes (parsed)

<!-- "None", or the protected test paths this ticket authorizes changing and why (D-13). -->
- None

## Allowed paths (parsed)

<!-- Globs the agent may change. Anything else is flagged as out of scope. -->
- 

## Out of scope

<!-- Things a capable agent might be tempted to do, but must not. -->
- 

## Notes for the reviewer

<!-- Optional: risks, tricky requirements, things to check closely. -->
