import { useLayoutEffect, useRef, useState } from 'react'
import { TextField, Tooltip, type TextFieldProps } from '@mui/material'

type NumberInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
  decimal?: boolean
  /**
   * Разрядность с бэка (`props.precision`): сколько знаков после запятой
   * показывать, когда поле не редактируется. В эталоне 1С значения стоят с
   * хвостовыми нулями — «Ставка» 1,500, «Тарифный коэффициент» 1,02, пустое
   * числовое поле 0,00.
   */
  precision?: number
}

/**
 * Физический предел хранилища: значения лежат в `NUMERIC(19,4)`, всё сверх
 * четвёртого знака Postgres округляет. Ограничение действует ВСЕГДА, даже когда
 * `precision` не пришёл: разрядность в метаданных заполнена пока не везде, а
 * потерять знак можно уже сейчас (согласовано с бэком 21.08.2026).
 */
const STORAGE_MAX_DECIMALS = 4

/** Сколько знаков после разделителя в тексте. */
const decimalsOf = (text: string): number => {
  const dotIdx = text.replace(',', '.').indexOf('.')
  return dotIdx >= 0 ? text.length - dotIdx - 1 : 0
}

/**
 * Дополнение хвостовыми нулями до `precision`.
 *
 * ТОЛЬКО дополняет и никогда не обрезает. Ввод сверх разрядности мы теперь не
 * пропускаем, но значение может прийти извне — из API, ввода на основании или
 * импорта. Обрезка на показе означала бы поле с 1.23 при 1.2346 в базе —
 * расхождение молча и в худшую сторону, поэтому лишние знаки показываем как
 * есть (сервер нормализует их своим патчем).
 */
const padDecimals = (text: string, precision: number): string => {
  if (!text || precision <= 0) return text
  const normalized = text.replace(',', '.')
  if (!/^-?\d*(?:\.\d*)?$/.test(normalized)) return text

  const dotIdx = normalized.indexOf('.')
  const decimals = dotIdx >= 0 ? normalized.length - dotIdx - 1 : 0
  if (decimals >= precision) return normalized

  const withDot = dotIdx >= 0 ? normalized : normalized + '.'
  return withDot + '0'.repeat(precision - decimals)
}

const formatWithSpaces = (raw: string): string => {
  if (!raw) return ''

  const normalized = raw.replace(',', '.')
  const negative = normalized.startsWith('-')
  const withoutMinus = negative ? normalized.slice(1) : normalized

  const dotIdx = withoutMinus.indexOf('.')
  const intPart = dotIdx >= 0 ? withoutMinus.slice(0, dotIdx) : withoutMinus
  const decPart = dotIdx >= 0 ? withoutMinus.slice(dotIdx) : ''

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (negative ? '-' : '') + formattedInt + decPart
}

const stripSpaces = (str: string): string => str.replace(/\s/g, '')

