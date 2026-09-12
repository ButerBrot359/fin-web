import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  evaluateExpression,
  roundTo,
} from '@/shared/lib/calc/evaluate-expression'
import { formatCalcNumber } from '@/shared/lib/calc/format-calc-number'

/** Ставка НДС РК. Одно место на весь калькулятор — меняется реформой, не кодом формы. */
export const VAT_RATE = 12

const TAPE_LIMIT = 3

/** Разрядность по умолчанию, когда бэк не прислал `precision`: потолок NUMERIC(19,4). */
const DEFAULT_DECIMALS = 4

export type CalculatorAction =
  | 'clear'
  | 'clearEntry'
  | 'backspace'
  | 'equals'
  | 'negate'
  | 'vatAdd'
  | 'vatSubtract'
  | 'vatExtract'

/** Пометка о том, каким действием получено значение — подпись в ленте. */
export type CalculatorNote = 'negate' | 'vatAdd' | 'vatSubtract' | 'vatExtract'

export interface CalculatorTapeEntry {
  id: number
  expression: string
  value: number
  note?: CalculatorNote
}

interface UseCalculatorOptions {
  /** Значение поля на момент открытия — с него начинается расчёт. */
  initialExpression: string
  precision?: number
}

const TRAILING_NUMBER_RE = /[\d\s\u00a0,.]+$/

export const useCalculator = ({
  initialExpression,
  precision,
}: UseCalculatorOptions) => {
  const decimals = precision ?? DEFAULT_DECIMALS
  const [expression, setExpression] = useState(initialExpression)
  const [tape, setTape] = useState<CalculatorTapeEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const tapeIdRef = useRef(0)

  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  })

  const { value: result, error } = useMemo(
    () => evaluateExpression(expression),
    [expression]
  )

  const replaceAll = (next: string) => {
    setExpression(next)
    caretRef.current = next.length
  }

  /** Результат становится новым операндом, а пройденный путь уходит в ленту. */
  const commit = (value: number, note?: CalculatorNote) => {
    if (!Number.isFinite(value)) return

    tapeIdRef.current += 1
    const entry: CalculatorTapeEntry = {
      id: tapeIdRef.current,
      expression,
      value: roundTo(value, decimals),
      note,
    }
    setTape((prev) => [entry, ...prev].slice(0, TAPE_LIMIT))
    replaceAll(formatCalcNumber(value, decimals, false))
  }

  const insert = (text: string) => {
    const input = inputRef.current
    const start = input?.selectionStart ?? expression.length
    const end = input?.selectionEnd ?? expression.length
    const next = expression.slice(0, start) + text + expression.slice(end)

    setExpression(next)
    caretRef.current = start + text.length
  }

  const backspace = () => {
    const input = inputRef.current
    const start = input?.selectionStart ?? expression.length
    const end = input?.selectionEnd ?? expression.length

    if (start !== end) {
      setExpression(expression.slice(0, start) + expression.slice(end))
      caretRef.current = start
      return
    }
    if (start === 0) return

    setExpression(expression.slice(0, start - 1) + expression.slice(start))
    caretRef.current = start - 1
  }

  const run = (action: CalculatorAction) => {
    switch (action) {
      case 'clear':
        replaceAll('')
        return
      case 'clearEntry':
        // CE как в 1С — снимает набранное число, оставляя выражение до него.
        replaceAll(expression.replace(TRAILING_NUMBER_RE, ''))
        return
      case 'backspace':
        backspace()
        return
      case 'equals':
        if (result !== null) commit(result)
        return
      case 'negate':
        if (result !== null) commit(-result, 'negate')
        return
      case 'vatAdd':
        if (result !== null) commit(result * (1 + VAT_RATE / 100), 'vatAdd')
        return
      case 'vatSubtract':
        if (result !== null)
          commit(result / (1 + VAT_RATE / 100), 'vatSubtract')
        return
      case 'vatExtract':
        if (result !== null) {
          commit(result - result / (1 + VAT_RATE / 100), 'vatExtract')
        }
        return
    }
  }

  const applyValue = (): number | null =>
    result === null ? null : roundTo(result, decimals)

  return {
    expression,
    setExpression,
    inputRef,
    result,
    error,
    decimals,
    tape,
    insert,
    run,
    applyValue,
    reuse: (value: number) => {
      replaceAll(formatCalcNumber(value, decimals, false))
    },
  }
}
