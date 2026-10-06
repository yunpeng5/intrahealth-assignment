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