export const NumberInput = ({
  readOnly,
  decimal,
  precision,
  onChange,
  onFocus,
  onBlur,
  slotProps,
  value,
  inputRef: externalInputRef,
  ...rest
}: NumberInputProps) => {
  const inputElRef = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)
  /**
   * Текст в процессе набора. Без него поле нельзя набрать по-человечески:
   * владелец хранит ЧИСЛО, поэтому промежуточные состояния до него не доживают.
   * «1,02» набиралось так: «1» → 1, «,» → parseFloat("1.") = 1 → владелец снова
   * отдаёт "1", запятая пропадает, следующие цифры дописываются к целому — на
   * экране 102 вместо 1,02 (репорт 20.08.2026, эталон 1С: 1,02). По той же
   * причине не доживали «1,10» (хвостовой ноль) и промежуточное «1.0» при
   * стирании.
   *
   * `null` — «не редактируем», показываем значение владельца. Черновик живёт до
   * blur: владельцу на каждый символ по-прежнему уходит разобранное число.
   */
  const [draft, setDraft] = useState<string | null>(null)

  const valueText =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : ''
  const rawValue = draft ?? valueText
  // Пока идёт набор, показываем ровно набранное: дополнять нулями на каждый
  // символ значило бы дописывать их пользователю под курсор. Хвостовые нули
  // появляются, когда поле отпущено (draft снят на blur).
  const displayValue = formatWithSpaces(
    draft !== null || precision === undefined
      ? rawValue
      : padDecimals(rawValue, precision)
  )

  /**
   * Дробную часть разрешаем и тогда, когда её не объявляли пропом, но она уже
   * есть в значении. Иначе поле показывает 1.02 и не даёт стереть ни символа:
   * каждое промежуточное состояние («1.0», «1.») не проходит целочисленную
   * проверку ниже, и удалить можно было только выделив всё целиком.
   */
  const allowDecimal = decimal === true || /[.,]/.test(rawValue)
  const maxDecimals = Math.min(
    precision ?? STORAGE_MAX_DECIMALS,
    STORAGE_MAX_DECIMALS
  )

  useLayoutEffect(() => {
    if (cursorRef.current !== null && inputElRef.current) {
      inputElRef.current.setSelectionRange(cursorRef.current, cursorRef.current)
      cursorRef.current = null
    }
  })

  const setInputRef = (node: HTMLInputElement | null) => {
    inputElRef.current = node
    if (typeof externalInputRef === 'function') {
      ;(externalInputRef as (instance: HTMLInputElement | null) => void)(node)
    }
  }

  const handleChange: TextFieldProps['onChange'] = (e) => {
    const input = e.target as HTMLInputElement
    const pos = input.selectionStart ?? 0
    const typed = input.value
    let raw = stripSpaces(typed).replace(',', '.')

    // Дефолтный «0» не «прилипает». Набор одной цифры рядом с 0: "05" | "50" -> "5".
    // Вставка (Ctrl+V) многозначного числа в «0» (каретка в конце): "012345" -> "12345"
    // — иначе значение отбраковывалось регэкспом ниже и вставка «не срабатывала».
    let cursorToEnd = false
    if (rawValue === '0' && /^\d{2}$/.test(raw)) {
      raw = raw.replace('0', '') || '0'
      cursorToEnd = true
    } else if (rawValue === '0' && /^0\d+$/.test(raw)) {
      raw = raw.replace(/^0+/, '') || '0'
      cursorToEnd = true
    }

    if (allowDecimal) {
      if (raw !== '' && !/^-?(?:0|[1-9]\d*)?(?:[,.]\d*)?$/.test(raw)) return
    } else {
      if (raw !== '' && !/^-?(?:0|[1-9]\d*)?$/.test(raw)) return
    }

    // Предел разрядности: по `precision`, где бэк его прислал, и потолок
    // хранилища во всех остальных случаях. Условие «и стало больше, чем было»
    // обязательно — иначе значение, пришедшее извне с лишними знаками, нельзя
    // было бы даже стереть: каждое промежуточное состояние упиралось бы в тот
    // же предел (та же ловушка, что была с дробными в целочисленном поле).
    const nextDecimals = decimalsOf(raw)
    if (
      nextDecimals > maxDecimals &&
      nextDecimals > decimalsOf(stripSpaces(rawValue))
    ) {
      return
    }

    const formatted = formatWithSpaces(raw)
    let newCursor = 0

    if (cursorToEnd) {
      newCursor = formatted.length
    } else {
      let charsBefore = 0
      for (let i = 0; i < pos; i++) {
        if (typed[i] !== ' ') charsBefore++
      }

      let count = 0
      for (let i = 0; i < formatted.length; i++) {
        if (count >= charsBefore) break
        newCursor = i + 1
        if (formatted[i] !== ' ') count++
      }
      if (charsBefore === 0) newCursor = 0
    }

    cursorRef.current = newCursor

    // Черновик — то, что видит пользователь; владельцу уходит `raw` для разбора
    // в число. Расходятся они ровно на незавершённых состояниях («1,», «1,10»).
    setDraft(raw)
    input.value = raw
    onChange?.(e)
  }

  // Дефолтный «0» ведёт себя как пустое поле (как в 1С): при фокусе выделяется
  // целиком, поэтому ввод ИЛИ вставка (Ctrl+V) заменяют его без ручного удаления.
  const handleFocus: TextFieldProps['onFocus'] = (e) => {
    if (rawValue === '0') {
      ;(e.target as HTMLInputElement).select()
    }
    onFocus?.(e)
  }

  // Набор закончен — показываем каноничное значение владельца (уже разобранное
  // и, возможно, пересчитанное сервером), черновик больше не нужен.
  const handleBlur: TextFieldProps['onBlur'] = (e) => {
    setDraft(null)
    onBlur?.(e)
  }

  return (
    <Tooltip
      title={displayValue}
      enterDelay={700}
      placement="bottom-start"
      disableInteractive
      slotProps={{
        popper: {
          modifiers: [{ name: 'offset', options: { offset: [0, -8] } }],
        },
        tooltip: { sx: { maxWidth: 500 } },
      }}
    >
      <TextField
        value={displayValue}
        {...rest}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        inputRef={setInputRef}
        slotProps={{
          ...slotProps,
          input: {
            ...(slotProps?.input as object),
            readOnly,
          },
          htmlInput: {
            ...(slotProps?.htmlInput as object),
            inputMode: decimal ? 'decimal' : 'numeric',
          },
        }}
      />
    </Tooltip>
  )
}
