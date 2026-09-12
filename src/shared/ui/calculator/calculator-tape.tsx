import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { formatCalcNumber } from '@/shared/lib/calc/format-calc-number'
import type { CalculatorTapeEntry } from './use-calculator'

interface CalculatorTapeProps {
  entries: CalculatorTapeEntry[]
  decimals: number
  /** Дополнять ли хвостовыми нулями — как в поле с известной разрядностью. */
  pad: boolean
  onReuse: (value: number) => void
}

/**
 * Лента расчётов — то, чего нет в калькуляторе 1С: видно, из чего сложилась
 * сумма, и любой промежуточный итог можно вернуть в строку одним кликом.
 */
export const CalculatorTape: FC<CalculatorTapeProps> = ({
  entries,
  decimals,
  pad,
  onReuse,
}) => {
  const { t } = useTranslation()

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-1 border-t border-ui-03 pt-2">
      <Typography variant="body2" className="text-ui-05">
        {t('calculator.tape')}
      </Typography>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => {
            onReuse(entry.value)
          }}
          title={t('calculator.reuse')}
          className="flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-ui-02"
        >
          <Typography variant="body2" className="truncate text-ui-05">
            {entry.expression}
            {entry.note ? ` · ${t(`calculator.notes.${entry.note}`)}` : ''}
          </Typography>
          <Typography variant="body2" className="whitespace-nowrap text-ui-06">
            {formatCalcNumber(entry.value, decimals, pad)}
          </Typography>
        </button>
      ))}
    </div>
  )
}
