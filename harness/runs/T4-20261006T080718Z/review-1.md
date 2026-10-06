## Review bot: request changes

Round 1 · `claude-fable-5-1` · 1 blocking, 0 should-fix, 0 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| 1.4 | met | frontend/src/QuestionnairePages.tsx:18 computes pageComplete; :54 disables Next until complete; :49 Back button decrements pageIndex while `answers` state (:13) is untouched, so earlier selections stay checked (:40). Covered by 'blocks moving forward…' and 'keeps earlier answers when moving back' tests. |
| 1.5 | met | frontend/src/QuestionnairePages.tsx:29-31 renders 'Page {pageIndex + 1} of {pageCount}' on every page; asserted per page in QuestionnaireView.test.tsx 'shows the correct progress on each page'. |
| 2.1 | not-met | The paged flow exists (QuestionnaireView.tsx, QuestionnairePages.tsx) but nothing renders it: frontend/src/App.tsx:1-9 still shows only the 'Pulse Check' heading and main.tsx renders App. A visitor opening the app cannot move through any pages. |
| D-1 | met | frontend/src/questionnaire.ts:3-25 types carry id/title/instructions/prompt/label only, matching backend QuestionnaireView.cs records; no values, bands or scoring anywhere in frontend/src. |
| D-3 | met | Single fetch in QuestionnaireView.tsx:15-25 (useEffect with [] deps); QuestionnairePages.tsx has no network code. Test 'makes no network calls … while moving between pages' asserts fetchMock called once after navigating. |
| D-4 | met | Answers held in useState (QuestionnairePages.tsx:13). No localStorage/sessionStorage/cookie/URL writes in frontend/src; test asserts storage empty, cookie empty and URL unchanged after paging. |
| D-9 | met | frontend/src/questionnaire.ts:30-36 reads ?questionnaire=<id>, falls back to 'wc-6'; QuestionnaireView.tsx:17 passes window.location.search. Tests cover default and named ID. |
| D-15 | met | QuestionnairePages.tsx:54 `disabled={!pageComplete}`; no unanswered-question hints are shown. Test clicks disabled Next and asserts page did not change. |
| T-1 | n/a | No back-end change; no client-facing response is produced or altered by this PR. Front-end types accept no score field. |
| T-2 | n/a | No back-end change; the PR only adds front-end files and a docs paragraph. |
| D-7 | n/a | No server code touched; nothing about the questionnaire is sent to the server while paging (D-3 evidence above). |
| D-8 | n/a | No server code touched; the front end has no score field, logic or display. |

### Findings

#### blocking

- **[requirement]** `frontend/src/App.tsx:3` (2.1): The new questionnaire flow is never mounted, so the app still shows only the heading and a visitor cannot load or page through a questionnaire.
  - Evidence: App.tsx:1-9 renders `<main><h1>Pulse Check</h1></main>` and main.tsx renders App. Grep for QuestionnaireView finds it only in its own file and its test. The ticket's Loading behaviour ('the app loads the questionnaire named by ?questionnaire=…') and Goal ('A visitor can move through a questionnaire's pages') are unmet in the running app; the acceptance tests pass only because they render QuestionnaireView directly.
  - Suggestion: Render `<QuestionnaireView />` inside `<main>` in App.tsx (allowed path frontend/**). Update App.test.tsx to stub fetch (or assert the error alert) so it stays green, and add one assertion that App shows the loaded questionnaire title so the wiring is covered.
