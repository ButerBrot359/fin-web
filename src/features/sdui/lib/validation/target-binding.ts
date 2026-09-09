import type { ValidationMessage } from '@/entities/validation-report'

/**
 * Binding узла, к которому ведёт сообщение: FIELD — реквизит шапки,
 * TABLE/TABLE_CELL — табличная часть. Безадресное сообщение пробует
 * легаси-канал attributeCode (v2 §2.6) — по нему подсвечивается таблица
 * или поле, строку пользователь прочитает в тексте.
 */
export function targetBinding(message: ValidationMessage): string | null {
  const t = message.target
  if (t) {
    if (t.kind === 'FIELD') return t.fieldCode
    if (t.kind === 'TABLE' || t.kind === 'TABLE_CELL') return t.tableCode
    return null
  }
  return message.attributeCode
}
