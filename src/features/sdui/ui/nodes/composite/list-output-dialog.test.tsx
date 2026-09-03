import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useSelectionStore } from '../../../lib/stores/selection-store'
import { ListOutputDialog } from './list-output-dialog'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const LIST_ID = 'list.Tabel.list'

const node = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'panel.listOutput.Tabel', type: 'PAGE', props }) as ViewNode

const withColumns = (extra: Record<string, unknown> = {}) =>
  node({
    kind: 'LIST_OUTPUT_DIALOG',
    listOutputColumns: [
      { id: 'Data', label: 'Дата' },
      { id: 'Nomer', label: 'Номер' },
    ],
    listOutputConfirmCommand: 'list.exportList:download',
    listOutputCancelCommand: 'list.exportList:cancel',
    listOutputSourceListId: LIST_ID,
    ...extra,
  })

/**
 * Бэк отдаёт диалог PAGE-узлом без детей (состав — в пропах), а рендерера у клиента не было:
 * «Вывести список» открывала пустое модальное окно (02.09.2026).
 */
describe('ListOutputDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('колонки приходят отмеченными; «Вывести» шлёт их в серверном порядке', () => {
    render(<ListOutputDialog node={withColumns()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.listOutput.confirm' })
    )

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.exportList:download',
      value: {
        columnIds: ['Data', 'Nomer'],
        onlySelected: false,
        selectedRowIds: [],
      },
      sourceNodeId: 'panel.listOutput.Tabel',
    })
  })

  it('снятая колонка в выгрузку не уходит', () => {
    render(<ListOutputDialog node={withColumns()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Дата' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.listOutput.confirm' })
    )

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({ columnIds: ['Nomer'] }),
      })
    )
  })

  it('без единой колонки «Вывести» недоступна — сервер такой запрос всё равно отклонит', () => {
    render(<ListOutputDialog node={withColumns()} />)

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'sdui.listOutput.all' })
    )

    const confirm = screen.getByRole('button', {
      name: 'sdui.listOutput.confirm',
    })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    fireEvent.click(confirm)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('«Отмена» шлёт команду отмены — диалог закрывает сервер', () => {
    render(<ListOutputDialog node={withColumns()} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.exportList:cancel',
    })
  })

  it('«Только выделенные» показывается лишь у типов с такой поддержкой и несёт id строки', () => {
    useSelectionStore.getState().setSelection(LIST_ID, 42)
    render(
      <ListOutputDialog
        node={withColumns({ listOutputSelectedRowsSupported: true })}
      />
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'sdui.listOutput.onlySelected' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.listOutput.confirm' })
    )

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({
          onlySelected: true,
          selectedRowIds: [42],
        }),
      })
    )
  })

  it('тип без поддержки выделенных строк флажок не показывает', () => {
    render(<ListOutputDialog node={withColumns()} />)

    expect(
      screen.queryByRole('checkbox', { name: 'sdui.listOutput.onlySelected' })
    ).toBeNull()
  })

  it('колонок нет → текст-заглушка и только «Отмена»', () => {
    render(
      <ListOutputDialog
        node={node({
          kind: 'LIST_OUTPUT_DIALOG',
          listOutputColumns: [],
          listOutputCancelCommand: 'list.exportList:cancel',
        })}
      />
    )

    expect(screen.getByText('sdui.listOutput.empty')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'sdui.listOutput.confirm' })
    ).toBeNull()
  })
})
