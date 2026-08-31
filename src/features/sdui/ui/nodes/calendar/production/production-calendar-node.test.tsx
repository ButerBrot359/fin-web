import type { ReactNode } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../../types/view'

const { dispatch } = vi.hoisted(() => ({
  dispatch: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))
vi.mock('../day-kind-legend', () => ({ DayKindLegend: () => null }))
// YearSelector-стаб: кнопка, дёргающая onChange(2031)
vi.mock('../year-selector', () => ({
  YearSelector: ({ onChange }: { onChange: (y: number) => void }) => (
    <button
      onClick={() => {
        onChange(2031)
      }}
    >
      year
    </button>
  ),
}))
// MonthGrid-стаб: январь отдаёт две реальные ячейки (15-е и 16-е)
vi.mock('../month-grid', () => ({
  MonthGrid: ({
    month,
    year,
    renderDay,
  }: {
    month: number
    year: number
    renderDay: (iso: string, dayNumber: number) => ReactNode
  }) => (
    <div>
      <span>m{month}</span>
      {month === 0 ? (
        <>
          {renderDay(`${String(year)}-01-15`, 15)}
          {renderDay(`${String(year)}-01-16`, 16)}
        </>
      ) : null}
    </div>
  ),
}))
// MUI DatePicker в jsdom тяжёлый — простой input с тем же контрактом
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: ({
    value,
    onChange,
  }: {
    value?: string
    onChange: (v: string) => void
  }) => (
    <input
      aria-label="destination"
      value={value ?? ''}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  ),
}))

import { ProductionCalendarNode } from './production-calendar-node'

const ENVELOPE = {
  draftId: 'draft-1',
  expectedDraftVersion: 4,
  calendarYear: 2030,
}

const baseProps = {
  mode: 'dayKind',
  productionCalendarContractVersion: 2,
  year: 2030,
  minYear: 2020,
  maxYear: 2035,
  editable: true,
  yearFilled: true,
  draftId: 'draft-1',
  draftVersion: 4,
  modified: false,
  coverage: 'FULL',
  allowedOperations: [
    'VIEW',
    'CHANGE_DAY',
    'TRANSFER_DAY',
    'FILL_YEAR',
    'PRINT',
    'SAVE_YEAR',
  ],
  dayKinds: [
    { code: 'Rabochiy', title: 'Рабочий' },
    { code: 'Prazdnik', title: 'Праздник' },
  ],
  days: [
    { date: '2030-01-15', kind: 'Rabochiy', kindTitle: 'Рабочий' },
    { date: '2030-01-16', kind: 'Prazdnik', kindTitle: 'Праздник' },
  ],
  transfers: [],
  baseVisible: false,
}

const node = (over: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'proizvkalendar.dniKalendarya',
    type: 'CALENDAR',
    props: { ...baseProps, ...over },
  }) as ViewNode

const cell15 = () => screen.getByRole('button', { name: /15 января 2030/ })
const cell16 = () => screen.getByRole('button', { name: /16 января 2030/ })
const button = (name: string) => screen.getByRole('button', { name })

