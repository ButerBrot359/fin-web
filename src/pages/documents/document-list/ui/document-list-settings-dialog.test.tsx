import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTableFilterStore } from '@/features/table-filter'
import type { ColumnMetaDto } from '@/shared/lib/eav'

import { DocumentListSettingsDialog } from './document-list-settings-dialog'

vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

const columns: ColumnMetaDto[] = [
  {
    code: 'Nomer',
    nameRu: 'Номер',
    dataType: 'STRING',
    isSystem: false,
    referencedTypeCode: null,
    referencedDomainKind: null,
    allowedOps: ['contains'],
  },
  {
    code: 'Data',
    nameRu: 'Дата',
    dataType: 'DATE',
    isSystem: false,
    referencedTypeCode: null,
    referencedDomainKind: null,
    allowedOps: ['eq'],
  },
]

const renderDialog = () => {
  const onColumnVisibilityChange = vi.fn()
  const onSortingChange = vi.fn()
  const view = render(
    <DocumentListSettingsDialog
      open
      tableId="Tabel"
      columns={columns}
      columnVisibility={{}}
      sorting={[]}
      onClose={vi.fn()}
      onColumnVisibilityChange={onColumnVisibilityChange}
      onSortingChange={onSortingChange}
    />
  )
  return { ...view, onColumnVisibilityChange, onSortingChange }
}

describe('DocumentListSettingsDialog', () => {
  beforeEach(() => {
    useTableFilterStore.setState({ byTable: {} })
  })

  afterEach(cleanup)

  it('applies a column visibility choice instead of leaving the list settings button inert', () => {
    const { onColumnVisibilityChange } = renderDialog()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Номер' }))

    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ Nomer: false })
  })

  it('changes the server-backed sort from the 1C-style sorting tab', () => {
    const { onSortingChange, rerender } = renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Сортировка' }))
    fireEvent.change(screen.getByLabelText('Поле'), {
      target: { value: 'Data' },
    })
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: 'Data', desc: false },
    ])

    rerender(
      <DocumentListSettingsDialog
        open
        tableId="Tabel"
        columns={columns}
        columnVisibility={{}}
        sorting={[{ id: 'Data', desc: false }]}
        onClose={vi.fn()}
        onColumnVisibilityChange={vi.fn()}
        onSortingChange={onSortingChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Направление'), {
      target: { value: 'DESC' },
    })

    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: 'Data', desc: true },
    ])
  })

  it('removes an active header filter from the selection tab', () => {
    useTableFilterStore
      .getState()
      .setAll('Tabel', [{ field: 'Nomer', op: 'contains', value: '001' }])
    renderDialog()

    fireEvent.click(screen.getByRole('tab', { name: 'Отбор' }))
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(useTableFilterStore.getState().byTable.Tabel?.filters).toEqual([])
  })
})
