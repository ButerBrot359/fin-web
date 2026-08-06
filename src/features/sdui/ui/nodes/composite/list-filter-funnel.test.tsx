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

// Тот же приём, что list-node.test.tsx / list-filter-value-control.test.tsx:
// подменяем тяжёлые MUI-контролы на плоские элементы (предмет теста — какое value
// уходит в onApply, не рендер пикеров).
vi.mock('@/shared/ui/inputs', () => ({
  TextInput: (props: {
    value?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-text"
      value={props.value ?? ''}
      onChange={(e) => {
        props.onChange(e)
      }}
    />
  ),
  NumberInput: (props: {
    value?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-number"
      value={props.value ?? ''}
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

import { ListFilterFunnel } from './list-filter-funnel'

describe('ListFilterFunnel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const openPopover = () => {
    fireEvent.click(screen.getByRole('button', { name: 'table.filter' }))
  }

  it('filterOps пуст → иконка воронки не рендерится', () => {
    const { container } = render(
      <ListFilterFunnel
        column={{ filterField: 'Kontragent', filterOps: [] }}
        onApply={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('выбор операции + значение + Применить → onApply(field, op, value); filterField, не attributeCode', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'code',
          filterOps: ['eq', 'contains'],
          dataType: 'STRING',
        }}
        onApply={onApply}
      />
    )
    openPopover()

    fireEvent.change(screen.getByTestId('filter-op-select'), {
      target: { value: 'contains' },
    })
    fireEvent.change(screen.getByTestId('scalar-text'), {
      target: { value: 'РОМ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(onApply).toHaveBeenCalledWith('code', 'contains', 'РОМ')
  })

  it('операторские лейблы берутся из filterOpLabels (не хардкод)', () => {
    render(
      <ListFilterFunnel
        column={{ filterField: 'Kontragent', filterOps: ['eq', 'ne'] }}
        filterOpLabels={{ eq: 'Равно', ne: 'Не равно' }}
        onApply={vi.fn()}
      />
    )
    openPopover()
    const select = screen.getByTestId('filter-op-select')
    expect(select.textContent).toContain('Равно')
    expect(select.textContent).toContain('Не равно')
  })

  it('isNull → Применить вызывает onApply без value', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{ filterField: 'Kontragent', filterOps: ['isNull'] }}
        onApply={onApply}
      />
    )
    openPopover()
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(onApply).toHaveBeenCalledWith('Kontragent', 'isNull', undefined)
  })

  it('between → value = массив из двух элементов', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'Data',
          filterOps: ['between'],
          dataType: 'DATE',
        }}
        onApply={onApply}
      />
    )
    openPopover()

    fireEvent.change(screen.getByTestId('scalar-date-table.periodFrom'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByTestId('scalar-date-table.periodTo'), {
      target: { value: '2026-01-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(onApply).toHaveBeenCalledWith('Data', 'between', [
      '2026-01-01',
      '2026-01-31',
    ])
  })

  it('ссылка (filterValueSource) → onApply получает голый numeric id', async () => {
    fetchReferenceOptionsMock.mockResolvedValue([
      { id: 7, code: '7', label: 'ТОО «Ромашка»' },
    ])
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'Kontragent',
          filterOps: ['eq'],
          filterValueSource: { url: '/x/entries' },
        }}
        onApply={onApply}
      />
    )
    openPopover()

    await waitFor(() => {
      expect(
        screen.getByTestId('ref-select').querySelectorAll('option').length
      ).toBeGreaterThan(1)
    })
    fireEvent.change(screen.getByTestId('ref-select'), {
      target: { value: '7' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(onApply).toHaveBeenCalledWith('Kontragent', 'eq', 7)
  })

  it('value-требующий оператор без значения → Применить задизейблена, onApply не вызывается', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'code',
          filterOps: ['eq'],
          dataType: 'STRING',
        }}
        onApply={onApply}
      />
    )
    openPopover()

    const applyBtn = screen.getByRole('button', { name: 'table.filterApply' })
    expect(applyBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.click(applyBtn)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.change(screen.getByTestId('scalar-text'), {
      target: { value: 'РОМ' },
    })
    expect(applyBtn.hasAttribute('disabled')).toBe(false)

    fireEvent.click(applyBtn)
    expect(onApply).toHaveBeenCalledWith('code', 'eq', 'РОМ')
  })

  it('between: Применить задизейблена, пока не заполнены ОБЕ границы', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'Data',
          filterOps: ['between'],
          dataType: 'DATE',
        }}
        onApply={onApply}
      />
    )
    openPopover()
    const applyBtn = screen.getByRole('button', { name: 'table.filterApply' })
    expect(applyBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByTestId('scalar-date-table.periodFrom'), {
      target: { value: '2026-01-01' },
    })
    expect(applyBtn.hasAttribute('disabled')).toBe(true)
    fireEvent.click(applyBtn)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.change(screen.getByTestId('scalar-date-table.periodTo'), {
      target: { value: '2026-01-31' },
    })
    expect(applyBtn.hasAttribute('disabled')).toBe(false)
  })

  it('in: Применить задизейблена для пустого массива, активна после добавления элемента', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'code',
          filterOps: ['in'],
          dataType: 'STRING',
        }}
        onApply={onApply}
      />
    )
    openPopover()
    const applyBtn = screen.getByRole('button', { name: 'table.filterApply' })
    expect(applyBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByTestId('scalar-text'), {
      target: { value: 'РОМ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.add' }))
    expect(applyBtn.hasAttribute('disabled')).toBe(false)

    // Возврат к пустому массиву (не undefined) — именно этот случай различает
    // ветку isArrayOp (Array.isArray && length > 0) от общего !isEmptyValue,
    // который для [] тоже вернул бы true (пустой массив — не '', не null/undefined).
    fireEvent.click(
      screen.getByRole('button', { name: 'table.filterRemoveChip' })
    )
    expect(applyBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.click(applyBtn)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('isNull/isNotNull → Применить ВСЕГДА активна (значение не требуется)', () => {
    render(
      <ListFilterFunnel
        column={{ filterField: 'Kontragent', filterOps: ['isNotNull'] }}
        onApply={vi.fn()}
      />
    )
    openPopover()
    const applyBtn = screen.getByRole('button', { name: 'table.filterApply' })
    expect(applyBtn.hasAttribute('disabled')).toBe(false)
  })

  it('операторский select имеет доступное имя (aria-label)', () => {
    render(
      <ListFilterFunnel
        column={{ filterField: 'Kontragent', filterOps: ['eq'] }}
        onApply={vi.fn()}
      />
    )
    openPopover()
    expect(
      screen.getByRole('combobox', { name: 'table.filterOperator' })
    ).toBeTruthy()
  })

  it('ENUMS (filterValueOptions) → onApply получает строковый value', () => {
    const onApply = vi.fn()
    render(
      <ListFilterFunnel
        column={{
          filterField: 'VidOperatsii',
          filterOps: ['eq'],
          filterValueOptions: [
            { value: 'IN', label: 'Приход', id: 1, code: 'IN' },
            { value: 'OUT', label: 'Расход', id: 2, code: 'OUT' },
          ],
        }}
        onApply={onApply}
      />
    )
    openPopover()

    fireEvent.change(screen.getByTestId('filter-enum-select'), {
      target: { value: 'OUT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(onApply).toHaveBeenCalledWith('VidOperatsii', 'eq', 'OUT')
  })
})
