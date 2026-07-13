import { useWatch, type Control } from 'react-hook-form'

// Отбор пикера ссылочной колонки ТЧ по сестринским ячейкам ТОЙ ЖЕ строки
// (SCRUM-281, хинт rowFilter из метаданных типа-строки ТЧ). В отличие от
// useCellDependency (источник — шапка документа), источник здесь — ячейка
// текущей строки: rowPathPrefix = '<КодТЧ>.<idx>'. Метаданные не грузим —
// map уже пришёл в атрибуте колонки.
//
// Возвращает { af: 'Attr:id[,Attr2:id2]' } (формат mergeSearchParams/бэка)
// либо undefined — «фильтра нет»: пустая ячейка = полный список, мягкий
// отбор как в 1С (ПараметрыВыбора).
export const useRowFilter = (
  rowFilter: Record<string, string> | undefined,
  rowPathPrefix: string,
  control: Control<Record<string, unknown>>
): Record<string, string> | undefined => {
  const entries = Object.entries(rowFilter ?? {})

  // Ссылочная ячейка в form state — { id, ... } | null.
  const values = useWatch({
    control,
    name: entries.map(([, binding]) => `${rowPathPrefix}.${binding}`),
  })

  const parts: string[] = []
  entries.forEach(([attrCode], i) => {
    const id = (values[i] as { id?: number | string } | null | undefined)?.id
    if (id != null) parts.push(`${attrCode}:${String(id)}`)
  })

  return parts.length > 0 ? { af: parts.join(',') } : undefined
}
