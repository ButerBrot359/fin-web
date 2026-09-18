import type { FC, KeyboardEvent } from 'react'
import { TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { formatCalcNumber } from '@/shared/lib/calc/format-calc-number'
import { Button } from '@/shared/ui/buttons'
import { CalculatorKeypad } from './calculator-keypad'
import { CalculatorTape } from './calculator-tape'
import { useCalculator } from './use-calculator'

/** Всё, что может встретиться в выражении: цифры, операции, скобки, проценты. */
const ALLOWED_RE = /^[\d\s\u00a0,.+\-*/():%x\u00d7\u00f7]*$/

export interface CalculatorPanelProps {
  /** Текущее значение поля — стартовое содержимое строки выражения. */
  initialExpression: string
  precision?: number
  onApply: (value: number) => void
  onCancel: () => void
}

export const CalculatorPanel: FC<CalculatorPanelProps> = ({
  initialExpression,
  precision,
  onApply,
  onCancel,
}) => {
  const { t } = useTranslation()
  const calc = useCalculator({ initialExpression, precision })

  const apply = () => {
    const value = calc.applyValue()
    if (value === null) return
    onApply(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      apply()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="flex w-[240px] flex-col gap-2 p-3">
      <TextField
        value={calc.expression}
        inputRef={calc.inputRef}
        autoFocus
        fullWidth
        placeholder={t('calculator.expression')}
        onChange={(e) => {
          if (ALLOWED_RE.test(e.target.value))
            calc.setExpression(e.target.value)
        }}
        onKeyDown={handleKeyDown}
        slotProps={{
          htmlInput: {
            inputMode: 'decimal',
            'aria-label': t('calculator.expression'),
          },
        }}
      />

      <div className="flex items-baseline justify-between gap-2">
        <Typography variant="body2" className="text-ui-05">
          {t('calculator.result')}
        </Typography>
        <Typography
          data-testid="calculator-result"
          className="truncate text-h3 text-ui-06"
        >
          {calc.result === null
            ? '—'
            : formatCalcNumber(
                calc.result,
                calc.decimals,
                precision !== undefined
              )}
        </Typography>
      </div>

      <CalculatorKeypad onInsert={calc.insert} onAction={calc.run} />

      <CalculatorTape
        entries={calc.tape}
        decimals={calc.decimals}
        pad={precision !== undefined}
        onReuse={calc.reuse}
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="tertiary" size="small" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          size="small"
          disabled={calc.applyValue() === null}
          onClick={apply}
        >
          {t('calculator.apply')}
        </Button>
      </div>
    </div>
  )
}
