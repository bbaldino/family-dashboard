import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kicker } from './Kicker'
import { Hairline } from './Hairline'
import { DoubleRule } from './DoubleRule'
import { TeamCap } from './TeamCap'

describe('broadsheet atoms', () => {
  it('Kicker renders its label', () => {
    render(<Kicker>Today</Kicker>)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('Hairline and DoubleRule render presentational rules', () => {
    const { container: hair } = render(<Hairline />)
    expect(hair.firstElementChild).toBeInstanceOf(HTMLElement)
    const { container: dbl } = render(<DoubleRule />)
    expect(dbl.firstElementChild).toBeInstanceOf(HTMLElement)
  })

  it('TeamCap shows the abbreviation', () => {
    render(<TeamCap short="LAD" primary="#005A9C" secondary="#ffffff" />)
    expect(screen.getByText('LAD')).toBeInTheDocument()
  })

  it('TeamCap survives missing team colours', () => {
    render(<TeamCap short="MIL" primary={null} secondary={null} />)
    expect(screen.getByText('MIL')).toBeInTheDocument()
  })
})
