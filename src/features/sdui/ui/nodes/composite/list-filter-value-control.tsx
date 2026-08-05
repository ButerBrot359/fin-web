import { useEffect, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AutocompleteInput,
  DateTimeInput,
  NumberInput,
  TextInput,
} from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'

export interface FilterEnumOption {
  value: string
  label: string
  id?: number
  code?: string
}

export interface FilterValueSource {
  url: string
  params?: Record<string, unknown>
}

// SCRUM-291 2c-a: метаданные колонки, нужные value-control для выбора контрола
// (ссылка/ENUMS/скаляр по dataType) — подмножество TABLE_COLUMN.props (design §2c/§7).
export interface ColumnFilterValueMeta {
  dataType?: string
  filterValueSource?: FilterValueSource
  filterValueOptions?: FilterEnumOption[]
}

interface SingleValueControlProps {
  column: ColumnFilterValueMeta
  value: unknown
  placeholder: string
  onChange: (value: unknown) => void
}

// Ссылочный контрол воронки: переиспользует тот же механизм, что REFERENCE_FIELD
// (fetchReferenceOptions/useReferenceOptions) — см. reference-field-node.tsx. Значение
// команды — голый числовой id, {id,code,label} на сервер не уходит (спека §7).
const ReferenceValueControl: FC<SingleValueControlProps> = ({
  column,
  value,
  onChange,
}) => {
  const source = column.filterValueSource
  const resetKey = JSON.stringify(source?.params ?? null)
  const { options, loading, load, loadDebounced } = useReferenceOptions(
    (search?: string) =>
      source
        ? fetchReferenceOptions({
            url: source.url,
            params: source.params,
            search,
          })
        : Promise.resolve([]),
    resetKey
  )

  // Воронка монтируется уже по явному действию пользователя (выбор ссылочной
  // операции в popover) — грузим опции сразу, без ожидания onOpen автокомплита.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно: перезапрос только по смене resetKey (см. use-reference-options.ts)
  }, [resetKey])

  const numericValue =
    typeof value === 'number' ? value : value != null ? Number(value) : null
  const selectedOption =
    options.find((o) => Number(o.id) === numericValue) ?? null

  return (
    <AutocompleteInput
      value={selectedOption}
      options={options}
      loading={loading}
      onOpen={() => {
        if (options.length === 0) load()
      }}
      onInputChange={(_e, val, reason) => {
        if (reason === 'input') loadDebounced(val)
      }}
      onChange={(opt: SelectOption | null) => {
        onChange(opt ? Number(opt.id) : null)
      }}
    />
  )
}

// ENUMS-контрол: инлайновые filterValueOptions с бэка (та же форма, что
// ENUM_FIELD.props.options). В команду уходит строковый `value`, не `id` (спека §7).
const EnumValueControl: FC<SingleValueControlProps> = ({
  column,
  value,
  onChange,
}) => {
  const { t } = useTranslation()
  const options = column.filterValueOptions ?? []
  return (
    <select
      data-testid="filter-enum-select"
      aria-label={t('table.filterValuePlaceholder')}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        onChange(e.target.value)
      }}
      className="h-9 rounded-md border border-ui-04 px-2 text-body2 text-ui-06"
    >
      <option value="" />
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Скалярный контрол по dataType — используется, когда у колонки нет ни
// filterValueSource, ни filterValueOptions.
const ScalarValueControl: FC<SingleValueControlProps> = ({
  column,
  value,
  placeholder,
  onChange,
}) => {
  const dataType = column.dataType

  if (dataType === 'DATE' || dataType === 'DATETIME') {
    return (
      <DateTimeInput
        value={typeof value === 'string' ? value : ''}
        dateOnly
        label={placeholder}
        onChange={(v) => {
          onChange(v || undefined)
        }}
      />
    )
  }

  if (dataType === 'NUMBER') {
    return (
      <NumberInput
        value={
          typeof value === 'number' || typeof value === 'string'
            ? String(value)
            : ''
        }
        placeholder={placeholder}
        onChange={(e) => {
          const raw = (e.target as HTMLInputElement).value
          onChange(raw === '' ? undefined : parseFloat(raw))
        }}
      />
    )
  }

  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      placeholder={placeholder}
      onChange={(e) => {
        onChange((e.target as HTMLInputElement).value)
      }}
    />
  )
}

const SingleValueControl: FC<SingleValueControlProps> = (props) => {
  if (props.column.filterValueSource)
    return <ReferenceValueControl {...props} />
  if (props.column.filterValueOptions) return <EnumValueControl {...props} />
  return <ScalarValueControl {...props} />
}

export interface ListFilterValueControlProps {
  op: string
  column: ColumnFilterValueMeta
  value: unknown
  onChange: (value: unknown) => void
}

// SCRUM-291 2c-a: контрол значения воронки колонки — переключается по op/источнику/
// dataType (design §2c). isNull/isNotNull — без контрола; between — пара контролов
// (значение — массив из двух элементов, границы дат сервер нормализует сам).
export const ListFilterValueControl: FC<ListFilterValueControlProps> = ({
  op,
  column,
  value,
  onChange,
}) => {
  const { t } = useTranslation()

  if (op === 'isNull' || op === 'isNotNull') return null

  if (op === 'between') {
    const pair = Array.isArray(value)
      ? (value as [unknown, unknown])
      : [undefined, undefined]
    return (
      <div className="flex items-center gap-2">
        <SingleValueControl
          column={column}
          value={pair[0]}
          placeholder={t('table.periodFrom')}
          onChange={(v) => {
            onChange([v, pair[1]])
          }}
        />
        <SingleValueControl
          column={column}
          value={pair[1]}
          placeholder={t('table.periodTo')}
          onChange={(v) => {
            onChange([pair[0], v])
          }}
        />
      </div>
    )
  }

  return (
    <SingleValueControl
      column={column}
      value={value}
      placeholder={t('table.filterValuePlaceholder')}
      onChange={onChange}
    />
  )
}
