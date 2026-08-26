import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
// Дерево сессии — template ищет в нём узел RaspisanieRaboty (spec v3).
const treeState: { root: unknown } = { root: null }
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    tree: treeState.root,
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}:${Object.values(o).join(':')}` : k,
  }),
  // Требуется транзитивной цепочкой TableCellEditor → resolve-select-value.ts
  // → реальный i18n singleton (i18n.use(initReactI18next)) — без экспорта
  // мок не удовлетворяет .use() и падает до рендера (как в read-only-table.test.tsx).
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))

import { KalendariTemplateTable } from './kalendari-template-table'

const checkboxCol: ViewNode = {
  id: 'dict.field.ShablonZapolneniya.col.DenVklyuchenVGrafik',
  type: 'TABLE_COLUMN',
  binding: 'DenVklyuchenVGrafik',
  props: { dataType: 'BOOLEAN', cellWidget: 'CHECKBOX_FIELD' },
}
const node = (): ViewNode => ({
  id: 'dict.field.ShablonZapolneniya',
  type: 'TABLE',
  binding: 'ShablonZapolneniya',
  props: { editable: true, allowAdd: true, allowDelete: true },
  children: [checkboxCol],
})

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rowId: `r${String(i + 1)}`,
    DenVklyuchenVGrafik: i < 5,
  }))

const scheduleNode: ViewNode = {
  id: 'dict.field.RaspisanieRaboty',
  type: 'TABLE',
  binding: 'RaspisanieRaboty',
  props: {},
  children: [],
}
const treeWithSchedule = (): ViewNode => ({
  id: 'root',
  type: 'PAGE',
  children: [node(), scheduleNode],
})

const wire = (hhmm: string) => `2000-01-01T${hhmm}:00`

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
  treeState.root = null
})
beforeEach(() => mockDispatch.mockClear())

describe('KalendariTemplateTable (spec v4)', () => {
  it('режим PoNedelyam → 7 строк с полными названиями дней, технической шапки нет', () => {
    sessionState.SposobZapolneniya = 'PoNedelyam'
    sessionState.ShablonZapolneniya = rows(7)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    // Полные названия (v4), не сокращённые
    expect(screen.getByText('Понедельник')).toBeTruthy()
    expect(screen.getByText('Воскресенье')).toBeTruthy()
    // Технической шапки нет
    expect(screen.queryByText('sdui.kalendari.workingDay')).toBeNull()
    expect(screen.queryByText('sdui.kalendari.dayColumn')).toBeNull()
    // Заголовок и подсказки шаблона
    expect(screen.getByText('sdui.kalendari.templateTitle')).toBeTruthy()
    expect(screen.getByText('sdui.kalendari.templateHint')).toBeTruthy()
    expect(screen.getByText('sdui.kalendari.templateIntro')).toBeTruthy()
  })

  it('циклический режим: ячейки «номер / дата от DataOtscheta / чекбокс» (v4)', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.DataOtscheta = '2026-01-01'
    sessionState.ShablonZapolneniya = rows(3)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getByText('1.01')).toBeTruthy()
    expect(screen.getByText('2.01')).toBeTruthy()
    expect(screen.getByText('3.01')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy() // порядковый номер
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('пустая/битая дата отсчёта → колонка дат пустая, номера на месте', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.DataOtscheta = 'not-a-date'
    sessionState.ShablonZapolneniya = rows(2)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByText(/\d\.\d{2}/)).toBeNull()
  })

  it('10 строк цикла: все строки в DOM (скролл-вьюпорт, не усечение)', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(10)
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(10)
  })

  // Переключение режима: бэк строки не пересобирает (коммент Talgat 18.08) —
  // реактивность фронта: → недели = ровно 7 строк полным EVENT'ом.
  it('смена циклы(3) → недели: EVENT с 7 строками, общие позиции сохранены, новые unchecked tmp-*', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(3)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as {
      value: { rowId: string; DenVklyuchenVGrafik: boolean }[]
    }
    expect(sent.value).toHaveLength(7)
    expect(sent.value.slice(0, 3).map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
    for (const row of sent.value.slice(3)) {
      expect(row.rowId.startsWith('tmp-')).toBe(true)
      expect(row.DenVklyuchenVGrafik).toBe(false)
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
  })

  it('смена циклы(10) → недели: хвост отброшен до 7', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(10)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)

    const sent = mockDispatch.mock.calls[0][0] as {
      value: { rowId: string }[]
    }
    expect(sent.value).toHaveLength(7)
  })

  it('смена циклы(7) → недели: длина уже 7 — EVENT не шлётся', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = rows(7)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('первичная гидратация режима (undefined → недели): EVENT не шлётся, дефолт — зона бэка', () => {
    sessionState.ShablonZapolneniya = rows(3)
    const { rerender } = render(<KalendariTemplateTable node={node()} />)
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    rerender(<KalendariTemplateTable node={node()} />)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('чекбокс шлёт EVENT с полным массивом строк', () => {
    sessionState.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
    }
    sessionState.ShablonZapolneniya = [
      { rowId: 'r1', DenVklyuchenVGrafik: true },
      { rowId: 'r2', DenVklyuchenVGrafik: true },
      { rowId: 'r3', DenVklyuchenVGrafik: false },
    ]
    render(<KalendariTemplateTable node={node()} />)
    fireEvent.click(screen.getAllByRole('checkbox')[2]) // включить r3
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: Record<string, unknown>[]
    }
    expect(sent.value[2].DenVklyuchenVGrafik).toBe(true)
  })
})

describe('KalendariTemplateTable — рабочее время и предпраздничный день (v4)', () => {
  const setup = (schedule: unknown[], holidays?: boolean) => {
    sessionState.SposobZapolneniya = 'PoNedelyam'
    sessionState.ShablonZapolneniya = rows(7)
    sessionState.RaspisanieRaboty = schedule
    if (holidays !== undefined) sessionState.UchityvatPrazdniki = holidays
    treeState.root = treeWithSchedule()
    render(<KalendariTemplateTable node={node()} />)
  }

  it('день без интервалов → текст-действие «Заполнить расписание», день с интервалами → саммари', () => {
    setup(
      [
        {
          rowId: '10',
          NomerDnya: 1,
          VremyaNachala: wire('09:00'),
          VremyaOkonchaniya: wire('18:00'),
        },
      ],
      true
    )
    expect(
      screen.getByText('sdui.kalendari.daySummary:9:09:00–18:00')
    ).toBeTruthy()
    // 6 пустых дней недели + пустой предпраздничный день
    expect(screen.getAllByText('sdui.kalendari.fillSchedule')).toHaveLength(7)
  })

  it('день 0 живёт в блоке предпраздничного дня, не строкой шаблона', () => {
    setup(
      [
        {
          rowId: '30',
          NomerDnya: 0,
          VremyaNachala: wire('09:00'),
          VremyaOkonchaniya: wire('15:00'),
        },
      ],
      true
    )
    expect(screen.getByText('sdui.kalendari.preHolidaySchedule')).toBeTruthy()
    // Саммари дня 0 — в блоке, все 7 дней недели пустые
    expect(
      screen.getByText('sdui.kalendari.daySummary:6:09:00–15:00')
    ).toBeTruthy()
    expect(screen.getAllByText('sdui.kalendari.fillSchedule')).toHaveLength(7)
  })

  it('«Учитывать праздники» снят → действие предпраздничного дня недоступно', () => {
    setup([], false)
    const actions = screen.getAllByText('sdui.kalendari.fillSchedule')
    // Последняя кнопка — предпраздничный блок (рендерится после таблицы)
    const preHolidayBtn = actions[actions.length - 1].closest('button')
    expect(preHolidayBtn?.disabled).toBe(true)
    // Дни недели при этом активны
    expect(actions[0].closest('button')?.disabled).toBe(false)
  })

  it('праздники включены → редактор дня 0 открывается и Apply шлёт полный массив', () => {
    const monday = {
      rowId: '10',
      NomerDnya: 1,
      VremyaNachala: wire('09:00'),
      VremyaOkonchaniya: wire('18:00'),
    }
    setup([monday], true)
    const actions = screen.getAllByText('sdui.kalendari.fillSchedule')
    fireEvent.click(actions[actions.length - 1]) // предпраздничный
    // Заголовок модалки: workTimeTitle с интерполяцией label=preHolidayDay
    expect(screen.getByText(/preHolidayDay/)).toBeTruthy()
    fireEvent.click(screen.getByText('sdui.kalendari.addInterval'))
    fireEvent.change(screen.getByLabelText('sdui.kalendari.start'), {
      target: { value: '09:00' },
    })
    fireEvent.change(screen.getByLabelText('sdui.kalendari.end'), {
      target: { value: '15:00' },
    })
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as {
      sourceNodeId: string
      value: { NomerDnya: number }[]
    }
    expect(sent.sourceNodeId).toBe('dict.field.RaspisanieRaboty')
    expect(sent.value).toHaveLength(2)
    expect(sent.value[0]).toEqual(monday) // чужой день сохранён
    expect(sent.value[1].NomerDnya).toBe(0)
  })

  it('Apply из модалки дня недели: полный массив, чужие дни сохранены', () => {
    const tuesday = {
      rowId: '20',
      NomerDnya: 2,
      VremyaNachala: wire('08:00'),
      VremyaOkonchaniya: wire('17:00'),
    }
    setup([tuesday], true)
    fireEvent.click(screen.getAllByText('sdui.kalendari.fillSchedule')[0]) // Пн
    fireEvent.click(screen.getByText('sdui.kalendari.addInterval'))
    fireEvent.change(screen.getByLabelText('sdui.kalendari.start'), {
      target: { value: '09:00' },
    })
    fireEvent.change(screen.getByLabelText('sdui.kalendari.end'), {
      target: { value: '18:00' },
    })
    fireEvent.click(screen.getByText('sdui.kalendari.apply'))

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as {
      sourceNodeId: string
      value: { rowId: string; NomerDnya: number; VremyaNachala: unknown }[]
    }
    expect(sent.sourceNodeId).toBe('dict.field.RaspisanieRaboty')
    expect(sent.value).toHaveLength(2)
    expect(sent.value[0]).toEqual(tuesday)
    expect(sent.value[1].NomerDnya).toBe(1)
    expect(sent.value[1].VremyaNachala).toBe(wire('09:00'))
    expect(sent.value[1].rowId.startsWith('tmp-')).toBe(true)
    expect(screen.queryByText('sdui.kalendari.apply')).toBeNull()
  })

  it('без узла RaspisanieRaboty в дереве колонка и предпраздничный блок не рендерятся', () => {
    sessionState.SposobZapolneniya = 'PoNedelyam'
    sessionState.ShablonZapolneniya = rows(7)
    treeState.root = node()
    render(<KalendariTemplateTable node={node()} />)
    expect(screen.queryByText('sdui.kalendari.fillSchedule')).toBeNull()
    expect(screen.queryByText('sdui.kalendari.preHolidaySchedule')).toBeNull()
  })
})
