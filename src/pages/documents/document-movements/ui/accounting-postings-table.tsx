import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'

import type { MovementGroup } from '../api/document-movements-api'

/**
 * Журнал проводок регистра бухгалтерии в раскладке 1С: проводка — блок из трёх
 * строк, аналитика по Дебету и Кредиту разнесена в две группы колонок. Названия
 * полей (субконто 1/2/3, ФКР/Специфика/Источник, Подразделение/Количество/Код)
 * вынесены в ШАПКУ (многорядную), а в строках данных идут только значения —
 * как в 1С (а не метка в каждой ячейке).
 *
 * Применяется только к регистру бухгалтерии (ZhurnalProvodokGosUchrezhdeniya).
 */

// Коды аналитики по строкам блока (порядок как в 1С):
//  строка 1: Субконто1 · ФКР · Подразделение
//  строка 2: Субконто2 · Специфика · Количество
//  строка 3: Субконто3 · Источник финансирования · Код платных услуг
//
// `*Label` — код колонки для ЗАГОЛОВКА (единый над Дт и Кт), `*Dt`/`*Kt` —
// РАЗДЕЛЬНЫЕ биндинги значений сторон. Раньше обе стороны читали один ключ
// (`a1`/`a2`), из-за чего кредитная аналитика (Подразделение/ФКР/…) показывала
// дебетовое значение. Имена Dt/Kt — контракт бэка (REST `/movements`:
// `podrazdelenieDt`/`podrazdelenieKt` и т.д.); `kolichestvo` — общее на проводку.
const ROW_FIELDS = [
  {
    subDt: 'subkonto1Dt',
    subKt: 'subkonto1Kt',
    a1Label: 'FKR',
    a1Dt: 'fkrDt',
    a1Kt: 'fkrKt',
    a2Label: 'Podrazdelenie',
    a2Dt: 'podrazdelenieDt',
    a2Kt: 'podrazdelenieKt',
  },
  {
    subDt: 'subkonto2Dt',
    subKt: 'subkonto2Kt',
    a1Label: 'Spetsifika',
    a1Dt: 'spetsifikaDt',
    a1Kt: 'spetsifikaKt',
    a2Label: 'kolichestvo',
    a2Dt: 'kolichestvo',
    a2Kt: 'kolichestvo',
  },
  {
    subDt: 'subkonto3Dt',
    subKt: 'subkonto3Kt',
    a1Label: 'IstochnikFinansirovaniya',
    a1Dt: 'istochnikFinansirovaniyaDt',
    a1Kt: 'istochnikFinansirovaniyaKt',
    a2Label: 'KodPlatnykhUslug',
    a2Dt: 'kodPlatnykhUslugDt',
    a2Kt: 'kodPlatnykhUslugKt',
  },
] as const

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
  return typeof v === 'string' ? v : String(v as string | number)
}

const thBase =
  'whitespace-nowrap px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-ui-06 align-bottom'
const cellPad = 'px-3 py-1.5 align-top'

