import { useEffect, useState, type FC } from 'react'
import { MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../types/view'
import {
  useFieldNode,
  type FieldNodeCommon,
} from '../../../lib/hooks/use-field-node'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
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

/**
 * Составное поле «объект» (SCRUM-268 §3.2): селектор члена (тип) + пикер значения.
 * Из входящего значения читается ТОЛЬКО targetTypeCode (см. object-field-logic.ts).
 */
export const ObjectFieldNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const f = useFieldNode(node)

  const allowedTypes = sortAllowedTypes(
    (node.props?.allowedTypes as AllowedType[] | undefined) ?? []
  )

  const value = (f.value as ObjectValue | null | undefined) ?? null

  // Единственный локальный стейт: ручной выбор члена при пустом значении.
  // Тип из значения всегда приоритетнее — селектор производный.
  const [userMemberKey, setUserMemberKey] = useState<string | undefined>(
    undefined
  )

  // Смена счёта перестраивает вид субконто: приходит патч props с другим
  // allowedTypes. Ручной выбор члена к новому набору отношения не имеет —
  // сбрасываем его, иначе селектор показывал бы член от прежнего счёта.
  const signature = membersSignature(allowedTypes)
  const [seenSignature, setSeenSignature] = useState(signature)
  if (seenSignature !== signature) {
    setSeenSignature(signature)
    setUserMemberKey(undefined)
  }

  // Значение прежнего вида в новом наборе недопустимо. Гасим его в стейте формы,
  // а не только в отрисовке: невидимое, оно уехало бы в запись документа и
  // положило бы сохранение целиком. Событие на сервер не шлём — он сам только
  // что перестроил поле, для него это не пользовательская правка.
  // Пустой allowedTypes — не «значение недопустимо», а «сервер про типы ничего
  // не сказал»; скрытое поле гасить тем более не наше дело. В обоих случаях
  // значение не трогаем.
  const staleValue =
    f.visible && allowedTypes.length > 0 && !isValueAllowed(allowedTypes, value)
  useEffect(() => {
    if (staleValue) f.setValue(null)
    // f пересобирается каждый рендер — завязка на сам факт устаревания
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleValue])

  if (!f.visible || allowedTypes.length === 0) return null

  const selectedKey = resolveSelectedMemberKey(
    allowedTypes,
    value,
    userMemberKey
  )
  const member = findMemberByKey(allowedTypes, selectedKey)

  const emitChange = (newVal: ObjectValue | null) => {
    f.setValue(newVal)
    f.fireServerEvent('change', newVal)
  }

  const handleMemberChange = (nextKey: string) => {
    setUserMemberKey(nextKey)
    // Семантика 1С: смена члена ВСЕГДА чистит значение (без кэша «по типу»)
    if (value) emitChange(null)
  }

  return (
    <div className="flex gap-2">
      {/* Один член — выбирать не из чего: селектор был бы обманом, вид субконто
          однозначен. Ширину поля значения он при этом съедал бы. */}
      {allowedTypes.length > 1 && (
        <TextField
          select
          label={t('sdui.objectField.type')}
          value={selectedKey ?? ''}
          onChange={(e) => {
            handleMemberChange(e.target.value)
          }}
          disabled={!f.enabled}
          slotProps={{ input: { readOnly: f.readonly } }}
          sx={{ minWidth: 160 }}
        >
          {allowedTypes.map((tp) => (
            <MenuItem key={memberKey(tp)} value={memberKey(tp)}>
              {/* У примитивных членов бэк presentation не присылает — подписываем
                  по domainKind именами типов 1С, как в ячейке ТЧ. */}
              {tp.presentation ??
                t(`sdui.objectField.primitive.${tp.domainKind}`, {
                  defaultValue: tp.domainKind,
                })}
            </MenuItem>
          ))}
        </TextField>
      )}
      {member && (
        // key: смена члена перемонтирует пикер — чистые inputValue/кэш опций
        <ObjectValuePicker
          key={memberKey(member)}
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
    JSON.stringify(optionsSource ?? null)
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
      onChange={(opt) => {
        onEmit(opt ? buildObjectValue(member, opt) : null)
      }}
    />
  )
}
