/**
 * Пустая ли ячейка ТЧ для клиентской проверки обязательности (SCRUM-329).
 * REFERENCE/OBJECT — «нет id»; числовой 0 и false — НЕ пусто (валидные значения).
 */
export function isCellEmpty(value: unknown, cellWidget: string): boolean {
  if (value == null) return true
  if (cellWidget === 'REFERENCE_FIELD' || cellWidget === 'OBJECT_FIELD') {
    if (typeof value === 'object') {
      return (value as { id?: unknown }).id == null
    }
    return value === ''
  }
  if (typeof value === 'string') return value === ''
  return false
}
