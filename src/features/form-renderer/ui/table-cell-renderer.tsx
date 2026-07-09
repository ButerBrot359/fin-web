import { useState, useEffect, useRef } from 'react'
import { Controller, type Control, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Box, Checkbox, IconButton } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { AxiosResponse } from 'axios'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { DocumentAttribute, EnumsValue } from '@/entities/document-type'
import {
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'
import { resolveSelectValue } from '@/shared/lib/utils/resolve-select-value'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { TextInput } from '@/shared/ui/inputs/text-input'
import { NumberInput } from '@/shared/ui/inputs/number-input'
import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'
import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'
import { useDictSidebarStore } from '@/features/dict-sidebar'
import {
  useAccountSubkontoKinds,
  type AccountPlanSubkontoKindDto,
} from '@/entities/account-plan'

import { useCellDependency } from '../lib/hooks/use-cell-dependency'
import { mergeSearchParams } from '../lib/utils/field-filter-params'

interface TableCellRendererProps {
  name: string
  column: DocumentAttribute
  control: Control<Record<string, unknown>>
  language: string
  /** Серверный фильтр ссылочного поля (query-параметры пикера). */
  serverFilterParams?: Record<string, string>
  /** Код колонки «Счёт учёта» ТЧ — источник сужения типов субконто по строке. */
  accountColumnCode?: string
}

const tableCellSx: SxProps<Theme> = {
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

const tableCellWrapperSx: SxProps<Theme> = {
  '& .MuiFormControl-root': { mb: 0, position: 'static', width: '100%' },
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 !important',
  },
  '& .MuiInputBase-input, & .MuiAutocomplete-input': {
    padding: '4px 8px !important',
    fontSize: '14px !important',
  },
  '& .MuiAutocomplete-inputRoot': {
    paddingLeft: '0 !important',
    paddingRight: '4px !important',
  },
  // DatePicker / DateTimePicker overrides
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
  '& .MuiPickersInputBase-input': {
    padding: '0 !important',
    fontSize: '14px !important',
    height: '28px !important',
  },
  '& .MuiInputAdornment-root': {
    width: 0,
    overflow: 'visible',
    ml: 0,
    transform: 'translateX(-24px)',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': {
    p: '2px',
  },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': {
    fontSize: '18px',
  },
}

interface DictionarySearchResponse {
  data: {
    content: {
      id: number
      code: string
      displayName?: string
      nameRu?: string
      nameKz?: string
      [key: string]: unknown
    }[]
  }
  success: boolean
}

const DEBOUNCE_MS = 300

