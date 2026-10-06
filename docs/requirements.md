# Pulse Check — Requirements

This is the working requirements source for everyone building or reviewing Pulse Check:
people, coding agents, and the review bot. Every ticket cites requirements by ID.

How we interpret these requirements is recorded in [decisions.md](decisions.md).
If this file and a decision seem to conflict, this file wins and the decision must be fixed.

## Product context

Pulse Check is a client-facing mental health application. People use it to check how they
are doing before they are anyone's patient.

- Front end: React and TypeScript.
- Back end: C# on ASP.NET Core.

## Scope rules

- **S-1** The requirements are complete. If something is not specified, it is not required.
- **S-2** Sign-in and accounts are out of scope.
- **S-3** Section 3 is stretch.

## 1. Questionnaires

- **1.1** A questionnaire is a titled list of questions split into pages. Each question has a
  prompt and fixed answer options, each with a numeric value. Which questions sit on which page
  is part of the questionnaire data.
- **1.2** A questionnaire has a score computed from the answers, and severity bands mapping
  score ranges to a plain-language label.
- **1.3** Questionnaires are data, not code. Adding a second questionnaire, or changing how its
  questions are paged, requires no code change.
- **1.4** The client moves through pages one at a time, forward and back. Every question on a
  page must be answered before moving forward. Moving back keeps the answers already given.
- **1.5** The client sees where they are: page number and total, or equivalent.
- **1.6** The score is computed only on final submission, never per page.

## 2. Submission

- **2.1** A visitor can complete a questionnaire, moving through all its pages.
- **2.2** On submission, the visitor sees their severity label and a next-steps message. Never
  the numeric score.
- **2.3** Nothing about a questionnaire is persisted on the server at any point, including
  between pages. No answers, no score, no identifier.
- **2.4** The score is computed on the server, not in the browser, and is never returned to it.

## 3. Stretch: save and resume without sign-in

Only after sections 1 and 2 run end to end. These requirements change what the server may store.

- **3.1** A visitor can save a partially completed questionnaire and resume it later in the
  same browser, without creating an account. The browser holds an anonymous session identifier;
  the server holds the saved answers and the page last reached under that identifier and
  nothing else.
- **3.2** On resume, the visitor lands on the page last reached with their answers intact.
- **3.3** Once submitted, a questionnaire is read-only. The visitor can reopen it and review
  their answers. The severity label is shown; the score is not stored with the answers and is
  not returned.
- **3.4** Saved and submitted questionnaires under an anonymous session expire after a period
  we choose, and are deleted.
- **3.5** 2.3 still applies to any questionnaire the visitor did not choose to save.

## Critical properties to test

- **T-1** The numeric score never appears in a client-facing response.
- **T-2** Nothing is written on the server.

## Sample questionnaire: Wellbeing Check (WC-6)

Invented for this exercise, not a clinical instrument.

Over the past two weeks, how often have you been bothered by the following? Options for every
question: Not at all (0), Several days (1), More than half the days (2), Nearly every day (3).

**Page 1: Energy and sleep**

1. Feeling tired or having little energy
2. Trouble falling or staying asleep

**Page 2: Mood**

1. Feeling nervous or on edge
2. Little interest or pleasure in doing things

**Page 3: Focus**

1. Difficulty concentrating
2. Feeling that things are piling up

Score is the sum, 0 to 18.

| Score | Severity label | Next-steps message |
| --- | --- | --- |
| 0 to 4 | Doing well | Keep doing what works for you. You can check in again any time. |
| 5 to 9 | Some strain | Consider a self-guided resource. Checking in weekly helps you see patterns. |
| 10 to 14 | Under pressure | It may help to talk to someone. You can request care from this portal. |
| 15 to 18 | Struggling | Please consider reaching out for support soon. If you are in crisis, contact a crisis line now. |
