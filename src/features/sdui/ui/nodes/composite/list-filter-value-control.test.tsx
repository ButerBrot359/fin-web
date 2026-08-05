import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

// SCRUM-291 2c-a: value-control реюзит контролы из shared/ui/inputs (MUI-пикеры/
// автокомплит), которые в jsdom без полноценного контекста не рендерятся осмысленно
// — подменяем на плоские элементы (прецедент list-node.test.tsx для DateTimeInput).
vi.mock('@/shared/ui/inputs', () => ({
  TextInput: (props: {
    value?: string
    placeholder?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-text"
      value={props.value ?? ''}
      placeholder={props.placeholder}
      onChange={(e) => {
        props.onChange(e)
      }}
    />
  ),
  NumberInput: (props: {
    value?: string
    placeholder?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-number"
      value={props.value ?? ''}
      placeholder={props.placeholder}
      onChange={(e) => {
        props.onChange(e)
      }}
    />
  ),
  DateTimeInput: (props: {
    value?: string
    label?: string
    onChange: (v: string) => void
  }) => (
    <input
      data-testid={`scalar-date-${props.label ?? ''}`}
      defaultValue={props.value}
      onChange={(e) => {
        props.onChange(e.target.value)
      }}
    />
  ),
  AutocompleteInput: (props: {
    value: { id: number | string } | null
    options: { id: number | string; label: string }[]
    onChange: (v: { id: number | string; label: string } | null) => void
  }) => (
    <select
      data-testid="ref-select"
      value={props.value?.id ?? ''}
      onChange={(e) => {
        const opt =
          props.options.find((o) => String(o.id) === e.target.value) ?? null
        props.onChange(opt)
      }}
    >
      <option value="" />
      {props.options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

const { fetchReferenceOptionsMock } = vi.hoisted(() => ({
  fetchReferenceOptionsMock: vi.fn(),
}))
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: fetchReferenceOptionsMock,
}))

import { ListFilterValueControl } from './list-filter-value-control'

describe('ListFilterValueControl', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('isNull/isNotNull → контрола значения нет', () => {
    const { container } = render(
      <ListFilterValueControl
        op="isNull"
        column={{}}
        value={undefined}
        onChange={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('between (дата) → два DateTimeInput, onChange собирает пару [from,to]', () => {
    const onChange = vi.fn()
    render(
      <ListFilterValueControl
        op="between"
        column={{ dataType: 'DATE' }}
        value={[undefined, undefined]}
        onChange={onChange}
      />
    )
    const from = screen.getByTestId('scalar-date-table.periodFrom')
    const to = screen.getByTestId('scalar-date-table.periodTo')

    fireEvent.change(from, { target: { value: '2026-01-01' } })
    expect(onChange).toHaveBeenCalledWith(['2026-01-01', undefined])

    fireEvent.change(to, { target: { value: '2026-01-31' } })
    expect(onChange).toHaveBeenCalledWith([undefined, '2026-01-31'])
  })

  it('ENUMS → select, value = строковый value (не id)', () => {
    const onChange = vi.fn()
    render(
      <ListFilterValueControl
        op="eq"
        column={{
          filterValueOptions: [
            { value: 'A', label: 'Альфа', id: 1, code: 'A' },
            { value: 'B', label: 'Бета', id: 2, code: 'B' },
          ],
        }}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByTestId('filter-enum-select'), {
      target: { value: 'B' },
    })
    expect(onChange).toHaveBeenCalledWith('B')
  })

  it('ENUMS select имеет доступное имя (aria-label)', () => {
    render(
      <ListFilterValueControl
        op="eq"
        column={{
          filterValueOptions: [
            { value: 'A', label: 'Альфа', id: 1, code: 'A' },
          ],
        }}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(
      screen.getByRole('combobox', { name: 'table.filterValuePlaceholder' })
    ).toBeTruthy()
  })

  it('ссылка (filterValueSource) → голый числовой id', async () => {
    fetchReferenceOptionsMock.mockResolvedValue([
      { id: 42, code: '42', label: 'ТОО «Ромашка»' },
    ])
    const onChange = vi.fn()
    render(
      <ListFilterValueControl
        op="eq"
        column={{ filterValueSource: { url: '/x/entries' } }}
        value={null}
        onChange={onChange}
      />
    )
    await waitFor(() => {
      expect(
        screen.getByTestId('ref-select').querySelectorAll('option').length
      ).toBeGreaterThan(1)
    })
    fireEvent.change(screen.getByTestId('ref-select'), {
      target: { value: '42' },
    })
    expect(onChange).toHaveBeenCalledWith(42)
  })

  it('скаляр текст (dataType=STRING) → строка как введено', () => {
    const onChange = vi.fn()
    render(
      <ListFilterValueControl
        op="eq"
        column={{ dataType: 'STRING' }}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByTestId('scalar-text'), {
      target: { value: 'abc' },
    })
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('скаляр число (dataType=NUMBER) → распарсенное число', () => {
    const onChange = vi.fn()
    render(
      <ListFilterValueControl
        op="eq"
        column={{ dataType: 'NUMBER' }}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByTestId('scalar-number'), {
      target: { value: '15' },
    })
    expect(onChange).toHaveBeenCalledWith(15)
  })
})
