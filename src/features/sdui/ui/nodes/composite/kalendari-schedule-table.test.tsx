import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const sessionState: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))
// EditableTable-стаб: маркер раскрытой таблицы, без глубоких зависимостей
vi.mock('./editable-table', () => ({
  EditableTable: () => <div data-testid="editable-table" />,
}))

import { KalendariScheduleTable } from './kalendari-schedule-table'

const node = (): ViewNode => ({
  id: 'dict.field.RaspisanieRaboty',
  type: 'TABLE',
  binding: 'RaspisanieRaboty',
  props: { editable: true, allowAdd: true, allowDelete: true },
  children: [
    {
      id: 'c1',
      type: 'TABLE_COLUMN',
      binding: 'NomerDnya',
      props: { dataType: 'INTEGER', cellWidget: 'NUMBER_FIELD' },
    },
    {
      id: 'c2',
      type: 'TABLE_COLUMN',
      binding: 'VremyaNachala',
      props: { dataType: 'DATETIME', cellWidget: 'DATETIME_FIELD' },
    },
    {
      id: 'c3',
      type: 'TABLE_COLUMN',
      binding: 'VremyaOkonchaniya',
      props: { dataType: 'DATETIME', cellWidget: 'DATETIME_FIELD' },
    },
  ],
})

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
})

describe('KalendariScheduleTable', () => {
  it('свёрнуто по умолчанию: таблицы нет, есть кнопка «Заполнить расписание»', () => {
    sessionState.RaspisanieRaboty = []
    render(<KalendariScheduleTable node={node()} />)
    expect(screen.queryByTestId('editable-table')).toBeNull()
    expect(screen.getByText('sdui.kalendari.fillSchedule')).toBeTruthy()
  })

  it('клик по кнопке раскрывает таблицу', () => {
    sessionState.RaspisanieRaboty = []
    render(<KalendariScheduleTable node={node()} />)
    fireEvent.click(screen.getByText('sdui.kalendari.fillSchedule'))
    expect(screen.getByTestId('editable-table')).toBeTruthy()
  })

  it('есть заполненное время → показывает саммари; клик по нему раскрывает', () => {
    sessionState.RaspisanieRaboty = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T18:00:00',
      },
    ]
    render(<KalendariScheduleTable node={node()} />)
    const summary = screen.getByRole('button', {
      name: /sdui\.kalendari\.schedule/,
    })
    expect(summary).toBeTruthy()
    fireEvent.click(summary)
    expect(screen.getByTestId('editable-table')).toBeTruthy()
  })
})
