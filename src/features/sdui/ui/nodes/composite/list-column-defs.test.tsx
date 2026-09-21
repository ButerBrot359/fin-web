import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode, RefObject } from 'react'

// Vitest не прогоняет svgr-плагин (см. cell-icon-registry.test.tsx) — импорт
// svg мокается вручную реальным <svg>, иначе getCellIcon отдаёт data-URL строку.
vi.mock('@/shared/assets/icons/folder-icon.svg', () => ({
  default: () => <svg data-testid="icon-folder" />,
}))
vi.mock('@/shared/assets/icons/list-element-icon.svg', () => ({
  default: () => <svg data-testid="icon-list-element" />,
}))

import type { ViewNode } from '../../../types/view'
import { buildListColumns, type ListRow } from './list-column-defs'

// Рендерим cell-функцию колонки напрямую (мимо таблицы): контракт TanStack —
// cell(info) с getValue() и row.original.
const renderHierarchyCell = (
  colProps: Record<string, unknown>,
  row: ListRow,
  value: unknown,
  onToggleExpand?: (rowId: number, expanded: boolean) => void
) => {
  const [col] = buildListColumns({
    columnNodes: [
      { id: 'c1', type: 'TABLE_COLUMN', props: colProps } as ViewNode,
    ],
    sortState: undefined,
    sortCommand: undefined,
    filterCommand: undefined,
    filterOpLabels: undefined,
    dispatch: vi.fn() as never,
    nodeId: 'list1',
    sortInFlightRef: { current: false } as RefObject<boolean>,
    onToggleExpand,
  })
  const cell = col.cell as (info: unknown) => ReactNode
  return render(<>{cell({ getValue: () => value, row: { original: row } })}</>)
}

const HIER_PROPS = {
  binding: 'name',
  cellKind: 'HIERARCHY',
  iconMap: { true: 'folder', false: 'listElement' },
}

describe('cellKind=HIERARCHY (SCRUM-360 блок H)', () => {
  it('уровень 2 → отступ 32px, текст рендерится', () => {
    const { container } = renderHierarchyCell(
      HIER_PROPS,
      { id: 1, _level: 2, _isGroup: false },
      'Оклады'
    )
    expect(screen.getByText('Оклады')).toBeTruthy()
    const wrap = container.querySelector('span[style]')
    expect(wrap?.getAttribute('style')).toContain('padding-left: 32px')
  })

  it('группа → глиф folder из iconMap', () => {
    const { container } = renderHierarchyCell(
      HIER_PROPS,
      { id: 2, _level: 0, _isGroup: true },
      'Начисления'
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('нет _level и _isGroup → отступ 0, без глифа, текст есть (фолбэк до Q-2)', () => {
    const { container } = renderHierarchyCell(HIER_PROPS, { id: 3 }, 'Плоский')
    expect(screen.getByText('Плоский')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
    expect(
      container.querySelector('span[style]')?.getAttribute('style')
    ).toContain('padding-left: 0')
  })
})

// SCRUM-360 v6 §8.7 п.3-4: дерево, фаза B — раскрыватель в ведущей колонке.
describe('cellKind=HIERARCHY — раскрыватель дерева (SCRUM-360 v6 §8)', () => {
  it('_hasChildren + свёрнут → треугольник «развернуть», клик шлёт expanded:true', () => {
    const onToggle = vi.fn()
    renderHierarchyCell(
      HIER_PROPS,
      {
        id: 30712,
        _level: 1,
        _isGroup: true,
        _hasChildren: true,
        _expanded: false,
      },
      'Поставщики Астаны',
      onToggle
    )
    const btn = screen.getByRole('button', { name: 'Развернуть группу' })
    btn.click()
    expect(onToggle).toHaveBeenCalledWith(30712, true)
  })

  it('_expanded → треугольник «свернуть», клик шлёт expanded:false (желаемое состояние, §8.5)', () => {
    const onToggle = vi.fn()
    renderHierarchyCell(
      HIER_PROPS,
      {
        id: 30712,
        _level: 0,
        _isGroup: true,
        _hasChildren: true,
        _expanded: true,
      },
      'Поставщики',
      onToggle
    )
    screen.getByRole('button', { name: 'Свернуть группу' }).click()
    expect(onToggle).toHaveBeenCalledWith(30712, false)
  })

  it('пустая группа (_hasChildren:false) → раскрывателя нет («плюсика» быть не должно)', () => {
    renderHierarchyCell(
      HIER_PROPS,
      {
        id: 5,
        _level: 0,
        _isGroup: true,
        _hasChildren: false,
        _expanded: false,
      },
      'Пустая',
      vi.fn()
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('без onToggleExpand (нет действия expand с бэка) → прежний вид без раскрывателя', () => {
    renderHierarchyCell(
      HIER_PROPS,
      {
        id: 6,
        _level: 0,
        _isGroup: true,
        _hasChildren: true,
        _expanded: false,
      },
      'Группа'
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('indentPerLevel из пропов колонки: уровень 2 × 24 → 48px', () => {
    const { container } = renderHierarchyCell(
      { ...HIER_PROPS, indentPerLevel: 24 },
      { id: 7, _level: 2, _isGroup: false },
      'Вложенный'
    )
    expect(
      container.querySelector('span[style]')?.getAttribute('style')
    ).toContain('padding-left: 48px')
  })
})
