import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode, RefObject } from 'react'

const armNewTabMock = vi.fn()
vi.mock('../../../lib/workspace-tab-gateway', () => ({
  armNewTab: () => {
    armNewTabMock()
    return true
  },
}))

import type { ViewNode } from '../../../types/view'
import { buildListColumns, type ListRow } from './list-column-defs'

const DOC_LINK_PROPS = {
  binding: 'recorderDocumentName',
  cellKind: 'DOCUMENT_LINK',
}

const renderCell = (row: ListRow, value: unknown) => {
  const [col] = buildListColumns({
    columnNodes: [
      { id: 'c1', type: 'TABLE_COLUMN', props: DOC_LINK_PROPS } as ViewNode,
    ],
    sortState: undefined,
    sortCommand: undefined,
    filterCommand: undefined,
    filterOpLabels: undefined,
    dispatch: vi.fn() as never,
    nodeId: 'list1',
    sortInFlightRef: { current: false } as RefObject<boolean>,
  })
  const cell = col.cell as (info: unknown) => ReactNode
  return render(
    <MemoryRouter>
      {cell({ getValue: () => value, row: { original: row } })}
    </MemoryRouter>
  )
}

const RECORDER_ROW: ListRow = {
  id: 7,
  recorderDocumentName: 'Тарификация AAY00-00002 от 14.08.2026',
  recorderDocumentTypeCode: 'Tarifikatsiya',
  recorderDocumentEntryId: 42,
}

describe('cellKind=DOCUMENT_LINK — колонка «Регистратор»', () => {
  beforeEach(() => {
    armNewTabMock.mockClear()
  })
  afterEach(cleanup)

  it('есть typeCode и id → ссылка на карточку документа, текст представления сохранён', () => {
    const { container } = renderCell(
      RECORDER_ROW,
      'Тарификация AAY00-00002 от 14.08.2026'
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/documents/Tarifikatsiya/42')
    expect(
      screen.getByText('Тарификация AAY00-00002 от 14.08.2026')
    ).toBeTruthy()
  })

  it('обычный клик → взводит новую вкладку рабочего стола и не всплывает в строку', () => {
    const { container } = renderCell(RECORDER_ROW, 'Тарификация')
    const link = container.querySelector('a')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(link!, event)
    expect(armNewTabMock).toHaveBeenCalledTimes(1)
  })

  it('клик с Ctrl → вкладку рабочего стола не взводит (переход уходит в браузер)', () => {
    const { container } = renderCell(RECORDER_ROW, 'Тарификация')
    fireEvent.click(container.querySelector('a')!, {
      ctrlKey: true,
    })
    expect(armNewTabMock).not.toHaveBeenCalled()
  })

  it('нет recorderDocumentEntryId → обычный текст, ссылки нет', () => {
    const { container } = renderCell(
      {
        id: 8,
        recorderDocumentName: 'Тарификация',
        recorderDocumentTypeCode: 'Tarifikatsiya',
      },
      'Тарификация'
    )
    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('Тарификация')).toBeTruthy()
  })

  it('нет recorderDocumentTypeCode → обычный текст, ссылки нет', () => {
    const { container } = renderCell(
      { id: 9, recorderDocumentEntryId: 42 },
      'Тарификация'
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('пустая строка в typeCode → обычный текст, «мёртвой» ссылки не возникает', () => {
    const { container } = renderCell(
      { id: 10, recorderDocumentTypeCode: '  ', recorderDocumentEntryId: 42 },
      'Тарификация'
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('колонка без cellKind → обычный текст, ссылки нет', () => {
    const [col] = buildListColumns({
      columnNodes: [
        {
          id: 'c1',
          type: 'TABLE_COLUMN',
          props: { binding: 'recorderDocumentName' },
        } as ViewNode,
      ],
      sortState: undefined,
      sortCommand: undefined,
      filterCommand: undefined,
      filterOpLabels: undefined,
      dispatch: vi.fn() as never,
      nodeId: 'list1',
      sortInFlightRef: { current: false } as RefObject<boolean>,
    })
    const cell = col.cell as (info: unknown) => ReactNode
    const { container } = render(
      <MemoryRouter>
        {cell({
          getValue: () => 'Тарификация',
          row: { original: RECORDER_ROW },
        })}
      </MemoryRouter>
    )
    expect(container.querySelector('a')).toBeNull()
  })
})
