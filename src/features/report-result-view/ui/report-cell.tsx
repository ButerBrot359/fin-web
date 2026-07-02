import { Typography } from '@mui/material'

import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import {
  GREEN_1C,
  formatMoney1C,
  isMeasure,
  isRightAligned,
  safeString,
  toNum,
} from '../lib/cell-helpers'

/** Подпись подстроки-показателя «Кол.» — форматируем количеством (3 знака). */
const SUB_LABEL_KOLICHESTVO = 'Кол.'

/** Стиль текста 1С: данные — #333, выделенные строки — зелёный жирный. */
const textStyle = (highlight?: boolean, negative?: boolean) => ({
  color: negative ? 'rgb(255,0,0)' : highlight ? GREEN_1C : '#333',
  fontWeight: highlight ? 700 : 400,
})

/**
 * Денежная (MEASURE) ячейка 1С-формата: фиксированные десятичные знаки
 * (2 для сумм, 3 для количества), разряды пробелами, выравнивание вправо,
 * tabular-nums. `negativeRed` ⇒ красным при <0; `blankOnZero` ⇒ пусто при 0;
 * `dcIndicator` ⇒ «Д <abs>» / «К <abs>» (признак сальдо как в 1С).
 */
export const MoneyCell = ({
  value,
  negativeRed,
  blankOnZero,
  bold,
  dcIndicator,
  decimals = 2,
}: {
  value: number
  negativeRed?: boolean
  blankOnZero?: boolean
  bold?: boolean
  dcIndicator?: boolean
  decimals?: number
}) => {
  if (value === 0 && blankOnZero) {
    return null
  }
  let text: string
  let isNeg = false
  if (dcIndicator) {
    // Признак Д/К вместо знака: дебетовое (≥0) / кредитовое (<0) сальдо.
    text = `${value < 0 ? 'К' : 'Д'} ${formatMoney1C(Math.abs(value), decimals)}`
  } else {
    text = formatMoney1C(value, decimals)
    isNeg = !!negativeRed && value < 0
  }
  return (
    <Typography
      variant="body2"
      noWrap
      className="text-right tabular-nums"
      sx={textStyle(bold, isNeg)}
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
      <Typography key={i} variant="body2" sx={textStyle(bold)}>
        {it}
      </Typography>
    ))}
  </div>
)

interface ReportCellProps {
  value: unknown
  col: ReportColumnDto
  /** 1С-выделение (строка-итог/сальдо/группа): жирный тёмно-зелёный. */
  bold?: boolean
  /**
   * Подписи подстрок-показателей этой строки (значение колонки «Показатель»):
   * элемент массива MEASURE-ячейки с подписью «Кол.» форматируется тремя
   * десятичными знаками, остальные — двумя.
   */
  subLabels?: string[]
}

/**
 * Универсальный рендер ячейки по метаданным колонки:
 * - массив в MEASURE ⇒ стопка денежных подстрок (Сумма/Кол. как в 1С);
 * - массив в остальных ⇒ стопка строк (AnalyticsCell);
 * - MEASURE ⇒ денежный 1С-формат (negativeRed/blankOnZero/dcIndicator);
 * - остальное ⇒ обычный текст (выравнивание по `align`/роли).
 */
export const ReportCell = ({
  value,
  col,
  bold,
  subLabels,
}: ReportCellProps) => {
  if (Array.isArray(value)) {
    if (isMeasure(col)) {
      return (
        <div className="flex flex-col gap-0.5">
          {value.map((v, i) => {
            const n = toNum(v)
            if (n == null) {
              // Пустая подстрока (нет значения показателя) — держит высоту.
              return (
                <Typography key={i} variant="body2">
                  &nbsp;
                </Typography>
              )
            }
            return (
              <MoneyCell
                key={i}
                value={n}
                negativeRed={col.negativeRed}
                blankOnZero={col.blankOnZero}
                bold={bold}
                dcIndicator={col.dcIndicator}
                decimals={subLabels?.[i] === SUB_LABEL_KOLICHESTVO ? 3 : 2}
              />
            )
          })}
        </div>
      )
    }
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
          className="text-right tabular-nums"
          sx={textStyle(bold)}
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
        dcIndicator={col.dcIndicator}
      />
    )
  }

  const text = safeString(value)
  if (!text) return null
  return (
    <Typography
      variant="body2"
      noWrap={!bold}
      className={isRightAligned(col) ? 'text-right' : ''}
      sx={textStyle(bold)}
    >
      {text}
    </Typography>
  )
}
