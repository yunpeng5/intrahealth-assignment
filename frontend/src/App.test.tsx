import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(
    Response.json({
      id: 'wc-6',
      title: 'Wellbeing Check (WC-6)',
      instructions: 'Over the past two weeks, how often have you been bothered by the following?',
      pages: [
        {
          id: 'energy-sleep',
          title: 'Energy and sleep',
          questions: [
            {
              id: 'tired',
              prompt: 'Feeling tired or having little energy',
              options: [{ id: 'not-at-all', label: 'Not at all' }],
            },
          ],
        },
      ],
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the app heading', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Pulse Check' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Wellbeing Check (WC-6)' })
  })

  it('shows the questionnaire loaded from the API', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Wellbeing Check (WC-6)' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/questionnaires/wc-6', expect.anything())
  })
})
