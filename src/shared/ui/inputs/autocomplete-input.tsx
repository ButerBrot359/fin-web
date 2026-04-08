import { type HTMLAttributes, type ReactNode, useMemo } from 'react'
import {
  Autocomplete,
  Paper,
  TextField,
  Tooltip,
  type TextFieldProps,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

interface FooterButtonsProps {
  onShowAll?: () => void
  onAdd?: () => void
  showAllLabel: string
  addLabel: string
}

function createFooterPaper({
  onShowAll,
  onAdd,
  showAllLabel,
  addLabel,
}: FooterButtonsProps) {
  function FooterPaper(props: HTMLAttributes<HTMLDivElement>) {
    return (
      <Paper
        {...props}
        sx={{
          borderRadius: '8px',
          boxShadow: '0px 3px 24px 0px rgba(42,117,244,0.4)',
          overflow: 'hidden',
        }}
      >
        {props.children}
        <div className="flex items-center justify-between border-t border-ui-04 py-3">
          {onShowAll && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onShowAll()
              }}
              className="cursor-pointer rounded-lg px-4 py-2.5 text-body1 font-medium text-accent-02"
            >
              {showAllLabel}
            </button>
          )}
          {onAdd && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onAdd()
              }}
              className="cursor-pointer rounded-lg px-4 py-2.5 text-body1 font-medium text-accent-02"
            >
              {addLabel}
            </button>
          )}
        </div>
      </Paper>
    )
  }
  return FooterPaper
}

export interface AutocompleteInputProps {
  value: SelectOption | null
  inputValue?: string
  options: SelectOption[]
  onChange: (value: SelectOption | null) => void
  onInputChange?: (event: unknown, value: string, reason: string) => void
  label?: string
  readOnly?: boolean
  disabled?: boolean
  required?: boolean
  error?: boolean
  helperText?: string
  loading?: boolean
  onOpen?: () => void
  endAction?: ReactNode
  slotProps?: TextFieldProps['slotProps']
  onShowAll?: () => void
  onAdd?: () => void
  size?: 'small' | 'medium'
}

export const AutocompleteInput = ({
  value,
  inputValue,
  options,
  onChange,
  onInputChange,
  label,
  readOnly,
  disabled,
  required,
  error,
  helperText,
  loading,
  onOpen,
  endAction,
  slotProps,
  onShowAll,
  onAdd,
  size,
}: AutocompleteInputProps) => {
  const { t } = useTranslation()

  const hasFooter = !!(onShowAll || onAdd)

  const PaperComponent = useMemo(() => {
    if (!hasFooter) return undefined
    return createFooterPaper({
      onShowAll,
      onAdd,
      showAllLabel: t('dictSidebar.showAll'),
      addLabel: t('dictSidebar.add'),
    })
  }, [hasFooter, onShowAll, onAdd, t])

  return (
    <Tooltip
      title={value?.label ?? ''}
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
      <Autocomplete
        size={size}
        value={value}
        inputValue={inputValue}
        options={options}
        onChange={(_e, newValue) => {
          onChange(newValue)
        }}
        onInputChange={onInputChange}
        onOpen={onOpen}
        filterOptions={onInputChange ? (x) => x : undefined}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        readOnly={readOnly}
        disabled={disabled}
        loading={loading}
        sx={[
          ...(disabled
            ? [
                {
                  '& .MuiFilledInput-root': {
                    backgroundColor: '#e6e9ee',
                    borderColor: '#c3cee0',
                    '&:hover': {
                      backgroundColor: '#e6e9ee',
                      borderColor: '#c3cee0',
                    },
                  },
                },
              ]
            : []),
          ...(size === 'small'
            ? [
                {
                  '& .MuiFilledInput-root': { minHeight: 32 },
                  '& .MuiAutocomplete-input': {
                    paddingTop: '6px !important',
                    paddingBottom: '6px !important',
                  },
                },
              ]
            : []),
        ]}
        slots={PaperComponent ? { paper: PaperComponent } : undefined}
        slotProps={{
          popper: { style: { minWidth: 300 } },
        }}
        loadingText={t('inputs.loading')}
        noOptionsText={t('inputs.noOptions')}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={error}
            helperText={helperText}
            slotProps={{
              ...slotProps,
              input: {
                ...params.InputProps,
                ...(slotProps?.input as object),
                endAdornment: (
                  <>
                    {params.InputProps.endAdornment}
                    {!disabled && endAction}
                  </>
                ),
              },
              htmlInput: {
                ...params.inputProps,
                ...(slotProps?.htmlInput as object),
              },
            }}
          />
        )}
      />
    </Tooltip>
  )
}
