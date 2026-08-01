import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchTabsRow } from './SearchTabsRow'

describe('SearchTabsRow', () => {
  it('renders only the two tabs with a real data source', () => {
    render(<SearchTabsRow query="" onQueryChange={() => {}} activeTab="quick-dials" onTabChange={() => {}} searching={false} />)
    expect(screen.getByText('Quick Dials')).toBeInTheDocument()
    expect(screen.getByText('For You')).toBeInTheDocument()
    expect(screen.queryByText('Playlists')).not.toBeInTheDocument()
    expect(screen.queryByText('Radio')).not.toBeInTheDocument()
  })

  it('fires onQueryChange as the user types', () => {
    const onQueryChange = vi.fn()
    render(<SearchTabsRow query="" onQueryChange={onQueryChange} activeTab="quick-dials" onTabChange={() => {}} searching={false} />)
    fireEvent.change(screen.getByLabelText('Search music'), { target: { value: 'amber' } })
    expect(onQueryChange).toHaveBeenCalledWith('amber')
  })

  it('fires onTabChange when a tab is pressed', () => {
    const onTabChange = vi.fn()
    render(<SearchTabsRow query="" onQueryChange={() => {}} activeTab="quick-dials" onTabChange={onTabChange} searching={false} />)
    fireEvent.click(screen.getByText('For You'))
    expect(onTabChange).toHaveBeenCalledWith('for-you')
  })

  it('marks the active tab bold while not searching', () => {
    render(<SearchTabsRow query="" onQueryChange={() => {}} activeTab="for-you" onTabChange={() => {}} searching={false} />)
    const forYou = screen.getByText('For You')
    expect(forYou.style.fontWeight).toBe('700')
  })

  it('leaves both tabs unmarked while a search is active', () => {
    render(<SearchTabsRow query="amber" onQueryChange={() => {}} activeTab="quick-dials" onTabChange={() => {}} searching />)
    const quickDials = screen.getByText('Quick Dials')
    expect(quickDials.style.fontWeight).not.toBe('700')
  })
})
