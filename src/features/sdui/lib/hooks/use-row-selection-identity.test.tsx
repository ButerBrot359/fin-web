import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableRow } from './use-table-sync'
import { useRowSelectionIdentity } from './use-row-selection-identity'

const setFromServer = vi.fn()
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({ setFromServer }),
}))

const rowsV1 = (): TableRow[] => [
  { rowId: 'r1', summa: 100 },
  { rowId: 'r2', summa: 200 },
]

const renderSelection = (initialRows: TableRow[] = rowsV1()) =>
  renderHook(({ rows }) => useRowSelectionIdentity('Tabl', rows), {
    initialProps: { rows: initialRows },
  })

beforeEach(() => {
  setFromServer.mockClear()
})

describe('useRowSelectionIdentity', () => {
  it('selectRow выделяет строку и публикует __selectedRowId для detail-ТЧ', () => {
    const { result } = renderSelection()

    act(() => {
      result.current.selectRow('r1')
    })

    expect(result.current.selectedRowId).toBe('r1')
    expect(result.current.selectedVisibleIndex).toBe(0)
    expect(setFromServer).toHaveBeenCalledWith('Tabl.__selectedRowId', 'r1')
  })

  it('строка выпала из видимого набора → сброс и снятие публикации (SCRUM-282 I2)', () => {
    const { result, rerender } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })
    setFromServer.mockClear()

    rerender({ rows: [{ rowId: 'r2', summa: 200 }] })

    expect(result.current.selectedRowId).toBeNull()
    expect(setFromServer).toHaveBeenCalledWith('Tabl.__selectedRowId', null)
  })

  it('подмена записи сервером под тем же rowId → сброс (SCRUM-291 §0.5 дефект 2)', () => {
    const { result, rerender } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })
    // Эффект снял подпись содержимого выбранной строки.
    setFromServer.mockClear()

    // Тот же rowId, другое содержимое: пересборка ТЧ перенумеровала строки.
    rerender({
      rows: [
        { rowId: 'r1', summa: 999 },
        { rowId: 'r2', summa: 200 },
      ],
    })

    expect(result.current.selectedRowId).toBeNull()
    expect(setFromServer).toHaveBeenCalledWith('Tabl.__selectedRowId', null)
  })

  it('после noteUserEdit серверное изменение строки — ОТВЕТ на правку, выделение живёт', () => {
    const { result, rerender } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })

    // Правка пользователя в выбранной строке (обёртка updateCell).
    act(() => {
      result.current.noteUserEdit('r1')
    })

    // Сервер дозаполнил строку по правке — выделение не снимается.
    rerender({
      rows: [
        { rowId: 'r1', summa: 999 },
        { rowId: 'r2', summa: 200 },
      ],
    })

    expect(result.current.selectedRowId).toBe('r1')
  })

  it('эхо-разрешение одноразовое: следующая подмена без правки снова сбрасывает', () => {
    const { result, rerender } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })
    act(() => {
      result.current.noteUserEdit('r1')
    })
    // Ответ сервера на правку принят, подпись снята заново.
    rerender({
      rows: [
        { rowId: 'r1', summa: 999 },
        { rowId: 'r2', summa: 200 },
      ],
    })
    // Подпись пере-снята; эхо-флаг ещё взведён — первая подмена трактуется
    // как эхо (одноразово)...
    rerender({
      rows: [
        { rowId: 'r1', summa: 1 },
        { rowId: 'r2', summa: 200 },
      ],
    })
    expect(result.current.selectedRowId).toBe('r1')

    // ...а вторая подмена без правки — уже сброс.
    rerender({
      rows: [
        { rowId: 'r1', summa: 2 },
        { rowId: 'r2', summa: 200 },
      ],
    })
    expect(result.current.selectedRowId).toBeNull()
  })

  it('noteUserEdit чужой строки эхо-разрешение не взводит', () => {
    const { result, rerender } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })
    act(() => {
      result.current.noteUserEdit('r2')
    })

    rerender({
      rows: [
        { rowId: 'r1', summa: 999 },
        { rowId: 'r2', summa: 200 },
      ],
    })

    expect(result.current.selectedRowId).toBeNull()
  })

  it('clearSelection снимает локальное выделение без публикации null (как у удаления строки)', () => {
    const { result } = renderSelection()
    act(() => {
      result.current.selectRow('r1')
    })
    setFromServer.mockClear()

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedRowId).toBeNull()
    expect(setFromServer).not.toHaveBeenCalled()
  })

  it('без binding публикации нет, выделение работает', () => {
    const { result } = renderHook(
      ({ rows }) => useRowSelectionIdentity(undefined, rows),
      { initialProps: { rows: rowsV1() } }
    )

    act(() => {
      result.current.selectRow('r2')
    })

    expect(result.current.selectedRowId).toBe('r2')
    expect(result.current.selectedVisibleIndex).toBe(1)
    expect(setFromServer).not.toHaveBeenCalled()
  })
})
