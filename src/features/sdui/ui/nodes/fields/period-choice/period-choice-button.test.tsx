import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dispatchMock, setValueMock, state } = vi.hoisted(() => ({
  dispatchMock: vi.fn(() => Promise.resolve(true)),
  setValueMock: vi.fn(),
  state: {} as Record<string, unknown>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { returnObjects?: boolean }) =>
      o?.returnObjects
        ? Array.from({ length: 12 }, (_, i) => `M${String(i)}`)
        : k,
  }),
}))
vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: (props: { label?: string; value?: string }) => (
    <input aria-label={props.label} value={props.value ?? ''} readOnly />
  ),
}))
vi.mock('../../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('../../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: setValueMock }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

import { readPeriodChoice } from '../../../../lib/utils/period-choice-props'
import { PeriodChoiceNodeButton } from './period-choice-button'

const choice = {
  fromNodeId: 'report.OSV.param.Period.from',
  toNodeId: 'report.OSV.param.Period.to',
  sourceNodeId: 'report.OSV.param.Period',
}

const openDialog = () => {
  render(<PeriodChoiceNodeButton choice={choice} />)
  fireEvent.click(screen.getByLabelText('periodChoice.title'))
}

describe('PeriodChoiceNodeButton', () => {
  beforeEach(() => {
    dispatchMock.mockClear()
    setValueMock.mockClear()
    state[choice.fromNodeId] = '2026-01-01'
    state[choice.toNodeId] = '2026-09-30'
  })

  it('выбранный в сетке месяц заполняет обе даты и уходит одним EVENT', () => {
    openDialog()
    expect(screen.getByLabelText('periodChoice.from')).toHaveValue('2026-01-01')

    fireEvent.click(screen.getAllByText('M6')[1])
    fireEvent.click(screen.getByText('periodChoice.select'))

    expect(setValueMock).toHaveBeenCalledWith(choice.fromNodeId, '2026-07-01')
    expect(setValueMock).toHaveBeenCalledWith(choice.toNodeId, '2026-07-31')
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: choice.sourceNodeId,
      trigger: 'change',
      value: { from: '2026-07-01', to: '2026-07-31' },
    })
    expect(screen.queryByText('periodChoice.select')).toBeNull()
  })

  it('Shift+клик по месяцу расширяет период до квартала', () => {
    openDialog()
    fireEvent.click(screen.getAllByText('M3')[1])
    fireEvent.click(screen.getAllByText('M5')[1], { shiftKey: true })
    fireEvent.click(screen.getByText('periodChoice.select'))

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: { from: '2026-04-01', to: '2026-06-30' },
      })
    )
  })

  it('клик по году выбирает весь год', () => {
    openDialog()
    fireEvent.click(screen.getByText('2027'))
    fireEvent.click(screen.getByText('periodChoice.select'))

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: { from: '2027-01-01', to: '2027-12-31' },
      })
    )
  })

  it('«Очистить период» отправляет пустые границы', () => {
    openDialog()
    fireEvent.click(screen.getByText('periodChoice.clear'))
    fireEvent.click(screen.getByText('periodChoice.select'))

    expect(setValueMock).toHaveBeenCalledWith(choice.fromNodeId, '')
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: { from: null, to: null } })
    )
  })

  it('стандартный период выбирается из списка', () => {
    openDialog()
    fireEvent.click(screen.getByText('periodChoice.showStandard'))
    fireEvent.doubleClick(screen.getByText('periodChoice.standard.thisYear'))

    const year = new Date().getFullYear()
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: { from: `${String(year)}-01-01`, to: `${String(year)}-12-31` },
      })
    )
  })

  it('«Отмена» закрывает окно без изменений', () => {
    openDialog()
    fireEvent.click(screen.getAllByText('M6')[1])
    fireEvent.click(screen.getByText('periodChoice.cancel'))

    expect(setValueMock).not.toHaveBeenCalled()
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('проп periodChoice без обязательных ключей игнорируется', () => {
    expect(readPeriodChoice(choice)).toEqual(choice)
    expect(readPeriodChoice({ fromNodeId: 'a' })).toBeNull()
    expect(readPeriodChoice(undefined)).toBeNull()
  })
})
