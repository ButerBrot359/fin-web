/**
 * Ноды-поля ввода — общий набор для раскладки (уважение `props.width`,
 * конструктор дизайна) и диалога «Изменить форму».
 */
export const FIELD_NODE_TYPES: ReadonlySet<string> = new Set([
  'TEXT_FIELD',
  'TEXT_AREA',
  'NUMBER_FIELD',
  'DATE_FIELD',
  'DATETIME_FIELD',
  'CHECKBOX_FIELD',
  'ENUM_FIELD',
  'REFERENCE_FIELD',
  'OBJECT_FIELD',
])

/** Пер-пользовательская ширина ноды-поля: число px или undefined. */
export function fieldWidth(node: {
  type: string
  props?: Record<string, unknown>
}): number | undefined {
  if (!FIELD_NODE_TYPES.has(node.type)) return undefined
  const width = node.props?.width
  return typeof width === 'number' && width > 0 ? width : undefined
}
