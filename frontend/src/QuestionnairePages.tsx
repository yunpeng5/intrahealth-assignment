import { useId, useState } from 'react'
import type { Answers, Questionnaire } from './questionnaire.ts'

interface QuestionnairePagesProps {
  questionnaire: Questionnaire
}

// Shows one page at a time (1.4) with "Page X of Y" (1.5). Forward is disabled until every
// question on the page is answered (D-15); answers persist across pages in React state (D-4).
function QuestionnairePages({ questionnaire }: QuestionnairePagesProps) {
  const groupNamePrefix = useId()
  const [pageIndex, setPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})

  const pageCount = questionnaire.pages.length
  const page = questionnaire.pages[pageIndex]
  const isLastPage = pageIndex === pageCount - 1
  const pageComplete = page?.questions.every((question) => question.id in answers) ?? false

  const select = (questionId: string, optionId: string) =>
    setAnswers((current) => ({ ...current, [questionId]: optionId }))

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
          </div>
        </>
      )}
    </section>
  )
}

export default QuestionnairePages
