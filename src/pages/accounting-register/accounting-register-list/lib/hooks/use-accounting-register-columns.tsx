import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { ColumnMetaDto } from '@/shared/lib/eav'
import { REFERENCE_DOMAIN_KINDS } from '@/shared/lib/consts/data-types'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'

import type { AccountingRegisterEntry } from '../../types/accounting-register'
import { DimensionCell } from '../../ui/dimension-cell'
import { RecorderCell } from '../../ui/recorder-cell'
import { SubkontoCell } from '../../ui/subkonto-cell'
import { getSubkontoRef } from '../../utils/subkonto'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

/**
 * Системные поля-флаги, которые есть в `/columns`, но в гриде не показываются.
 */
const HIDDEN_SYSTEM_CODES = new Set(['id', 'isActive'])

/**
 * Системные колонки со счетами Дт/Кт — это полноценные колонки журнала
 * (отображаются), их нельзя спутать с Дт/Кт-полями измерений ниже.
 */
const ACCOUNT_SIDE_CODES = new Set(['accountDtId', 'accountKtId'])

/**
 * Дт/Кт-поля измерений (`fkrDtId`/`fkrKtId` и т.п.) — детализация для
 * асимметричных проводок. В шапку не выводятся: измерение представлено
 * одной «схлопнутой» колонкой (как в 1С при Дт=Кт).
 */
const isDimensionSideField = (code: string): boolean =>
  !ACCOUNT_SIDE_CODES.has(code) && /(DtId|KtId)$/.test(code)

const SUBKONTO_RE = /^subkonto([1-9]\d*)(Dt|Kt)$/

const headerText = (
  col: { nameRu: string; nameKz?: string | null },
  language: string
): string => (language === 'kz' ? (col.nameKz ?? col.nameRu) : col.nameRu)

/**
 * Колонки журнала проводок строятся СТРОГО по ответу `/columns` — единый
 * источник без дублей. Ключи объектов данных (`/entries`) для набора колонок
 * НЕ используются (там избыточный набор: и схлопнутые поля, и пары Дт/Кт).
 */
export const useAccountingRegisterColumns = (
  columnsMeta: ColumnMetaDto[] = []
): ColumnDef<AccountingRegisterEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const lang = i18n.language

    const buildColumn = (
      col: ColumnMetaDto
    ): ColumnDef<AccountingRegisterEntry> | null => {
      const header = () => <span>{headerText(col, lang)}</span>

      switch (col.code) {
        case 'period':
          return {
            id: 'period',
            accessorFn: (row) => row.period ?? null,
            header: () => <span>{t('accountingRegister.period')}</span>,
            // Период (1C: Period — DateTime) — дата со временем до секунд.
            cell: ({ getValue }) => {
              const v = getValue() as string | null | undefined
              return cellText(v ? formatDate(v, 'dd.MM.yyyy HH:mm:ss') : '')
            },
          }
        // id = системный код фильтра/сортировки (accountDtId), но отображаем
        // читаемый код счёта (accountDtCode) — бэк whitelist'ит фильтр по *Id.
        case 'accountDtId':
          return {
            id: 'accountDtId',
            accessorFn: (row) => row.accountDtCode ?? null,
            header: () => <span>{t('accountingRegister.debitAccount')}</span>,
            cell: ({ getValue }) =>
              cellText((getValue() as string | null) ?? ''),
          }
        case 'accountKtId':
          return {
            id: 'accountKtId',
            accessorFn: (row) => row.accountKtCode ?? null,
            header: () => <span>{t('accountingRegister.creditAccount')}</span>,
            cell: ({ getValue }) =>
              cellText((getValue() as string | null) ?? ''),
          }
        // Сумма (1C: Edm.Double) — денежный формат: разделители разрядов
        // пробелом и десятичная запятая (5550000 → «5 550 000»).
        case 'summa':
          return {
            id: 'summa',
            accessorFn: (row) => row.summa ?? null,
            header: () => <span>{t('accountingRegister.sum')}</span>,
            cell: ({ getValue }) => {
              const v = getValue() as number | string | null | undefined
              return cellText(
                v == null || v === '' ? '' : formatWithSpaces(String(v))
              )
            },
          }
        case 'soderzhanie':
          return {
            id: 'soderzhanie',
            accessorFn: (row) => row.soderzhanie ?? null,
            header: () => <span>{t('accountingRegister.content')}</span>,
            cell: ({ getValue }) =>
              cellText((getValue() as string | null) ?? ''),
          }
        // Регистратор (1C: Recorder) — бэк отдаёт только ID; резолвим в имя.
        case 'recorderDocumentEntryId':
          return {
            id: 'recorderDocumentEntryId',
            accessorFn: (row) => row.recorderDocumentEntryId ?? null,
            header: () => <span>{t('accountingRegister.recorder')}</span>,
            cell: ({ getValue }) => (
              <RecorderCell id={getValue() as number | null | undefined} />
            ),
          }
        case 'lineNo':
          return {
            id: 'lineNo',
            accessorFn: (row) => row.lineNo ?? null,
            header: () => <span>{t('accountingRegister.lineNo')}</span>,
            cell: ({ getValue }) => {
              const v = getValue() as number | null | undefined
              return cellText(v == null ? '' : String(v))
            },
          }
      }

      // Субконто1..3 Дт/Кт — ссылка из массивов subkontosDt/subkontosKt
      // записи (по position и side); значение хранится как ID, резолвим в имя.
      const subkonto = SUBKONTO_RE.exec(col.code)
      if (subkonto) {
        const position = Number(subkonto[1])
        const side = subkonto[2] as 'Dt' | 'Kt'
        return {
          id: col.code,
          accessorFn: (row) => getSubkontoRef(row, position, side),
          header,
          enableSorting: false,
          cell: ({ getValue }) => (
            <SubkontoCell subkonto={getValue() as ReturnType<typeof getSubkontoRef>} />
          ),
        }
      }

      const isReference =
        !!col.referencedDomainKind &&
        REFERENCE_DOMAIN_KINDS.has(col.referencedDomainKind)

      // Измерения (organizatsiyaId/fkr/spetsifika/…) — ID из поля записи,
      // резолвим ID → имя через справочник.
      if (isReference) {
        return {
          id: col.code,
          accessorFn: (row) => (row[col.code] as number | null | undefined) ?? null,
          header,
          cell: ({ getValue }) => (
            <DimensionCell
              id={getValue() as number | null | undefined}
              resolve
            />
          ),
        }
      }

      // Прочие простые колонки (ValyutnayaSumma, Kolichestvo, Kod).
      return {
        id: col.code,
        accessorFn: (row) => row[col.code] ?? null,
        header,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v === '') return cellText('')
          if (col.dataType === 'DATE') {
            return cellText(typeof v === 'string' ? formatDate(v) : '')
          }
          if (col.dataType === 'DATETIME') {
            return cellText(typeof v === 'string' ? formatDateTime(v) : '')
          }
          // Дальше ожидаем примитив (число/строка); объекты не выводим.
          if (typeof v !== 'number' && typeof v !== 'string') return cellText('')
          if (col.dataType === 'DECIMAL' || col.dataType === 'INTEGER') {
            return cellText(formatWithSpaces(String(v)))
          }
          return cellText(String(v))
        },
      }
    }

    return columnsMeta
      .filter(
        (col) =>
          !HIDDEN_SYSTEM_CODES.has(col.code) && !isDimensionSideField(col.code)
      )
      .map(buildColumn)
      .filter((c): c is ColumnDef<AccountingRegisterEntry> => c !== null)
  }, [columnsMeta, i18n.language, t])
}
