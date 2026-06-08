import { Typography } from '@mui/material'

import {
  useDictionaryEntry,
  resolveDictionaryEntryLabel,
} from '@/shared/lib/dictionary-entry'

interface DimensionCellProps {
  /** ID элемента справочника из строки (`row[col.code]`). */
  id: number | null | undefined
  /** `true` — резолвить ID → имя через справочник; иначе показывать ID как есть. */
  resolve: boolean
}

/**
 * Ячейка системной колонки-измерения регистра бухгалтерии.
 *
 * Значение лежит прямо в строке под ключом = `code` колонки (а не в
 * `values[]`). Для ссылочных колонок (`referencedDomainKind: "DICTIONARY"`)
 * резолвит ID в отображаемое имя через `/api/dictionaries/entries/id/{id}`.
 */
export const DimensionCell = ({ id, resolve }: DimensionCellProps) => {
  const { entry } = useDictionaryEntry(resolve ? id : null)

  let text = ''
  if (id != null) {
    text = resolve ? resolveDictionaryEntryLabel(entry, id) : String(id)
  }

  return (
    <Typography variant="body2" noWrap className="text-ui-06">
      {text}
    </Typography>
  )
}
