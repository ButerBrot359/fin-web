import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { n?: number }) =>
      o?.n != null ? `${k}:${String(o.n)}` : k,
  }),
  // Требуется транзитивной цепочкой TableCellEditor → resolve-select-value.ts
  // → реальный i18n singleton (i18n.use(initReactI18next)) — без экспорта
  // мок не удовлетворяет .use() и падает до рендера (как в read-only-table.test.tsx).
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))

import { KalendariTemplateTable } from './kalendari-template-table'

const checkboxCol: ViewNode = {
  id: 'dict.field.ShablonZapolneniya.col.DenVklyuchenVGrafik',
  type: 'TABLE_COLUMN',
  binding: 'DenVklyuchenVGrafik',
  props: { dataType: 'BOOLEAN', cellWidget: 'CHECKBOX_FIELD' },
}
const node = (): ViewNode => ({
  id: 'dict.field.ShablonZapolneniya',
  type: 'TABLE',
  binding: 'ShablonZapolneniya',
  props: { editable: true, allowAdd: true, allowDelete: true },
  children: [checkboxCol],
})

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rowId: `r${String(i + 1)}`,
    DenVklyuchenVGrafik: i < 5,
  }))

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
})
beforeEach(() => mockDispatch.mockClear())

describe('KalendariTemplateTable', () => {
  it('режим PoNedelyam → 7 строк с подписями дней недели, без ячейки длины цикла', () => {
    sessionState.SposobZapolneniya = 'PoNedelyam'
    sessionState.ShablonZapolneniya = rows(7)
    render(<KalendariTemplateTable node={node()} />)
    // 7 чекбоксов
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    // нет поля длины цикла
    expect(screen.queryByLabelText('sdui.kalendari.cycleLength')).toBeNull()
  })

  it('режим циклов → подписи «День N» и поле длины цикла', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getByText('sdui.kalendari.dayN:1')).toBeTruthy()
    expect(screen.getByText('sdui.kalendari.dayN:3')).toBeTruthy()
    expect(screen.getByLabelText('sdui.kalendari.cycleLength')).toBeTruthy()
  })

  it('увеличение длины цикла → коммит на blur: replaceRows с общими позициями сохранён, новые unchecked tmp-*', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3) // r1,r2 checked; r3 unchecked
    render(<KalendariTemplateTable node={node()} />)
    const input = screen.getByLabelText('sdui.kalendari.cycleLength')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: { rowId: string; DenVklyuchenVGrafik: boolean }[]
    }
    expect(sent.value).toHaveLength(5)
    expect(sent.value.slice(0, 3).map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
    expect(sent.value[3].DenVklyuchenVGrafik).toBe(false)
    expect(sent.value[3].rowId.startsWith('tmp-')).toBe(true)
  })

  it('уменьшение длины цикла → коммит по Enter: хвост отброшен', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(6)
    render(<KalendariTemplateTable node={node()} />)
    const input = screen.getByLabelText('sdui.kalendari.cycleLength')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as { value: unknown[] }
    expect(sent.value).toHaveLength(2)
  })

  it('промежуточное значение без blur/Enter: не резайзит и не шлёт EVENT; коммит происходит только на blur', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    render(<KalendariTemplateTable node={node()} />)
    const input = screen.getByLabelText('sdui.kalendari.cycleLength')
    // Перепечатывание: стирание до "" — раньше на каждый onChange резайзило и
    // роняло хвост строк. Теперь только буфер поля меняется.
    fireEvent.change(input, { target: { value: '' } })
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)

    fireEvent.change(input, { target: { value: '5' } })
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)

    // Коммит финального значения — единственный resize/EVENT.
    fireEvent.blur(input)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as { value: unknown[] }
    expect(sent.value).toHaveLength(5)
  })

  // Переключение режима: бэк строки не пересобирает (коммент Talgat 18.08) —
  // реактивность фронта: → недели = ровно 7 строк полным EVENT'ом.
  it('смена циклы(3) → недели: EVENT с 7 строками, общие позиции сохранены, новые unchecked tmp-*', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as {
      value: { rowId: string; DenVklyuchenVGrafik: boolean }[]
    }
    expect(sent.value).toHaveLength(7)
    expect(sent.value.slice(0, 3).map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
    for (const row of sent.value.slice(3)) {
      expect(row.rowId.startsWith('tmp-')).toBe(true)
      expect(row.DenVklyuchenVGrafik).toBe(false)
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
  })

  it('смена циклы(10) → недели: хвост отброшен до 7', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(10)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)

    const sent = mockDispatch.mock.calls[0][0] as {
      value: { rowId: string }[]
    }
    expect(sent.value).toHaveLength(7)
    expect(sent.value.map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
      'r6',
      'r7',
    ])
  })

  it('смена циклы(7) → недели: длина уже 7 — EVENT не шлётся', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(7)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('смена недели → циклы: строки не трогаем, длина цикла = текущее количество', () => {
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    sessionState.ShablonZapolneniya = rows(7)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    rerender(<KalendariTemplateTable node={node()} />)

    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    const input = screen.getByLabelText<HTMLInputElement>(
      'sdui.kalendari.cycleLength'
    )
    expect(input.value).toBe('7')
  })

  it('первичная гидратация режима (undefined → недели): EVENT не шлётся, дефолт — зона бэка', () => {
    sessionState.ShablonZapolneniya = rows(3)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('чекбокс шлёт EVENT, длина цикла в строки не попадает', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    // rows(3) даёт все три строки checked=true (i<5 при n=3) — не годится для
    // теста «включить r3»: явный фикстур с r3=false, чтобы клик реально включал.
    sessionState.ShablonZapolneniya = [
      { rowId: 'r1', DenVklyuchenVGrafik: true },
      { rowId: 'r2', DenVklyuchenVGrafik: true },
      { rowId: 'r3', DenVklyuchenVGrafik: false },
    ]
    render(<KalendariTemplateTable node={node()} />)
    fireEvent.click(screen.getAllByRole('checkbox')[2]) // включить r3
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: Record<string, unknown>[]
    }
    expect(sent.value[2].DenVklyuchenVGrafik).toBe(true)
    expect(sent.value[0]).not.toHaveProperty('DlinaTsikla')
  })
})
