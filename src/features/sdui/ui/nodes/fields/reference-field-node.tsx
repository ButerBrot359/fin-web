import { useState, type FC } from 'react'
import { IconButton } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useReferenceOptions } from '../../../lib/hooks/use-reference-options'
import { useResolvedOptionsParams } from '../../../lib/hooks/use-resolved-options-params'
import { useSduiDispatch } from '../../../lib/dispatch'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import type { OptionsParamValue } from '../../../lib/utils/resolve-options-params'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { openReferencePicker } from '../../../lib/reference-picker-gateway'

interface ReferenceValue {
  id: number
  presentation: string
}

function toSelectOption(ref: ReferenceValue): SelectOption {
  return { id: ref.id, code: String(ref.id), label: ref.presentation }
}

function fromSelectOption(opt: SelectOption): ReferenceValue {
  return { id: Number(opt.id), presentation: opt.label }
}

// SCRUM-291 §19.3: props.multiple — значение узла в состоянии формы должно
// нормализоваться в массив ReferenceValue независимо от того, в какой форме
// оно там оказалось: сам массив, одиночный объект {id, presentation} (сервер
// когда-то прислал/сохранил его как одиночное значение) или голый скаляр
// number/string (id без presentation). Presentation для голого скаляра
// неизвестна — используем String(id) как заглушку.
function toReferenceValue(raw: unknown): ReferenceValue | null {
  if (raw == null) return null
  if (typeof raw === 'number' || typeof raw === 'string') {
    return { id: Number(raw), presentation: String(raw) }
  }
  if (typeof raw === 'object' && 'id' in raw) {
    const obj = raw as { id: unknown; presentation?: unknown }
    const presentation =
      typeof obj.presentation === 'string' ||
      typeof obj.presentation === 'number'
        ? String(obj.presentation)
        : String(obj.id)
    return { id: Number(obj.id), presentation }
  }
  return null
}

function toReferenceArray(raw: unknown): ReferenceValue[] {
  if (Array.isArray(raw)) {
    return raw
      .map(toReferenceValue)
      .filter((v): v is ReferenceValue => v !== null)
  }
  const single = toReferenceValue(raw)
  return single ? [single] : []
}

