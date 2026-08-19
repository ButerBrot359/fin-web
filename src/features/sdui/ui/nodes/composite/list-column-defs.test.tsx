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
  value: unknown
) => {
  const [col] = buildListColumns({
    columnNodes: [
      { id: 'c1', type: 'TABLE_COLUMN', props: colProps } as ViewNode,
    ],
    sortState: undefined,
    typeCode: undefined,
    filterOpLabels: undefined,
    dispatch: vi.fn() as never,
    nodeId: 'list1',
    sortInFlightRef: { current: false } as RefObject<boolean>,
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
