import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ColumnMetaDto } from '@/shared/lib/eav'

import { ColumnFilterPopover } from './column-filter-popover'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))
vi.mock('./value-controls', () => ({
  ValueControl: () => <input data-testid="value-control" />,
}))

const column = (over: Partial<ColumnMetaDto> = {}): ColumnMetaDto => ({
  code: 'Gorod',
  nameRu: 'Город',
  dataType: 'STRING',
  isSystem: false,
  referencedTypeCode: null,
  referencedDomainKind: null,
  allowedOps: ['eq', 'ne', 'contains', 'isNull', 'isNotNull'],
  ...over,
})

const renderPopover = (col: ColumnMetaDto, onHeaderClick = vi.fn()) => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(
    // Имитация кликабельного заголовка-сортировщика: MUI-портал всплывает
    // по React-дереву, а не по DOM (SCRUM-360 §3.1).
    <th onClick={onHeaderClick} onMouseDown={onHeaderClick}>
      <ColumnFilterPopover
        anchorEl={anchor}
        column={col}
        initial={null}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    </th>
  )
  return onHeaderClick
}

describe('ColumnFilterPopover (SCRUM-360 §3.1/§4)', () => {
  afterEach(cleanup)

  it('клики внутри поповера не всплывают до заголовка-сортировщика', () => {
    const onHeaderClick = renderPopover(column())
    const value = screen.getByTestId('value-control')
    fireEvent.mouseDown(value)
    fireEvent.click(value)
    expect(onHeaderClick).not.toHaveBeenCalled()
  })

  it('defaultOp с бэка предвыбран вместо первого из allowedOps', () => {
    renderPopover(column({ defaultOp: 'contains' }))
    expect(screen.getByText('tableFilter.ops.contains')).toBeTruthy()
  })

  it('без defaultOp (старый кэш) — прежний фолбэк на первый разрешённый', () => {
    renderPopover(column())
    expect(screen.getByText('tableFilter.ops.eq')).toBeTruthy()
  })
})
