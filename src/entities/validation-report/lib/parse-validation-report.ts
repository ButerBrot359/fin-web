import type {
  ValidationMessage,
  ValidationReport,
  ValidationSeverity,
  ValidationSource,
  ValidationTarget,
} from '../types/validation-report'

const SEVERITIES: ValidationSeverity[] = ['ERROR', 'WARNING']
const SOURCES: ValidationSource[] = [
  'REQUIRED_ATTRIBUTE',
  'BUSINESS_RULE',
  'OPERATION',
]

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

/**
 * Валидность target проверяется по kind ВМЕСТЕ с обязательными полями
 * (v2 §2.4): одному имени вида на границе провода не доверяем. Неполный или
 * неизвестный адрес превращается в null — сообщение остаётся в списке
 * текстом, это легальная деградация, не дефект.
 */
function parseTarget(raw: unknown): ValidationTarget | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const kind = str(t.kind)
  if (kind === 'DOCUMENT') return { kind: 'DOCUMENT' }
  if (kind === 'FIELD') {
    const fieldCode = str(t.fieldCode)
    return fieldCode ? { kind: 'FIELD', fieldCode } : null
  }
  if (kind === 'TABLE') {
    const tableCode = str(t.tableCode)
    return tableCode ? { kind: 'TABLE', tableCode } : null
  }
  if (kind === 'TABLE_CELL') {
    const tableCode = str(t.tableCode)
    const columnCode = str(t.columnCode)
    const rowIndex = typeof t.rowIndex === 'number' ? t.rowIndex : null
    if (tableCode && columnCode && rowIndex != null) {
      return { kind: 'TABLE_CELL', tableCode, rowIndex, columnCode }
    }
    // Сервер понижает недостоверную ячейку до TABLE сам, но неполный адрес
    // на границе провода деградируем тем же способом.
    return tableCode ? { kind: 'TABLE', tableCode } : null
  }
  return null
}

function parseMessage(raw: unknown, index: number): ValidationMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const message = str(m.message)
  if (!message) return null
  const severity = SEVERITIES.find((s) => s === m.severity) ?? 'ERROR'
  const source = SOURCES.find((s) => s === m.source) ?? null
  return {
    // id стабилен только внутри отчёта; отсутствие на проводе — не повод
    // терять сообщение, фолбэк по позиции сохраняет ключи уникальными.
    id: str(m.id) ?? `msg-${String(index)}`,
    severity,
    source,
    blocking: m.blocking === true,
    message,
    target: parseTarget(m.target),
    attributeCode: str(m.attributeCode),
  }
}

/** Defensive-разбор отчёта с границы провода; мусор → null, не исключение. */
export function parseValidationReport(raw: unknown): ValidationReport | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.messages)) return null
  const messages = r.messages
    .map((m, i) => parseMessage(m, i))
    .filter((m): m is ValidationMessage => m !== null)
  return {
    operation: str(r.operation),
    blockingCount: typeof r.blockingCount === 'number' ? r.blockingCount : 0,
    messages,
  }
}
