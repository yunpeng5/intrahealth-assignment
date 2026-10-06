## Review bot: approve

Round 2 · `claude-fable-5-1` · 0 blocking, 0 should-fix, 1 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| 1.4 | met | frontend/src/QuestionnairePages.tsx:18 computes pageComplete from every question on the page; :57 disables Next until complete; :52 Back decrements pageIndex while answers state (:13) persists. Tests: QuestionnaireView.test.tsx 'blocks moving forward until every question on the page is answered' and 'keeps earlier answers when moving back'. |
| 1.5 | met | frontend/src/QuestionnairePages.tsx:29-31 renders 'Page {pageIndex + 1} of {pageCount}' on every page; test 'shows the correct progress on each page' checks 1 of 3, 2 of 3, 3 of 3 and back to 2 of 3. |
| 2.1 | met | Navigation part only: Next/Back controls in QuestionnairePages.tsx:50-60 move through all pages; last page has no Next (:56 !isLastPage) per ticket. Test 'has no forward control on the last page' walks all three pages. |
| 1.3 | met | Ticket's test requirement: QuestionnaireView.test.tsx 'renders a differently paged questionnaire according to its data' uses the `repaged` fixture (3 questions then 1, different option sets) and asserts groups, progress and controls follow the data. |
| D-1 | met | frontend/src/questionnaire.ts:3-25 types carry only id/title/instructions/prompt/label; grep of frontend/src for value/score/band finds only a comment. No numeric values or scoring logic anywhere in the front end. |
| D-3 | met | Single fetch in QuestionnaireView.tsx:16-24 useEffect with [] deps; page moves are pure setPageIndex (QuestionnairePages.tsx:52,57). Test 'makes no network calls ... while moving between pages' asserts fetchMock called once after multiple moves. |
| D-4 | met | Answers in useState (QuestionnairePages.tsx:13); grep of frontend/src shows no localStorage/sessionStorage/cookie/history writes outside test assertions. Test asserts storage empty, cookie empty and URL unchanged after navigation. |
| D-9 | met | frontend/src/questionnaire.ts:30-36 reads ?questionnaire=<id>, falls back to 'wc-6'; QuestionnaireView.tsx:17 uses window.location.search. Tests cover default and named ID; 404 and network failure show a plain alert message (QuestionnaireView.tsx:28). |
| D-15 | met | QuestionnairePages.tsx:57 `disabled={!pageComplete}`; no per-question error messaging is added. Test clicks the disabled Next and asserts the page did not change. |
| T-1 | met | No back-end change; front-end types and UI never request or display a score. questionnaire.ts:1-25. |
| T-2 | n/a | No back-end change in this PR (diff stat is frontend/** and docs/architecture.md only); server write behaviour is unaffected. |
| D-7 | n/a | No server code touched. On the browser side, nothing about answers is written to storage, cookies or URL (QuestionnaireView.test.tsx:308-312), so nothing is sent beyond the single GET. |
| D-8 | n/a | Score handling is server-only and unchanged; the front end has no code path that could receive or log a score. |
| D-13 | met | Diff stat touches no path listed in harness/protected-paths.txt; ticket authorizes none. |
| D-14 | met | No save/resume, session identifier or server-held progress is introduced; sections 1 and 2 behaviour only. |

### Findings

#### nit

- **[correctness]** `frontend/src/QuestionnairePages.tsx:18` (1.4): Page completeness uses the `in` operator on a plain object, so a question whose ID matches an Object.prototype member (e.g. `constructor`, `toString`) would count as answered without a selection.
  - Evidence: `page?.questions.every((question) => question.id in answers)` with `answers` initialised as `{}`; `'toString' in {}` is true.
  - Suggestion: Use `Object.hasOwn(answers, question.id)` or `answers[question.id] !== undefined`, or initialise answers with `Object.create(null)`.
