import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Questionnaire } from './questionnaire.ts'
import QuestionnaireView from './QuestionnaireView.tsx'

const frequencyOptions = [
  { id: 'not-at-all', label: 'Not at all' },
  { id: 'several-days', label: 'Several days' },
  { id: 'more-than-half', label: 'More than half the days' },
  { id: 'nearly-every-day', label: 'Nearly every day' },
]

// Display-only shape from D-1 for the sample questionnaire.
const wc6: Questionnaire = {
  id: 'wc-6',
  title: 'Wellbeing Check (WC-6)',
  instructions: 'Over the past two weeks, how often have you been bothered by the following?',
  pages: [
    {
      id: 'energy-sleep',
      title: 'Energy and sleep',
      questions: [
        { id: 'tired', prompt: 'Feeling tired or having little energy', options: frequencyOptions },
        { id: 'sleep', prompt: 'Trouble falling or staying asleep', options: frequencyOptions },
      ],
    },
    {
      id: 'mood',
      title: 'Mood',
      questions: [
        { id: 'nervous', prompt: 'Feeling nervous or on edge', options: frequencyOptions },
        { id: 'interest', prompt: 'Little interest or pleasure in doing things', options: frequencyOptions },
      ],
    },
    {
      id: 'focus',
      title: 'Focus',
      questions: [
        { id: 'concentrating', prompt: 'Difficulty concentrating', options: frequencyOptions },
        { id: 'piling-up', prompt: 'Feeling that things are piling up', options: frequencyOptions },
      ],
    },
  ],
}

