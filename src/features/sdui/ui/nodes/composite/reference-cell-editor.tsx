import { useState, type FC } from 'react'
import { Box, IconButton } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { openReferencePicker } from '../../../lib/reference-picker-gateway'
import { renderCellValue } from '../../../lib/utils/cell-value'
import {
  resolveOptionsParams,
  type OptionsParamValue,
} from '../../../lib/utils/resolve-options-params'

interface ReferenceCellEditorProps {
  colProps: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
  onCommit: () => void
  extraParams?: Record<string, string>
}

/**
 * Ссылочные props узла `TABLE_COLUMN` — ровно тот контракт, что описан в спеке
 * SCRUM-314 §2. Заведён отдельным типом намеренно: сегодня одни и те же имена
 * читают три места (`reference-field-node.tsx`, `object-cell-editor.tsx` и это),
 * каждое своим `as`-выражением, — и разъезд с бэком остался бы незамеченным до
 * рантайма. `colProps` разбираем один раз, дальше работаем с типом.
 */
interface ReferenceCellProps {
  /** Раздел ссылки: DICTIONARY, CALCULATION_PLAN, DOCUMENT, регистры… */
  domain?: string
  /** Код целевого типа. Пуст → цель неизвестна (инвариант A4). */
  targetTypeCode?: string
  /** Показывать «Показать все» — открыть полный список выбора. */
  allowShowAll?: boolean
  /** Показывать «Добавить» — создать новый элемент целевого типа. */
  allowCreate?: boolean
  /** Готовый конкретный фильтр от бэка; фронт его не синтезирует. */
  filter?: Record<string, unknown>
  optionsSource?: { url: string; params?: Record<string, OptionsParamValue> }
}

function readReferenceCellProps(
  colProps: Record<string, unknown>
): ReferenceCellProps {
  return colProps as ReferenceCellProps
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
  extraParams,
}) => {
  const { t } = useTranslation()

  // Аффордансы пикера — тот же серверный контракт, что у REFERENCE_FIELD шапки
  // (reference-field-node.tsx). Ветки node.actions здесь нет: у TABLE_COLUMN
  // серверных команд showAll/create не бывает, только props.
  const {
    domain,
    targetTypeCode,
    allowShowAll,
    allowCreate,
    filter,
    optionsSource,
  } = readReferenceCellProps(colProps)

  // Backend-driven источник: url приходит с бэка, фронт его не конструирует
  // (SCRUM-286). Ячейка ТЧ не читает стейт формы — { fromBinding } тут не
  // ожидается, но защитно резолвим (getValue → undefined), чтобы случайный
  // объект-параметр не улетел строкой [object Object].
  const url = optionsSource?.url ?? null
  const params = {
    ...resolveOptionsParams(optionsSource?.params, () => undefined),
    ...extraParams,
  }

  const resetKey = JSON.stringify(params)

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        url
          ? fetchReferenceOptions({ url, params, search })
          : Promise.resolve([]),
      resetKey
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

  // Легаси-пикер получает готовый конкретный фильтр из props.filter (бэк кладёт
  // туда, например, {Vladelets: id}) — фронт его не синтезирует.
  const searchParams = filter
    ? Object.fromEntries(Object.entries(filter).map(([k, v]) => [k, String(v)]))
    : undefined

  // Инвариант A4: без targetTypeCode бэк осознанно не кладёт ни optionsSource,
  // ни allow* — цель ссылки неизвестна, пикер открывать не по чему. Гейт
  // выражен наличием функции, а не булевым флагом: так domain/typeCode сужены
  // по построению и не нужны non-null-assertion'ы на месте вызова.
  const openPicker =
    domain && targetTypeCode
      ? (mode: 'list' | 'create') => {
          openReferencePicker({
            mode,
            domain,
            typeCode: targetTypeCode,
            onSelect: applySelected,
            searchParams,
            // Список открывается на записи, уже стоящей в ячейке.
            selectedId: mode === 'list' ? selectedOption?.id : undefined,
          })
        }
      : null

  // «Добавить» — только для настоящих справочников. dataType=DICTIONARY означает
  // «ссылка вообще», реальный домен лежит в props.domain: у «Вида начисления»
  // это CALCULATION_PLAN, и создание элемента справочника там не сработает.
  // Бэк тот же гейт заводит у себя, здесь — вторая дешёвая защита (спека §2).
  const canCreate = openPicker !== null && domain === 'DICTIONARY'

  // SCRUM-291 §18.4.1: проваливание в карточку УЖЕ стоящей в ячейке записи —
  // не пикер (§18.4 заблокирован PM). Читаем {id, presentation} из текущего
  // значения ячейки, никакой rowId-командной модели не нужно (по образцу
  // browse-edit ветки reference-field-node.tsx).
  const openCard =
    selectedOption && domain && targetTypeCode
      ? () => {
          openReferencePicker({
            mode: 'edit',
            domain,
            typeCode: targetTypeCode,
            entryId: selectedOption.id,
            onSelect: applySelected,
          })
        }
      : null

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
        onShowAll={
          openPicker && (allowShowAll ?? true)
            ? () => {
                openPicker('list')
              }
            : undefined
        }
        onAdd={
          openPicker && canCreate && (allowCreate ?? true)
            ? () => {
                openPicker('create')
              }
            : undefined
        }
        endAction={
          openCard ? (
            <IconButton
              aria-label={t('inputs.openReference')}
              sx={{ p: '4px', borderRadius: '6px' }}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                openCard()
              }}
            >
              <OpenInNewIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
          ) : undefined
        }
      />
    </Box>
  )
}
