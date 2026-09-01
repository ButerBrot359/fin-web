import {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
} from 'react'
import {
  Autocomplete,
  Paper,
  TextField,
  Tooltip,
  type SxProps,
  type TextFieldProps,
  type Theme,
} from '@mui/material'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
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

interface AutocompleteInputBaseProps {
  inputValue?: string
  options: SelectOption[]
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
  /** Растянуть на всю ширину контейнера (по умолчанию ширина по контенту). */
  fullWidth?: boolean
  /**
   * Подсвечивать первую опцию → Enter её выбирает (поведение 1С: «ввёл часть
   * наименования, нажал Enter — значение подставилось»).
   *
   * <p>Опция, а не поведение по умолчанию: компонент общий для SDUI и легаси, а
   * `autoHighlight` меняет семантику Enter на ~20 легаси-экранах (параметры отчётов,
   * ОСВ, карточка счёта), которые в эту задачу не входят.
   *
   * <p>Именно `autoHighlight`, а не `autoSelect`: последний выбирает опцию ещё и при
   * потере фокуса — подставлял бы значение, которого пользователь не выбирал.
   */
  autoHighlight?: boolean
  /**
   * Значение ПЕРЕНОСИТСЯ по ширине поля: TextField рендерится `<textarea>`
   * вместо `<input>`. Нужен ячейке ТЧ — ширина колонки фиксирована, а `<input>`
   * длинное наименование («Надбавка за особые условия труда 10%») по природе
   * своей не переносит, а прокручивает, показывая обрезок.
   *
   * <p>Опция, а не поведение по умолчанию: компонент общий для SDUI и легаси, и
   * в полях формы (шапка документа, параметры отчётов) однострочность — не
   * дефект, а нужная компактность.
   */
  multilineInput?: boolean
  /**
   * Раскрывать список при получении фокуса (SCRUM-363: одноразовая цель
   * автоперехода по ячейкам ТЧ). Default `false` — обычный клик/фокус
   * пользователя поведения не меняет.
   */
  openOnFocus?: boolean
}

export interface AutocompleteInputSingleProps extends AutocompleteInputBaseProps {
  multiple?: false
  value: SelectOption | null
  onChange: (value: SelectOption | null) => void
}

export interface AutocompleteInputMultipleProps extends AutocompleteInputBaseProps {
  multiple: true
  value: SelectOption[]
  onChange: (value: SelectOption[]) => void
}

export type AutocompleteInputProps =
  | AutocompleteInputSingleProps
  | AutocompleteInputMultipleProps

export const AutocompleteInput = (props: AutocompleteInputProps) => {
  const {
    inputValue,
    options,
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
    fullWidth,
    autoHighlight = false,
    multilineInput = false,
    openOnFocus = false,
  } = props
  const { t } = useTranslation()

  // ВНИМАНИЕ: `autoHighlight` уходит в MUI КАК ЕСТЬ. Вычислять его от `loading` НЕЛЬЗЯ —
  // проверено по исходнику @mui/material/useAutocomplete:
  //
  //   defaultHighlighted = autoHighlight ? 0 : -1                            (:139)
  //   syncHighlightedIndex — useCallback с deps
  //     [filteredOptions.length, value, changeHighlightedIndex,
  //      setHighlightedIndex, popupOpen, inputValue, multiple]               (:476-480)
  //   useEffect(..., [syncHighlightedIndex, filteredOptionsChanged,
  //                   popupOpen, disableCloseOnSelect])                      (:497-500)
  //
  // Ни `autoHighlight`, ни `loading` в зависимостях нет. Поэтому при `autoHighlight && !loading`
  // эффект успевал отработать в рендере, где загрузка ещё шла (autoHighlight=false →
  // defaultHighlighted=-1 → сброс подсветки), а последующий переход loading→false его НЕ
  // перезапускал: список, value, inputValue и popupOpen не менялись. Подсветка не появлялась
  // никогда, и Enter не срабатывал — ровно тот баг, который этой опцией и чинится.
  //
  // Пустое поле (value=null) попадает в ветку «popup пуст → reset» (:425-429), а reset
  // возвращает defaultHighlighted (:333) — то есть 0. Так первая опция и подсвечивается.

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

  const sx: SxProps<Theme> = [
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
  ]

  /**
   * Enter в `<textarea>` вставил бы перенос строки прямо в строку поиска.
   * Гасим — но ТОЛЬКО после обработчика MUI и только если он сам событие не
   * забрал: при открытом списке Enter выбирает подсвеченную опцию
   * (`useAutocomplete` зовёт `preventDefault`), и перехватывать это нельзя.
   */
  const guardEnter =
    (inner?: (event: KeyboardEvent<HTMLInputElement>) => void) =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      inner?.(event)
      if (event.key === 'Enter' && !event.defaultPrevented) {
        event.preventDefault()
      }
    }

  const renderInput = (params: AutocompleteRenderInputParams) => {
    const htmlInput = {
      ...params.inputProps,
      ...(slotProps?.htmlInput as object),
    } as AutocompleteRenderInputParams['inputProps']
    return (
      <TextField
        {...params}
        multiline={multilineInput}
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
          htmlInput: multilineInput
            ? { ...htmlInput, onKeyDown: guardEnter(htmlInput.onKeyDown) }
            : htmlInput,
        }}
      />
    )
  }

  if (props.multiple) {
    return (
      <Autocomplete
        multiple
        size={size}
        fullWidth={fullWidth}
        value={props.value}
        inputValue={inputValue}
        options={options}
        onChange={(_e, newValue) => {
          props.onChange(newValue)
        }}
        onInputChange={onInputChange}
        onOpen={onOpen}
        openOnFocus={openOnFocus}
        autoHighlight={autoHighlight}
        filterOptions={onInputChange ? (x) => x : undefined}
        getOptionLabel={(option) => option.label}
        // Ключ опции — id: дефолтный ключ MUI по label роняет/дублирует опции
        // с одинаковым представлением (например, полные тёзки у физлиц).
        getOptionKey={(option) => option.id}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        readOnly={readOnly}
        disabled={disabled}
        loading={loading}
        sx={sx}
        slots={PaperComponent ? { paper: PaperComponent } : undefined}
        slotProps={{
          popper: { style: { minWidth: 300 } },
        }}
        loadingText={t('inputs.loading')}
        noOptionsText={t('inputs.noOptions')}
        renderInput={renderInput}
      />
    )
  }

  return (
    <Tooltip
      title={props.value?.label ?? ''}
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
        fullWidth={fullWidth}
        value={props.value}
        inputValue={inputValue}
        options={options}
        onChange={(_e, newValue) => {
          props.onChange(newValue)
        }}
        onInputChange={onInputChange}
        onOpen={onOpen}
        openOnFocus={openOnFocus}
        autoHighlight={autoHighlight}
        filterOptions={onInputChange ? (x) => x : undefined}
        getOptionLabel={(option) => option.label}
        // Ключ опции — id: дефолтный ключ MUI по label роняет/дублирует опции
        // с одинаковым представлением (например, полные тёзки у физлиц).
        getOptionKey={(option) => option.id}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        readOnly={readOnly}
        disabled={disabled}
        loading={loading}
        sx={sx}
        slots={PaperComponent ? { paper: PaperComponent } : undefined}
        slotProps={{
          popper: { style: { minWidth: 300 } },
        }}
        loadingText={t('inputs.loading')}
        noOptionsText={t('inputs.noOptions')}
        renderInput={renderInput}
      />
    </Tooltip>
  )
}
