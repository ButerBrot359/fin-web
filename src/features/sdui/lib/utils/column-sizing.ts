// Примитивы ширин колонок SDUI-таблиц: приведение серверного `width`/`minWidth`
// и вычисление ключа колонки в карте персиста. Держатся отдельно от хука, чтобы
// их можно было использовать в билдерах column defs (они не хуки) и покрыть
// юнит-тестами без рендера.

/**
 * Нижняя граница ширины колонки при перетаскивании, когда бэк не прислал
 * `minWidth` (а это норма: сервер отдаёт минимум только если аналитик задал его
 * в layout и сознательно не выдумывает значение сам).
 */
export const SDUI_MIN_COLUMN_WIDTH = 40

/**
 * Ширина колонки, когда бэк не прислал `width`. Совпадает с дефолтом TanStack
 * Table (`defaultColumn.size`), чтобы ручной рендер (ReadOnlyTable) и рендер
 * через TanStack давали одинаковую стартовую сетку.
 */
export const SDUI_DEFAULT_COLUMN_WIDTH = 150

/**
 * Безопасное приведение серверной ширины к px. `width` в контракте объявлен
 * числом, но реально может приехать Long-строкой (Jackson сериализует Long
 * строкой при потере точности), поэтому приводим через Number(), а всё
 * бессмысленное (NaN, 0, отрицательное) отбрасываем — undefined означает
 * «ширины нет, решает рендерер».
 */
export function toColumnWidth(value: unknown): number | undefined {
  const width = Number(value)
  if (!Number.isFinite(width) || width <= 0) return undefined
  return width
}

/** Поля ширин TanStack `ColumnDef`, общие для любого типа строки таблицы. */
export interface ColumnSizeProps {
  size?: number
  minSize?: number
  enableResizing?: boolean
}

/**
 * Ширины колонки из props узла (`width`/`minWidth`/`resizable`) в формате
 * TanStack — одно место для всех рендереров SDUI-таблиц.
 *
 * <p>`enableResizing` проставляется ТОЛЬКО когда бэк запретил тянуть колонку
 * (`resizable: false` — единственное значение, которое он эмитит). Явное `true`
 * ставить нельзя: `columnDef.enableResizing` перекрывает опцию таблицы
 * `enableColumnResizing`, и ручки появились бы в таблицах без
 * `columnsResizable`, то есть мастер-выключатель перестал бы работать.
 */
export function columnSizeProps(
  props: Record<string, unknown> | undefined
): ColumnSizeProps {
  const width = toColumnWidth(props?.width)
  return {
    ...(width !== undefined ? { size: width } : {}),
    minSize: toColumnWidth(props?.minWidth) ?? SDUI_MIN_COLUMN_WIDTH,
    ...(props?.resizable === false ? { enableResizing: false } : {}),
  }
}

/**
 * Ключ колонки в карте персиста: id колонки ОТНОСИТЕЛЬНО узла таблицы.
 *
 * <p>ЗАЧЕМ (не «упрощать» до абсолютного id узла): `columnStateKey` приходит с
 * бэка и у пикера справочника общий на ТИП справочника
 * (`panel:DICTIONARY:Kontragenty`), а абсолютный id колонки внутри пикера
 * содержит код узла-поля формы, из которого пикер открыт
 * (`panel.choice.field.kontragent.list.col.nameRu`). При абсолютных id одна и та
 * же карта под одним ключом наполнялась бы несовместимыми наборами ключей от
 * разных полей формы: ширины, настроенные из поля «Контрагент», никогда бы не
 * применились к пикеру из поля «Плательщик», а карта росла бы без границ.
 *
 * <p>Операция чисто строковая — никакого обхода дерева: если id колонки
 * начинается с `{tableNodeId}.`, префикс отрезается, иначе id берётся как есть
 * (колонка, id которой не производен от id таблицы, и так стабилен).
 */
export function toRelativeColumnId(
  tableNodeId: string,
  columnId: string
): string {
  const prefix = `${tableNodeId}.`
  return columnId.startsWith(prefix) ? columnId.slice(prefix.length) : columnId
}
