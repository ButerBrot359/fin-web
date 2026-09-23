export interface EnumOption {
  value: string
  label: string
  id?: number
  code?: string
  // SCRUM-308 §3.5: недоступность ОДНОЙ опции (не узла). Ключи появляются
  // только у погашенных вариантов — отсутствие ключа, а не false.
  disabled?: boolean
  disabledReason?: string
  // SCRUM-355 §8.7: id узла-соседа из children перечисления, который
  // рисуется В СТРОКЕ этой опции (поле выбора учётной записи рядом со своей
  // радиокнопкой «Настройки почты:», а не отдельной строкой ниже).
  adornmentNodeId?: string
}

/** Текущее значение enum (строка-код или объект `{id, code, presentation}`) → строковый `value` опции. */
export function resolveEnumValue(
  value: unknown,
  options: EnumOption[]
): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { id?: unknown; code?: unknown }
    const match = options.find(
      (o) =>
        (v.id != null && o.id === v.id) || (v.code != null && o.code === v.code)
    )
    return match?.value ?? ''
  }
  return ''
}