const DictCell = ({
  name,
  column,
  control,
  language,
  serverFilterParams,
}: TableCellRendererProps) => {
  const resolved = resolveAttributeDomain(column)
  const searchUrl =
    resolved && REFERENCE_DOMAIN_KINDS.has(resolved.domain)
      ? getUniversalSearchUrl(resolved.domain, resolved.typeCode)
      : undefined
  const isServerSearch = !!searchUrl

  // Dependent dictionaries (e.g. Подразделения filtered by owner org) need the
  // owner filter, which the row lacks — it is sourced from the header field.
  const { searchParams: depParams, disabled } = useCellDependency(
    column,
    control
  )

  // Фильтр поля (напр. отбор МОЛ по «Организации» документа) объединяется
  // с af-фильтром зависимости (af-условия склеиваются, не затирают друг друга).
  const searchParams = mergeSearchParams(serverFilterParams, depParams)

  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fieldValue = useWatch({ control, name })
  const fieldValueId = (fieldValue as { id?: number | string } | null)?.id

  useEffect(() => {
    if (fieldValueId != null) {
      const resolved = resolveSelectValue(fieldValue, [])
      setInputValue(resolved?.label ?? '')
    } else {
      setInputValue('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValueId])

  useEffect(() => {
    if (!isServerSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [inputValue, isServerSearch])

  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<DictionarySearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['dictionary-search', searchUrl, debouncedSearch, searchParams],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: searchUrl!,
        params: { q: debouncedSearch, size: 30, ...searchParams },
      }),
    enabled: isServerSearch && opened,
    select: (response) =>
      response.data.data.content.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            entry.displayName ??
            (language === 'kz' && entry.nameKz ? entry.nameKz : entry.nameRu) ??
            entry.code,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })

  const push = useDictSidebarStore.getState().push

  const handleShowAll = resolved
    ? (onSelect: (value: SelectOption) => void) => {
        push({
          mode: 'list',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          searchParams,
          onSelect,
        })
      }
    : undefined

  const handleAdd = resolved
    ? (fieldOnChange: (value: unknown) => void) => {
        push({
          mode: 'create',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          onSelect: (val: SelectOption) => {
            fieldOnChange(val.raw ?? null)
          },
        })
      }
    : undefined

  const handleOpenEntry = resolved
    ? (entryId: number | string, fieldOnChange: (value: unknown) => void) => {
        push({
          mode: 'edit',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          entryId,
          onSelect: (val: SelectOption) => {
            fieldOnChange(val.raw ?? null)
          },
        })
      }
    : undefined

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const currentValue = resolveSelectValue(field.value, options)
        const currentEntryId = (field.value as { id?: number | string } | null)
          ?.id

        const showAllHandler = handleShowAll
          ? () => {
              handleShowAll((val: SelectOption) => {
                field.onChange(val.raw ?? null)
              })
            }
          : undefined

        const addHandler = handleAdd
          ? () => {
              handleAdd(field.onChange)
            }
          : undefined

        const endAction =
          currentEntryId != null && handleOpenEntry ? (
            <IconButton
              sx={{ p: '2px', borderRadius: '4px' }}
              tabIndex={-1}
              onClick={() => {
                handleOpenEntry(currentEntryId, field.onChange)
              }}
            >
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 16 }} />
            </IconButton>
          ) : undefined

        return (
          <AutocompleteInput
            value={currentValue}
            inputValue={isServerSearch ? inputValue : undefined}
            options={options}
            disabled={disabled}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
            }}
            onInputChange={
              isServerSearch
                ? (_e, value, reason) => {
                    if (reason !== 'reset') {
                      setInputValue(value)
                    }
                  }
                : undefined
            }
            onOpen={() => {
              setOpened(true)
            }}
            loading={isFetching}
            size="small"
            onShowAll={showAllHandler}
            onAdd={addHandler}
            endAction={endAction}
          />
        )
      }}
    />
  )
}

const EnumCell = ({
  name,
  column,
  control,
}: Omit<TableCellRendererProps, 'language'>) => {
  const enumTypeCode =
    (column.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ?? ''

  const [opened, setOpened] = useState(false)

  const toSelectOption = (item: EnumsValue): SelectOption => ({
    id: item.id,
    code: item.code,
    label: item.name,
    raw: item as unknown as Record<string, unknown>,
  })

  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<EnumsValue[]>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['enum-values', enumTypeCode],
    queryFn: () =>
      apiService.get<EnumsValue[]>({
        url: `/api/enums/${enumTypeCode}/values`,
      }),
    enabled: opened && !!enumTypeCode,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data.map(toSelectOption),
  })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const currentValue = resolveSelectValue(field.value, options)

        return (
          <AutocompleteInput
            value={currentValue}
            options={options}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
            }}
            onOpen={() => {
              setOpened(true)
            }}
            loading={isFetching}
            size="small"
          />
        )
      }}
    />
  )
}

/**
 * Вид субконто счёта (AccountPlanSubkontoKindDto) → пара {домен, typeCode} для
 * пикера. COMPOSITE/PRIMITIVE однозначно не сужаются → null (полный тип).
 */
const kindToNarrowed = (
  kind: AccountPlanSubkontoKindDto | undefined
): { domainKind: string; typeCode: string } | null => {
  if (!kind) return null
  switch (kind.valueKind) {
    case 'DICTIONARY':
      return kind.valueDictionaryTypeCode
        ? { domainKind: 'DICTIONARY', typeCode: kind.valueDictionaryTypeCode }
        : null
    case 'DOCUMENT':
      return kind.valueDocumentTypeCode
        ? { domainKind: 'DOCUMENT', typeCode: kind.valueDocumentTypeCode }
        : null
    case 'ENUMS':
      return kind.valueEnumsTypeCode
        ? { domainKind: 'ENUMS', typeCode: kind.valueEnumsTypeCode }
        : null
    default:
      return null
  }
}

