/**
 * Ширина поля из эталона 1С: бэк переводит ширину в символах в пиксели
 * (`px = символы * 10 + 24`) и кладёт её в `props.maxWidth` у FIELD-узлов.
 *
 * Это именно потолок, а не фиксированная ширина: на узком экране контрол обязан
 * ужиматься вместе с колонкой, иначе форма уезжает в горизонтальный скролл.
 * Поэтому значение попадает в `max-width`, а раскладку по-прежнему решает flex.
 *
 * Приходит числом (`304`), но в раскладках 1С встречается и строковая форма
 * (`"304"`) — приводим сами, чтобы не зависеть от того, каким носителем проп
 * доехал. Мусор и неположительные значения игнорируем: поле остаётся тянущимся,
 * а не схлопывается в ноль.
 */
export function parseMaxWidth(raw: unknown): number | undefined {
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined
  return n
}

/**
 * Стиль внешней коробки поля: `flex` задаёт раскладку, `maxWidth` — потолок.
 * Годится и для `sx` MUI, и для обычного `style` — undefined-ключи оба игнорируют.
 */
export function fieldBoxStyle(f: {
  flex?: number | string
  maxWidth?: number
}): { flex?: number | string; maxWidth?: number } {
  return { flex: f.flex, maxWidth: f.maxWidth }
}
