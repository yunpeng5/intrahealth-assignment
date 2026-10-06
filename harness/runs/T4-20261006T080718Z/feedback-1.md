## Review: changes requested (round 1)

The review bot found these blocking problems:

- **frontend/src/App.tsx:3** (requirement, 2.1): The new questionnaire flow is never mounted, so the app still shows only the heading and a visitor cannot load or page through a questionnaire.
  - Evidence: App.tsx:1-9 renders `<main><h1>Pulse Check</h1></main>` and main.tsx renders App. Grep for QuestionnaireView finds it only in its own file and its test. The ticket's Loading behaviour ('the app loads the questionnaire named by ?questionnaire=…') and Goal ('A visitor can move through a questionnaire's pages') are unmet in the running app; the acceptance tests pass only because they render QuestionnaireView directly.
  - Suggestion: Render `<QuestionnaireView />` inside `<main>` in App.tsx (allowed path frontend/**). Update App.test.tsx to stub fetch (or assert the error alert) so it stays green, and add one assertion that App shows the loaded questionnaire title so the wiring is covered.

## What to do

Fix each blocking finding. Change nothing else.

Stay within the ticket's allowed paths and the hard rules in CLAUDE.md. Before you finish, run
the acceptance commands yourself. End with the updated summary: what you changed, which
requirement IDs it covers, how you verified it, and open questions.