/** Позиция субконто из кода колонки: `...Subkonto1` → 1 (иначе undefined). */
const parseSubkontoPosition = (code: string): number | undefined => {
  const match = /Subkonto(\d+)$/i.exec(code)
  return match ? Number(match[1]) : undefined
}

interface SubkontoObjectCellProps {
  name: string
  column: DocumentAttribute
  control: Control<Record<string, unknown>>
  language: string
  serverFilterParams?: Record<string, string>
  /** RHF-путь к «Счёту учёта» этой строки. */
  accountFieldName?: string
}

/**
 * OBJECT-ячейка субконто ТЧ. Сужает пикер до фактического вида субконто по
 * «Счёту учёта» строки: `GET /account-plan/entries/{id}/subkonto-kinds`, запись
 * с position = номеру колонки (Субконто1/2/3). DICTIONARY/DOCUMENT → пикер
 * справочника/документа, ENUMS → перечисление. Если вида для позиции нет
 * (или COMPOSITE/PRIMITIVE) — полный составной тип (первый ссылочный член).
 *
 * Реактивность: `useWatch` по счёту + queryKey по его id — смена счёта
 * перезапрашивает виды и перерисовывает тип без переоткрытия документа.
 */
const SubkontoObjectCell = ({
  name,
  column,
  control,
  language,
  serverFilterParams,
  accountFieldName,
}: SubkontoObjectCellProps) => {
  // Сентинел вместо пустого name: подписка на несуществующий путь не вызывает
  // ре-рендеры (в отличие от name '' — тот подписывает на всю форму).
  const accountValue = useWatch({
    control,
    name: accountFieldName ?? '__subkonto_no_account__',
  }) as { id?: number | string } | null | undefined
  const accountId = accountFieldName ? accountValue?.id : undefined

  const { kinds } = useAccountSubkontoKinds(accountId ?? null)

  const position = parseSubkontoPosition(column.code)
  const narrowed =
    position != null
      ? kindToNarrowed(kinds.find((k) => k.position === position))
      : null

  if (narrowed && REFERENCE_DOMAIN_KINDS.has(narrowed.domainKind)) {
    const objectColumn = {
      ...column,
      domainKind: narrowed.domainKind,
      allowedTypes: [
        { domainKind: narrowed.domainKind, typeCode: narrowed.typeCode },
      ],
    } as DocumentAttribute
    return (
      <Box sx={tableCellWrapperSx}>
        <DictCell
          name={name}
          column={objectColumn}
          control={control}
          language={language}
          serverFilterParams={serverFilterParams}
        />
      </Box>
    )
  }

  if (narrowed && narrowed.domainKind === 'ENUMS') {
    const enumColumn = {
      ...column,
      allowedTypes: [{ domainKind: 'ENUMS', typeCode: narrowed.typeCode }],
    } as DocumentAttribute
    return (
      <Box sx={tableCellWrapperSx}>
        <EnumCell name={name} column={enumColumn} control={control} />
      </Box>
    )
  }

  // Fallback: полный составной тип (первый ссылочный член) — прежнее поведение.
  const firstType = (column.allowedTypes ?? []).find((at) =>
    REFERENCE_DOMAIN_KINDS.has(at.domainKind)
  )
  if (firstType) {
    const objectColumn = {
      ...column,
      domainKind: firstType.domainKind,
      allowedTypes: [firstType],
    }
    return (
      <Box sx={tableCellWrapperSx}>
        <DictCell
          name={name}
          column={objectColumn}
          control={control}
          language={language}
          serverFilterParams={serverFilterParams}
        />
      </Box>
    )
  }

  // OBJECT без ссылочного типа — обычный текстовый ввод (как было).
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...field } }) => (
        <TextInput
          {...field}
          inputRef={ref}
          value={(field.value as string) || ''}
          size="small"
          autoFocus
          sx={tableCellSx}
        />
      )}
    />
  )
}

interface CellInputProps extends TableCellRendererProps {
  onPickerOpen?: () => void
  onPickerClose?: () => void
  /** RHF-путь к «Счёту учёта» этой строки (для запроса видов субконто). */
  accountFieldName?: string
}

