import { useState, type FC } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { renderCellValue } from '../../../lib/utils/cell-value'

// Тот же legacy-фолбэк, что в ReferenceFieldNode (двухветочный источник,
// отклонение D-2 ревизии SDUI): приоритет optionsSource с бэка.
const DOMAIN_PATH_MAP: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}

interface ReferenceCellEditorProps {
  colProps: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
  onCommit: () => void
}

// Компактная стилизация под ячейку ТЧ — по образцу cellSx/dateCellSx
// из table-cell-editor.tsx (прозрачный фон, без рамки, высота 28px).
const wrapperSx: SxProps<Theme> = {
  width: '100%',
  '& .MuiFormControl-root': { mb: 0, position: 'static' },
  '& .MuiFilledInput-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiAutocomplete-input': {
    padding: '4px 0 !important',
    fontSize: '14px !important',
  },
}

interface CellReferenceValue {
  id: number | string
  presentation?: unknown
}

function isReferenceValue(value: unknown): value is CellReferenceValue {
  return value !== null && typeof value === 'object' && 'id' in value
}

function toSelectOption(value: unknown): SelectOption | null {
  if (!isReferenceValue(value)) return null
  return {
    id: Number(value.id),
    code: String(value.id),
    label: renderCellValue(value),
  }
}

export const ReferenceCellEditor: FC<ReferenceCellEditorProps> = ({
  colProps,
  value,
  onChange,
  onCommit,
}) => {
  const optionsSource = colProps.optionsSource as
    | { url: string; params?: Record<string, string> }
    | undefined
  const domain = (colProps.domain as string | undefined) ?? 'DICTIONARY'
  const targetTypeCode = colProps.targetTypeCode as string | undefined

  const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'
  const url = optionsSource
    ? optionsSource.url
    : targetTypeCode
      ? `/api/${domainPath}/${targetTypeCode}/entries`
      : null

  const resetKey = JSON.stringify(optionsSource?.params ?? null)

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        url
          ? fetchReferenceOptions({ url, params: optionsSource?.params, search })
          : Promise.resolve([]),
      resetKey,
    )

  // ENUM-колонка без optionsSource и без фолбэка (нет targetTypeCode):
  // graceful-деградация — нейтральное отображение, не рабочий пикер без данных
  // (известный бэкенд-gap resolveEnumOptions, спека §1.3(d)).
  if (!url) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14 }}>
        {renderCellValue(value)}
      </span>
    )
  }

  const selectedOption = toSelectOption(value)

  const applySelected = (opt: SelectOption | null) => {
    // Полный ссылочный объект {id, presentation}, не bare id (спека §1.3(a), TODO-2)
    const newVal = opt ? { id: Number(opt.id), presentation: opt.label } : null
    onChange(newVal)
    resetOptions()
    onCommit()
  }

  return (
    <Box sx={wrapperSx}>
      <AutocompleteInput
        value={selectedOption}
        inputValue={inputValue}
        options={options}
        size="small"
        fullWidth
        loading={loading}
        onInputChange={(_e, val, reason) => {
          setInputValue(val)
          if (reason === 'input') loadDebounced(val)
        }}
        onOpen={() => {
          if (options.length === 0) load()
        }}
        onChange={applySelected}
      />
    </Box>
  )
}
