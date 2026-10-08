import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useReselectAfterServerDelete } from './use-reselect-after-server-delete'
import type { TableRow } from './use-table-sync'

const stroki = (...ids: string[]): TableRow[] => ids.map((rowId) => ({ rowId }))

const smontirovat = (nachalo: TableRow[]) => {
  const selectRow = vi.fn()
  const hook = renderHook(
    ({ rows }) => useReselectAfterServerDelete(rows, selectRow),
    { initialProps: { rows: nachalo } }
  )
  return { selectRow, hook }
}

describe('useReselectAfterServerDelete', () => {
  it('после удаления строки на сервере выделяет следующую', () => {
    const { selectRow, hook } = smontirovat(stroki('a', 'b', 'c'))
    hook.result.current(['b'])
    hook.rerender({ rows: stroki('a', 'c') })
    expect(selectRow).toHaveBeenCalledWith('c')
  })

  it('удалена последняя строка — выделяет предыдущую', () => {
    const { selectRow, hook } = smontirovat(stroki('a', 'b', 'c'))
    hook.result.current(['c'])
    hook.rerender({ rows: stroki('a', 'b') })
    expect(selectRow).toHaveBeenCalledWith('b')
  })

  it('удалена единственная строка — выделять нечего', () => {
    const { selectRow, hook } = smontirovat(stroki('a'))
    hook.result.current(['a'])
    hook.rerender({ rows: stroki() })
    expect(selectRow).not.toHaveBeenCalled()
  })

  it('сервер отказал в удалении — выделение не трогается', () => {
    const { selectRow, hook } = smontirovat(stroki('a', 'b', 'c'))
    hook.result.current(['b'])
    hook.rerender({ rows: stroki('a', 'b', 'c') })
    hook.rerender({ rows: stroki('a', 'c') })
    expect(selectRow).not.toHaveBeenCalled()
  })

  it('удаление нескольких строк снимает выделение, как клавиша Delete', () => {
    const { selectRow, hook } = smontirovat(stroki('a', 'b', 'c'))
    hook.result.current(['a', 'b'])
    hook.rerender({ rows: stroki('c') })
    expect(selectRow).not.toHaveBeenCalled()
  })
})
