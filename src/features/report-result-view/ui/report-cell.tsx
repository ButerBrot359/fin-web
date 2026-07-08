import { Typography } from '@mui/material'

import { formatDate } from '@/shared/lib/utils/date'

import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import {
  DATA_FS,
  GREEN_1C,
  HEAD_FS,
  formatMoney1C,
  isMeasure,
  isRightAligned,
  safeString,
  toNum,
} from '../lib/cell-helpers'

/** Подпись подстроки-показателя «Кол.» — форматируем количеством (3 знака). */
const SUB_LABEL_KOLICHESTVO = 'Кол.'

/**
 * Значение PERIOD-колонки: ISO-строка → 1С-формат по `col.format`
 * (`dd.MM.yyyy`, с временем — если формат содержит часы).
 */
const formatPeriodValue = (raw: string, col: ReportColumnDto): string => {
  const pattern = col.format?.includes('HH')
    ? 'dd.MM.yyyy HH:mm:ss'
    : 'dd.MM.yyyy'
  return formatDate(raw, pattern) || raw
}

/** Стиль текста 1С: данные — #333/11px, выделенные строки — зелёный жирный/13px. */
const textStyle = (highlight?: boolean, negative?: boolean) => ({
  color: negative ? 'rgb(255,0,0)' : highlight ? GREEN_1C : '#333',
  fontWeight: highlight ? 700 : 400,
  fontSize: highlight ? HEAD_FS : DATA_FS,
  lineHeight: 1.3,
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
    // Нулевое сальдо 1С показывает без буквы — просто «0,00» (сальдо на начало).
    text =
      value === 0
        ? formatMoney1C(0, decimals)
        : `${value < 0 ? 'К' : 'Д'} ${formatMoney1C(Math.abs(value), decimals)}`
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

  let text = safeString(value)
  if (!text) return null
  if (col.role === 'PERIOD' && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    text = formatPeriodValue(text, col)
  }
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
