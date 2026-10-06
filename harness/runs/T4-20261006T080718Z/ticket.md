---
issue: 4
title: T4: Paged questionnaire flow in the browser
---

## Goal

A visitor can move through a questionnaire's pages one at a time, with answers required before
moving forward and kept when moving back.

## Requirements

- 1.4, 1.5, 2.1 (navigation part)
- D-1, D-3, D-4, D-9, D-15

## Behaviour

- **Loading:** the app loads the questionnaire named by `?questionnaire=<id>`, falling back to
  the configured default `wc-6` (D-9), from `GET /api/questionnaires/{id}`. If loading fails,
  the visitor sees a plain error message.
- **Pages:** each page shows the questionnaire title, the instructions, the page title, and
  each question with its options as a single-choice group.
- **Moving forward:** the forward control is disabled until every question on the current
  page is answered (D-15).
- **Moving back:** goes to the previous page with earlier answers still selected.
- **Progress:** the visitor always sees "Page X of Y".
- **Last page:** has no forward control. Submission is added in T5.
- **Answer storage:** answers live only in React state (D-4). No storage APIs, and no network
  calls while moving between pages (D-3).

**Tests (React Testing Library, network mocked)**
- Moving forward is blocked on an incomplete page.
- Moving back keeps earlier answers.
- The progress indicator is correct on each page.
- A fixture with different paging is rendered according to its data (1.3).
- No fetch calls happen while moving between pages.

## Acceptance commands (parsed)

```sh
npm run verify
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- None

## Allowed paths (parsed)

- frontend/**
- docs/architecture.md

## Out of scope

- Submission and the result screen (T5).
- Any back-end change.
- Questionnaire lists or pickers, saving progress, routing libraries, theming, animations,
  extra text not in the data.

## Notes for the reviewer

- Check the code holds no numeric values or score logic.
- Check nothing is written to browser storage.
