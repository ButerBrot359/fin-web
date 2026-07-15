import { useQuery } from '@tanstack/react-query'
import { useWatch, type Control } from 'react-hook-form'

import { fetchOsGruppaId } from '../../api/os-gruppa'

/**
 * Зарезервированный ключ row-scope parent-фильтра в `rowFilter` колонки
 * (NodeProps.ROW_FILTER на бэке). В отличие от прочих ключей (отбор по EAV-атрибуту
 * → `af=`), `parent` — системное поле иерархии справочника, передаётся как `?parent=`.
 */
export const PARENT_ROW_FILTER_KEY = 'parent'

const NO_SIBLING = '__no_parent_sibling__'

/**
 * Row-scope отбор пикера «по родителю» (КБП-ПОК-ВИДВНА). Значение ключа `parent` в
 * `rowFilter` — код сиблинг-колонки-источника (ОС) ТОЙ ЖЕ строки ТЧ. При открытии
 * пикера читаем запись ОС из этой ячейки, резолвим её ГруппаОС через бэк и отдаём
 * `{ parent: <id> }` для подстановки в choice-запрос (сужение до видов группы ОС).
 *
 * Эталон 1С (мягкий отбор, ЗначениеЗаполнено): ОС пуст / ГруппаОС не резолвится ⟹
 * `undefined` = «фильтра нет» = полный список. Резолв ленивый (react-query по osId),
 * работает и для новой строки, и для сохранённого дока (событие смены ОС не нужно —
 * источник значения — сама ячейка строки, а не ответ события). Смена ОС в ячейке →
 * новый osId → новый запрос → анти-стейл. Row-scope: каждая строка читает свою ячейку.
 */
export const useParentFilter = (
  rowFilter: Record<string, string> | undefined,
  rowPathPrefix: string,
  control: Control<Record<string, unknown>>
): Record<string, string> | undefined => {
  const siblingCol = rowFilter?.[PARENT_ROW_FILTER_KEY]

  // Ссылочная ячейка-источник в form state — { id, ... } | null.
  const siblingValue = useWatch({
    control,
    name: siblingCol ? `${rowPathPrefix}.${siblingCol}` : NO_SIBLING,
  })
  const osId = (siblingValue as { id?: number | string } | null | undefined)?.id

  const { data: gruppaOSId } = useQuery({
    queryKey: ['os-gruppa', osId],
    queryFn: () => fetchOsGruppaId(Number(osId)),
    enabled: siblingCol != null && osId != null,
    staleTime: 5 * 60 * 1000,
  })

  return gruppaOSId != null
    ? { [PARENT_ROW_FILTER_KEY]: String(gruppaOSId) }
    : undefined
}
