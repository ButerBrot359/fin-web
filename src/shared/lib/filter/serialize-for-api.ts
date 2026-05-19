import type { FilterCondition, FilterRequest } from '@/entities/document-entry'

/**
 * Преобразует FilterRequest перед отправкой в `POST /search`.
 *
 * Reference-контролы (`DictionaryControl`, `EnumsControl`) хранят в
 * `FilterCondition.value` объект `{ id, code, label }`, чтобы чип над
 * таблицей мог показать человекочитаемое имя и переживать F5 (URL-кодек
 * сериализует весь объект). Но бэк ждёт чистый id (Long), иначе падает
 * с `Value type mismatch ... expected DICTIONARY, got LinkedHashMap`.
 *
 * Здесь обходим filters[].value и подменяем reference-объект на его id.
 * Поддерживаем как одиночное значение, так и `in`/`notIn` (массив).
 * Скалярные значения (строки/числа/даты/булевы) проходят без изменений.
 */
const isReferenceLike = (v: unknown): v is { id: unknown } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v

const unpackValue = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(unpackValue)
  if (isReferenceLike(v)) return v.id
  return v
}

export const serializeFilterForApi = (filter: FilterRequest): FilterRequest => ({
  ...filter,
  filters: filter.filters.map(
    (c): FilterCondition => ({ ...c, value: unpackValue(c.value) })
  ),
})
