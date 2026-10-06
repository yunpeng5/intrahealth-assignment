## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 0 should-fix, 2 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| 2.1 | met | frontend/src/QuestionnairePages.tsx:85-94 keeps Next on non-final pages and adds Submit on the last page; test 'sends exactly one POST with every answer, only at final submission' walks all three WC-6 pages and submits. |
| 2.2 | met | frontend/src/QuestionnairePages.tsx:39-47 renders only questionnaire title, result.label and result.nextSteps; frontend/src/questionnaire.ts:62-63 destructures only label/nextSteps so extra fields are dropped. Tests assert no radios, buttons, 'Page X of Y' or any digit remain, including when the response carries score/band fields. |
| 1.6 | met | Only one network call is made before submission: test asserts fetchMock called once (the GET) after reaching and completing the last page, then twice after Submit. No per-page call exists in QuestionnairePages.tsx. |
| D-2 | met | frontend/src/questionnaire.ts:54-58 POSTs to /api/questionnaires/{id}/submissions with JSON body { answers }; test checks URL, method, Content-Type and exact payload. |
| D-3 | met | Page moves are setPageIndex only (QuestionnairePages.tsx:81,86); the browser contacts the server once to load and once to submit, verified by call counts in the submission tests. |
| D-4 | met | Answers live in useState (QuestionnairePages.tsx:20); no storage or cookie APIs are used. The error-path test asserts localStorage, sessionStorage and document.cookie are empty. |
| D-15 | met | frontend/src/QuestionnairePages.tsx:91 disables Submit with !pageComplete \|\| submitting; tests 'blocks submitting until every question on the last page is answered' and 'disables the submit control while the submission is in flight' confirm no POST is sent in either state. |
| T-1 | met | No back-end change in the diff; the front end never computes anything from answers and discards any field other than label/nextSteps (questionnaire.ts:62-63). Test with score/band in the mocked response asserts no digit is displayed. |
| T-2 | met | No back-end files changed (diff stat lists only frontend/** and docs/architecture.md). The front end writes nothing to storage or cookies (asserted in the error-path test). |
| D-1 | met | The Questionnaire types in questionnaire.ts:1-25 are unchanged and display-only; the new SubmissionResult type (questionnaire.ts:47-50) carries only label and nextSteps. No GET contract change. |
| D-7 | met | No server-side code touched; nothing about the visitor's questionnaire is stored client-side either (QuestionnairePages.tsx uses React state only; the error path test checks storage and cookies). |
| D-8 | met | Back end unchanged. The browser requests nothing but label/nextSteps and renders nothing numeric from the answers (QuestionnairePages.tsx:39-47; digit-free assertions in the result tests). |

### Findings

#### nit

- **[quality]** `frontend/src/QuestionnairePages.tsx:76`: The submission-failure alert stays visible on earlier pages after the visitor navigates Back.
  - Evidence: The alert at line 76 is gated only on submitState.status === 'failed', and nothing resets submitState when pageIndex changes, so the 'could not be submitted' message appears on page 1 or 2 after a failed attempt on page 3.
  - Suggestion: Reset submitState to idle in the Back/Next handlers (or when an answer changes). Harmless as is; the author may ignore.
- **[tests]** `harness/runs/T5-20261006T082539Z/transcript-maker-initial-1.jsonl:147`: The ticket's manual check was done with a scripted fetch through the Vite proxy, not by clicking through the UI in a browser.
  - Evidence: The maker's summary says a browser was unavailable and curl was blocked, so it sent the same POST via Node fetch and got 200 { label: 'Some strain', ... } for answers summing to 7. The result screen itself was not observed in a browser.
  - Suggestion: Before merging, a human should load WC-6 in a browser with both servers running and confirm the result screen shows only the label and next steps. The RTL tests already cover the rendered output, so this is confirmation rather than a gap.
