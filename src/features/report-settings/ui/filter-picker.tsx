import { useMemo } from 'react'

import { AutocompleteInput } from '@/shared/ui/inputs'
import { useDictionaryEntries } from '@/shared/lib/dictionary-entry/use-dictionary-entries'
import type { SelectOption } from '@/shared/types/select-option'

interface FilterPickerProps {
  label: string
  /** Код справочника-источника значений (DICTIONARY typeCode). */
  dictTypeCode: string
  /** Выбранное значение (ID записи справочника) или null. */
  valueId: number | null
  onChange: (valueId: number | null) => void
}

/**
 * Один отбор: выпадашка значений справочника по его коду типа. Грузит активные
 * записи через общий `useDictionaryEntries`, работает по ID (значение
 * восстанавливается из загруженных записей). Используется во вкладке «Отборы».
 */
export const FilterPicker = ({
  label,
  dictTypeCode,
  valueId,
  onChange,
}: FilterPickerProps) => {
  const { entries } = useDictionaryEntries(dictTypeCode)
  const options = useMemo<SelectOption[]>(
    () =>
      entries.map((e) => ({
        id: e.id,
        code: e.code ?? '',
        label: e.displayName ?? e.nameRu ?? e.code ?? String(e.id),
      })),
    [entries]
  )
  const value = options.find((o) => Number(o.id) === valueId) ?? null

  return (
    <AutocompleteInput
      value={value}
      options={options}
      onChange={(o) => {
        onChange(o ? Number(o.id) : null)
      }}
      label={label}
      size="small"
      fullWidth
    />
  )
}
