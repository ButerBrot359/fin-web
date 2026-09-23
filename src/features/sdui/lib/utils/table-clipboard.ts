import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import { renderCellValue } from './cell-value'
import { omitServiceRowKeys } from './service-row-keys'

/**
 * Буфер обмена строк ТЧ (Ctrl+C / Ctrl+V, эталон — таблица 1С).
 *
 * Текст в системном буфере — TSV: колонка = таб, строка = перевод строки. Такой
 * формат читают Excel и «Google Таблицы», поэтому скопированные строки можно
 * вставить наружу, а данные из таблицы — внутрь.
 *
 * Рядом с текстом держится СВОЙ буфер полных значений строк. Ссылочная ячейка
 * хранит `{id, presentation}`, и по одному представлению из текста ссылку не
 * восстановить: `id` в TSV нет и быть не может. Поэтому копирование внутри
 * приложения вставляется из своего буфера (ссылки, перечисления и скрытые
 * колонки доезжают целиком), а из текста разбираются только простые типы — этим
 * путём идёт вставка из Excel.
 */

const RAZDELITEL_KOLONOK = '\t'
const RAZDELITEL_STROK = '\n'

/** Строка значений (без `rowId`) — то, что уходит в новую строку при вставке. */
export type ClipboardRowValues = Record<string, unknown>

interface Bufer {
  tekst: string
  stroki: ClipboardRowValues[]
}

let bufer: Bufer | null = null

/**
 * Текст ячейки для TSV. Табы и переводы строк внутри значения схлопываются в
 * пробел: иначе одна многострочная ячейка разъехалась бы на несколько строк
 * буфера и вставка сдвинула бы все колонки.
 */
function tekstYacheyki(value: unknown, dataType: string): string {
  if (value == null) return ''
  if (typeof value === 'object') return odnaStroka(renderCellValue(value))
  if (typeof value === 'boolean' || dataType === 'BOOLEAN') {
    return value === true || value === 'true' ? 'Да' : 'Нет'
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'string') return odnaStroka(value)
  return ''
}

function odnaStroka(text: string): string {
  return text.replace(/[\t\r\n]+/g, ' ')
}

/**
 * Строки ТЧ → TSV по ВИДИМЫМ колонкам: копируется то, что пользователь видит,
 * иначе в Excel уехали бы служебные колонки master-detail.
 */
export function stroitTsv(rows: TableRow[], columns: TableColumnDef[]): string {
  return rows
    .map((row) =>
      columns
        .map((col) => tekstYacheyki(row[col.binding], col.dataType))
        .join(RAZDELITEL_KOLONOK)
    )
    .join(RAZDELITEL_STROK)
}

/**
 * Запомнить скопированное: текст-подпись и полные значения строк. Подпись нужна,
 * чтобы на вставке отличить «пользователь копировал здесь» от «в буфере чужой
 * текст из Excel».
 */
export function zapomnitKopiyu(tekst: string, rows: TableRow[]): void {
  bufer = {
    tekst,
    stroki: rows.map((row) => {
      const { rowId: _rowId, ...values } = omitServiceRowKeys(row)
      return values
    }),
  }
}

/** Полные значения из своего буфера, если в системном буфере тот же текст. */
export function vzyatKopiyu(tekst: string): ClipboardRowValues[] | null {
  if (bufer?.tekst !== tekst) return null
  return bufer.stroki.map((values) => ({ ...values }))
}

/** Только для тестов: забыть своё содержимое буфера. */
export function sbrositKopiyu(): void {
  bufer = null
}

// Разделитель разрядов из Excel — пробел, в том числе неразрывный и узкий.
const CHISLOVOY_MUSOR = /[\s\u00a0\u202f]/g

function chislo(text: string): number | null {
  const normalizovannyy = text.replace(CHISLOVOY_MUSOR, '').replace(',', '.')
  if (normalizovannyy === '') return null
  const value = Number(normalizovannyy)
  return Number.isFinite(value) ? value : null
}

const DATA_RU = /^(\d{2})\.(\d{2})\.(\d{4})/
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/

function data(text: string): string | null {
  if (DATA_ISO.test(text)) return text
  const ru = DATA_RU.exec(text)
  if (!ru) return null
  return `${ru[3]}-${ru[2]}-${ru[1]}`
}

const ISTINA = new Set(['да', 'истина', 'true', '1', '✓', 'x', 'yes'])
const LOZH = new Set(['нет', 'ложь', 'false', '0', '', '-', 'no'])

/**
 * Текст ячейки → значение по типу колонки. `undefined` — «этим текстом колонку
 * заполнить нельзя»: ссылку и перечисление без `id` не собрать, а мусор в числе
 * лучше оставить пустым, чем записать NaN. Ключ такой колонки в результат не
 * попадает, и строка остаётся с дефолтом из `buildEmptyRow`.
 */
function znachenieYacheyki(text: string, dataType: string): unknown {
  const obrezannyy = text.trim()
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return text
    case 'INTEGER': {
      const value = chislo(obrezannyy)
      return value === null ? undefined : Math.trunc(value)
    }
    case 'DECIMAL':
    case 'NUMBER': {
      const value = chislo(obrezannyy)
      return value ?? undefined
    }
    case 'BOOLEAN': {
      const nizhniy = obrezannyy.toLowerCase()
      if (ISTINA.has(nizhniy)) return true
      if (LOZH.has(nizhniy)) return false
      return undefined
    }
    case 'DATE':
    case 'DATETIME':
      return data(obrezannyy) ?? undefined
    default:
      return undefined
  }
}

/**
 * TSV → значения строк по ВИДИМЫМ колонкам (в том же порядке, в котором текст
 * собирался). Readonly-колонка позицию в тексте занимает, но значение из неё не
 * применяется: она и с клавиатуры не правится.
 */
export function razobratTsv(
  tekst: string,
  columns: TableColumnDef[]
): ClipboardRowValues[] {
  return tekst
    .split(/\r\n|\r|\n/)
    .filter((stroka) => stroka.trim() !== '')
    .map((stroka) => {
      const yacheyki = stroka.split(RAZDELITEL_KOLONOK)
      const values: ClipboardRowValues = {}
      columns.forEach((col, index) => {
        if (col.readonly === true) return
        // Колонок в таблице больше, чем позиций в тексте (вставка из Excel с
        // меньшим числом колонок) — лишние остаются с дефолтом строки.
        if (index >= yacheyki.length) return
        const value = znachenieYacheyki(yacheyki[index], col.dataType)
        if (value !== undefined) values[col.binding] = value
      })
      return values
    })
}
