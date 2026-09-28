import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InBrief } from './InBrief'
import type { BriefItem } from '@/integrations/sports'

const now = new Date('2026-09-28T18:00:00Z')
const item = (i: number, over: Partial<BriefItem> = {}): BriefItem => ({
  h: `Headline ${i}`,
  dek: `Dek ${i}`,
  source: 'team',
  tag: '49ers',
  publishedAt: '2026-09-28T16:00:00Z',
  ...over,
})

describe('InBrief', () => {
  it('shows deks only on the first items, and caps with +N more', () => {
    render(<InBrief items={[1, 2, 3, 4].map((i) => item(i))} max={3} deks={1} now={now} />)
    expect(screen.getByText('Dek 1')).toBeInTheDocument()
    expect(screen.queryByText('Dek 2')).not.toBeInTheDocument()
    expect(screen.queryByText('Headline 4')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  it('tags each item and ages it', () => {
    render(
      <InBrief items={[item(1, { source: 'league', tag: 'NFL' })]} max={5} deks={0} now={now} />,
    )
    expect(screen.getByText('NFL')).toBeInTheDocument()
    expect(screen.getByText(/2H AGO/)).toBeInTheDocument()
  })

  it('says so when there is no news', () => {
    render(<InBrief items={[]} max={5} deks={2} now={now} />)
    expect(screen.getByText('No news right now.')).toBeInTheDocument()
  })
})
