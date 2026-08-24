import { useState, type FC } from 'react'
import { MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../types/view'
import { useFieldNode, type FieldNodeCommon } from '../../../lib/hooks/use-field-node'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import {
  sortAllowedTypes,
  findAllowedType,
  resolveSelectedTypeCode,
  buildObjectValue,
  type AllowedType,
  type ObjectValue,
} from './object-field-logic'

/**
 * Составное поле «объект» (SCRUM-268 §3.2): селектор члена (тип) + пикер значения.
 * Из входящего значения читается ТОЛЬКО targetTypeCode (см. object-field-logic.ts).
 */
export const ObjectFieldNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const f = useFieldNode(node)

  const allowedTypes = sortAllowedTypes(
    (node.props?.allowedTypes as AllowedType[] | undefined) ?? [],
  )

  const value = (f.value as ObjectValue | null | undefined) ?? null

  // Единственный локальный стейт: ручной выбор члена при пустом значении.
  // Тип из значения всегда приоритетнее — селектор производный.
  const [userTypeCode, setUserTypeCode] = useState<string | undefined>(undefined)

  if (!f.visible || allowedTypes.length === 0) return null

  const selectedTypeCode = resolveSelectedTypeCode(allowedTypes, value, userTypeCode)
  const member = findAllowedType(allowedTypes, selectedTypeCode)

  const emitChange = (newVal: ObjectValue | null) => {
    f.setValue(newVal)
    f.fireServerEvent('change', newVal)
  }

  const handleMemberChange = (nextTypeCode: string) => {
    setUserTypeCode(nextTypeCode)
    // Семантика 1С: смена члена ВСЕГДА чистит значение (без кэша «по типу»)
    if (value) emitChange(null)
  }

  return (
    <div
      className="flex gap-2"
      style={{ flex: f.flex !== undefined ? f.flex : undefined }}
    >
      <TextField
        select
        label={t('sdui.objectField.type')}
        value={selectedTypeCode ?? ''}
        onChange={(e) => handleMemberChange(e.target.value)}
        disabled={!f.enabled}
        slotProps={{ input: { readOnly: f.readonly } }}
        sx={{ minWidth: 160 }}
      >
        {allowedTypes.map((tp) => (
          <MenuItem key={tp.targetTypeCode} value={tp.targetTypeCode}>
            {tp.presentation}
          </MenuItem>
        ))}
      </TextField>
      {member && (
        // key: смена члена перемонтирует пикер — чистые inputValue/кэш опций
        <ObjectValuePicker
          key={member.targetTypeCode}
          member={member}
          field={f}
          value={value}
          onEmit={emitChange}
        />
      )}
    </div>
  )
}

interface ObjectValuePickerProps {
  member: AllowedType
  field: FieldNodeCommon
  value: ObjectValue | null
  onEmit: (v: ObjectValue | null) => void
}

const ObjectValuePicker: FC<ObjectValuePickerProps> = ({
  member,
  field,
  value,
  onEmit,
}) => {
  const { t } = useTranslation()
  const optionsSource = member.optionsSource

  const [inputValue, setInputValue] = useState('')

  const { options, loading, load, loadDebounced } = useReferenceOptions(
    (search?: string) =>
      optionsSource
        ? fetchReferenceOptions({
            url: optionsSource.url,
            params: optionsSource.params,
            search,
          })
        : Promise.resolve([]),
    JSON.stringify(optionsSource ?? null),
  )

  // Член без optionsSource (примитив/ENUMS) — пока не поддержан, не падаем
  if (!optionsSource) {
    return (
      <TextField
        disabled
        fullWidth
        label={field.label}
        value=""
        placeholder={t('sdui.objectField.unsupportedMember')}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    )
  }

  // Значение показываем только если оно принадлежит выбранному члену
  const selectedOption: SelectOption | null =
    value && value.targetTypeCode === member.targetTypeCode
      ? { id: value.id, code: String(value.id), label: value.presentation }
      : null

  return (
    <AutocompleteInput
      value={selectedOption}
      inputValue={inputValue}
      options={options}
      label={field.label}
      required={field.required}
      readOnly={field.readonly}
      disabled={!field.enabled}
      error={!!field.error}
      helperText={field.error}
      loading={loading}
      fullWidth
      onInputChange={(_e, val, reason) => {
        setInputValue(val)
        if (reason === 'input') {
          loadDebounced(val)
        }
      }}
      onOpen={() => {
        if (options.length === 0) {
          load()
        }
      }}
      onChange={(opt) => onEmit(opt ? buildObjectValue(member, opt) : null)}
    />
  )
}
