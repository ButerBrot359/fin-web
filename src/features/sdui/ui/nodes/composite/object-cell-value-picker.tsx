import { useState, type FC } from 'react'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import {
  buildObjectValue,
  type AllowedType,
  type ObjectValue,
} from './object-field-logic'
import { readonlyCellTextStyle } from './table-cell-editor-styles'

interface ObjectCellValuePickerProps {
  member: AllowedType
  value: ObjectValue | null
  placeholder: string
  onChange: (value: unknown) => void
  onCommit: () => void
  /** Значение очистили — тип у ячейки снова не задан (см. handleValueCleared). */
  onCleared: () => void
}

/**
 * Пикер ЗНАЧЕНИЯ выбранного члена составного типа в ячейке ТЧ — вторая
 * половина `ObjectCellEditor` (см. javadoc там): сам редактор владеет выбором
 * члена, этот компонент — только автокомплитом по optionsSource члена.
 */
export const ObjectCellValuePicker: FC<ObjectCellValuePickerProps> = ({
  member,
  value,
  placeholder,
  onChange,
  onCommit,
  onCleared,
}) => {
  const optionsSource = member.optionsSource

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        optionsSource
          ? fetchReferenceOptions({
              url: optionsSource.url,
              params: optionsSource.params,
              search,
            })
          : Promise.resolve([]),
      JSON.stringify(optionsSource ?? null)
    )

  // Член без optionsSource — примитив (STRING/DECIMAL/BOOLEAN/DATETIME) или ENUMS.
  // Здесь НЕЛЬЗЯ просто нарисовать текстовый/числовой редактор: у OBJECT-атрибута
  // серверный путь записи (`ValueFieldHelper.setValueObject`) принимает только
  // `{id, type|targetTypeCode}` либо голый числовой id, а на строку/булево бросает
  // IllegalArgumentException — то есть рабочий на вид редактор отказывал бы при
  // коммите, что хуже нынешней жалобы. Поэтому член в списке показываем (он есть в
  // метаданных и в 1С), а редактор — честная заглушка; поддержка примитивных членов
  // составного типа = отдельная задача на БЭК, не косметика фронта.
  if (!optionsSource) {
    return (
      <span style={{ ...readonlyCellTextStyle, opacity: 0.6 }}>
        {placeholder}
      </span>
    )
  }

  // Значение показываем только если оно принадлежит выбранному члену.
  // Проверка на null — ОТДЕЛЬНО от сравнения кодов, а не `value?.targetTypeCode
  // === member.targetTypeCode`: у примитивного члена оба кода undefined, такое
  // сравнение дало бы true и обращение к `value.id` при value === null.
  const valueTypeCode = value?.targetTypeCode
  const selectedOption: SelectOption | null =
    value != null && valueTypeCode === member.targetTypeCode
      ? { id: value.id, code: String(value.id), label: value.presentation }
      : null

  return (
    <AutocompleteInput
      value={selectedOption}
      inputValue={inputValue}
      options={options}
      size="small"
      fullWidth
      // Та же ячейка ТЧ, что и у ссылочной колонки: значение переносится по
      // ширине, а не прокручивается в однострочном input.
      multilineInput
      loading={loading}
      onInputChange={(_e, val, reason) => {
        setInputValue(val)
        if (reason === 'input') loadDebounced(val)
      }}
      onOpen={() => {
        if (options.length === 0) load()
      }}
      onChange={(opt) => {
        // Исходящее значение собирает buildObjectValue: {id, presentation, type,
        // targetTypeCode} — targetTypeCode round-trip'ится и различает
        // same-domain членов (см. object-field-logic.ts).
        onChange(opt ? buildObjectValue(member, opt) : null)
        resetOptions()
        onCommit()
        if (!opt) onCleared()
      }}
    />
  )
}
