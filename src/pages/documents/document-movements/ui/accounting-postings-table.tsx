import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'

import type { MovementGroup } from '../api/document-movements-api'

/**
 * Журнал проводок регистра бухгалтерии в раскладке 1С: каждая проводка —
 * блок из трёх строк, аналитика по Дебету и Кредиту разнесена в две группы
 * колонок, субконто и измерения идут построчно (как «таблица в таблице» 1С).
 * Сумма и Содержание — общие для проводки (объединены по вертикали).
 *
 * Применяется только к регистру бухгалтерии (ZhurnalProvodokGosUchrezhdeniya);
 * остальные регистры рендерит плоский MovementTable.
 */

// Коды аналитики по строкам блока Дебет/Кредит (порядок как в 1С):
//  строка 1: Субконто1 · ФКР · Подразделение
//  строка 2: Субконто2 · Специфика · Количество
//  строка 3: Субконто3 · Источник финансирования · Код платных услуг
const ROW_FIELDS = [
  { subDt: 'subkonto1Dt', subKt: 'subkonto1Kt', a1: 'FKR', a2: 'Podrazdelenie' },
  { subDt: 'subkonto2Dt', subKt: 'subkonto2Kt', a1: 'Spetsifika', a2: 'kolichestvo' },
  {
    subDt: 'subkonto3Dt',
    subKt: 'subkonto3Kt',
    a1: 'IstochnikFinansirovaniya',
    a2: 'KodPlatnykhUslug',
  },
] as const

type Entry = Record<string, unknown>

/** Резолв значения ячейки: ссылочный объект → имя; число → разряды; строка как есть. */
const resolveValue = (v: unknown): string => {
  if (v == null || v === '') return ''
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (
      (o.displayName as string | undefined) ??
      (o.nameRu as string | undefined) ??
      (o.name as string | undefined) ??
      ''
    )
  }
  if (typeof v === 'number') return formatWithSpaces(String(v))
  return String(v)
}

const thBase = 'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase text-ui-06'
const cellPad = 'px-3 py-1.5 align-top'

export const AccountingPostingsTable = ({ group }: { group: MovementGroup }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  // Локализованные метки полей по коду колонки (для подписи субконто/аналитики).
  const label = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of group.columns) map[c.code] = getLocalizedName(c, lang)
    return (code: string) => map[code] ?? code
  }, [group.columns, lang])

  // Ячейка «метка + значение» (как поле проводки в 1С: подпись сверху, значение снизу).
  const FieldCell = ({
    code,
    entry,
    border,
  }: {
    code: string
    entry: Entry
    border?: boolean
  }) => (
    <td className={cn(cellPad, 'max-w-52', border && 'border-l border-ui-04')}>
      <span className="block truncate text-[10px] uppercase leading-tight text-ui-05">
        {label(code)}
      </span>
      <Typography variant="body2" noWrap className="truncate text-ui-06">
        {resolveValue(entry[code])}
      </Typography>
    </td>
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ui-04">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          <tr>
            <th className={cn(thBase, 'text-center')}>{t('accountingRegister.num')}</th>
            <th className={cn(thBase, 'text-left')}>{t('accountingRegister.date')}</th>
            <th className={cn(thBase, 'border-l border-ui-04 text-center')} colSpan={4}>
              {t('accountingRegister.debit')}
            </th>
            <th className={cn(thBase, 'border-l border-ui-04 text-center')} colSpan={4}>
              {t('accountingRegister.credit')}
            </th>
            <th className={cn(thBase, 'border-l border-ui-04 text-right')}>
              {t('accountingRegister.sum')}
            </th>
            <th className={cn(thBase, 'border-l border-ui-04 text-left')}>
              {t('accountingRegister.content')}
            </th>
          </tr>
        </thead>
        <tbody>
          {group.entries.map((entry, idx) => {
            const period = entry._period
            return (
              <Fragment key={(entry._id as number | string | undefined) ?? idx}>
                {ROW_FIELDS.map((rf, r) => {
                  const first = r === 0
                  // Граница сверху отделяет проводки друг от друга.
                  const topBorder = first ? 'border-t-2 border-ui-04' : ''
                  return (
                    <tr key={r} className={cn(idx % 2 === 1 && 'bg-ui-02/40', topBorder)}>
                      {first && (
                        <>
                          <td rowSpan={3} className={cn(cellPad, 'text-center text-ui-06')}>
                            {idx + 1}
                          </td>
                          <td rowSpan={3} className={cn(cellPad, 'whitespace-nowrap text-ui-06')}>
                            <Typography variant="body2" noWrap className="text-ui-06">
                              {typeof period === 'string'
                                ? formatDate(period, 'dd.MM.yyyy HH:mm:ss')
                                : ''}
                            </Typography>
                          </td>
                          {/* Счёт Дт — общий для проводки */}
                          <td
                            rowSpan={3}
                            className={cn(cellPad, 'border-l border-ui-04 align-middle')}
                          >
                            <Typography variant="body2" noWrap className="font-bold text-ui-06">
                              {resolveValue(entry.accountDt)}
                            </Typography>
                          </td>
                        </>
                      )}
                      {/* Дебет: субконто N · аналитика1 · аналитика2 */}
                      <FieldCell code={rf.subDt} entry={entry} border={!first} />
                      <FieldCell code={rf.a1} entry={entry} />
                      <FieldCell code={rf.a2} entry={entry} />
                      {first && (
                        /* Счёт Кт — общий для проводки */
                        <td
                          rowSpan={3}
                          className={cn(cellPad, 'border-l border-ui-04 align-middle')}
                        >
                          <Typography variant="body2" noWrap className="font-bold text-ui-06">
                            {resolveValue(entry.accountKt)}
                          </Typography>
                        </td>
                      )}
                      {/* Кредит: субконто N · аналитика1 · аналитика2 */}
                      <FieldCell code={rf.subKt} entry={entry} border={!first} />
                      <FieldCell code={rf.a1} entry={entry} />
                      <FieldCell code={rf.a2} entry={entry} />
                      {first && (
                        <>
                          <td
                            rowSpan={3}
                            className={cn(cellPad, 'border-l border-ui-04 text-right align-middle')}
                          >
                            <Typography variant="body2" noWrap className="font-bold text-ui-06">
                              {resolveValue(entry.summa)}
                            </Typography>
                          </td>
                          <td
                            rowSpan={3}
                            className={cn(cellPad, 'border-l border-ui-04 align-middle')}
                          >
                            <Typography variant="body2" className="text-ui-06">
                              {resolveValue(entry.soderzhanie)}
                            </Typography>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
