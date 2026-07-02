/**
 * Путь поля формы — конвенция, общая для `fieldFilters` и `formConfig.visibility`:
 * поле шапки = код реквизита, колонка ТЧ = `<КодТЧ><КодКолонки>` (без разделителя,
 * напр. `PlanFinansirovaniya` + `KodPlatnykhUslug` → `PlanFinansirovaniyaKodPlatnykhUslug`).
 */
export const headerFieldPath = (fieldCode: string): string => fieldCode

export const tableColumnPath = (
  tableCode: string,
  columnCode: string
): string => `${tableCode}${columnCode}`

/**
 * Динамическая видимость элемента по `formConfig.visibility`.
 * Отсутствие ключа → элемент видим (fallback на статический `showInForm`),
 * `false` → скрыт, `true` → видим. Пустая карта — поведение как раньше.
 */
export const isFieldVisible = (
  visibilityMap: Record<string, boolean>,
  path: string
): boolean => !(path in visibilityMap) || visibilityMap[path]
