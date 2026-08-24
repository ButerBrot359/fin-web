import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SduiListSettingsDialog } from './sdui-list-settings-dialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const columns = [
  {
    id: 'date',
    type: 'TABLE_COLUMN' as const,
    props: { header: 'Дата', sortable: true, attributeCode: 'Data' },
  },
  {
    id: 'number',
    type: 'TABLE_COLUMN' as const,
    props: { header: 'Номер', sortable: false, attributeCode: 'Nomer' },
  },
]

const setup = () => {
  const dispatch = vi.fn()
  const onVisibilityChange = vi.fn()
  const onRemoveFilter = vi.fn()
  const onClearFilters = vi.fn()

  render(
    <SduiListSettingsDialog
      open
      columns={columns}
      visibility={{}}
      sortState={{ column: 'Data', dir: 'ASC' }}
      sortCommand="list.applySort:Tabel"
      filterChips={[
        { field: 'Organizatsiya', label: 'Организация равно Demo' },
      ]}
      canClearFilters
      nodeId="list"
      dispatch={dispatch}
      onClose={vi.fn()}
      onVisibilityChange={onVisibilityChange}
      onRemoveFilter={onRemoveFilter}
      onClearFilters={onClearFilters}
    />
  )

  return { dispatch, onVisibilityChange, onRemoveFilter, onClearFilters }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('SduiListSettingsDialog', () => {
  it('hides a column in the real SDUI list receiver through its column id', () => {
    const { onVisibilityChange } = setup()

    fireEvent.click(screen.getByLabelText('Дата'))

    expect(onVisibilityChange).toHaveBeenCalledWith({ date: false })
  })

  it('uses the server-provided opaque sort command rather than constructing one', () => {
    const { dispatch } = setup()

    fireEvent.click(
      screen.getByRole('tab', { name: 'sdui.listSettings.tabs.sorting' })
    )
    fireEvent.mouseDown(
      screen.getByLabelText('sdui.listSettings.sortDirection')
    )
    fireEvent.click(
      screen.getByRole('option', { name: 'sdui.listSettings.desc' })
    )

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applySort:Tabel',
      value: { column: 'Data', dir: 'DESC' },
      sourceNodeId: 'list',
    })
  })

  it('removes and clears active filters only through supplied callbacks', () => {
    const { onRemoveFilter, onClearFilters } = setup()

    fireEvent.click(
      screen.getByRole('tab', { name: 'sdui.listSettings.tabs.filter' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.listSettings.removeFilter' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.listSettings.clearFilters' })
    )

    expect(onRemoveFilter).toHaveBeenCalledWith('Organizatsiya')
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
