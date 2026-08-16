import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { ru } from 'date-fns/locale'

import { DateTimeInput, type DateTimeInputProps } from './datetime-input'

/**
 * `props.dateFormat` в поле даты: «Месяц начисления» должен показывать 08.2026,
 * а не 12.08.2026, и день в нём выбрать нельзя. Пикер рендерится настоящий —
 * предмет теста именно его конфигурация (формат поля + виды календаря).
 *
 * Значение читаем из `input`: у MUI v8 видимое поле собрано из секций
 * (role="spinbutton"), а цельная строка живёт в скрытом инпуте.
 */
const renderInput = (props: Partial<DateTimeInputProps>) => {
  const utils = render(
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <DateTimeInput
        dateOnly
        value="2026-08-12"
        onChange={() => undefined}
        {...props}
      />
    </LocalizationProvider>
  )
  return {
    ...utils,
    fieldValue: () => utils.container.querySelector('input')?.value,
    openCalendar: () =>
      fireEvent.click(utils.container.querySelector('button')!),
  }
}

describe('DateTimeInput — props.dateFormat', () => {
  afterEach(cleanup)

  it('без ключа поведение прежнее: дд.ММ.гггг и выбор дня', () => {
    const { fieldValue, openCalendar } = renderInput({})
    expect(fieldValue()).toBe('12.08.2026')
    openCalendar()
    // Сетка дней в MUI — role="grid".
    expect(screen.getByRole('grid')).toBeTruthy()
  })

  it('«MM.yyyy» показывает месяц и год без дня', () => {
    const { fieldValue } = renderInput({ dateFormat: 'MM.yyyy' })
    expect(fieldValue()).toBe('08.2026')
  })

  it('с «MM.yyyy» календарь открывается на выборе месяца — сетки дней нет', () => {
    const { openCalendar } = renderInput({ dateFormat: 'MM.yyyy' })
    openCalendar()
    expect(screen.queryByRole('grid')).toBeNull()
    // Вместо дней — радиогруппа месяцев (locale ru: «янв.» … «дек.»).
    expect(screen.getAllByRole('radio')).toHaveLength(12)
  })

  // Формат значения на проводе не меняется: уходит полная дата с первым числом.
  // Это и есть суть дефекта — раньше на сервер уезжал посторонний день, а
  // проведение считало по началу месяца, и введённое молча терялось.
  it('выбор месяца отдаёт первое число (2026-08-01)', () => {
    const onChange = vi.fn<(v: string) => void>()
    const { openCalendar } = renderInput({ dateFormat: 'MM.yyyy', onChange })
    openCalendar()
    // Сентябрь — девятый месяц радиогруппы; выбираем не текущий, чтобы клик
    // точно менял значение.
    fireEvent.click(screen.getAllByRole('radio')[8])
    expect(onChange).toHaveBeenCalledWith('2026-09-01')
  })

  it('с «dd.MM.yyyy» день по-прежнему выбирается', () => {
    const { openCalendar } = renderInput({ dateFormat: 'dd.MM.yyyy' })
    openCalendar()
    expect(screen.getByRole('grid')).toBeTruthy()
  })
})
