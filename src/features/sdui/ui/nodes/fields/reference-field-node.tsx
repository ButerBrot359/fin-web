import { useState, type FC } from 'react'

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
import {
  toSelectOption,
  fromSelectOption,
  toReferenceArray,
  type ReferenceValue,
} from '../../../lib/utils/reference-value'
import { readReferenceAffordances } from '../../../lib/utils/reference-affordances'
import {
  useStableSelectOption,
  useStableSelectOptions,
} from '../../../lib/hooks/use-stable-select-option'
import { ReferenceEndActions } from './reference-end-actions'

const EMPTY_OPTIONS: SelectOption[] = []

export const ReferenceFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const dispatch = useSduiDispatch()

  const domain = node.props?.domain as string | undefined
  const multiSelectBinding = node.props?.binding as string | undefined
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

  // Ссылка на value обязана быть стабильной между рендерами, иначе MUI стирает набранный
  // текст на каждом нажатии клавиши — см. useStableSelectOption. Хуки стоят ДО раннего
  // возврата по visible: порядок вызова хуков не должен зависеть от условия.
  const selectedOption = useStableSelectOption(
    !multiple && rawValue ? toSelectOption(rawValue as ReferenceValue) : null
  )
  const selectedOptions = useStableSelectOptions(
    multiple
      ? toReferenceArray(rawValue, multiSelectBinding).map(toSelectOption)
      : EMPTY_OPTIONS
  )

  if (!f.visible) return null

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
  // Асимметрия дефолтов (allowShowAll открыт, остальные закрыты) — см.
  // reference-affordances.ts.
  const { showAll, create, open, copy } = readReferenceAffordances(node)

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
    // SCRUM-317 v4 §4.1: текст ошибки живёт в панели и тултипе — под полем только рамка
    error: !!f.error,
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
      showAll.action && showAll.allow !== false
        ? () =>
            void dispatch({
              type: 'COMMAND',
              command: showAll.action!.command!,
              sourceNodeId: node.id,
            })
        : !showAll.action && (showAll.allow ?? canBrowse)
          ? openDictList
          : undefined,
    // SCRUM-360 (v5-back): гейт RefActionsCompletenessIT (C1.4a) зелёный —
    // props-only фолбэк `allowCreate ?? canBrowse` снят. Создание идёт только
    // серверной командой create; без createAction кнопки «Добавить» нет.
    onAdd:
      create.action && create.allow === true
        ? () =>
            void dispatch({
              type: 'COMMAND',
              command: create.action!.command!,
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
              <ReferenceEndActions
                nodeId={node.id}
                open={open}
                copy={copy}
                canBrowse={canBrowse}
                onLegacyOpen={() => {
                  // Вызывается только при canBrowse (гейт в ReferenceEndActions),
                  // поэтому domain/targetTypeCode здесь заведомо заданы.
                  openReferencePicker({
                    mode: 'edit',
                    domain: domain!,
                    typeCode: targetTypeCode!,
                    entryId: selectedOption.id,
                    onSelect: applySelected,
                  })
                }}
              />
            )
          }
        />
      )}
    </div>
  )
}
