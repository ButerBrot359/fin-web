import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ObjectFieldNode } from './object-field-node'

const state: Record<string, unknown> = {}
const events: { trigger: string; value: unknown }[] = []

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => (action: { trigger: string; value: unknown }) => {
    events.push({ trigger: action.trigger, value: action.value })
    return Promise.resolve(true)
  },
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))
// i18n в тестах не инициализирован — подписи проверяем по ключам.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
// Опции справочника здесь не предмет проверки — сеть не трогаем.
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: () => Promise.resolve([]),
}))

const KONTRAGENTY = {
  position: 1,
  domainKind: 'DICTIONARY',
  targetTypeCode: 'Kontragenty',
  presentation: 'Контрагенты',
  optionsSource: { url: '/api/dictionary/Kontragenty/entries' },
}
const FIZ_LITSA = {
  position: 2,
  domainKind: 'DICTIONARY',
  targetTypeCode: 'FizicheskieLitsa',
  presentation: 'Физические лица',
  optionsSource: { url: '/api/dictionary/FizicheskieLitsa/entries' },
}
const DVIZHENIYA = {
  position: 1,
  domainKind: 'DICTIONARY',
  targetTypeCode: 'DvizheniyaFinansirovaniya',
  presentation: 'Движения финансирования',
  optionsSource: { url: '/api/dictionary/DvizheniyaFinansirovaniya/entries' },
}

const node = (allowedTypes: unknown[]): ViewNode =>
  ({
    id: 'field.subkonto1',
    type: 'OBJECT_FIELD',
    binding: 'Subkonto1',
    // visible/enabled явные — по контракту SCRUM-362 B-4 бэк всегда их проставляет
    props: {
      label: 'Сотрудники и контрагенты',
      allowedTypes,
      visible: true,
      enabled: true,
    },
    // бэк пересчитывает форму по смене субконто — правка уходит событием
    actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
  }) as ViewNode

// MUI Select — это combobox с подписью; getByLabelText ловит ещё и скрытый input.
const typeSelect = () =>
  screen.getByRole('combobox', { name: 'sdui.objectField.type' })

beforeEach(() => {
  delete state.Subkonto1
  events.length = 0
})
afterEach(cleanup)

describe('ObjectFieldNode выбор типа', () => {
  it('несколько членов → селектор с подписями членов', () => {
    render(<ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />)
    fireEvent.mouseDown(typeSelect())
    const list = within(screen.getByRole('listbox'))
    expect(list.getByText('Контрагенты')).toBeTruthy()
    expect(list.getByText('Физические лица')).toBeTruthy()
  })

  it('один член → селектор не показываем', () => {
    render(<ObjectFieldNode node={node([KONTRAGENTY])} />)
    expect(
      screen.queryByRole('combobox', { name: 'sdui.objectField.type' })
    ).toBeNull()
    // поле значения при этом на месте
    expect(screen.getByLabelText(/Сотрудники и контрагенты/)).toBeTruthy()
  })

  it('смена типа чистит значение', () => {
    state.Subkonto1 = {
      id: 42,
      presentation: 'ТОО «Ромашка»',
      targetTypeCode: 'Kontragenty',
    }
    render(<ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />)
    fireEvent.mouseDown(typeSelect())
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Физические лица')
    )

    expect(state.Subkonto1).toBeNull()
    expect(events.at(-1)?.value).toBeNull()
  })
})

describe('ObjectFieldNode смена счёта (патч allowedTypes)', () => {
  it('ручной выбор члена сбрасывается на новый набор', () => {
    const { rerender } = render(
      <ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />
    )
    fireEvent.mouseDown(typeSelect())
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Физические лица')
    )
    expect(typeSelect().textContent).toContain('Физические лица')

    // сервер прислал другой вид субконто — прежнего члена в нём нет
    rerender(<ObjectFieldNode node={node([DVIZHENIYA, KONTRAGENTY])} />)
    expect(typeSelect().textContent).toContain('Движения финансирования')
  })

  it('выбор сбрасывается, даже если прежний член есть и в новом наборе', () => {
    const { rerender } = render(
      <ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />
    )
    fireEvent.mouseDown(typeSelect())
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Физические лица')
    )

    // Набор другой, хотя «Физические лица» в нём остались: вид субконто задаёт
    // сервер, и его решение важнее прежнего ручного выбора.
    rerender(<ObjectFieldNode node={node([DVIZHENIYA, FIZ_LITSA])} />)
    expect(typeSelect().textContent).toContain('Движения финансирования')
  })

  it('тот же набор в новом массиве выбор не сбрасывает', () => {
    const { rerender } = render(
      <ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />
    )
    fireEvent.mouseDown(typeSelect())
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Физические лица')
    )
    // патч по соседнему пропу пересобирает массив, состав тот же
    rerender(
      <ObjectFieldNode node={node([{ ...KONTRAGENTY }, { ...FIZ_LITSA }])} />
    )
    expect(typeSelect().textContent).toContain('Физические лица')
  })

  it('значение прежнего вида гасится в стейте формы', () => {
    state.Subkonto1 = {
      id: 3346,
      presentation: 'Движение',
      targetTypeCode: 'DvizheniyaFinansirovaniya',
    }
    const { rerender } = render(<ObjectFieldNode node={node([DVIZHENIYA])} />)
    expect(state.Subkonto1).not.toBeNull()

    rerender(<ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />)

    expect(state.Subkonto1).toBeNull()
    // серверу об этом не сообщаем: он сам только что перестроил поле
    expect(events).toHaveLength(0)
  })

  it('значение допустимого вида переживает патч', () => {
    state.Subkonto1 = {
      id: 42,
      presentation: 'ТОО «Ромашка»',
      targetTypeCode: 'Kontragenty',
    }
    const { rerender } = render(
      <ObjectFieldNode node={node([KONTRAGENTY, FIZ_LITSA])} />
    )
    rerender(<ObjectFieldNode node={node([KONTRAGENTY, DVIZHENIYA])} />)
    expect(state.Subkonto1).not.toBeNull()
  })
})
