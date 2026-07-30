import type { FC } from 'react'
import { Checkbox, MenuItem, Select } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

import { TextInput, NumberInput } from '@/shared/ui/inputs'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { ReferenceCellEditor } from './reference-cell-editor'
import { DateCellEditor } from './date-cell-editor'

interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  props?: Record<string, unknown>
  onChange: (value: unknown) => void
  onCommit: () => void
}

interface EnumOption {
  value: string
  label: string
  id?: number
  code?: string
}

/** Текущее значение enum-ячейки → строковый `value` опции для <Select>. */
function resolveEnumValue(value: unknown, options: EnumOption[]): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { id?: unknown; code?: unknown }
    const match = options.find(
      (o) =>
        (v.id != null && o.id === v.id) || (v.code != null && o.code === v.code)
    )
    return match?.value ?? ''
  }
  return ''
}

const cellSx: SxProps<Theme> = {
  mb: 0,
  position: 'static',
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
  },
  '& .MuiInputBase-input': {
    padding: '4px 8px !important',
    fontSize: '14px !important',
  },
}

const enumCellSx: SxProps<Theme> = {
  fontSize: '14px',
  '&::before, &::after': { display: 'none' },
  '& .MuiSelect-select': {
    padding: '4px 8px !important',
    minHeight: '28px',
    display: 'flex',
    alignItems: 'center',
  },
}

const dateCellSx: SxProps<Theme> = {
  '& .MuiFormControl-root': { mb: 0, position: 'static', width: '100%' },
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 !important',
  },
  '& .MuiPickersInputBase-root': {
    position: 'relative',
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiPickersInputBase-sectionsContainer': {
    padding: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    fontSize: '14px !important',
  },
  '& .MuiInputAdornment-root': {
    width: 0,
    overflow: 'visible',
    ml: 0,
    transform: 'translateX(-24px)',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': { p: '2px' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
}

/**
 * `unknown` → строка для показа. Явный разбор примитивов вместо `String(value)`:
 * на объекте `String()` дал бы «[object Object]» (правило no-base-to-string), а
 * ссылочные значения `{id, presentation}` умеет разворачивать renderCellValue.
 */
function toDisplayString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return renderCellValue(value)
}

function formatReadonlyValue(value: unknown, dataType: string): string {
  if (value == null || value === '') return ''
  // Ссылочные/enum значения {id, presentation} — показываем presentation
  if (typeof value === 'object' && 'presentation' in value) {
    return renderCellValue(value)
  }
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return toDisplayString(value)
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(toDisplayString(value))
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : ''
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : ''
    case 'BOOLEAN':
      // Явное сравнение, а не проверка на «истинность» unknown: у BOOLEAN-колонки
      // на проводе приезжает boolean (или его строковая форма), а для unknown
      // no-unnecessary-condition считает любое значение истинным.
      return value === true || value === 'true' ? '✓' : ''
    default:
      return renderCellValue(value)
  }
}

export const TableCellEditor: FC<TableCellEditorProps> = ({
  cellWidget,
  dataType,
  value,
  readonly,
  props,
  onChange,
  onCommit,
}) => {
  if (readonly) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
        {formatReadonlyValue(value, dataType)}
      </span>
    )
  }

  switch (cellWidget) {
    case 'TEXT_FIELD': {
      const strValue = toDisplayString(value)
      return (
        <TextInput
          value={strValue}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
          }}
          size="small"
          sx={cellSx}
        />
      )
    }

    case 'NUMBER_FIELD': {
      const strValue = toDisplayString(value)
      return (
        <NumberInput
          value={strValue}
          decimal={dataType === 'DECIMAL'}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = raw === '' ? null : parseFloat(raw)
            onChange(parsed)
          }}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
          }}
          size="small"
          sx={cellSx}
        />
      )
    }

    case 'DATE_FIELD':
    case 'DATETIME_FIELD':
      // Коммит НЕ на onChange: пикер стреляет на каждый сегмент даты, и коммит
      // посреди набора перемонтировал ячейку — терялись цифры года (SCRUM-279 D6).
      // Подробный разбор и ловушки фокуса — в date-cell-editor.tsx.
      return (
        <DateCellEditor
          value={value}
          dateOnly={cellWidget === 'DATE_FIELD'}
          sx={dateCellSx}
          onChange={onChange}
          onCommit={onCommit}
        />
      )

    case 'CHECKBOX_FIELD': {
      return (
        <Checkbox
          checked={!!value}
          onChange={(e) => {
            onChange(e.target.checked)
            onCommit()
          }}
          size="small"
          sx={{ p: '2px' }}
        />
      )
    }

    case 'ENUM_FIELD': {
      const options = (props?.options as EnumOption[] | undefined) ?? []
      const current = resolveEnumValue(value, options)
      return (
        <Select
          value={current}
          onChange={(e) => {
            const selected = e.target.value
            const opt = options.find((o) => o.value === selected)
            // Тот же контракт значения, что в enum-field-node.tsx
            onChange(
              opt
                ? {
                    id: opt.id ?? selected,
                    code: opt.code ?? opt.value,
                    presentation: opt.label,
                  }
                : { id: selected, code: selected, presentation: selected }
            )
            onCommit()
          }}
          size="small"
          fullWidth
          variant="standard"
          sx={enumCellSx}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      )
    }

    case 'REFERENCE_FIELD':
      return (
        <ReferenceCellEditor
          colProps={props ?? {}}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
        />
      )

    default:
      return (
        <span style={{ padding: '4px 8px', fontSize: 14 }}>
          {renderCellValue(value)}
        </span>
      )
  }
}