const CellInput = ({
  name,
  column,
  control,
  language,
  serverFilterParams,
  onPickerOpen,
  onPickerClose,
  accountFieldName,
}: CellInputProps) => {
  const { dataType } = column
  const cellResolved = resolveAttributeDomain(column)

  if (cellResolved && REFERENCE_DOMAIN_KINDS.has(cellResolved.domain)) {
    return (
      <Box sx={tableCellWrapperSx}>
        <DictCell
          name={name}
          column={column}
          control={control}
          language={language}
          serverFilterParams={serverFilterParams}
        />
      </Box>
    )
  }

  if (dataType === 'ENUMS') {
    return (
      <Box sx={tableCellWrapperSx}>
        <EnumCell name={name} column={column} control={control} />
      </Box>
    )
  }

  if (dataType === 'OBJECT') {
    return (
      <SubkontoObjectCell
        name={name}
        column={column}
        control={control}
        language={language}
        serverFilterParams={serverFilterParams}
        accountFieldName={accountFieldName}
      />
    )
  }

  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, ...field } }) => (
            <TextInput
              {...field}
              inputRef={ref}
              value={(field.value as string) || ''}
              size="small"
              autoFocus
              sx={tableCellSx}
            />
          )}
        />
      )

    case 'INTEGER':
    case 'DECIMAL':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, onChange, ...field } }) => (
            <NumberInput
              {...field}
              onChange={onChange}
              inputRef={ref}
              value={field.value != null ? String(field.value as number) : ''}
              decimal={dataType === 'DECIMAL'}
              size="small"
              autoFocus
              sx={tableCellSx}
            />
          )}
        />
      )

    case 'DATE':
    case 'DATETIME':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Box sx={tableCellWrapperSx}>
              <DateTimeInput
                value={(field.value as string | undefined) ?? undefined}
                onChange={field.onChange}
                dateOnly={dataType === 'DATE'}
                size="small"
                onOpen={onPickerOpen}
                onClose={onPickerClose}
              />
            </Box>
          )}
        />
      )

    default:
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, ...field } }) => (
            <TextInput
              {...field}
              inputRef={ref}
              value={(field.value as string) || ''}
              size="small"
              autoFocus
              sx={tableCellSx}
            />
          )}
        />
      )
  }
}

export const TableCellRenderer = ({
  name,
  column,
  control,
  language,
  serverFilterParams,
  accountColumnCode,
}: TableCellRendererProps) => {
  const { dataType } = column
  const [editing, setEditing] = useState(false)
  const cellRef = useRef<HTMLDivElement>(null)
  const pickerOpenRef = useRef(false)
  const value = useWatch({ control, name })

  // Путь к «Счёту учёта» этой строки — по нему субконто-ячейка берёт виды
  // субконто счёта (эндпоинт /subkonto-kinds) для сужения типа.
  const rowPath = name.slice(0, name.lastIndexOf('.'))
  const accountFieldName = accountColumnCode
    ? `${rowPath}.${accountColumnCode}`
    : undefined

  if (dataType === 'BOOLEAN') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Checkbox
            checked={!!field.value}
            onChange={(e) => {
              field.onChange(e.target.checked)
            }}
            size="small"
            sx={{ p: 0 }}
          />
        )}
      />
    )
  }

  if (!editing) {
    const displayText = formatCellValue(value, column)
    return (
      <div
        className="flex min-h-[28px] cursor-text items-center truncate border-b-2 border-transparent px-2 py-1 text-body2 text-ui-06 hover:bg-ui-04"
        onClick={() => {
          setEditing(true)
        }}
      >
        {displayText || '\u00A0'}
      </div>
    )
  }

  const handleBlur = () => {
    requestAnimationFrame(() => {
      if (pickerOpenRef.current) return
      if (!cellRef.current?.contains(document.activeElement)) {
        setEditing(false)
      }
    })
  }

  return (
    <div
      ref={cellRef}
      className="border-b-2 border-accent-02 hover:bg-ui-04"
      onBlur={handleBlur}
    >
      <CellInput
        name={name}
        column={column}
        control={control}
        language={language}
        serverFilterParams={serverFilterParams}
        accountFieldName={accountFieldName}
        onPickerOpen={() => {
          pickerOpenRef.current = true
        }}
        onPickerClose={() => {
          pickerOpenRef.current = false
        }}
      />
    </div>
  )
}
