import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18next from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import { ItogiHierarchyTable } from './itogi-hierarchy-table'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof I18next>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ getValue: (k: string) => state[k] }),
}))

const column = (
  binding: string,
  label: string,
  props: Record<string, unknown> = {}
): ViewNode =>
  ({
    id: 'table.itogi.col.' + binding,
    type: 'TABLE_COLUMN',
    binding,
    props: { label, ...props },
  }) as unknown as ViewNode

const node = {
  id: 'table.itogi',
  type: 'TABLE',
  binding: 'Itogi',
  props: { hierarchical: true },
  children: [
    column('FizicheskoeLitso', 'Физическое лицо'),
    column('Nachisleno', 'Начислено', { textColor: '#0000FF' }),
  ],
} as unknown as ViewNode

/**
 * Строки — как их отдаёт NachislenieZarplatyItogiComposer: плоский список всех уровней
 * с __level и __parentRowId.
 */
const rows = [
  {
    rowId: 'f=1;',
    __level: 0,
    __parentRowId: null,
    FizicheskoeLitso: { id: 1, presentation: 'Айбекова' },
    Nachisleno: 167672,
  },
  {
    rowId: 'f=1;/p=5;',
    __level: 1,
    __parentRowId: 'f=1;',
    FizicheskoeLitso: null,
    Nachisleno: 167672,
  },
  {
    rowId: 'f=1;/p=5;/s=9;',
    __level: 2,
    __parentRowId: 'f=1;/p=5;',
    FizicheskoeLitso: null,
    Nachisleno: 167672,
  },
]

describe('ItogiHierarchyTable — свод «Итоги»', () => {
  beforeEach(() => {
    cleanup()
    state.Itogi = rows
  })

  it('по умолчанию виден только верхний уровень (ПоказатьУровеньГруппировокСтрок(0))', () => {
    render(<ItogiHierarchyTable node={node} />)
    expect(screen.getByText('Айбекова')).toBeTruthy()
    expect(screen.getAllByText('167672').length).toBe(1)
  })

  it('раскрытие строки показывает её детей, повторный клик — прячет', () => {
    render(<ItogiHierarchyTable node={node} />)

    fireEvent.click(screen.getByRole('button', { name: 'table.expandRow' }))
    expect(screen.getAllByText('167672').length).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: 'table.collapseRow' }))
    expect(screen.getAllByText('167672').length).toBe(1)
  })

  it('«Развернуть» раскрывает все уровни, «Свернуть» — возвращает к верхнему', () => {
    render(<ItogiHierarchyTable node={node} />)

    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    expect(screen.getAllByText('167672').length).toBe(3)

    fireEvent.click(screen.getByRole('button', { name: 'table.collapseAll' }))
    expect(screen.getAllByText('167672').length).toBe(1)
  })

  it('шапка берёт подписи колонок из узлов', () => {
    render(<ItogiHierarchyTable node={node} />)
    expect(screen.getByText('Физическое лицо')).toBeTruthy()
    expect(screen.getByText('Начислено')).toBeTruthy()
  })

  it('пустой свод показывает заглушку, а не падает', () => {
    state.Itogi = []
    render(<ItogiHierarchyTable node={node} />)
    expect(screen.getByText('table.empty')).toBeTruthy()
  })

  it('колонка с props.textColor красит текст своих ячеек', () => {
    render(<ItogiHierarchyTable node={node} />)
    const cell = screen.getAllByText('167672')[0].closest('td')
    expect(window.getComputedStyle(cell as Element).color).toBe(
      'rgb(0, 0, 255)'
    )
  })
})
