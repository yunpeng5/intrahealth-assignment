---
issue: 5
title: T5: Submit and show the result
---

## Goal

A visitor who completes the last page can submit and sees their severity label and next-steps
message, never a number. This completes sections 1 and 2 end to end.

## Requirements

- 2.1, 2.2, 1.6
- D-2, D-3, D-4, D-15

## Behaviour

- **Submit control:** the last page gets a Submit control. Like the forward control, it is
  disabled until every question on the page is answered (D-15).
- **Submitting:** sends a single `POST /api/questionnaires/{id}/submissions` with
  `{ answers: { questionId: optionId } }`.
- **Result screen:** shows the returned `label` and `nextSteps`, and no number of any kind
  derived from the answers.
- **While submitting:** the control is disabled, so the answers are not sent twice.
- **On failure:** the visitor sees a plain error message. Their answers are kept so they can
  try again.

**Tests (React Testing Library, network mocked)**
- Submit is blocked on an incomplete last page.
- Exactly one POST is sent, with the expected payload, and only at final submission.
- The result renders the label and message.
- The error path keeps the answers.

**Manual check (recorded in the summary):** with both servers running, complete WC-6 once and
note the result shown.

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

- Restarting or retaking flows, sharing or printing results, save and resume (section 3).
- Any back-end change.

## Notes for the reviewer

- Check that no score, band index or range is computed or displayed in the browser.
