import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { ColumnMetaDto } from '@/shared/lib/eav'
import type { TableExportData } from '@/shared/lib/table-export'
import type { XlsxCell } from '@/shared/lib/xlsx/write-xlsx'
import { REFERENCE_DOMAIN_KINDS } from '@/shared/lib/consts/data-types'
import {
  fetchDictionaryEntryById,
  resolveDictionaryEntryLabel,
  type DictionaryEntryById,
} from '@/shared/lib/dictionary-entry'
import { getDocumentEntry, type DocumentEntry } from '@/entities/document-entry'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'

import type { AccountingRegisterEntry } from '../../types/accounting-register'
import { getSubkontoRef, type SubkontoRef } from '../../utils/subkonto'

// Те же правила фильтрации/классификации колонок, что и в
// use-accounting-register-columns.tsx — чтобы выгрузка совпадала с гридом.
const HIDDEN_SYSTEM_CODES = new Set(['id', 'isActive'])
const ACCOUNT_SIDE_CODES = new Set(['accountDtId', 'accountKtId'])
const SUBKONTO_RE = /^subkonto([1-9]\d*)(Dt|Kt)$/

const isDimensionSideField = (code: string): boolean =>
  !ACCOUNT_SIDE_CODES.has(code) && /(DtId|KtId)$/.test(code)

const headerText = (col: ColumnMetaDto, language: string): string =>
  language === 'kz' ? (col.nameKz ?? col.nameRu) : col.nameRu

const numericCell = (v: unknown): XlsxCell => {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isFinite(n)) return n
  return typeof v === 'string' ? v : ''
}

/**
 * Готовит данные журнала проводок для выгрузки в Excel со значениями «как в
 * гриде»: ссылки (регистратор, измерения, субконто) резолвятся ID → имя.
 *
 * Ячейки грида резолвят ссылки лениво и только для видимых строк, поэтому здесь
 * предварительно догружаем все нужные справочники/документы одним пакетом.
 */
export const useAccountingRegisterExport = (
  columnsMeta: ColumnMetaDto[] = []
): ((entries: AccountingRegisterEntry[]) => Promise<TableExportData>) => {
  const { t, i18n } = useTranslation()

  return useCallback(
    async (entries: AccountingRegisterEntry[]): Promise<TableExportData> => {
      const lang = i18n.language

    const cols = columnsMeta.filter(
      (col) =>
        !HIDDEN_SYSTEM_CODES.has(col.code) && !isDimensionSideField(col.code)
    )

    const subkontoRef = (
      row: AccountingRegisterEntry,
      code: string
    ): SubkontoRef | null => {
      const m = SUBKONTO_RE.exec(code)
      if (!m) return null
      return getSubkontoRef(row, Number(m[1]), m[2] as 'Dt' | 'Kt')
    }

    const isReferenceCol = (col: ColumnMetaDto): boolean =>
      !!col.referencedDomainKind &&
      REFERENCE_DOMAIN_KINDS.has(col.referencedDomainKind)

    // 1. Собираем все ID ссылок, которые нужно разрешить в имена.
    const dictIds = new Set<number>()
    const docIds = new Set<number>()

    for (const row of entries) {
      if (typeof row.recorderDocumentEntryId === 'number') {
        docIds.add(row.recorderDocumentEntryId)
      }
      for (const col of cols) {
        if (SUBKONTO_RE.test(col.code)) {
          const ref = subkontoRef(row, col.code)
          if (ref?.refId != null) {
            if (ref.valueType === 'DICTIONARY') dictIds.add(ref.refId)
            else if (ref.valueType === 'DOCUMENT') docIds.add(ref.refId)
          }
        } else if (isReferenceCol(col)) {
          const v = row[col.code]
          if (typeof v === 'number') dictIds.add(v)
        }
      }
    }

    // 2. Догружаем имена пакетом (по уникальным ID). Сбой одной ссылки не
    //    срывает всю выгрузку — для неё останется запасной вид (#id).
    const dictMap = new Map<number, DictionaryEntryById>()
    const docMap = new Map<number, DocumentEntry>()

    await Promise.allSettled([
      ...[...dictIds].map(async (id) => {
        dictMap.set(id, await fetchDictionaryEntryById(id))
      }),
      ...[...docIds].map(async (id) => {
        const res = await getDocumentEntry(String(id))
        docMap.set(id, res.data.data)
      }),
    ])

    const dictLabel = (id: number | null | undefined): string =>
      id == null ? '' : resolveDictionaryEntryLabel(dictMap.get(id), id)

    const docLabel = (id: number | null | undefined): string => {
      if (id == null) return ''
      const doc = docMap.get(id)
      const name = doc ? getLocalizedName(doc, lang) : ''
      return name || doc?.code || `#${String(id)}`
    }

    // 3. Заголовки и извлечение значения для каждой колонки.
    const cellOf = (
      col: ColumnMetaDto,
      row: AccountingRegisterEntry
    ): XlsxCell => {
      switch (col.code) {
        case 'period':
          return row.period ? formatDate(row.period, 'dd.MM.yyyy HH:mm:ss') : ''
        case 'accountDtId':
          return row.accountDtCode ?? ''
        case 'accountKtId':
          return row.accountKtCode ?? ''
        case 'summa':
          return numericCell(row.summa)
        case 'soderzhanie':
          return row.soderzhanie ?? ''
        case 'recorderDocumentEntryId':
          return docLabel(row.recorderDocumentEntryId)
        case 'lineNo':
          return numericCell(row.lineNo)
      }

      if (SUBKONTO_RE.test(col.code)) {
        const ref = subkontoRef(row, col.code)
        if (ref?.refId == null) return ''
        if (ref.valueType === 'DICTIONARY') return dictLabel(ref.refId)
        if (ref.valueType === 'DOCUMENT') return docLabel(ref.refId)
        return String(ref.refId)
      }

      if (isReferenceCol(col)) {
        const v = row[col.code]
        return typeof v === 'number' ? dictLabel(v) : ''
      }

      const v = row[col.code]
      if (v == null || v === '') return ''
      if (col.dataType === 'DATE') {
        return typeof v === 'string' ? formatDate(v) : ''
      }
      if (col.dataType === 'DATETIME') {
        return typeof v === 'string' ? formatDateTime(v) : ''
      }
      if (col.dataType === 'DECIMAL' || col.dataType === 'INTEGER') {
        return numericCell(v)
      }
      return typeof v === 'number' || typeof v === 'string'
        ? String(v)
        : ''
    }

    const headerOf = (col: ColumnMetaDto): string => {
      switch (col.code) {
        case 'period':
          return t('accountingRegister.period')
        case 'accountDtId':
          return t('accountingRegister.debitAccount')
        case 'accountKtId':
          return t('accountingRegister.creditAccount')
        case 'summa':
          return t('accountingRegister.sum')
        case 'soderzhanie':
          return t('accountingRegister.content')
        case 'recorderDocumentEntryId':
          return t('accountingRegister.recorder')
        case 'lineNo':
          return t('accountingRegister.lineNo')
        default:
          return headerText(col, lang)
      }
    }

    return {
      headers: cols.map(headerOf),
      rows: entries.map((row) => cols.map((col) => cellOf(col, row))),
    }
    },
    [columnsMeta, t, i18n.language]
  )
}
