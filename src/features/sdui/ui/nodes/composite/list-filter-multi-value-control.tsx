import { useEffect, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import { AutocompleteInput, NumberInput, TextInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import type { ColumnFilterValueMeta } from './list-filter-value-control'

interface MultiValueControlProps {
  column: ColumnFilterValueMeta
  value: unknown[]
  onChange: (value: unknown[]) => void
}

// Мульти-ссылочный контрол in/notIn: тот же источник опций, что у
// ReferenceValueControl, но AutocompleteInput в multiple-режиме (K1, см.
// reference-field-node.tsx). В команду уходит массив голых числовых id (спека §7).
const MultiReferenceValueControl: FC<MultiValueControlProps> = ({
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

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно: перезапрос только по смене resetKey (см. use-reference-options.ts)
  }, [resetKey])

  const numericValues = value
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !Number.isNaN(v))
  const selectedOptions = options.filter((o) =>
    numericValues.includes(Number(o.id))
  )

  return (
    <AutocompleteInput
      multiple
      value={selectedOptions}
      options={options}
      loading={loading}
      onOpen={() => {
        if (options.length === 0) load()
      }}
      onInputChange={(_e, val, reason) => {
        if (reason === 'input') loadDebounced(val)
      }}
      onChange={(opts: SelectOption[]) => {
        onChange(opts.map((o) => Number(o.id)))
      }}
    />
  )
}

// Мульти-ENUMS-контрол in/notIn: чекбокс-лист вместо <select multiple> — нагляднее
// и проще тестировать по лейблу опции. В команду уходит массив строковых value.
const MultiEnumValueControl: FC<MultiValueControlProps> = ({
  column,
  value,
  onChange,
}) => {
  const { t } = useTranslation()
  const options = column.filterValueOptions ?? []
  const selected = value.filter((v): v is string => typeof v === 'string')

  return (
    <div
      role="group"
      aria-label={t('table.filterValuePlaceholder')}
      className="flex flex-col gap-1"
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 text-body2 text-ui-06"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => {
              const next = selected.includes(opt.value)
                ? selected.filter((v) => v !== opt.value)
                : [...selected, opt.value]
              onChange(next)
            }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

// Мульти-скалярный контрол in/notIn: список текущих значений (с удалением) + одно
// поле ввода (text/number по dataType) с добавлением по кнопке. В команду уходит
// массив string[]/number[] по dataType (спека §7).
const MultiScalarValueControl: FC<MultiValueControlProps> = ({
  column,
  value,
  onChange,
}) => {
  const { t } = useTranslation()
  const dataType = column.dataType
  const isNumber = dataType === 'NUMBER'
  const [draft, setDraft] = useState('')

  const addItem = () => {
    if (draft === '') return
    if (isNumber) {
      const parsed = parseFloat(draft)
      if (Number.isNaN(parsed)) return
      onChange([...value, parsed])
    } else {
      onChange([...value, draft])
    }
    setDraft('')
  }

  const removeItem = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const InputComponent = isNumber ? NumberInput : TextInput

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((item, idx) => (
            <li
              key={`${String(item)}-${String(idx)}`}
              className="flex items-center gap-1 rounded bg-ui-02 px-2 py-0.5 text-body2 text-ui-06"
            >
              <span>{String(item)}</span>
              <button
                type="button"
                aria-label={t('table.filterRemoveChip')}
                onClick={() => {
                  removeItem(idx)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <InputComponent
          value={draft}
          placeholder={t('table.filterValuePlaceholder')}
          onChange={(e) => {
            setDraft((e.target as HTMLInputElement).value)
          }}
        />
        <button
          type="button"
          onClick={addItem}
          className="h-9 shrink-0 rounded-md border border-ui-04 px-3 text-body2 text-ui-06"
        >
          {t('table.add')}
        </button>
      </div>
    </div>
  )
}

// Диспетчер мульти-контрола in/notIn: тот же приоритет источника, что у
// SingleValueControl (filterValueSource → filterValueOptions → скаляр по dataType).
export const MultiValueControl: FC<MultiValueControlProps> = (props) => {
  if (props.column.filterValueSource)
    return <MultiReferenceValueControl {...props} />
  if (props.column.filterValueOptions)
    return <MultiEnumValueControl {...props} />
  return <MultiScalarValueControl {...props} />
}
