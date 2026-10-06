// Display-only questionnaire as returned by GET /api/questionnaires/{id} (D-1).
// It carries IDs, titles, prompts and option labels only: no values, scoring or bands.
export interface QuestionnaireOption {
  id: string
  label: string
}

export interface QuestionnaireQuestion {
  id: string
  prompt: string
  options: QuestionnaireOption[]
}

export interface QuestionnairePage {
  id: string
  title?: string | null
  questions: QuestionnaireQuestion[]
}

export interface Questionnaire {
  id: string
  title: string
  instructions?: string | null
  pages: QuestionnairePage[]
}

// Selected option ID per question ID. Held in React state only (D-4).
export type Answers = Record<string, string>

export const defaultQuestionnaireId = 'wc-6'

// The questionnaire named by `?questionnaire=<id>`, or the configured default (D-9).
export function questionnaireIdFromSearch(search: string): string {
  const id = new URLSearchParams(search).get('questionnaire')?.trim()
  return id ? id : defaultQuestionnaireId
}

export async function fetchQuestionnaire(id: string, signal?: AbortSignal): Promise<Questionnaire> {
  const response = await fetch(`/api/questionnaires/${encodeURIComponent(id)}`, { signal })
  if (!response.ok) {
    throw new Error(`Loading questionnaire failed with status ${response.status}`)
  }
  return (await response.json()) as Questionnaire
}

// The only scoring output the browser receives (D-2): a label and a next-steps message, no score.
export interface SubmissionResult {
  label: string
  nextSteps: string
}

// The single submission call (D-2, D-3). Scoring happens on the server only (1.6).
export async function submitAnswers(id: string, answers: Answers): Promise<SubmissionResult> {
  const response = await fetch(`/api/questionnaires/${encodeURIComponent(id)}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
  if (!response.ok) {
    throw new Error(`Submitting answers failed with status ${response.status}`)
  }
  const { label, nextSteps } = (await response.json()) as SubmissionResult
  return { label, nextSteps }
}
