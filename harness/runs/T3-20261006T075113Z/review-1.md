## Review bot: approve

Round 1 · `claude-fable-5-1` · 0 blocking, 0 should-fix, 1 nit

### Requirements

| ID | Status | Evidence |
|---|---|---|
| 1.2 | met | backend/src/PulseCheck.Api/Questionnaires/QuestionnaireScoring.cs:39-46 sums option values and maps the score to the band whose inclusive min-max contains it; bands come from the definition data (wc-6.json:86-111). |
| 1.6 | met | The score is computed only inside the POST submissions handler (QuestionnaireEndpoints.cs:43). There is no per-page endpoint; GET /api/questionnaires/{id} is unchanged. |
| 2.2 | met | Submission.cs:10-13: SubmissionResult has only Label and NextSteps. SubmissionEndpointTests.cs:61 asserts the body has exactly those two properties with the exact band strings. |
| 2.3 | met | No storage, cache, cookie, static field or file write in the submission path (QuestionnaireEndpoints.cs:29-45, QuestionnaireScoring.cs). Grep of backend/src for ILogger/Console/MemoryCache/ConcurrentDictionary/static mutable fields found nothing. NoServerStateInvariantTests promoted and passing per gates. |
| 2.4 | met | Scoring happens server-side in QuestionnaireScoring.Score; the response type SubmissionResult cannot serialize a score. SubmissionInvariantTests (no JSON numbers, no score in headers) promoted and passing. |
| T-1 | met | SubmissionResult (Submission.cs:10) carries only two strings; ValidationProblem messages (QuestionnaireScoring.cs:21,25,32) contain question IDs only. SubmissionInvariantTests.Successful_submission_contains_no_json_numbers and Submission_headers_carry_no_score are now in the baseline. |
| T-2 | met | No file writes, database, session or cookie code added; NoPersistenceSourceTests and NoServerStateInvariantTests.Completing_a_questionnaire_writes_no_files pass per gate results. |
| D-1 | met | GET endpoint unchanged (QuestionnaireEndpoints.cs:20-21) and still returns QuestionnaireView. The new SubmissionResult exposes no option values, ranges or band indexes. |
| D-2 | met | QuestionnaireEndpoints.cs:24-45: POST /api/questionnaires/{id}/submissions returns 404 for unknown questionnaire, 400 ValidationProblem keyed by question ID for missing answer / unknown question / option not in question (QuestionnaireScoring.cs:14-35), and 200 with exactly { label, nextSteps }. Error messages never include option IDs (verified by SubmissionEndpointTests.cs:107-123 and QuestionnaireScoringTests.cs:99-108). |
| D-6 | met | QuestionnaireScoring.cs:40-42 computes the integer sum of selected option values; BandFor uses inclusive Min <= score <= Max (line 46). QuestionnaireScoringTests.cs:37-46 and 48-57 test the sum across pages and inclusive edges. |
| D-7 | met | Nothing from a request is stored or logged: QuestionnaireScoring is a static class with no fields; the handler keeps score as a local only. No ILogger usage in backend/src. NoServerStateInvariantTests.Completing_a_questionnaire_logs_nothing_derived_from_answers now in baseline and passing. |
| D-8 | met | The score is a local in Submit (QuestionnaireEndpoints.cs:43), passed to BandFor and discarded. It is not returned, not in headers, not in exception messages (Single's failure message carries no value and is unreachable after startup band-coverage validation in QuestionnaireDefinitionLoader.CheckBands), not logged. |
| D-13 | met | Diffs to SubmissionInvariantTests.cs and NoServerStateInvariantTests.cs are exactly one deleted line each: [Trait("Category", "Pending")]. No other protected file is touched; InvariantSupport.cs unchanged. |

### Findings

#### nit

- **[tests]** `backend/tests/PulseCheck.Api.Tests/Questionnaires/SubmissionEndpointTests.cs:107` (D-2): The HTTP-level 'option that does not belong to its question' test cannot actually use an option from another WC-6 question, because every WC-6 question shares the same four option IDs; it uses a nonexistent ID and a question ID instead.
  - Evidence: InlineData values are "sometimes" (not an option anywhere) and "tired" (a question ID). The genuine cross-question case is covered only by the unit test QuestionnaireScoringTests.An_option_from_another_question_is_reported_without_echoing_it against a hand-built definition.
  - Suggestion: Acceptable as is since the unit test covers the real case. Optionally rename the endpoint test to 'Option_id_not_in_the_question_returns_400...' or add a comment noting why WC-6 cannot exercise a cross-question option.
