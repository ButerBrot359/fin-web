import type { RowAppearanceRule } from '../../types/view'

/**
 * Условная заливка строки таблицы — перенос `УсловноеОформление` формы из 1С
 * (эталон Тарификации подсвечивает светло-зелёным работников с
 * `РаботникРассчитан = Истина`).
 *
 * <p>Контракт — ПРАВИЛО на узле таблицы (`props.rowAppearance`), а не цвет в
 * каждой строке. Так бэку хватает одной строки в раскладке (признак и так уже
 * лежит в данных свёртки), а фронт пересчитывает заливку из значения колонки —
 * строка зеленеет сразу после патча этой колонки, даже если сервер не переслал
 * никакого построчного «оформления».
 *
 * <p>Служебными ключами строки (`__rowReadonly` и компания, см.
 * `service-row-keys.ts`) это НЕ сделано намеренно: тот класс ключей описывает
 * ПОВЕДЕНИЕ строки, которое считает только сервер (правила доступности из
 * модулей 1С), а здесь всё условие — «значение колонки равно X», и его фронт
 * проверяет сам.
 *
 * ```json
 * "rowAppearance": [
 *   {
 *     "binding": "RabotnikRasschitan",
 *     "equals": true,
 *     "backgroundColor": "rgb(200, 255, 210)"
 *   }
 * ]
 * ```
 */

/** Ключ пропа узла таблицы. */
const ROW_APPEARANCE_PROP = 'rowAppearance'

/**
 * Значение пропа → массив сырых правил или `null`, если пропа нет/он не тот.
 *
 * <p>Строка разбирается как JSON НЕ на всякий случай: сид раскладки кладёт
 * значение в `layout_node_props.prop_value` текстом, а `NodeBuilder.coerceProp`
 * приводит к Java-типу только INTEGER и BOOLEAN — `prop_type='JSON'` уезжает на
 * фронт СТРОКОЙ. Правило, собранное композером в объект, тоже поддерживается:
 * оба канала доставки должны давать одинаковый результат.
 */
function toRuleArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    // Не JSON — на бэке опечатка в сиде; таблица из-за неё падать не должна.
    return null
  }
}

/**
 * Правила из props узла: массив, отфильтрованный до пригодных элементов.
 *
 * <p>Мусор молча отбрасывается, а не роняет таблицу: props приезжают с сервера
 * (значения раскладки — строки из БД), и опечатка в одном правиле не должна
 * стоить пользователю всей табличной части. Непригодное правило — это правило
 * без `binding` или без `backgroundColor`: заливать нечем или не по чему.
 */
export function parseRowAppearance(
  props: Record<string, unknown> | undefined
): RowAppearanceRule[] {
  const raw = toRuleArray(props?.[ROW_APPEARANCE_PROP])
  if (raw === null) return []

  const result: RowAppearanceRule[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const rule = item as Record<string, unknown>
    const binding = rule.binding
    const backgroundColor = rule.backgroundColor
    if (typeof binding !== 'string' || binding === '') continue
    if (typeof backgroundColor !== 'string' || backgroundColor === '') continue
    result.push({
      binding,
      // `equals` отсутствует ⇒ правило про булев признак «включено»: это
      // подавляющее большинство отборов условного оформления в 1С
      // («РаботникРассчитан = Истина»), и бэку не нужно писать его дважды.
      equals: Object.hasOwn(rule, 'equals') ? rule.equals : true,
      backgroundColor,
    })
  }
  return result
}

/**
 * Значение ячейки в сравнимом виде.
 *
 * <p>Ссылочное/enum-значение приезжает объектом `{id, presentation}` — сравнение
 * идёт по `id`, потому что в отборе оформления бэк указывает именно id элемента,
 * а не его представление (представление зависит от языка).
 *
 * <p>Булев признак может приехать и строкой `"true"` (значения раскладки и части
 * патчей — строковые). Форма записи не должна менять результат отбора, поэтому
 * обе приводятся к boolean — так же, как это делает readonly-рендер ячейки.
 */
function normalize(value: unknown): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value !== null && typeof value === 'object' && 'id' in value) {
    return (value as { id: unknown }).id
  }
  return value
}

/**
 * Сработало ли правило на строке.
 *
 * <p>`equals: null` — это отбор «значения нет»: пустая ячейка приезжает и как
 * `null`, и как `undefined` (ключа в строке нет вовсе), и как `""`.
 */
function matches(
  rule: RowAppearanceRule,
  row: Record<string, unknown>
): boolean {
  const value = normalize(row[rule.binding])
  if (rule.equals === null) {
    return value === null || value === undefined || value === ''
  }
  return value === normalize(rule.equals)
}

/**
 * Цвет фона строки или `undefined`, если ни одно правило не сработало.
 *
 * <p>Побеждает ПЕРВОЕ сработавшее правило — порядок задаёт бэк, как и порядок
 * элементов условного оформления в 1С.
 */
export function resolveRowBackground(
  rules: RowAppearanceRule[],
  row: Record<string, unknown>
): string | undefined {
  for (const rule of rules) {
    if (matches(rule, row)) return rule.backgroundColor
  }
  return undefined
}
