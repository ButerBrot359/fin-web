import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'
import type { CalculatorAction } from './use-calculator'

type KeySpec =
  | { kind: 'insert'; text: string; label: string; tone?: KeyTone }
  | { kind: 'action'; action: CalculatorAction; label: string; tone?: KeyTone }

type KeyTone = 'digit' | 'op' | 'equals' | 'danger'

const ROWS: KeySpec[][] = [
  [
    { kind: 'action', action: 'clear', label: 'C', tone: 'danger' },
    { kind: 'action', action: 'clearEntry', label: 'CE', tone: 'danger' },
    { kind: 'action', action: 'backspace', label: '⌫', tone: 'danger' },
    { kind: 'insert', text: '/', label: '÷', tone: 'op' },
  ],
  [
    { kind: 'insert', text: '7', label: '7', tone: 'digit' },
    { kind: 'insert', text: '8', label: '8', tone: 'digit' },
    { kind: 'insert', text: '9', label: '9', tone: 'digit' },
    { kind: 'insert', text: '*', label: '×', tone: 'op' },
  ],
  [
    { kind: 'insert', text: '4', label: '4', tone: 'digit' },
    { kind: 'insert', text: '5', label: '5', tone: 'digit' },
    { kind: 'insert', text: '6', label: '6', tone: 'digit' },
    { kind: 'insert', text: '-', label: '−', tone: 'op' },
  ],
  [
    { kind: 'insert', text: '1', label: '1', tone: 'digit' },
    { kind: 'insert', text: '2', label: '2', tone: 'digit' },
    { kind: 'insert', text: '3', label: '3', tone: 'digit' },
    { kind: 'insert', text: '+', label: '+', tone: 'op' },
  ],
  [
    { kind: 'insert', text: '0', label: '0', tone: 'digit' },
    { kind: 'insert', text: '00', label: '00', tone: 'digit' },
    { kind: 'insert', text: ',', label: ',', tone: 'digit' },
    { kind: 'action', action: 'equals', label: '=', tone: 'equals' },
  ],
]

const EXTRA_ROW: KeySpec[] = [
  { kind: 'insert', text: '(', label: '(', tone: 'op' },
  { kind: 'insert', text: ')', label: ')', tone: 'op' },
  { kind: 'insert', text: '%', label: '%', tone: 'op' },
  { kind: 'action', action: 'negate', label: '±', tone: 'op' },
]

const toneClasses: Record<KeyTone, string> = {
  digit: 'bg-ui-02 text-ui-06 hover:bg-ui-04',
  op: 'bg-ui-07 text-accent-02 hover:bg-ui-08',
  equals: 'bg-accent-01 text-ui-06 hover:bg-accent-01-hover',
  danger: 'bg-ui-02 text-support-01 hover:bg-ui-04',
}

type AriaKey = 'clear' | 'clearEntry' | 'backspace' | 'equals' | 'negate'

/** Подсказка о клавише в тултипе/скринридере — по метке из `calculator.keys`. */
const ariaKeys: Partial<Record<CalculatorAction, AriaKey>> = {
  clear: 'clear',
  clearEntry: 'clearEntry',
  backspace: 'backspace',
  equals: 'equals',
  negate: 'negate',
}

interface CalculatorKeypadProps {
  onInsert: (text: string) => void
  onAction: (action: CalculatorAction) => void
}

export const CalculatorKeypad: FC<CalculatorKeypadProps> = ({
  onInsert,
  onAction,
}) => {
  const { t } = useTranslation()

  const renderKey = (key: KeySpec, index: number) => {
    const ariaKey = key.kind === 'action' ? ariaKeys[key.action] : undefined

    return (
      <Button
        key={`${key.label}-${String(index)}`}
        variant="secondary"
        onClick={() => {
          if (key.kind === 'insert') onInsert(key.text)
          else onAction(key.action)
        }}
        aria-label={ariaKey ? t(`calculator.keys.${ariaKey}`) : key.label}
        className={cn(
          'h-10 justify-center px-0 font-medium',
          toneClasses[key.tone ?? 'digit']
        )}
      >
        {key.label}
      </Button>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {EXTRA_ROW.map(renderKey)}
      {ROWS.flatMap((row, rowIndex) =>
        row.map((key, index) => renderKey(key, rowIndex * 10 + index))
      )}
    </div>
  )
}
