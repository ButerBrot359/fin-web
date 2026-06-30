import { Typography } from '@mui/material'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import {
  isMeasure,
  isRightAligned,
  safeString,
  toNum,
} from '../lib/cell-helpers'

/**
 * Денежная (MEASURE) ячейка: разряды пробелами, выравнивание вправо,
 * tabular-nums. `negativeRed` ⇒ красным при <0; `blankOnZero` ⇒ пусто при 0;
 * `bold` ⇒ жирным (итоги/сальдо).
 */
export const MoneyCell = ({
  value,
  negativeRed,
  blankOnZero,
  bold,
}: {
  value: number
  negativeRed?: boolean
  blankOnZero?: boolean
  bold?: boolean
}) => {
  const text = value === 0 && blankOnZero ? '' : formatWithSpaces(String(value))
  const isNeg = negativeRed && value < 0
  return (
    <Typography
      variant="body2"
      noWrap
      className={`text-right tabular-nums ${
        isNeg ? 'text-support-01' : 'text-ui-06'
      } ${bold ? 'font-bold' : ''}`}
    >
      {text}
    </Typography>
  )
}

/** Многострочная ячейка аналитики: каждая строка массива — отдельная линия. */
export const AnalyticsCell = ({
  items,
  bold,
}: {
  items: string[]
  bold?: boolean
}) => (
  <div className="flex flex-col gap-0.5">
    {items.map((it, i) => (
      <Typography
        key={i}
        variant="body2"
        className={`text-ui-06 ${bold ? 'font-bold' : ''}`}
      >
        {it}
      </Typography>
    ))}
  </div>
)

interface ReportCellProps {
  value: unknown
  col: ReportColumnDto
  /** Жирный шрифт (строка-итог/сальдо/группа). */
  bold?: boolean
}

/**
 * Универсальный рендер ячейки по метаданным колонки:
 * - массив значений ⇒ стопка строк (AnalyticsCell);
 * - MEASURE ⇒ денежный формат (negativeRed/blankOnZero);
 * - остальное ⇒ обычный текст (выравнивание по `align`/роли).
 */
export const ReportCell = ({ value, col, bold }: ReportCellProps) => {
  if (Array.isArray(value)) {
    return <AnalyticsCell items={value.map((v) => safeString(v))} bold={bold} />
  }

  if (isMeasure(col)) {
    const n = toNum(value)
    if (n == null) {
      // Не числовое значение в MEASURE-колонке — показываем как текст.
      const text = safeString(value)
      if (!text) return null
      return (
        <Typography
          variant="body2"
          noWrap
          className={`text-right tabular-nums text-ui-06 ${
            bold ? 'font-bold' : ''
          }`}
        >
          {text}
        </Typography>
      )
    }
    return (
      <MoneyCell
        value={n}
        negativeRed={col.negativeRed}
        blankOnZero={col.blankOnZero}
        bold={bold}
      />
    )
  }

  const text = safeString(value)
  if (!text) return null
  return (
    <Typography
      variant="body2"
      noWrap
      className={`text-ui-06 ${isRightAligned(col) ? 'text-right' : ''} ${
        bold ? 'font-bold' : ''
      }`}
    >
      {text}
    </Typography>
  )
}
