import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DateCellEditor } from './date-cell-editor'

// MUI-пикер подменён заглушкой намеренно. Предмет теста — не рендер календаря,
// а единственная логика, которой владеет DateCellEditor: КОГДА звать onCommit.
// Заглушка даёт прямой доступ к трём каналам пикера (onChange по сегменту,
// onOpen/onClose попапа), не втягивая LocalizationProvider и внутренности MUI.
const pickerHandlers: {
  onChange?: (v: string) => void
  onOpen?: () => void
  onClose?: () => void
} = {}

vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: (props: {
    value?: string
    onChange: (v: string) => void
    onOpen?: () => void
    onClose?: () => void
  }) => {
    pickerHandlers.onChange = props.onChange
    pickerHandlers.onOpen = props.onOpen
    pickerHandlers.onClose = props.onClose
    return <input data-testid="picker" defaultValue={props.value} />
  },
}))

describe('DateCellEditor — когда коммитится дата в ячейке ТЧ (SCRUM-314 §7)', () => {
  afterEach(cleanup)

  let onChange: ReturnType<typeof vi.fn<(value: unknown) => void>>
  let onCommit: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    onChange = vi.fn<(value: unknown) => void>()
    onCommit = vi.fn<() => void>()
  })

  const setup = () => {
    const { container } = render(
      <DateCellEditor
        value="2020-03-15"
        dateOnly
        sx={{}}
        onChange={onChange}
        onCommit={onCommit}
      />
    )
    return { cell: container.firstChild as HTMLElement }
  }

  // Главный дефект §7: коммит висел прямо на onChange пикера, а тот стреляет на
  // КАЖДЫЙ сегмент. Пока набирался год «2020», последовательно уезжали 0002,
  // 0020, 0202, 2020 — и «Записать» посреди набора сохраняло мусорную дату
  // (в БД оказывалось 0002-03-15 при вводе 15.03.2020).
  it('набор сегмента меняет значение, но НЕ коммитит', () => {
    setup()

    pickerHandlers.onChange?.('0002-03-15')
    pickerHandlers.onChange?.('0020-03-15')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('0020-03-15')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('уход фокуса из ячейки коммитит', () => {
    const { cell } = setup()
    pickerHandlers.onChange?.('2020-03-15')

    fireEvent.focusOut(cell, { relatedTarget: document.body })

    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  // Ловушка 1: клик по иконке календаря переводит фокус на кнопку ВНУТРИ
  // ячейки, а focusout всплывает — наивный коммит сработал бы посреди набора.
  it('перевод фокуса внутри ячейки не коммитит', () => {
    const { cell } = setup()

    fireEvent.focusOut(cell, { relatedTarget: screen.getByTestId('picker') })

    expect(onCommit).not.toHaveBeenCalled()
  })

  // Ловушка 2: попап календаря живёт в портале, то есть вне currentTarget, и
  // проверкой relatedTarget не отсекается — гасим коммит флагом до onClose.
  it('пока календарь открыт, blur не коммитит; коммит уходит на закрытии', () => {
    const { cell } = setup()

    pickerHandlers.onOpen?.()
    fireEvent.focusOut(cell, { relatedTarget: document.body })
    expect(onCommit).not.toHaveBeenCalled()

    pickerHandlers.onClose?.()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('Enter коммитит, не дожидаясь ухода фокуса', () => {
    const { cell } = setup()

    fireEvent.keyDown(cell, { key: 'Enter' })

    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})
