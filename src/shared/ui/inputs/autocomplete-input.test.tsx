import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'
import { AutocompleteInput } from './autocomplete-input'

const OPTIONS_A: SelectOption[] = [{ id: 1, code: '1', label: 'Стол' }]
const OPTIONS_B: SelectOption[] = [{ id: 2, code: '2', label: 'Инструменты' }]

const Pair = ({ onShowAll }: { onShowAll?: () => void }) => (
  <div>
    <span>Пустое место</span>
    <AutocompleteInput
      label="Номенклатура"
      value={null}
      options={OPTIONS_A}
      onChange={vi.fn()}
      onShowAll={onShowAll}
    />
    <AutocompleteInput
      label="Вид ОС"
      value={null}
      options={OPTIONS_B}
      onChange={vi.fn()}
    />
  </div>
)

const openByKeyboard = (label: string) => {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), {
    key: 'ArrowDown',
  })
}

describe('AutocompleteInput — один открытый список', () => {
  afterEach(cleanup)

  it('открытие второго списка закрывает первый, даже если фокус не ушёл', () => {
    render(<Pair />)

    openByKeyboard('Номенклатура')
    expect(screen.getByText('Стол')).toBeInTheDocument()

    openByKeyboard('Вид ОС')
    expect(screen.getByText('Инструменты')).toBeInTheDocument()
    expect(screen.queryByText('Стол')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listbox')).toHaveLength(1)
  })

  it('клик по любому месту страницы вне списка закрывает его', () => {
    render(<Pair />)

    openByKeyboard('Номенклатура')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByText('Пустое место'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('клик внутри самого списка его не закрывает', () => {
    const onShowAll = vi.fn()
    render(<Pair onShowAll={onShowAll} />)

    openByKeyboard('Номенклатура')
    fireEvent.pointerDown(screen.getByText('Стол'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    const showAll = screen.getByRole('button', { name: 'dictSidebar.showAll' })
    fireEvent.pointerDown(showAll)
    fireEvent.mouseDown(showAll)
    expect(onShowAll).toHaveBeenCalledTimes(1)
  })

  it('клик по своему полю не закрывает открытый список', () => {
    render(<Pair />)

    openByKeyboard('Номенклатура')
    fireEvent.pointerDown(
      screen.getByRole('combobox', { name: 'Номенклатура' })
    )
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