describe('ProductionCalendarNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('рендерит 12 месяцев, серверные дни и toolbar', () => {
    render(<ProductionCalendarNode node={node()} />)
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
    expect(cell15().getAttribute('data-kind')).toBe('Rabochiy')
    expect(cell16().getAttribute('data-kind')).toBe('Prazdnik')
    // без выбора кнопка изменения disabled
    expect(
      button('sdui.productionCalendar.changeDay').hasAttribute('disabled')
    ).toBe(true)
  })

  it('multi-select + выбор вида отправляет exact payload dni.izmenit и чистит выбор', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(cell16())
    fireEvent.click(cell15())
    expect(cell15().getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button('sdui.productionCalendar.changeDay'))
    fireEvent.click(screen.getByText('Праздник'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.dni.izmenit',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: {
          ...ENVELOPE,
          selectedDates: ['2030-01-15', '2030-01-16'],
          targetKindCode: 'Prazdnik',
        },
      })
    })
    await waitFor(() => {
      expect(cell15().getAttribute('aria-pressed')).toBe('false')
    })
  })

  it('неуспех команды сохраняет выбор для повтора', async () => {
    dispatch.mockResolvedValueOnce(false)
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(cell15())
    fireEvent.click(button('sdui.productionCalendar.changeDay'))
    fireEvent.click(screen.getByText('Праздник'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled()
    })
    expect(cell15().getAttribute('aria-pressed')).toBe('true')
  })

  it('перенос: одна дата, две ISO-даты в payload den.perenesti', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(cell15())
    fireEvent.click(button('sdui.productionCalendar.transferDay'))
    fireEvent.change(screen.getByLabelText('destination'), {
      target: { value: '2030-01-20' },
    })
    fireEvent.click(button('sdui.productionCalendar.transferConfirm'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.den.perenesti',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: {
          ...ENVELOPE,
          firstDate: '2030-01-15',
          secondDate: '2030-01-20',
        },
      })
    })
  })

  it('перенос при мультивыборе: источник — первая выбранная дата (v5 §2.3)', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(cell15())
    fireEvent.click(cell16())
    const transferButton = button('sdui.productionCalendar.transferDay')
    expect(transferButton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(transferButton)
    fireEvent.change(screen.getByLabelText('destination'), {
      target: { value: '2030-01-20' },
    })
    fireEvent.click(button('sdui.productionCalendar.transferConfirm'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.den.perenesti',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: {
          ...ENVELOPE,
          firstDate: '2030-01-15',
          secondDate: '2030-01-20',
        },
      })
    })
  })

  it('перенос: дата вне года невалидна', () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(cell15())
    fireEvent.click(button('sdui.productionCalendar.transferDay'))
    fireEvent.change(screen.getByLabelText('destination'), {
      target: { value: '2031-01-20' },
    })
    expect(
      button('sdui.productionCalendar.transferConfirm').hasAttribute('disabled')
    ).toBe(true)
  })

  it('контекстное меню повторяет change-workflow', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.contextMenu(cell15())
    fireEvent.click(screen.getAllByText('sdui.productionCalendar.changeDay')[1])
    fireEvent.click(screen.getByText('Рабочий'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'proizvkalendar.dni.izmenit',
          value: expect.objectContaining({
            selectedDates: ['2030-01-15'],
            targetKindCode: 'Rabochiy',
          }),
        })
      )
    })
  })

  it('заполнить по умолчанию шлёт только envelope', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(button('sdui.calendar.fillDefaults'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.god.zapolnit',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: ENVELOPE,
      })
    })
  })

  it('смена года шлёт god.change c targetYear', async () => {
    render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(screen.getByText('year'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.god.change',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: { ...ENVELOPE, targetYear: 2031 },
      })
    })
  })

  it('SAVE_DISCARD_CANCEL_REQUIRED: Сохранить → save, затем god.open строго после успеха', async () => {
    const { rerender } = render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(screen.getByText('year'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled()
    })
    rerender(
      <ProductionCalendarNode
        node={node({
          lastCommand: 'proizvkalendar.god.change',
          commandOutcome: 'SAVE_DISCARD_CANCEL_REQUIRED',
        })}
      />
    )
    dispatch.mockClear()
    fireEvent.click(button('sdui.productionCalendar.save'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'COMMAND',
        command: 'save',
      })
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'COMMAND',
        command: 'proizvkalendar.god.open',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: { targetYear: 2031 },
      })
    })
  })

  it('SAVE_DISCARD_CANCEL_REQUIRED: неуспешный save НЕ продолжается god.open', async () => {
    const { rerender } = render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(screen.getByText('year'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled()
    })
    rerender(
      <ProductionCalendarNode
        node={node({
          lastCommand: 'proizvkalendar.god.change',
          commandOutcome: 'SAVE_DISCARD_CANCEL_REQUIRED',
        })}
      />
    )
    dispatch.mockClear()
    dispatch.mockResolvedValueOnce(false)
    fireEvent.click(button('sdui.productionCalendar.save'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1)
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'COMMAND', command: 'save' })
    // диалог остаётся доступным
    expect(
      screen.getByText('sdui.productionCalendar.yearDialogTitle')
    ).toBeTruthy()
  })

  it('SAVE_DISCARD_CANCEL_REQUIRED: Не сохранять → god.discard-and-open', async () => {
    const { rerender } = render(<ProductionCalendarNode node={node()} />)
    fireEvent.click(screen.getByText('year'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled()
    })
    rerender(
      <ProductionCalendarNode
        node={node({
          lastCommand: 'proizvkalendar.god.change',
          commandOutcome: 'SAVE_DISCARD_CANCEL_REQUIRED',
        })}
      />
    )
    dispatch.mockClear()
    fireEvent.click(button('sdui.productionCalendar.discard'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'COMMAND',
        command: 'proizvkalendar.god.discard-and-open',
        sourceNodeId: 'proizvkalendar.dniKalendarya',
        value: { ...ENVELOPE, targetYear: 2031 },
      })
    })
  })

  it('печать: PRINT_SAVE_REQUIRED показывает предупреждение, preview не открывается', () => {
    render(
      <ProductionCalendarNode
        node={node({
          lastCommand: 'proizvkalendar.print',
          commandOutcome: 'PRINT_SAVE_REQUIRED',
        })}
      />
    )
    expect(
      screen.getByText('sdui.productionCalendar.printSaveRequired')
    ).toBeTruthy()
    expect(screen.queryByText('sdui.productionCalendar.printTitle')).toBeNull()
  })

  it('unknown contract version → read-only warning, команды не шлются', () => {
    render(
      <ProductionCalendarNode
        node={node({ productionCalendarContractVersion: 3 })}
      />
    )
    expect(
      screen.getByText('sdui.productionCalendar.unsupportedContract')
    ).toBeTruthy()
    fireEvent.click(cell15())
    expect(cell15().getAttribute('aria-pressed')).toBe('false')
    expect(button('sdui.calendar.fillDefaults').hasAttribute('disabled')).toBe(
      true
    )
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('editable=false → read-only: выбор и мутации недоступны', () => {
    render(<ProductionCalendarNode node={node({ editable: false })} />)
    expect(screen.getByText('sdui.productionCalendar.readOnly')).toBeTruthy()
    fireEvent.click(cell15())
    expect(cell15().getAttribute('aria-pressed')).toBe('false')
    expect(
      button('sdui.productionCalendar.changeDay').hasAttribute('disabled')
    ).toBe(true)
  })

  it('день с kind=null — незаполненный, не рабочий', () => {
    render(
      <ProductionCalendarNode
        node={node({
          days: [{ date: '2030-01-15', kind: null, kindTitle: null }],
        })}
      />
    )
    expect(cell15().getAttribute('data-kind')).toBeNull()
  })

  it('базовое поле: enable/select/clear шлют base-команды', async () => {
    render(
      <ProductionCalendarNode
        node={node({
          baseVisible: true,
          hasBaseCalendar: false,
          baseCalendarEntryId: null,
          baseCandidates: [{ id: 101, code: '01', nameRu: 'Пятидневка' }],
        })}
      />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'proizvkalendar.base.enable',
          value: ENVELOPE,
        })
      )
    })
  })

  it('печать: PRINT_READY открывает preview, закрытие не переоткрывает тот же result', () => {
    const indicators = {
      calendarDays: 31,
      workingDays: 20,
      daysOff: 11,
      hours40: 160,
      hours36: 144,
      hours24: 96,
    }
    const period = (number: number) => ({ number, indicators })
    render(
      <ProductionCalendarNode
        node={node({
          lastCommand: 'proizvkalendar.print',
          commandOutcome: 'PRINT_READY',
          commandResult: {
            status: 'READY',
            projection: {
              revisionId: 7,
              headVersion: 3,
              calendarYear: 2030,
              coverage: 'FULL',
              sourceSha256: 'a'.repeat(64),
              months: Array.from({ length: 12 }, (_, i) => period(i + 1)),
              quarters: [1, 2, 3, 4].map(period),
              halfYears: [1, 2].map(period),
              annual: indicators,
              averageMonthly: { hours40: 164.9, hours36: 148.4, hours24: 98.9 },
              nonWorkingPeriodWarning: false,
            },
          },
        })}
      />
    )
    expect(screen.getByText('sdui.productionCalendar.printTitle')).toBeTruthy()
    fireEvent.click(button('sdui.productionCalendar.close'))
    expect(screen.queryByText('sdui.productionCalendar.printTitle')).toBeNull()
  })

  it('список переносов рендерит серверный presentation', () => {
    render(
      <ProductionCalendarNode
        node={node({
          transfers: [
            {
              sourceDate: '2030-01-05',
              destinationDate: '2030-01-07',
              sourceKindCode: 'Rabochiy',
              presentation: 'Рабочий день 05.01 перенесён на 07.01',
            },
          ],
        })}
      />
    )
    expect(
      screen.getByText('Рабочий день 05.01 перенесён на 07.01')
    ).toBeTruthy()
  })
})
