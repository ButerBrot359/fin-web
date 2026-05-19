import type { ColumnMetaDto, FilterOp } from '@/entities/document-entry'

/**
 * Возвращает список операторов фильтра, разрешённых для колонки.
 *
 * Источник истины — бэк (`ColumnMetaDto.allowedOps`). Семантика:
 *   - непустой массив → разрешённые операторы
 *   - пустой массив или `null` → фильтрация запрещена, иконка скрыта
 *
 * Дополнительно: для NOT NULL колонок (`nullable === false`)
 * убираем `isNull`/`isNotNull` — они бессмысленны.
 * `nullable === undefined` трактуется как `true` (защитно — для
 * старого кэша/прокси до деплоя Phase 2.1).
 */
export const resolveAllowedOps = (
  column: ColumnMetaDto
): readonly FilterOp[] => {
  const ops = column.allowedOps ?? []
  if (column.nullable === false) {
    return ops.filter((op) => op !== 'isNull' && op !== 'isNotNull')
  }
  return ops
}
