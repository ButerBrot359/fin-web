import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import {
  type AccountingRow,
  type BlockRowDef,
  type SemanticBindings,
  formatSum,
  resolveCellValue,
} from './accounting-block-logic'

// Строка блока проводки журнала бухрегистра. Вынесено из
// accounting-postings-block.tsx (декомпозиция, перенос 1:1): раскладка блока —
// см. комментарий там.

const cellPad = 'px-3 py-1.5 align-top'
export const bl = 'border-l border-ui-04'

const Val = ({ value, numeric }: { value: string; numeric?: boolean }) => (
  <Typography
    variant="body2"
    noWrap
    className={cn('truncate text-ui-06', numeric && 'text-right tabular-nums')}
  >
    {value}
  </Typography>
)

interface BlockRowProps {
  row: AccountingRow
  rd: BlockRowDef
  semantic: SemanticBindings
  first: boolean
  blockHeight: number
  zebra: boolean
  num: number
}

export const BlockRow = ({
  row,
  rd,
  semantic,
  first,
  blockHeight,
  zebra,
  num,
}: BlockRowProps) => {
  // SCRUM-362 B-3: одна колонка на обеих сторонах (роль block: без стороны) —
  // это «Количество»: рисуется числом с разрядами, а не презентацией ссылки.
  const shared = rd.a2Dt !== '' && rd.a2Dt === rd.a2Kt
  const numeric = shared
  const a2 = (key: string) =>
    shared && key === rd.a2Dt ? formatSum(row[key]) : resolveCellValue(row[key])
  const semanticValue = (binding: string | undefined): unknown =>
    binding ? row[binding] : undefined

  return (
    <tr
      className={cn(
        zebra && 'bg-ui-02/40',
        'group-hover:bg-ui-07',
        first && 'border-t-2 border-ui-04'
      )}
    >
      {first && (
        <>
          <td
            rowSpan={blockHeight}
            className={cn(cellPad, 'text-center text-ui-06')}
          >
            {num}
          </td>
          <td
            rowSpan={blockHeight}
            className={cn(cellPad, 'whitespace-nowrap text-ui-06')}
          >
            <Typography variant="body2" noWrap className="text-ui-06">
              {resolveCellValue(semanticValue(semantic.period))}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {resolveCellValue(semanticValue(semantic.accountDt))}
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
            {resolveCellValue(semanticValue(semantic.accountKt))}
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
          <td
            rowSpan={blockHeight}
            className={cn(cellPad, bl, 'text-right align-middle')}
          >
            <Typography variant="body2" noWrap className="font-bold text-ui-06">
              {formatSum(semanticValue(semantic.sum))}
            </Typography>
          </td>
          <td rowSpan={blockHeight} className={cn(cellPad, bl, 'align-middle')}>
            <Typography variant="body2" className="text-ui-06">
              {resolveCellValue(semanticValue(semantic.content))}
            </Typography>
          </td>
        </>
      )}
    </tr>
  )
}
