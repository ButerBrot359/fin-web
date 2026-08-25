import type { ReactElement } from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { AccountingPostingsBlock } from './accounting-postings-block'

// usePagedTableRows (SCRUM-368) внутри журнала требует QueryClient
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

// Transitive dep: resolve-select-value → @/app/config/i18n (uses initReactI18next)
vi.mock('@/app/config/i18n', () => ({ default: { language: 'ru' } }))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

// SCRUM-362 B-3: раскладка блока — из ролей-координат props.role на колонках
// (карта wave-1 спеки), биндинги остались ключами значений строк.
const table = {
  id: 'tbl',
  type: 'TABLE',
  binding: 'movements.acc.Zhurnal',
  props: { regKind: 'ACCOUNTING', editable: false },
  children: [
    {
      id: 'c.period',
      type: 'TABLE_COLUMN',
      binding: '_period',
      props: { label: 'Дата', role: 'period' },
    },
    {
      id: 'g.dt',
      type: 'COLUMN_GROUP',
      props: { label: 'ДЕБЕТ' },
      children: [
        {
          id: 'c.accDt',
          type: 'TABLE_COLUMN',
          binding: '_accountDtCode',
          props: { label: 'Счёт', role: 'accountDt' },
        },
        {
          id: 'c.subDt1',
          type: 'TABLE_COLUMN',
          binding: '_subkontoDt1',
          props: { label: 'КПС', role: 'blockDt:1:0' },
        },
        {
          id: 'c.fkrDt',
          type: 'TABLE_COLUMN',
          binding: '_fkrDt',
          props: { label: 'ФКР', role: 'blockDt:1:1' },
        },
        {
          id: 'c.subDt2',
          type: 'TABLE_COLUMN',
          binding: '_subkontoDt2',
          props: { label: 'Субконто2', role: 'blockDt:2:0' },
        },
        {
          id: 'c.subDt3',
          type: 'TABLE_COLUMN',
          binding: '_subkontoDt3',
          props: { label: 'Субконто3', role: 'blockDt:3:0' },
        },
      ],
    },
    {
      id: 'g.kt',
      type: 'COLUMN_GROUP',
      props: { label: 'КРЕДИТ' },
      children: [
        {
          id: 'c.accKt',
          type: 'TABLE_COLUMN',
          binding: '_accountKtCode',
          props: { label: 'Счёт', role: 'accountKt' },
        },
        {
          id: 'c.subKt1',
          type: 'TABLE_COLUMN',
          binding: '_subkontoKt1',
          props: { label: 'КОСГУ', role: 'blockKt:1:0' },
        },
      ],
    },
    {
      id: 'c.kol',
      type: 'TABLE_COLUMN',
      binding: '_kolichestvo',
      props: { label: 'Количество', role: 'block:2:2' },
    },
    {
      id: 'c.summa',
      type: 'TABLE_COLUMN',
      binding: '_summa',
      props: { label: 'Сумма', role: 'sum' },
    },
    {
      id: 'c.sod',
      type: 'TABLE_COLUMN',
      binding: '_soderzhanie',
      props: { label: 'Содержание', role: 'content' },
    },
    {
      id: 'c.active',
      type: 'TABLE_COLUMN',
      binding: '_isActiveLabel',
      props: { label: 'Активность', role: 'active' },
    },
  ],
} as ViewNode

describe('AccountingPostingsBlock', () => {
  it('рендерит 1С-блок: группы, N, сумму с разрядами, секунды, 3 строки на проводку', () => {
    state['movements.acc.Zhurnal'] = [
      {
        rowId: '1',
        _period: '07.07.2026 10:15:30',
        _accountDtCode: '1080',
        _accountKtCode: '3010',
        _summa: '12345.00',
        _soderzhanie: 'Оплата',
        _subkontoDt1: { id: 1, presentation: 'КПС-111' },
        _isActiveLabel: 'Да',
      },
    ]

    const { container } = render(<AccountingPostingsBlock node={table} />)

    expect(screen.getByText('ДЕБЕТ')).toBeTruthy()
    expect(screen.getByText('КРЕДИТ')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy() // N = idx + 1
    expect(screen.getByText('07.07.2026 10:15:30')).toBeTruthy() // период с секундами как есть
    expect(screen.getByText('12 345,00')).toBeTruthy() // формат суммы
    expect(screen.getByText('КПС-111')).toBeTruthy() // презентация субконто
    expect(screen.queryByText('Да')).toBeNull() // Активность не рисуем (§1.5)
    // проводка — <tbody> из 3 строк
    const tbody = container.querySelector('tbody')
    expect(tbody?.querySelectorAll('tr')).toHaveLength(3)
  })
})
