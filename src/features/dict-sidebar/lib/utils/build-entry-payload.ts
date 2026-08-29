import type { DocumentAttribute } from '@/entities/document-type'
import type { DictEntryCreatePayload } from '../../api/dict-sidebar-api'

/**
 * Встроенные поля записи универсального домена: едут отдельными полями тела
 * запроса, а не в `attributes`.
 */
const BUILT_IN_FIELDS = new Set([
  'nameRu',
  'nameKz',
  'code',
  'parentId',
  'sortOrder',
])

/**
 * Строка ТЧ уже существует на сервере, если её идентификатор ЧИСЛОВОЙ. Контракт
 * бэка (карточка ПВР, 29.08.2026): у новых строк `rowId` обязан быть
 * нечисловым временным («tmp-1»), по нему сервер и отличает вставку от правки.
 */
const persistedRowId = (row: Record<string, unknown>): number | null => {
  for (const key of ['rowId', 'id'] as const) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      !isNaN(Number(value))
    ) {
      return Number(value)
    }
  }
  return null
}

/**
 * Строки ТЧ в том виде, в каком их ждёт CRUD-эндпоинт: у каждой строки есть
 * `rowId` — свой у существующей, временный «tmp-N» у добавленной на форме.
 *
 * Легаси-форма строк ТЧ идентификаторами не снабжает вовсе (`buildEmptyRow`
 * кладёт только колонки), поэтому добавленная строка уходила без `rowId` — и
 * сервер сохранить её не мог.
 */
export const normalizeTableRows = (
  rows: Record<string, unknown>[]
): Record<string, unknown>[] => {
  let tempCounter = 0
  return rows.map((row) => {
    const persisted = persistedRowId(row)
    if (persisted !== null) return { ...row, rowId: persisted }
    tempCounter += 1
    return { ...row, rowId: `tmp-${String(tempCounter)}` }
  })
}

const isRowArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) &&
  value.every((row) => typeof row === 'object' && row !== null)

/**
 * Тело CRUD-запроса карточки универсального домена (POST/PUT
 * `/api/universaldomain-entries/…`) из значений формы.
 *
 * ЧТО БЫЛО СЛОМАНО (карточка ПВР «Виды начислений/удержаний организации»,
 * 29.08.2026). Правки «сохранялись» с тостом успеха, а строка ТЧ «Базовые виды
 * расчёта» после переоткрытия исчезала. Со стороны фронта причины две:
 *   1) строки уходили без `rowId` (см. normalizeTableRows);
 *   2) ТЧ, которую форма ещё не загрузила, уходила ПУСТЫМ массивом. Сервер
 *      трактует непустой массив как ПОЛНЫЙ снимок строк, а пустой намеренно
 *      игнорирует, чтобы не стереть существующие, — но полагаться на это
 *      снисхождение нельзя: пустой массив в теле означает «строк нет», и любая
 *      смена этой семантики на бэке молча затирала бы ТЧ. Поэтому пустую ТЧ не
 *      отправляем вовсе.
 *
 * Следствие (2): очистить ТЧ подчистую этим путём нельзя — как и на сервере,
 * где пустой массив игнорируется. Удаление строк живёт в SDUI-форме карточки.
 *
 * ПРЕДПОСЫЛКА непустой ветки: раз сервер читает массив как полный снимок, форма
 * обязана держать ВСЕ строки записи — то есть карточка открывается уже с
 * загруженной ТЧ (GET записи отдаёт строки в `attributes`). Иначе добавление
 * одной строки к невидимым для формы существующим стёрло бы остальные.
 *
 * @param data       значения react-hook-form (встроенные поля + атрибуты)
 * @param attributes метаданные типа: по ним узнаём, какие ключи — ТЧ (TABLE)
 */
export const buildEntryPayload = (
  data: Record<string, unknown>,
  attributes: DocumentAttribute[]
): DictEntryCreatePayload => {
  const tableCodes = new Set(
    attributes
      .filter((attr) => attr.dataType === 'TABLE')
      .map((attr) => attr.code)
  )

  const entryAttributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (BUILT_IN_FIELDS.has(key)) continue
    if (tableCodes.has(key)) {
      if (!isRowArray(value) || value.length === 0) continue
      entryAttributes[key] = normalizeTableRows(value)
      continue
    }
    entryAttributes[key] = value
  }

  return {
    nameRu: (data.nameRu as string | undefined) ?? '',
    nameKz: data.nameKz as string | undefined,
    code: data.code as string | undefined,
    parentId: data.parentId as number | null | undefined,
    sortOrder: data.sortOrder as number | undefined,
    attributes: entryAttributes,
  }
}
