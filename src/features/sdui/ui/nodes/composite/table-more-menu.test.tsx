import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableCommandDescriptor } from '../../../types/view'
import { TableMoreMenu } from './table-more-menu'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))

const podbor: TableCommandDescriptor = {
  command: 'table.podbor:VychetyIPN',
  label: 'Подбор',
  enabled: true,
  behavior: { flushPendingTables: false },
  inMoreMenu: true,
}

const hidden: TableCommandDescriptor = {
  command: 'table.x:T',
  label: 'Не в меню',
  enabled: true,
  behavior: {},
  inMoreMenu: false,
}

const makeProps = () => ({
  anchorEl: document.body,
  onClose: vi.fn(),
  allowAdd: true,
  allowDelete: true,
  allowReorder: true,
  canAdd: true,
  canCopy: true,
  canRemove: true,
  canMoveUp: false,
  canMoveDown: true,
  onAdd: vi.fn(),
  onCopy: vi.fn(),
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  hasQuery: false,
  onFind: vi.fn(),
  onClearSearch: vi.fn(),
  commands: [podbor, hidden],
  commandLabel: (cmd: TableCommandDescriptor) => cmd.label,
  onCommand: vi.fn(),
})

describe('TableMoreMenu (SCRUM-302)', () => {
  beforeEach(cleanup)

  it('стандартные пункты + доменные с inMoreMenu после разделителя', () => {
    render(<TableMoreMenu {...makeProps()} />)
    for (const key of [
      'table.add',
      'table.copyRow',
      'table.deleteRow',
      'table.moveUp',
      'table.moveDown',
    ]) {
      expect(screen.getByText(key)).toBeTruthy()
    }
    expect(screen.getByText('Подбор')).toBeTruthy()
    expect(screen.queryByText('Не в меню')).toBeNull()
    expect(screen.getByRole('separator')).toBeTruthy()
  })

  it('неактивность по правилам: moveUp disabled, moveDown активен', () => {
    render(<TableMoreMenu {...makeProps()} />)
    expect(
      screen
        .getByText('table.moveUp')
        .closest('li')
        ?.getAttribute('aria-disabled')
    ).toBe('true')
    expect(
      screen
        .getByText('table.moveDown')
        .closest('li')
        ?.getAttribute('aria-disabled')
    ).toBeNull()
  })

  it('клик по доменному пункту зовёт onCommand и закрывает меню', () => {
    const props = makeProps()
    render(<TableMoreMenu {...props} />)
    fireEvent.click(screen.getByText('Подбор'))
    expect(props.onCommand).toHaveBeenCalledWith(podbor)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('пункт удаления зовёт onRemove', () => {
    const props = makeProps()
    render(<TableMoreMenu {...props} />)
    fireEvent.click(screen.getByText('table.deleteRow'))
    expect(props.onRemove).toHaveBeenCalled()
  })
})