export const AccountingPostingsTable = ({ group }: { group: MovementGroup }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const label = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of group.columns) map[c.code] = getLocalizedName(c, lang)
    return (code: string) => map[code] ?? code
  }, [group.columns, lang])

  // Значение-ячейка (без метки — метка живёт в шапке). numeric — выравнивание вправо.
  const Val = ({ v, numeric }: { v: unknown; numeric?: boolean }) => (
    <Typography
      variant="body2"
      noWrap
      className={cn('truncate text-ui-06', numeric && 'text-right tabular-nums')}
    >
      {resolveValue(v)}
    </Typography>
  )

  // Метки трёх строк блока (для шапки): субконто 1/2/3 одной стороны.
  const sideLabels = (side: 'Dt' | 'Kt') =>
    ROW_FIELDS.map((rf) => label(side === 'Dt' ? rf.subDt : rf.subKt))
  const a1Labels = ROW_FIELDS.map((rf) => label(rf.a1Label))
  const a2Labels = ROW_FIELDS.map((rf) => label(rf.a2Label))

  const bl = 'border-l border-ui-04'

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ui-04">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          {/* Ряд 1 — группы Дебет / Кредит. */}
          <tr className="border-b border-ui-04">
            <th rowSpan={4} className={cn(thBase, 'text-center')}>
              {t('accountingRegister.num')}
            </th>
            <th rowSpan={4} className={thBase}>
              {t('accountingRegister.date')}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {t('accountingRegister.debit')}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {t('accountingRegister.credit')}
            </th>
            <th rowSpan={4} className={cn(thBase, bl, 'text-right')}>
              {t('accountingRegister.sum')}
            </th>
            <th rowSpan={4} className={cn(thBase, bl)}>
              {t('accountingRegister.content')}
            </th>
          </tr>
          {/* Ряды 2-4 — названия полей (субконто/аналитика построчно), как в 1С. */}
          {[0, 1, 2].map((r) => (
            <tr key={r} className={r === 2 ? 'border-b border-ui-04' : undefined}>
              {r === 0 && (
                <th rowSpan={3} className={cn(thBase, bl)}>
                  {t('accountingRegister.account')}
                </th>
              )}
              <th className={thBase}>{sideLabels('Dt')[r]}</th>
              <th className={thBase}>{a1Labels[r]}</th>
              <th className={thBase}>{a2Labels[r]}</th>
              {r === 0 && (
                <th rowSpan={3} className={cn(thBase, bl)}>
                  {t('accountingRegister.account')}
                </th>
              )}
              <th className={thBase}>{sideLabels('Kt')[r]}</th>
              <th className={thBase}>{a1Labels[r]}</th>
              <th className={thBase}>{a2Labels[r]}</th>
            </tr>
          ))}
        </thead>
        {group.entries.map((entry, idx) => {
          const period = entry._period
          // Каждая проводка — отдельный <tbody class="group"> для hover всей проводки.
          return (
            <tbody
              key={(entry._id as number | string | undefined) ?? idx}
              className="group"
            >
              {ROW_FIELDS.map((rf, r) => {
                const first = r === 0
                const topBorder = first ? 'border-t-2 border-ui-04' : ''
                const numeric = rf.a2Label === 'kolichestvo' // строка с «Количество»
                // Дебет: новый Dt-биндинг, фолбэк на легаси-код (без Dt/Kt) —
                // чтобы дебет не сломался, если бэк ещё не отдаёт Dt-поле.
                const a1DtVal = entry[rf.a1Dt] ?? entry[rf.a1Label]
                const a2DtVal = entry[rf.a2Dt] ?? entry[rf.a2Label]
                return (
                  <tr
                    key={r}
                    className={cn(
                      idx % 2 === 1 && 'bg-ui-02/40',
                      'group-hover:bg-ui-07',
                      topBorder
                    )}
                  >
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
                        <td rowSpan={3} className={cn(cellPad, bl, 'align-middle')}>
                          <Typography variant="body2" noWrap className="font-bold text-ui-06">
                            {resolveValue(entry.accountDt)}
                          </Typography>
                        </td>
                      </>
                    )}
                    {/* Дебет: значения субконто / аналитика1 / аналитика2 */}
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={entry[rf.subDt]} />
                    </td>
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={a1DtVal} />
                    </td>
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={a2DtVal} numeric={numeric} />
                    </td>
                    {first && (
                      <td rowSpan={3} className={cn(cellPad, bl, 'align-middle')}>
                        <Typography variant="body2" noWrap className="font-bold text-ui-06">
                          {resolveValue(entry.accountKt)}
                        </Typography>
                      </td>
                    )}
                    {/* Кредит: значения субконто / аналитика1 / аналитика2 —
                        строго Kt-биндинги (иначе показывался бы дебет). */}
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={entry[rf.subKt]} />
                    </td>
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={entry[rf.a1Kt]} />
                    </td>
                    <td className={cn(cellPad, 'max-w-52')}>
                      <Val v={entry[rf.a2Kt]} numeric={numeric} />
                    </td>
                    {first && (
                      <>
                        <td rowSpan={3} className={cn(cellPad, bl, 'text-right align-middle')}>
                          <Typography variant="body2" noWrap className="font-bold text-ui-06">
                            {resolveValue(entry.summa)}
                          </Typography>
                        </td>
                        <td rowSpan={3} className={cn(cellPad, bl, 'align-middle')}>
                          <Typography variant="body2" className="text-ui-06">
                            {resolveValue(entry.soderzhanie)}
                          </Typography>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
