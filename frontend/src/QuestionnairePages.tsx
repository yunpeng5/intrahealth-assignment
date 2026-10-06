import { useId, useState } from 'react'
import { submitAnswers, type Answers, type Questionnaire, type SubmissionResult } from './questionnaire.ts'

interface QuestionnairePagesProps {
  questionnaire: Questionnaire
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed' }
  | { status: 'done'; result: SubmissionResult }

// Shows one page at a time (1.4) with "Page X of Y" (1.5). Forward and Submit are disabled until
// every question on the page is answered (D-15); answers persist across pages in React state (D-4).
// Answers are sent once, on final submission (1.6, D-3), and only the label and next steps are shown (2.2).
function QuestionnairePages({ questionnaire }: QuestionnairePagesProps) {
  const groupNamePrefix = useId()
  const [pageIndex, setPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' })

  const pageCount = questionnaire.pages.length
  const page = questionnaire.pages[pageIndex]
  const isLastPage = pageIndex === pageCount - 1
  const pageComplete = page?.questions.every((question) => question.id in answers) ?? false
  const submitting = submitState.status === 'submitting'

  const select = (questionId: string, optionId: string) =>
    setAnswers((current) => ({ ...current, [questionId]: optionId }))

  const submit = () => {
    setSubmitState({ status: 'submitting' })
    submitAnswers(questionnaire.id, answers)
      .then((result) => setSubmitState({ status: 'done', result }))
      .catch(() => setSubmitState({ status: 'failed' }))
  }

  if (submitState.status === 'done') {
    return (
      <section>
        <h2>{questionnaire.title}</h2>
        <h3>{submitState.result.label}</h3>
        <p>{submitState.result.nextSteps}</p>
      </section>
    )
  }

  return (
    <section>
      <h2>{questionnaire.title}</h2>
      {questionnaire.instructions && <p>{questionnaire.instructions}</p>}
      {page && (
        <>
          <p>
            Page {pageIndex + 1} of {pageCount}
          </p>
          {page.title && <h3>{page.title}</h3>}
          {page.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.prompt}</legend>
              {question.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={`${groupNamePrefix}-${question.id}`}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() => select(question.id, option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
          {submitState.status === 'failed' && (
            <p role="alert">Your answers could not be submitted. Please try again.</p>
          )}
          <div>
            {pageIndex > 0 && (
              <button type="button" onClick={() => setPageIndex(pageIndex - 1)}>
                Back
              </button>
            )}
            {!isLastPage && (
              <button type="button" disabled={!pageComplete} onClick={() => setPageIndex(pageIndex + 1)}>
                Next
              </button>
            )}
            {isLastPage && (
              <button type="button" disabled={!pageComplete || submitting} onClick={submit}>
                Submit
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default QuestionnairePages
