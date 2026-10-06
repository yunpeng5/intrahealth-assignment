import { useEffect, useState } from 'react'
import { fetchQuestionnaire, questionnaireIdFromSearch, type Questionnaire } from './questionnaire.ts'
import QuestionnairePages from './QuestionnairePages.tsx'

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; questionnaire: Questionnaire }

// Loads the questionnaire named in the URL (D-9) once, then hands it to the page flow.
// Moving between pages makes no further network calls (D-3).
function QuestionnaireView() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchQuestionnaire(questionnaireIdFromSearch(window.location.search), controller.signal)
      .then((questionnaire) => setState({ status: 'loaded', questionnaire }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'failed' })
        }
      })
    return () => controller.abort()
  }, [])

  if (state.status === 'failed') {
    return <p role="alert">The questionnaire could not be loaded.</p>
  }
  if (state.status === 'loading') {
    return null
  }
  return <QuestionnairePages questionnaire={state.questionnaire} />
}

export default QuestionnaireView
