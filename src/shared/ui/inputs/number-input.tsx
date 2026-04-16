import { useLayoutEffect, useRef } from 'react'
import {
  TextField,
  Tooltip,
  type TextFieldProps,
  IconButton,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

type NumberInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
  decimal?: boolean
}

const formatWithSpaces = (raw: string): string => {
  if (!raw) return ''

  const normalized = raw.replace('.', ',')
  const negative = normalized.startsWith('-')
  const withoutMinus = negative ? normalized.slice(1) : normalized

  const commaIdx = withoutMinus.indexOf(',')
  const intPart = commaIdx >= 0 ? withoutMinus.slice(0, commaIdx) : withoutMinus
  const decPart = commaIdx >= 0 ? withoutMinus.slice(commaIdx) : ''

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (negative ? '-' : '') + formattedInt + decPart
}

const stripSpaces = (str: string): string => str.replace(/\s/g, '')

export const NumberInput = ({
  readOnly,
  decimal,
  onChange,
  slotProps,
  value,
  inputRef: externalInputRef,
  ...rest
}: NumberInputProps) => {
  const inputElRef = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)

  const rawValue =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : ''
  const displayValue = formatWithSpaces(rawValue)

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
    let raw = stripSpaces(typed)

    // Replace solitary "0" when user types another digit next to it: "05" | "50" -> "5"
    let cursorToEnd = false
    if (rawValue === '0' && /^\d{2}$/.test(raw)) {
      raw = raw.replace('0', '') || '0'
      cursorToEnd = true
    }

    if (decimal) {
      if (raw !== '' && !/^-?(?:0|[1-9]\d*)?(?:[,.]\d*)?$/.test(raw)) return
    } else {
      if (raw !== '' && !/^-?(?:0|[1-9]\d*)?$/.test(raw)) return
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

    input.value = raw
    onChange?.(e)
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
        inputRef={setInputRef}
        slotProps={{
          ...slotProps,
          input: {
            ...(slotProps?.input as object),
            readOnly,
            sx: { paddingRight: '4px' },
            endAdornment: (
              <IconButton sx={{ p: '4px', borderRadius: '6px' }} tabIndex={-1}>
                <ArrowDropDownIcon
                  className="text-ui-05"
                  sx={{ fontSize: 20 }}
                />
              </IconButton>
            ),
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
