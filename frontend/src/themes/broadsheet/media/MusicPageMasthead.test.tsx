import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MusicPageMasthead } from './MusicPageMasthead'

function renderMasthead(onAction = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/from-somewhere', '/current']} initialIndex={1}>
      <Routes>
        <Route path="/from-somewhere" element={<div data-testid="landed-back" />} />
        <Route
          path="/current"
          element={
            <MusicPageMasthead
              kicker="The Record"
              title="Push The Button"
              titleFontSize={62}
              actionLabel="Play album"
              actionIcon={<span>▶</span>}
              onAction={onAction}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MusicPageMasthead', () => {
  it('renders the kicker and title', () => {
    renderMasthead()
    expect(screen.getByText('The Record')).toBeInTheDocument()
    expect(screen.getByText('Push The Button')).toBeInTheDocument()
  })

  it('calls onAction when the action button is tapped', () => {
    const onAction = vi.fn()
    renderMasthead(onAction)
    fireEvent.click(screen.getByText('Play album'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('"← Back" navigates to the previous entry in history', () => {
    renderMasthead()
    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByTestId('landed-back')).toBeInTheDocument()
  })
})