// A different questionnaire, paged differently: three questions, then one (1.3).
const repaged: Questionnaire = {
  id: 'repaged',
  title: 'Repaged Check',
  instructions: 'Pick one answer per question.',
  pages: [
    {
      id: 'first',
      title: 'First block',
      questions: [
        { id: 'q1', prompt: 'Question one', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
        { id: 'q2', prompt: 'Question two', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
        { id: 'q3', prompt: 'Question three', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
      ],
    },
    {
      id: 'second',
      title: 'Second block',
      questions: [
        {
          id: 'q4',
          prompt: 'Question four',
          options: [
            { id: 'a', label: 'Option A' },
            { id: 'b', label: 'Option B' },
            { id: 'c', label: 'Option C' },
          ],
        },
      ],
    },
  ],
}

const fetchMock = vi.fn<typeof fetch>()

function respondWith(questionnaire: Questionnaire) {
  fetchMock.mockResolvedValue(Response.json(questionnaire))
}

function setSearch(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

async function renderLoaded(title: string) {
  render(<QuestionnaireView />)
  await screen.findByRole('heading', { name: title })
}

function question(prompt: string) {
  return screen.getByRole('group', { name: prompt })
}

function answer(prompt: string, optionLabel: string) {
  fireEvent.click(within(question(prompt)).getByRole('radio', { name: optionLabel }))
}

const next = () => screen.getByRole('button', { name: 'Next' })
const back = () => screen.getByRole('button', { name: 'Back' })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setSearch('')
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  setSearch('')
})

describe('QuestionnaireView loading', () => {
  it('loads the default questionnaire when the URL names none', async () => {
    respondWith(wc6)

    await renderLoaded('Wellbeing Check (WC-6)')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/questionnaires/wc-6')
  })

  it('loads the questionnaire named by the query parameter', async () => {
    setSearch('?questionnaire=repaged')
    respondWith(repaged)

    await renderLoaded('Repaged Check')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/questionnaires/repaged')
  })

  it('shows an error message when the questionnaire is not found', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    render(<QuestionnaireView />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The questionnaire could not be loaded.')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<QuestionnaireView />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The questionnaire could not be loaded.')
  })

  it('shows the title, instructions, page title and each question as a single-choice group', async () => {
    respondWith(wc6)

    await renderLoaded('Wellbeing Check (WC-6)')

    expect(screen.getByText(wc6.instructions!)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Energy and sleep' })).toBeInTheDocument()
    expect(screen.getAllByRole('group')).toHaveLength(2)
    for (const prompt of ['Feeling tired or having little energy', 'Trouble falling or staying asleep']) {
      const radios = within(question(prompt)).getAllByRole('radio')
      expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(
        frequencyOptions.map((option) => option.label),
      )
    }

    answer('Feeling tired or having little energy', 'Several days')
    answer('Feeling tired or having little energy', 'Nearly every day')

    const tired = question('Feeling tired or having little energy')
    expect(within(tired).getByRole('radio', { name: 'Nearly every day' })).toBeChecked()
    expect(within(tired).getByRole('radio', { name: 'Several days' })).not.toBeChecked()
    expect(within(question('Trouble falling or staying asleep')).getByRole('radio', { name: 'Nearly every day' }))
      .not.toBeChecked()
  })
})

describe('QuestionnaireView paging', () => {
  it('blocks moving forward until every question on the page is answered', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')

    expect(next()).toBeDisabled()
    fireEvent.click(next())
    expect(screen.getByRole('heading', { name: 'Energy and sleep' })).toBeInTheDocument()

    answer('Feeling tired or having little energy', 'Not at all')
    expect(next()).toBeDisabled()

    answer('Trouble falling or staying asleep', 'Several days')
    expect(next()).toBeEnabled()

    fireEvent.click(next())
    expect(screen.getByRole('heading', { name: 'Mood' })).toBeInTheDocument()
    expect(next()).toBeDisabled()
  })

  it('keeps earlier answers when moving back', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')

    answer('Feeling tired or having little energy', 'More than half the days')
    answer('Trouble falling or staying asleep', 'Not at all')
    fireEvent.click(next())
    answer('Feeling nervous or on edge', 'Nearly every day')
    answer('Little interest or pleasure in doing things', 'Several days')
    fireEvent.click(next())

    fireEvent.click(back())
    expect(screen.getByRole('heading', { name: 'Mood' })).toBeInTheDocument()
    expect(within(question('Feeling nervous or on edge')).getByRole('radio', { name: 'Nearly every day' }))
      .toBeChecked()
    expect(within(question('Little interest or pleasure in doing things')).getByRole('radio', { name: 'Several days' }))
      .toBeChecked()
    expect(next()).toBeEnabled()

    fireEvent.click(back())
    expect(screen.getByRole('heading', { name: 'Energy and sleep' })).toBeInTheDocument()
    expect(within(question('Feeling tired or having little energy')).getByRole('radio', { name: 'More than half the days' }))
      .toBeChecked()
    expect(within(question('Trouble falling or staying asleep')).getByRole('radio', { name: 'Not at all' }))
      .toBeChecked()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('shows the correct progress on each page', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    answer('Feeling tired or having little energy', 'Not at all')
    answer('Trouble falling or staying asleep', 'Not at all')
    fireEvent.click(next())

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    answer('Feeling nervous or on edge', 'Not at all')
    answer('Little interest or pleasure in doing things', 'Not at all')
    fireEvent.click(next())

    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    fireEvent.click(back())
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('has no forward control on the last page', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')

    for (const page of wc6.pages.slice(0, -1)) {
      for (const q of page.questions) {
        answer(q.prompt, 'Not at all')
      }
      fireEvent.click(next())
    }

    expect(screen.getByRole('heading', { name: 'Focus' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(back()).toBeInTheDocument()
  })

  it('renders a differently paged questionnaire according to its data', async () => {
    setSearch('?questionnaire=repaged')
    respondWith(repaged)
    await renderLoaded('Repaged Check')

    expect(screen.getByText('Pick one answer per question.')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'First block' })).toBeInTheDocument()
    expect(screen.getAllByRole('group').map((group) => group.querySelector('legend')?.textContent)).toEqual([
      'Question one',
      'Question two',
      'Question three',
    ])

    answer('Question one', 'Yes')
    answer('Question two', 'No')
    expect(next()).toBeDisabled()
    answer('Question three', 'Yes')
    fireEvent.click(next())

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Second block' })).toBeInTheDocument()
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(within(question('Question four')).getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('makes no network calls and writes no browser storage while moving between pages', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const urlBefore = window.location.href

    answer('Feeling tired or having little energy', 'Several days')
    answer('Trouble falling or staying asleep', 'Several days')
    fireEvent.click(next())
    answer('Feeling nervous or on edge', 'Several days')
    answer('Little interest or pleasure in doing things', 'Several days')
    fireEvent.click(next())
    answer('Difficulty concentrating', 'Several days')
    fireEvent.click(back())
    fireEvent.click(back())
    fireEvent.click(next())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
    expect(document.cookie).toBe('')
    expect(window.location.href).toBe(urlBefore)
  })
})

describe('QuestionnaireView submission', () => {
  const result = { label: 'Some strain', nextSteps: 'Consider a self-guided resource.' }

  const submit = () => screen.getByRole('button', { name: 'Submit' })

  // Answers the first pages and moves to the last one, without answering it.
  function reachLastPage() {
    answer('Feeling tired or having little energy', 'More than half the days')
    answer('Trouble falling or staying asleep', 'Not at all')
    fireEvent.click(next())
    answer('Feeling nervous or on edge', 'Nearly every day')
    answer('Little interest or pleasure in doing things', 'Several days')
    fireEvent.click(next())
  }

  function answerLastPage() {
    answer('Difficulty concentrating', 'Not at all')
    answer('Feeling that things are piling up', 'Nearly every day')
  }

  const expectedPayload = {
    answers: {
      tired: 'more-than-half',
      sleep: 'not-at-all',
      nervous: 'nearly-every-day',
      interest: 'several-days',
      concentrating: 'not-at-all',
      'piling-up': 'nearly-every-day',
    },
  }

  // The questionnaire title ("WC-6") has a digit of its own; everything else must have none (2.2).
  function resultTextWithoutTitle() {
    return document.body.textContent?.replace(wc6.title, '')
  }

  function submissionCalls() {
    return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
  }

  it('blocks submitting until every question on the last page is answered', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()

    expect(submit()).toBeDisabled()
    fireEvent.click(submit())
    answer('Difficulty concentrating', 'Not at all')
    expect(submit()).toBeDisabled()
    fireEvent.click(submit())

    expect(submissionCalls()).toHaveLength(0)
    answer('Feeling that things are piling up', 'Several days')
    expect(submit()).toBeEnabled()
  })

  it('has no submit control before the last page', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')

    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    answer('Feeling tired or having little energy', 'Not at all')
    answer('Trouble falling or staying asleep', 'Not at all')
    fireEvent.click(next())
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
  })

  it('sends exactly one POST with every answer, only at final submission', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()
    answerLastPage()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValue(Response.json(result))
    fireEvent.click(submit())
    fireEvent.click(submit())
    await screen.findByRole('heading', { name: result.label })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/questionnaires/wc-6/submissions')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(init?.body as string)).toEqual(expectedPayload)
  })

  it('disables the submit control while the submission is in flight', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()
    answerLastPage()

    let resolve: (response: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    fireEvent.click(submit())

    expect(submit()).toBeDisabled()
    fireEvent.click(submit())
    expect(submissionCalls()).toHaveLength(1)

    resolve(Response.json(result))
    expect(await screen.findByRole('heading', { name: result.label })).toBeInTheDocument()
    expect(submissionCalls()).toHaveLength(1)
  })

  it('shows the label and next-steps message, and nothing else from the questionnaire', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()
    answerLastPage()

    fetchMock.mockResolvedValue(Response.json(result))
    fireEvent.click(submit())

    expect(await screen.findByRole('heading', { name: 'Some strain' })).toBeInTheDocument()
    expect(screen.getByText('Consider a self-guided resource.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
    expect(resultTextWithoutTitle()).not.toMatch(/\d/)
  })

  it('shows only the label and message even if the response carries extra fields', async () => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()
    answerLastPage()

    fetchMock.mockResolvedValue(Response.json({ ...result, score: 4217, band: 3 }))
    fireEvent.click(submit())

    await screen.findByRole('heading', { name: result.label })
    expect(resultTextWithoutTitle()).not.toMatch(/\d/)
  })

  it.each([
    ['the server rejects the submission', () => fetchMock.mockResolvedValue(new Response(null, { status: 500 }))],
    ['the request fails', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('shows an error and keeps the answers when %s, so the visitor can try again', async (_, fail) => {
    respondWith(wc6)
    await renderLoaded('Wellbeing Check (WC-6)')
    reachLastPage()
    answerLastPage()

    fail()
    fireEvent.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Your answers could not be submitted. Please try again.')
    expect(within(question('Difficulty concentrating')).getByRole('radio', { name: 'Not at all' })).toBeChecked()
    expect(within(question('Feeling that things are piling up')).getByRole('radio', { name: 'Nearly every day' }))
      .toBeChecked()
    fireEvent.click(back())
    expect(within(question('Feeling nervous or on edge')).getByRole('radio', { name: 'Nearly every day' }))
      .toBeChecked()
    fireEvent.click(next())

    fetchMock.mockResolvedValue(Response.json(result))
    expect(submit()).toBeEnabled()
    fireEvent.click(submit())

    expect(await screen.findByRole('heading', { name: result.label })).toBeInTheDocument()
    expect(submissionCalls()).toHaveLength(2)
    expect(JSON.parse(submissionCalls()[1][1]?.body as string)).toEqual(expectedPayload)
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
    expect(document.cookie).toBe('')
  })
})