export const ReferenceFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const dispatch = useSduiDispatch()
  const { t } = useTranslation()

  const domain = node.props?.domain as string | undefined
  const targetTypeCode = node.props?.targetTypeCode as string | undefined
  const filter = node.props?.filter as Record<string, unknown> | undefined
  const optionsSource = node.props?.optionsSource as
    | { url: string; params?: Record<string, OptionsParamValue> }
    | undefined

  const rawValue = f.value

  // SCRUM-291 §19.3: параметр отчёта ACCOUNT_LIST/REF_LIST — тот же узел
  // REFERENCE_FIELD, но значение множественное. Не путать с props.selectionMode
  // (ELEMENT/GROUP_AND_ELEMENT/GROUP) — другой проп с другой семантикой.
  const multiple = node.props?.multiple === true

  const [inputValue, setInputValue] = useState('')

  // Полностью backend-driven источник данных: url и params приходят с бэка.
  // Фронт не строит URL из domain и не знает бизнес-смысла params.
  // Декларативные зависимости { fromBinding } резолвятся механически из стейта
  // формы (SCRUM-286). Реактивность дропдаупа — через resetKey.
  const url = optionsSource?.url ?? null
  const params = useResolvedOptionsParams(optionsSource?.params)
  const resetKey = JSON.stringify(params)

  const { options, loading, load, loadDebounced, resetOptions } =
    useReferenceOptions(
      (search?: string) =>
        url
          ? fetchReferenceOptions({ url, params, search })
          : Promise.resolve([]),
      resetKey
    )

  if (!f.visible) return null

  const selectedOption =
    !multiple && rawValue ? toSelectOption(rawValue as ReferenceValue) : null
  const selectedOptions = multiple
    ? toReferenceArray(rawValue).map(toSelectOption)
    : []

  const applySelected = (opt: SelectOption | null) => {
    const newVal = opt ? fromSelectOption(opt) : null
    f.setValue(newVal)
    // Сброс кэша опций: следующий onOpen перезапросит свежий список,
    // и запись, созданная из формы выбора, появится без перезагрузки страницы.
    resetOptions()
    f.fireServerEvent('change', newVal)
  }

  const applySelectedMultiple = (opts: SelectOption[]) => {
    const newVal = opts.map(fromSelectOption)
    f.setValue(newVal)
    resetOptions()
    f.fireServerEvent('change', newVal)
  }

  const canBrowse = !!targetTypeCode && !f.readonly && f.enabled

  // Легаси-пикер («Показать все»/создать) получает готовый конкретный фильтр
  // из node.props.filter (бэк кладёт туда {Vladelets: id}); фронт не синтезирует.
  const filterSearchParams = filter
    ? Object.fromEntries(Object.entries(filter).map(([k, v]) => [k, String(v)]))
    : undefined

  const openDictList = () => {
    openReferencePicker({
      mode: 'list',
      domain: domain!,
      typeCode: targetTypeCode!,
      onSelect: applySelected,
      searchParams: filterSearchParams,
      // Список открывается на записи, уже стоящей в поле.
      selectedId: selectedOption?.id,
    })
  }

  // SCRUM-291 §18.3: props.allow* — единственный источник видимости affordance'ов.
  // Асимметрия дефолтов не случайна и повторяет серверную (ReferenceAffordanceResolver):
  // allowShowAll открыт, пока явно не false; остальные три закрыты, пока явно не true.
  const showAllAction = node.actions?.find(
    (a) => a.trigger === 'showAll' && a.actionId === 'command'
  )
  const allowShowAll = node.props?.allowShowAll as boolean | undefined

  const createAction = node.actions?.find(
    (a) => a.trigger === 'create' && a.actionId === 'command'
  )
  const allowCreate = node.props?.allowCreate as boolean | undefined

  const openAction = node.actions?.find(
    (a) => a.trigger === 'open' && a.actionId === 'command'
  )
  const allowOpen = node.props?.allowOpen as boolean | undefined

  const copyAction = node.actions?.find(
    (a) => a.trigger === 'copy' && a.actionId === 'command'
  )
  const allowCopy = node.props?.allowCopy as boolean | undefined

  // Общие пропы автокомплита — одинаковые и для одиночного, и для мульти-режима
  // (§19.3): формула видимости showAll/create не зависит от multiple, J уже
  // гейтит их по allow* (сервер сам шлёт allowShowAll/allowCreate=false для
  // списковых параметров отчёта — доп. спецкейс на multiple не нужен).
  const commonInputProps = {
    inputValue,
    options,
    label: f.label,
    required: f.required,
    readOnly: f.readonly,
    disabled: !f.enabled,
    error: !!f.error,
    helperText: f.error,
    loading,
    // 1С: ввёл часть наименования, нажал Enter — первое подходящее значение подставилось.
    // Включаем точечно у ссылочного поля SDUI, а не по умолчанию в общем компоненте:
    // AutocompleteInput живёт в shared/ и используется легаси-экранами, которым менять
    // семантику Enter в этой задаче нельзя. Подсветка сама снимается на время загрузки —
    // см. highlightFirst в autocomplete-input.tsx.
    autoHighlight: true,
    onInputChange: (_e: unknown, val: string, reason: string) => {
      setInputValue(val)
      if (reason === 'input') {
        loadDebounced(val)
      }
    },
    onOpen: () => {
      if (options.length === 0) {
        load()
      }
    },
    onShowAll:
      showAllAction && allowShowAll !== false
        ? () =>
            void dispatch({
              type: 'COMMAND',
              command: showAllAction.command!,
              sourceNodeId: node.id,
            })
        : !showAllAction && (allowShowAll ?? canBrowse)
          ? openDictList
          : undefined,
    // SCRUM-360 (v5-back): гейт RefActionsCompletenessIT (C1.4a) зелёный —
    // props-only фолбэк `allowCreate ?? canBrowse` снят. Создание идёт только
    // серверной командой create; без createAction кнопки «Добавить» нет.
    onAdd:
      createAction && allowCreate === true
        ? () =>
            void dispatch({
              type: 'COMMAND',
              command: createAction.command!,
              sourceNodeId: node.id,
            })
        : undefined,
  }

  return (
    <div>
      {multiple ? (
        <AutocompleteInput
          multiple
          value={selectedOptions}
          onChange={applySelectedMultiple}
          {...commonInputProps}
        />
      ) : (
        <AutocompleteInput
          value={selectedOption}
          onChange={applySelected}
          {...commonInputProps}
          endAction={
            !selectedOption ? undefined : (
              <>
                {openAction ? (
                  allowOpen === true ? (
                    <IconButton
                      aria-label={t('inputs.openReference')}
                      sx={{ p: '4px', borderRadius: '6px' }}
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        void dispatch({
                          type: 'COMMAND',
                          command: openAction.command!,
                          sourceNodeId: node.id,
                        })
                      }}
                    >
                      <OpenInNewIcon
                        className="text-ui-05"
                        sx={{ fontSize: 20 }}
                      />
                    </IconButton>
                  ) : null
                ) : canBrowse ? (
                  <IconButton
                    aria-label={t('inputs.openReference')}
                    sx={{ p: '4px', borderRadius: '6px' }}
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      openReferencePicker({
                        mode: 'edit',
                        domain: domain!,
                        typeCode: targetTypeCode,
                        entryId: selectedOption.id,
                        onSelect: applySelected,
                      })
                    }}
                  >
                    <OpenInNewIcon
                      className="text-ui-05"
                      sx={{ fontSize: 20 }}
                    />
                  </IconButton>
                ) : null}
                {copyAction && allowCopy === true ? (
                  <IconButton
                    aria-label={t('inputs.copyReference')}
                    sx={{ p: '4px', borderRadius: '6px' }}
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void dispatch({
                        type: 'COMMAND',
                        command: copyAction.command!,
                        sourceNodeId: node.id,
                      })
                    }}
                  >
                    <ContentCopyIcon
                      className="text-ui-05"
                      sx={{ fontSize: 20 }}
                    />
                  </IconButton>
                ) : null}
              </>
            )
          }
        />
      )}
    </div>
  )
}
