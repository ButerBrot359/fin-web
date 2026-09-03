import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { TableRow } from './use-table-sync'
import { useExternalRowFilter } from './use-external-row-filter'

const state: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useBindingValue: (binding: string | undefined) =>
    binding ? state[binding] : undefined,
}))

const rows: TableRow[] = [
  { rowId: 'r1', Sotrudnik: { id: 1, presentation: 'Иванов' } },
  { rowId: 'r2', Sotrudnik: { id: 2, presentation: 'Петров' } },
]

const node = (props: Record<string, unknown>) =>
  ({ id: 'table.nachisleniya', type: 'TABLE', props }) as unknown as ViewNode

const OTBOR = {
  filterSource: 'OtborSotrudnikov',
  filterSourceColumn: 'Sotrudnik',
  filterColumn: 'Sotrudnik',
}

describe('отбор строк по внешнему списку', () => {
  it('без выбранной строки источника видны все строки', () => {
    state.OtborSotrudnikov = [
      { rowId: '1', Sotrudnik: { id: 1, presentation: 'Иванов' } },
    ]
    state['OtborSotrudnikov.__selectedRowId'] = undefined

    const { result } = renderHook(() => useExternalRowFilter(node(OTBOR), rows))

    expect(result.current).toHaveLength(2)
  })

  it('выбранный сотрудник оставляет только его строки', () => {
    state.OtborSotrudnikov = [
      { rowId: '1', Sotrudnik: { id: 1, presentation: 'Иванов' } },
      { rowId: '2', Sotrudnik: { id: 2, presentation: 'Петров' } },
    ]
    state['OtborSotrudnikov.__selectedRowId'] = '2'

    const { result } = renderHook(() => useExternalRowFilter(node(OTBOR), rows))

    expect(result.current).toHaveLength(1)
    expect(result.current[0].rowId).toBe('r2')
  })

  it('ключи могут отличаться: налоговая ТЧ отбирается по физлицу', () => {
    state.OtborSotrudnikov = [
      {
        rowId: '1',
        Sotrudnik: { id: 1, presentation: 'Иванов' },
        FizicheskoeLitso: { id: 11, presentation: 'Иванов И.И.' },
      },
    ]
    state['OtborSotrudnikov.__selectedRowId'] = '1'
    const nalogovye: TableRow[] = [
      {
        rowId: 'n1',
        FizicheskoeLitso: { id: 11, presentation: 'Иванов И.И.' },
      },
      {
        rowId: 'n2',
        FizicheskoeLitso: { id: 12, presentation: 'Петров П.П.' },
      },
    ]

    const { result } = renderHook(() =>
      useExternalRowFilter(
        node({
          filterSource: 'OtborSotrudnikov',
          filterSourceColumn: 'FizicheskoeLitso',
          filterColumn: 'FizicheskoeLitso',
        }),
        nalogovye
      )
    )

    expect(result.current.map((r) => r.rowId)).toEqual(['n1'])
  })

  it('без пропов отбора строки не трогаются', () => {
    const { result } = renderHook(() => useExternalRowFilter(node({}), rows))

    expect(result.current).toBe(rows)
  })
})
