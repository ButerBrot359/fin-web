import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useForm } from 'react-hook-form'

import { useRowFilter } from './use-row-filter'

// Хук читает сестринские ячейки строки ТЧ через useWatch, поэтому рендерим
// его внутри формы с предзаполненными значениями строки.
const renderRowFilter = (
  rowFilter: Record<string, string> | undefined,
  formValues: Record<string, unknown>,
) =>
  renderHook(() => {
    const { control } = useForm<Record<string, unknown>>({
      defaultValues: formValues,
    })
    return useRowFilter(rowFilter, 'OsnovnyeSredstva.0', control)
  })

describe('useRowFilter (отбор пикера по ячейке строки ТЧ)', () => {
  it('заполненная ячейка → af в формате AttrCode:id', () => {
    const { result } = renderRowFilter(
      { SchetUcheta: 'SchetUcheta' },
      {
        OsnovnyeSredstva: [
          { SchetUcheta: { id: 4711, presentation: '2360' } },
        ],
      },
    )
    expect(result.current).toEqual({ af: 'SchetUcheta:4711' })
  })

  it('пустая (null) и не-ссылочная (без id) ячейка → undefined', () => {
    const empty = renderRowFilter(
      { SchetUcheta: 'SchetUcheta' },
      { OsnovnyeSredstva: [{ SchetUcheta: null }] },
    )
    expect(empty.result.current).toBeUndefined()

    const nonRef = renderRowFilter(
      { SchetUcheta: 'SchetUcheta' },
      { OsnovnyeSredstva: [{ SchetUcheta: 'просто строка' }] },
    )
    expect(nonRef.result.current).toBeUndefined()
  })

  it('несколько пар map → af через запятую, пустые пары пропускаются', () => {
    const { result } = renderRowFilter(
      { SchetUcheta: 'SchetUcheta', Sklad: 'Sklad', MOL: 'MOL' },
      {
        OsnovnyeSredstva: [
          { SchetUcheta: { id: 1 }, Sklad: null, MOL: { id: 2 } },
        ],
      },
    )
    expect(result.current).toEqual({ af: 'SchetUcheta:1,MOL:2' })
  })

  it('rowFilter отсутствует у колонки → undefined', () => {
    const { result } = renderRowFilter(undefined, {
      OsnovnyeSredstva: [{ SchetUcheta: { id: 1 } }],
    })
    expect(result.current).toBeUndefined()
  })
})
