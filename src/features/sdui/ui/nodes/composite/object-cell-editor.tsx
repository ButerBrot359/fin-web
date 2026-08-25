import { useEffect, useState, type FC } from 'react'
import { Box, MenuItem, Select } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { renderCellValue } from '../../../lib/utils/cell-value'
import {
  sortAllowedTypes,
  memberKey,
  findMemberByKey,
  resolveSelectedMemberKey,
  membersSignature,
  isValueAllowed,
  buildObjectValue,
  type AllowedType,
  type ObjectValue,
} from './object-field-logic'

interface ObjectCellEditorProps {
  colProps: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
  onCommit: () => void
}

// Компактная стилизация под ячейку ТЧ — по образцу wrapperSx из
// reference-cell-editor.tsx (прозрачный фон, без рамки, высота 28px).
const wrapperSx: SxProps<Theme> = {
  width: '100%',
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
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

const memberSelectSx: SxProps<Theme> = {
  flex: '0 0 auto',
  minWidth: 96,
  maxWidth: 140,
  fontSize: '14px',
  '&::before, &::after': { display: 'none' },
  '& .MuiSelect-select': {
    padding: '4px 8px !important',
    minHeight: '28px',
    display: 'flex',
    alignItems: 'center',
  },
}

/**
 * Составное поле «объект» в ЯЧЕЙКЕ табличной части (SCRUM-279 D4-доп, §3 спеки).
 *
 * ЗАЧЕМ. Аналитик сообщила, что в «Дополнительных реквизитах» физлица колонка
 * «Значение» не активна — её нельзя заполнить. Причина: тип значения там
 * составной (OBJECT) — он определяется выбранным «Свойством» и может быть ссылкой
 * на любой из допустимых справочников. Бэк такие колонки отдаёт с
 * `cellWidget: OBJECT_FIELD`, но в `table-cell-editor.tsx` ветки OBJECT_FIELD не
 * было — ячейка падала в `default:` и рендерилась НЕРЕДАКТИРУЕМЫМ текстом.
 *
 * Это компактный аналог `ObjectFieldNode` (шапка формы, SCRUM-268 §3.2). Вся
 * недекоративная логика — выбор члена, приоритет типа из значения, сборка
 * исходящего значения — переиспользуется из `object-field-logic.ts`: тот же
 * контракт, те же тесты, никакой второй копии правил.
 *
 * Отличие от шапки — источник данных: ячейка ТЧ не читает стейт формы
 * (`useFieldNode`), а получает `colProps`/`value` и отдаёт `onChange`/`onCommit`,
 * как остальные редакторы ячеек.
 */
export const ObjectCellEditor: FC<ObjectCellEditorProps> = ({
  colProps,
  value,
  onChange,
  onCommit,
}) => {
  const { t } = useTranslation()

  const allowedTypes = sortAllowedTypes(
    (colProps.allowedTypes as AllowedType[] | undefined) ?? []
  )

  const objectValue = (value as ObjectValue | null | undefined) ?? null

  // Единственный локальный стейт: ручной выбор члена при пустом значении.
  // Тип из значения всегда приоритетнее — селектор производный (как в шапке).
  const [userMemberKey, setUserMemberKey] = useState<string | undefined>(
    undefined
  )

  // Смена «Свойства»/счёта перестраивает набор членов колонки: ручной выбор от
  // прежнего набора не переносим (см. membersSignature).
  const signature = membersSignature(allowedTypes)
  const [seenSignature, setSeenSignature] = useState(signature)
  if (seenSignature !== signature) {
    setSeenSignature(signature)
    setUserMemberKey(undefined)
  }

  // Значение недопустимого теперь вида гасим — иначе оно уедет в запись строки и
  // сервер отклонит её целиком. Пустой allowedTypes значит «сервер про типы
  // ничего не сказал» (graceful-ветка ниже), это не повод чистить значение.
  const staleValue =
    allowedTypes.length > 0 && !isValueAllowed(allowedTypes, objectValue)
  useEffect(() => {
    // Не в фазе рендера: onChange/onCommit правят стейт таблицы-родителя.
    if (staleValue) {
      onChange(null)
      onCommit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleValue])

  // Graceful-деградация: у части OBJECT-атрибутов в метаданных нет строк
  // allowedTypes (известный хвост — атрибуты без FK на целевой тип), бэк тогда
  // осознанно не кладёт props.allowedTypes. Предлагать пустой селектор нельзя —
  // показываем значение как есть, а не имитацию рабочего пикера.
  if (allowedTypes.length === 0) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14 }}>
        {renderCellValue(value)}
      </span>
    )
  }

  const selectedKey = resolveSelectedMemberKey(
    allowedTypes,
    objectValue,
    userMemberKey
  )
  const member = findMemberByKey(allowedTypes, selectedKey)

  const handleMemberChange = (nextKey: string) => {
    setUserMemberKey(nextKey)
    // Семантика 1С: смена члена ВСЕГДА чистит значение (без кэша «по типу»).
    // Коммитим только если чистить было что — иначе это локальный выбор типа,
    // серверу о нём знать нечего.
    if (objectValue) {
      onChange(null)
      onCommit()
    }
  }

  return (
    <Box sx={wrapperSx}>
      {/* Один член — выбирать не из чего, селектор только съедал бы ширину
          ячейки (см. тот же случай в шапке). */}
      {allowedTypes.length > 1 && (
        <Select
          value={selectedKey ?? ''}
          onChange={(e) => {
            handleMemberChange(e.target.value)
          }}
          size="small"
          variant="standard"
          sx={memberSelectSx}
        >
          {allowedTypes.map((tp) => (
            <MenuItem key={memberKey(tp)} value={memberKey(tp)}>
              {/* У примитивных членов бэк presentation не присылает — подписываем
                по domainKind именами типов 1С («Строка», «Число», «Булево»,
                «Дата»), иначе четыре пункта из семи были бы пустыми. */}
              {tp.presentation ??
                t(`sdui.objectField.primitive.${tp.domainKind}`, {
                  defaultValue: tp.domainKind,
                })}
            </MenuItem>
          ))}
        </Select>
      )}
      {member && (
        // key: смена члена перемонтирует пикер — чистые inputValue и кэш опций
        <ObjectCellValuePicker
          key={memberKey(member)}
          member={member}
          value={objectValue}
          placeholder={t('sdui.objectField.unsupportedMember')}
          onChange={onChange}
          onCommit={onCommit}
        />
      )}
    </Box>
  )
}

