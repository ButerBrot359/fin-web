import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import {
  type AccountingRow,
  type BlockRowDef,
  buildRowDefs,
  collectColumnLabels,
  collectGroupLabels,
  formatSum,
  getBlockRowCount,
  resolveCellValue,
} from './accounting-block-logic'

// Журнал проводок бухрегистра в раскладке 1С. Раскладка СКОПИРОВАНА из легаси
// accounting-postings-table.tsx (импортов из легаси нет — правило изоляции):
// проводка — блок из N строк (обычно 3), аналитика Дт/Кт в двух группах
// колонок, метки полей — в многорядной шапке, в строках только значения.
// Метки шапки — из props.label листьев дерева колонок TABLE (бэк резолвит).

const thBase =
  'whitespace-nowrap px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-ui-06 align-bottom'
const cellPad = 'px-3 py-1.5 align-top'
const bl = 'border-l border-ui-04'

const Val = ({ value, numeric }: { value: string; numeric?: boolean }) => (
  <Typography
    variant="body2"
    noWrap
    className={cn('truncate text-ui-06', numeric && 'text-right tabular-nums')}
  >
    {value}
  </Typography>
)

export const AccountingPostingsBlock = ({ node }: NodeProps) => {
  const { t } = useTranslation()
  const { getValue } = useSduiSession()

  const rows = (getValue(node.binding) as AccountingRow[] | undefined) ?? []
  const labels = collectColumnLabels(node)
  const groups = collectGroupLabels(node)
  const rowDefs = buildRowDefs(getBlockRowCount(rows))

  const label = (binding: string) => labels.get(binding) ?? ''
  const headSpan = 1 + rowDefs.length

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ui-04">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          {/* Ряд 1 — группы ДЕБЕТ / КРЕДИТ. */}
          <tr className="border-b border-ui-04">
            <th rowSpan={headSpan} className={cn(thBase, 'text-center')}>
              {t('table.rowNumber')}
            </th>
            <th rowSpan={headSpan} className={thBase}>
              {label('_period')}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[0] ?? ''}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[1] ?? ''}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl, 'text-right')}>
              {label('_summa')}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl)}>
              {label('_soderzhanie')}
            </th>
          </tr>
          {/* Ряды 2..N+1 — метки субконто/аналитики построчно, как в 1С. */}
          {rowDefs.map((rd, r) => (
            <tr
              key={r}
              className={r === rowDefs.length - 1 ? 'border-b border-ui-04' : undefined}
            >
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label('_accountDtCode')}
                </th>
              )}
              <th className={thBase}>{label(rd.subDt)}</th>
              <th className={thBase}>{rd.a1Dt ? label(rd.a1Dt) : ''}</th>
              <th className={thBase}>{rd.a2Dt ? label(rd.a2Dt) : ''}</th>
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label('_accountKtCode')}
                </th>
              )}
              <th className={thBase}>{label(rd.subKt)}</th>
              <th className={thBase}>{rd.a1Kt ? label(rd.a1Kt) : ''}</th>
              <th className={thBase}>{rd.a2Kt ? label(rd.a2Kt) : ''}</th>
            </tr>
          ))}
        </thead>
        {/* Каждая проводка — отдельный <tbody class="group"> для hover всего блока. */}
        {rows.map((row, idx) => (
          <tbody key={row.rowId} className="group">
            {rowDefs.map((rd, r) => (
              <BlockRow
                key={r}
                row={row}
                rd={rd}
                first={r === 0}
                blockHeight={rowDefs.length}
                zebra={idx % 2 === 1}
                num={idx + 1}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

interface BlockRowProps {
  row: AccountingRow
  rd: BlockRowDef
  first: boolean
  blockHeight: number
  zebra: boolean
  num: number
}

const BlockRow = ({ row, rd, first, blockHeight, zebra, num }: BlockRowProps) => {
  const numeric = rd.a2Dt === '_kolichestvo' // строка с «Количество»
  const a2 = (key: string) =>
    key === '_kolichestvo' ? formatSum(row[key]) : resolveCellValue(row[key])

  return (
    <tr
      className={cn(
        zebra && 'bg-ui-02/40',
        'group-hover:bg-ui-07',
        first && 'border-t-2 border-ui-04',
      )}
    >
      {first && (
        <>
          <td rowSpan={blockHeight} className={cn(cellPad, 'text-center text-ui-06')}>
            {num}
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, 'whitespace-nowrap text-ui-06')}>
            <Typography variant="body2" noWrap className="text-ui-06">
              {resolveCellValue(row._period)}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {resolveCellValue(row._accountDtCode)}
            </Typography>
          </td>
        </>
      )}
      {/* Дебет: субконто / аналитика1 / аналитика2 */}
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={resolveCellValue(row[rd.subDt])} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a1Dt ? resolveCellValue(row[rd.a1Dt]) : ''} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a2Dt ? a2(rd.a2Dt) : ''} numeric={numeric} />
      </td>
      {first && (
        <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
          <Typography variant="body2" noWrap className="font-bold text-ui-06">
            {resolveCellValue(row._accountKtCode)}
          </Typography>
        </td>
      )}
      {/* Кредит: субконто / аналитика1 / аналитика2 */}
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={resolveCellValue(row[rd.subKt])} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a1Kt ? resolveCellValue(row[rd.a1Kt]) : ''} />
      </td>
      <td className={cn(cellPad, 'max-w-52')}>
        <Val value={rd.a2Kt ? a2(rd.a2Kt) : ''} numeric={numeric} />
      </td>
      {first && (
        <>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'text-right align-middle')}>
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {formatSum(row._summa)}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" className="text-ui-06">
              {resolveCellValue(row._soderzhanie)}
            </Typography>
          </td>
        </>
      )}
    </tr>
  )
}
