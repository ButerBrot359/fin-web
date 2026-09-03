import { useState } from 'react'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react'
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
    // Кнопок в поле две, и крестик очистки идёт раньше — «первая попавшаяся»
    // больше не годится. У кнопки календаря есть aria-label, у крестика — title.
    openCalendar: () =>
      fireEvent.click(
        utils.container.querySelector<HTMLButtonElement>('button[aria-label]')!
      ),
  }
}

/** Поле со стейтом наверху — как в настоящей форме. */
const renderControlledInput = (spy?: (value: string) => void) => {
  const Controlled = () => {
    const [value, setValue] = useState('2026-08-12')
    return (
      <DateTimeInput
        dateOnly
        value={value}
        onChange={(next) => {
          spy?.(next)
          setValue(next)
        }}
      />
    )
  }
  const utils = render(
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Controlled />
    </LocalizationProvider>
  )
  return {
    ...utils,
    fieldValue: () => utils.container.querySelector('input')?.value,
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

  /**
   * Поле ДАТЫ-ВРЕМЕНИ с месячной маской — «Период» Разделения результатов расчёта
   * зарплаты. В 1С там «Сентябрь 2026», времени нет вовсе, а день срезается
   * (НачалоМесяца в ПередЗаписью). Раньше DateTimePicker получал только format,
   * поэтому подпись была месячной, а календарь всё равно предлагал выбрать день
   * и часы.
   */
  it('DATETIME с месячной маской: календарь без дней, только месяцы', () => {
    const utils = render(
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        <DateTimeInput
          value="2026-08-12T00:00:00"
          onChange={() => undefined}
          dateFormat="LLLL yyyy"
        />
      </LocalizationProvider>
    )
    fireEvent.click(
      utils.container.querySelector<HTMLButtonElement>('button[aria-label]')!
    )

    expect(screen.queryByRole('grid')).toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(12)
    cleanup()
  })

  it('DATETIME с месячной маской: подпись — название месяца и год', () => {
    const utils = render(
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        <DateTimeInput
          value="2026-08-12T00:00:00"
          onChange={() => undefined}
          dateFormat="LLLL yyyy"
        />
      </LocalizationProvider>
    )

    expect(utils.container.querySelector('input')?.value).toBe('август 2026')
    cleanup()
  })

  it('с «dd.MM.yyyy» день по-прежнему выбирается', () => {
    const { openCalendar } = renderInput({ dateFormat: 'dd.MM.yyyy' })
    openCalendar()
    expect(screen.getByRole('grid')).toBeTruthy()
  })
})

/**
 * Очистка значения. Два пути: поразрядный Backspace (каретка сама идёт справа
 * налево) и крестик «стереть всё сразу».
 */
describe('DateTimeInput — очистка значения', () => {
  afterEach(cleanup)

  const clearButton = () =>
    document.querySelector<HTMLButtonElement>('button.clearButton')

  const sections = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="spinbutton"]'))

  // Пикер запоминает активный разряд по фокусу — без act() обновление стейта не
  // успевает примениться, и он считает, что в поле не выбрано ничего.
  const focusSection = (section: HTMLElement) => {
    act(() => {
      section.focus()
    })
  }

  /**
   * Backspace в браузере: пикер держит текущий разряд выделенным, браузер стирает
   * выделение и шлёт `input` уже после `keydown`. jsdom за него этого не делает —
   * эмулируем обе половины, иначе проверялся бы только наш перевод каретки.
   */
  const pressBackspace = (section: HTMLElement) => {
    fireEvent.keyDown(section, { key: 'Backspace' })
    section.textContent = ''
    fireEvent.input(section)
  }

  it('у заполненного поля есть кнопка очистки', () => {
    renderInput({})
    expect(clearButton()).toBeTruthy()
  })

  it('крестик отдаёт наружу пустую строку', async () => {
    const onChange = vi.fn<(v: string) => void>()
    renderInput({ onChange })
    fireEvent.click(clearButton()!)
    // Очистка отложена на макрозадачу (см. handleChange): в момент события
    // крестик ещё не успел опустошить разряды.
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('')
    })
  })

  it('Backspace стирает текущий разряд и сам переводит каретку на предыдущий', async () => {
    // Стирание — предмет пикера; наш вклад — только перевод каретки, его и
    // проверяем. Видимая пустота разряда в jsdom недостоверна: без эха значения
    // наверх пикер тут же пересинхронизирует разряды из неизменившегося `value`
    // (в браузере сфокусированное поле держит свой ввод само).
    renderControlledInput()
    const [day, month, year] = sections()

    focusSection(year)
    pressBackspace(year)
    // Каретка сама переехала на месяц, мышь не понадобилась.
    await waitFor(() => {
      expect(document.activeElement).toBe(month)
    })

    pressBackspace(month)
    await waitFor(() => {
      expect(document.activeElement).toBe(day)
    })
  })

  it('недодата при наборе не отдаёт наружу пустую строку (SCRUM-276)', async () => {
    const onChange = vi.fn<(v: string) => void>()
    renderControlledInput(onChange)
    const [, month] = sections()

    // Стереть только месяц: «12.__.2026» — невалидная, недонабранная дата.
    // Раньше каждый такой шаг слал наружу «""» — и SDUI гнал серверу мусорный
    // EVENT перед настоящим значением.
    focusSection(month)
    pressBackspace(month)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('на первом разряде каретка не уезжает за границу поля', async () => {
    renderControlledInput()
    const [day] = sections()
    focusSection(day)
    pressBackspace(day)
    await waitFor(() => {
      expect(document.activeElement).toBe(day)
    })
  })

  it('readOnly не очищается ни крестиком, ни клавишей', async () => {
    const onChange = vi.fn<(v: string) => void>()
    const { fieldValue } = renderInput({ readOnly: true, onChange })
    expect(clearButton()).toBeNull()
    const year = sections().at(-1)!
    focusSection(year)
    fireEvent.keyDown(year, { key: 'Backspace' })
    await waitFor(() => {
      expect(document.activeElement).toBe(year)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(fieldValue()).toBe('12.08.2026')
  })
})
