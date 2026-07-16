import type { FieldFilter } from '@/entities/form-config'
import type { FilterCondition, FilterRequest } from '@/shared/lib/eav'

/**
 * Отбор `attributeIn` (набор допустимых значений, эталон КБП «Отбор.Ссылка»)
 * применяется НЕ через `af=` (как `attributeEquals`), а через Filter-DSL POST
 * `/api/dictionaries/entries/{typeCode}/search`. Здесь — чистая трансляция
 * дескриптора в тело запроса и проверки пустоты/наличия.
 */

/** Есть ли у поля отбор `attributeIn` с непустым набором ключей. */
export const hasAttributeIn = (filter: FieldFilter | undefined): boolean =>
  filter?.attributeIn != null && Object.keys(filter.attributeIn).length > 0

/**
 * Fail-closed: набор задан, но ВСЕ массивы значений пусты ⇒ пикер обязан
 * показать 0 вариантов (не искать неограниченно, можно вообще не слать запрос).
 */
export const attributeInIsEmpty = (
  filter: FieldFilter | undefined
): boolean => {
  const ai = filter?.attributeIn
  if (!ai) return false
  const arrays = Object.values(ai)
  return arrays.length > 0 && arrays.every((arr) => (arr?.length ?? 0) === 0)
}

/**
 * `attributeIn: { id: [1,2,3] }` → тело Filter-DSL:
 * `{ filters: [ {id in [1,2,3]}, {parentId isNotNull} ], logic: 'AND' }`.
 *
 * ⚠️ Условие `parentId isNotNull` ОБЯЗАТЕЛЬНО: без него (и без query `?parent`)
 * бэкенд подмешивает `parentId IS NULL` — вернутся только корни, отбор
 * сломается. Наличие условия по `parentId` включает escape-hatch на бэке →
 * тело берётся как есть. Query `?parent` при этом НЕ передаём (перезаписал бы
 * отбор одним родителем).
 *
 * Возвращает `undefined`, если `attributeIn` нет.
 */
export const attributeInToFilterRequest = (
  filter: FieldFilter | undefined
): FilterRequest | undefined => {
  const ai = filter?.attributeIn
  if (!ai || Object.keys(ai).length === 0) return undefined
  const filters: FilterCondition[] = Object.entries(ai).map(
    ([field, values]) => ({ field, op: 'in', value: values ?? [] })
  )
  filters.push({ field: 'parentId', op: 'isNotNull', value: null })
  return { filters, logic: 'AND' }
}
