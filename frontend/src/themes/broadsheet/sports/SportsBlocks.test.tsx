import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DivisionTable } from './SportsBlocks'

describe('DivisionTable', () => {
  it('says the table is unavailable when standings failed', () => {
    render(<DivisionTable table={{ title: '', rows: [] }} />)
    expect(screen.getByText('Table unavailable.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('marks the followed team and renders every row, never truncated', () => {
    const rows = ['LAD', 'SD', 'ARI'].map((t, i) => ({
      t,
      w: 100 - i,
      l: 62 + i,
      pct: '.600',
      gb: '—',
      strk: 'W1',
      me: t === 'LAD',
    }))
    render(<DivisionTable table={{ title: 'National League West', rows }} />)
    expect(screen.getByText('National League West')).toBeInTheDocument()
    expect(screen.getByText('LAD')).toBeInTheDocument()
    expect(screen.getByText('SD')).toBeInTheDocument()
    expect(screen.getByText('ARI')).toBeInTheDocument()
  })
})
