import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18next from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import { SelectionListTable } from './selection-list-table'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof I18next>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))

const state: Record<string, unknown> = {}
const setFromServer = vi.fn()
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (k: string) => state[k],
    setFromServer: (k: string, v: unknown) => {
      setFromServer(k, v)
    },
  }),
}))

const node = {
  id: 'table.otborSotrudnikov',
  type: 'TABLE',
  binding: 'OtborSotrudnikov',
  props: { selectionList: true, label: 'Отбор по сотруднику' },
  children: [
    {
      id: 'table.otborSotrudnikov.col.Sotrudnik',
      type: 'TABLE_COLUMN',
      binding: 'Sotrudnik',
      props: { label: 'Сотрудник' },
    },
  ],
} as unknown as ViewNode

describe('список-отбор', () => {
  beforeEach(() => {
    cleanup()
    setFromServer.mockClear()
    state.OtborSotrudnikov = [
      { rowId: '1', Sotrudnik: { id: 1, presentation: 'Иванов' } },
      { rowId: '2', Sotrudnik: { id: 2, presentation: 'Петров' } },
    ]
  })

  it('клик по строке публикует выбор под ключом master-detail', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.click(screen.getByText('Иванов'))

    expect(setFromServer).toHaveBeenCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      '1'
    )
  })

  it('повторный клик по выбранной строке снимает отбор', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.click(screen.getByText('Петров'))
    fireEvent.click(screen.getByText('Петров'))

    expect(setFromServer).toHaveBeenLastCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      null
    )
  })

  it('кнопка «Показать всех» доступна только при выбранной строке и снимает отбор', () => {
    render(<SelectionListTable node={node} />)
    const button = screen.getByRole('button', { name: 'table.clearFilter' })
    expect(button).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByText('Иванов'))
    fireEvent.click(screen.getByRole('button', { name: 'table.clearFilter' }))

    expect(setFromServer).toHaveBeenLastCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      null
    )
  })

  it('пустой список показывает заглушку, а не пустую таблицу', () => {
    state.OtborSotrudnikov = []
    render(<SelectionListTable node={node} />)

    expect(screen.getByText('table.empty')).toBeTruthy()
  })
})