interface ObjectCellValuePickerProps {
  member: AllowedType
  value: ObjectValue | null
  placeholder: string
  onChange: (value: unknown) => void
  onCommit: () => void
}

const ObjectCellValuePicker: FC<ObjectCellValuePickerProps> = ({
  member,
  value,
  placeholder,
  onChange,
  onCommit,
}) => {
  const optionsSource = member.optionsSource

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        optionsSource
          ? fetchReferenceOptions({
              url: optionsSource.url,
              params: optionsSource.params,
              search,
            })
          : Promise.resolve([]),
      JSON.stringify(optionsSource ?? null)
    )

  // Член без optionsSource — примитив (STRING/DECIMAL/BOOLEAN/DATETIME) или ENUMS.
  // Здесь НЕЛЬЗЯ просто нарисовать текстовый/числовой редактор: у OBJECT-атрибута
  // серверный путь записи (`ValueFieldHelper.setValueObject`) принимает только
  // `{id, type|targetTypeCode}` либо голый числовой id, а на строку/булево бросает
  // IllegalArgumentException — то есть рабочий на вид редактор отказывал бы при
  // коммите, что хуже нынешней жалобы. Поэтому член в списке показываем (он есть в
  // метаданных и в 1С), а редактор — честная заглушка; поддержка примитивных членов
  // составного типа = отдельная задача на БЭК, не косметика фронта.
  if (!optionsSource) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14, opacity: 0.6 }}>
        {placeholder}
      </span>
    )
  }

  // Значение показываем только если оно принадлежит выбранному члену.
  // Проверка на null — ОТДЕЛЬНО от сравнения кодов, а не `value?.targetTypeCode
  // === member.targetTypeCode`: у примитивного члена оба кода undefined, такое
  // сравнение дало бы true и обращение к `value.id` при value === null.
  const valueTypeCode = value?.targetTypeCode
  const selectedOption: SelectOption | null =
    value != null && valueTypeCode === member.targetTypeCode
      ? { id: value.id, code: String(value.id), label: value.presentation }
      : null

  return (
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
      onChange={(opt) => {
        // Исходящее значение собирает buildObjectValue: {id, presentation, type,
        // targetTypeCode} — targetTypeCode round-trip'ится и различает
        // same-domain членов (см. object-field-logic.ts).
        onChange(opt ? buildObjectValue(member, opt) : null)
        resetOptions()
        onCommit()
      }}
    />
  )
}
