import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TabelEmployee } from './tabel-matrix-contract'
import type { DayHeader } from './tabel-matrix-logic'
import { TabelMatrixGrid } from './tabel-matrix-grid'

const days: DayHeader[] = [
  { iso: '2026-08-03', dayNum: '3', weekday: 'Пн', weekend: false },
  { iso: '2026-08-04', dayNum: '4', weekday: 'Вт', weekend: false },
]

const employee: TabelEmployee = {
  employeeNodeId: 'employee:42',
  employeeRef: 42,
  employeePresentation: 'Волгин В. М.',
  dayTotals: { '2026-08-03': '8' },
  total: '175',
  workKinds: [
    {
      kindNodeId: 'employee:42:kind:101',
      workTimeKindRef: 101,
      workTimeKindPresentation: 'Явка',
      protected: false,
      cells: { '2026-08-03': '8' },
      total: '175',
    },
  ],
}

const noop = () => undefined
const renderGrid = () =>
  render(
    <TabelMatrixGrid
      days={days}
      employees={[employee]}
      collapsed={new Set()}
      activeId={null}
      busy={false}
      draftKindsFor={() => []}
      onToggle={noop}
      onSelect={noop}
      onDeleteEmployee={noop}
      onDeleteKind={noop}
      onCommitCell={() => () => true}
    />
  )

// Спека от 01.09 §1: «Итого» — вторая колонка, между «Сотрудник/вид времени»
// и первым днём, в одной sticky-зоне с колонкой сотрудника.
describe('TabelMatrixGrid: колонка «Итого» (SCRUM-276, после теста)', () => {
  afterEach(cleanup)

  it('в шапке «Итого» стоит второй, дни — с третьей колонки', () => {
    renderGrid()
    const headerCells = screen
      .getAllByRole('columnheader')
      .map((c) => c.textContent)
    expect(headerCells[0]).toBe('sdui.tabel.employeeColumn')
    expect(headerCells[1]).toBe('sdui.tabel.totalColumn')
    expect(headerCells[2]).toContain('3')
  })

  it('в строке сотрудника итог — вторая ячейка, значение из total', () => {
    renderGrid()
    const employeeRow = screen.getByText('Волгин В. М.').closest('tr')
    const cells = [...(employeeRow?.cells ?? [])]
    expect(cells[1].textContent).toBe('175')
    // Дни идут после итога
    expect(cells).toHaveLength(2 + days.length)
  })

  it('обе первые колонки sticky: итог зафиксирован на left:260', () => {
    renderGrid()
    const employeeRow = screen.getByText('Волгин В. М.').closest('tr')
    const totalCell = employeeRow?.cells[1]
    expect(totalCell).toBeDefined()
    const style = window.getComputedStyle(totalCell as HTMLElement)
    expect(style.position).toBe('sticky')
    expect(style.left).toBe('260px')
  })
})

vi.mock(import('react-i18next'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTranslation: (() => ({
      t: (key: string) => key,
      i18n: { language: 'ru' },
    })) as unknown as typeof actual.useTranslation,
  }
})
