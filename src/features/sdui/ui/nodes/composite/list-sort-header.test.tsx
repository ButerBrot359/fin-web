import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ListSortHeader } from './list-sort-header'

describe('ListSortHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('activates sort on Enter and Space when sortable', () => {
    const onSort = vi.fn()
    render(
      <ListSortHeader
        label="Дата"
        arrowDir="ASC"
        onSort={onSort}
        funnel={null}
      />
    )
    const btn = screen.getByRole('button', { name: /Дата/ })
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(onSort).toHaveBeenCalledTimes(2)
  })

  it('renders a plain label (no button role) when not sortable', () => {
    render(
      <ListSortHeader
        label="Имя"
        arrowDir={undefined}
        onSort={undefined}
        funnel={null}
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Имя')).toBeTruthy()
  })
})
