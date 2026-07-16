import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { FieldNode as FieldNodeType } from '@/entities/form-config'
import {
  IGNORED_DATA_TYPES,
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
  getUniversalDirectoriesUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
import type { SelectOption } from '@/shared/types/select-option'
import {
  TextField,
  NumberField,
  EnumField,
  DictField,
  CheckboxField,
  DateTimeField,
  TextareaField,
} from '@/shared/ui/form-fields'
import { useDictSidebarStore } from '@/features/dict-sidebar'

import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'
import {
  fieldFilterToSearchParams,
  mergeSearchParams,
  selectionModeToSearchParams,
} from '../lib/utils/field-filter-params'
import {
  attributeInIsEmpty,
  attributeInToFilterRequest,
} from '../lib/utils/attribute-in-filter'
import { headerFieldPath, isFieldVisible } from '../lib/utils/field-path'
import {
  getOrgScopeSourceFields,
  synthesizeReferenceFilter,
} from '../lib/utils/org-scoped-filter'
import type { FieldDependency } from '../types/renderer-context'
import { TableField } from './table-field'

interface FieldNodeProps {
  node: FieldNodeType
}

export const FieldNode = ({ node }: FieldNodeProps) => {
  const { t } = useTranslation()
  const {
    attributeMap,
    form,
    language,
    optionsMap,
    onFieldChange,
    dependencyMap,
    fieldFilters,
    visibilityMap,
  } = useFormRendererContext()
  const attribute = attributeMap.get(node.code)

  const dependency: FieldDependency | undefined = dependencyMap.get(node.code)
  const sourceValue = form.watch(dependency?.sourceFieldCode ?? '') as
    | { id: number | string; [key: string]: unknown }
    | null
    | undefined

  const isFirstRender = useRef(true)
  const prevSourceId = useRef<number | string | undefined>(sourceValue?.id)

  useEffect(() => {
    if (!dependency) return

    if (isFirstRender.current) {
      isFirstRender.current = false
      prevSourceId.current = sourceValue?.id
      return
    }

    const prevId = prevSourceId.current
    if (prevId !== sourceValue?.id) {
      prevSourceId.current = sourceValue?.id
      if (prevId !== undefined) {
        form.setValue(node.code, null)
      }
    }
  }, [dependency, sourceValue?.id, form, node.code])

  const disabled = dependency ? !sourceValue : false

  // Поля-источники для отбора ссылочного поля (напр. МОЛ → «Организация»;
  // «Договор контрагента» → «Организация» + «Контрагент»). Значения читаем live
  // из формы — фильтр реактивен к их смене.
  const orgSourceFields = useMemo(
    () => (attribute ? getOrgScopeSourceFields(attribute) : []),
    [attribute]
  )
  const orgSourceValues = form.watch(
    orgSourceFields.length > 0 ? orgSourceFields : ['']
  )
  // Сериализованные id источников — стабильный триггер пересчёта searchParams
  // (сам массив orgSourceValues пересоздаётся каждый рендер).
  const orgSourceSignature = orgSourceFields
    .map(
      (code, i) =>
        `${code}:${String((orgSourceValues[i] as { id?: string | number } | null | undefined)?.id ?? '')}`
    )
    .join(',')

  // Фильтр поля: серверный `fieldFilters` имеет приоритет, иначе синтезируем
  // из живых значений полей-источников. Объединяется с af-фильтром зависимости.
  const sourceId = sourceValue?.id
  const searchParams = useMemo(() => {
    const depParams =
      dependency && sourceId != null
        ? { af: `${dependency.targetAttributeCode}:${String(sourceId)}` }
        : undefined
    const effectiveFilter =
      fieldFilters[node.code] ??
      synthesizeReferenceFilter(attribute, (code) => {
        const idx = orgSourceFields.indexOf(code)
        return idx >= 0 ? orgSourceValues[idx] : undefined
      })
    return mergeSearchParams(
      mergeSearchParams(depParams, fieldFilterToSearchParams(effectiveFilter)),
      selectionModeToSearchParams(attribute?.referenceSelectionMode)
    )
    // orgSourceValues читается по актуальному рендеру; пересчёт триггерит orgSourceSignature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dependency,
    sourceId,
    fieldFilters,
    node.code,
    attribute,
    orgSourceFields,
    orgSourceSignature,
  ])

  if (!attribute) return null

  // Динамическая видимость (formConfig.visibility): проверка после всех хуков.
  if (!isFieldVisible(visibilityMap, headerFieldPath(node.code))) return null

  const { dataType, readonly: attrReadOnly } = attribute
  // Динамический readOnly из дескриптора: ключ `"<код>.readOnly": true`
  // (тот же контракт, что у SotrudnikiItemFormHandler) — блокирует поле и кнопку
  // выбора (fail-closed, когда отбор не настроен). Значение — boolean, не
  // FieldFilter, поэтому читаем из карты как unknown.
  const filterReadOnly =
    (fieldFilters as Record<string, unknown>)[`${node.code}.readOnly`] === true
  const isReadOnly = attrReadOnly || filterReadOnly

  if (IGNORED_DATA_TYPES.has(dataType)) return null

  if (dataType === 'TABLE') {
    return (
      <div style={{ flex: node.flex, minWidth: 0 }}>
        <TableField attribute={attribute} form={form} language={language} />
      </div>
    )
  }

  const label =
    node.label ??
    (language === 'kz'
      ? attribute.nameKz || attribute.nameRu
      : attribute.nameRu)

  const required = attribute.isRequired ? t('errors.required') : undefined

  const handleValueChange = attribute.formEvent
    ? () => {
        onFieldChange(node.code)
      }
    : undefined

  const commonProps = {
    name: node.code,
    label,
    control: form.control,
    readOnly: isReadOnly,
    required,
    onValueChange: handleValueChange,
  }

  const getEnumTypeCode = () =>
    (attribute.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ?? ''

  const renderField = () => {
    if (dataType === 'DIRECTORY') {
      const resolved = resolveAttributeDomain(attribute)
      if (resolved) {
        const searchUrl = getUniversalDirectoriesUrl(
          resolved.domain,
          resolved.typeCode
        )

        return (
          <DictField
            {...commonProps}
            searchUrl={searchUrl}
            disabled={disabled}
            searchParams={{ isHierarchical: 'false', ...searchParams }}
            selectOptions={(response) => {
              const entries = response.data as { id: number; code: string | null; displayName?: string; nameRu?: string; nameKz?: string }[]
              return entries.map(
                (entry): SelectOption => ({
                  id: entry.id,
                  code: entry.code ?? '',
                  label:
                    entry.displayName ||
                    (language === 'kz'
                      ? entry.nameKz || entry.nameRu
                      : entry.nameRu) ||
                    '',
                  raw: entry as unknown as Record<string, unknown>,
                })
              )
            }}
          />
        )
      }
      return null
    }

    if (dataType === 'OBJECT') {
      const allowedTypes = attribute.allowedTypes ?? []
      if (allowedTypes.length === 0) return null

      const primaryResolved = { domain: allowedTypes[0].domainKind, typeCode: allowedTypes[0].typeCode }
      const searchUrl = getUniversalSearchUrl(primaryResolved.domain, primaryResolved.typeCode)

      return (
        <DictField
          {...commonProps}
          searchUrl={searchUrl}
          disabled={disabled}
          searchParams={searchParams}
        />
      )
    }

    const resolved = resolveAttributeDomain(attribute)

    if (resolved && REFERENCE_DOMAIN_KINDS.has(resolved.domain)) {
      // Отбор `attributeIn` (эталон КБП «Отбор.Ссылка», напр. ВидНМА): пикер
      // ограничен НАБОРОМ id → Filter-DSL POST `/api/dictionaries/entries/
      // {typeCode}/search`, а не GET с `af=`. Пустой набор ⇒ 0 вариантов.
      const dslBody = attributeInToFilterRequest(fieldFilters[node.code])
      const dslEmpty = attributeInIsEmpty(fieldFilters[node.code])
      const isDsl = dslBody != null
      const searchUrl = isDsl
        ? `/api/dictionaries/entries/${resolved.typeCode}/search`
        : getUniversalSearchUrl(resolved.domain, resolved.typeCode)

      const push = useDictSidebarStore.getState().push

      // При создании новой записи из ссылочного поля предзаполняем реквизит-владелец
      // значением поля-источника по зависимости справочника (dependsOn). Напр. для
      // «Договор контрагента» это Vladelets = Контрагент документа — пользователю не
      // нужно выбирать контрагента вручную в форме нового договора.
      const createDefaults =
        dependency && sourceValue
          ? { [dependency.targetAttributeCode]: sourceValue }
          : undefined

      const handleShowAll = (onSelect: (value: SelectOption) => void) => {
        push({
          mode: 'list',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          searchParams,
          defaults: createDefaults,
          onSelect,
        })
      }

      const handleAdd = () => {
        push({
          mode: 'create',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          defaults: createDefaults,
          onSelect: (val: SelectOption) => {
            form.setValue(node.code, val.raw ?? null)
            handleValueChange?.()
          },
        })
      }

      const handleOpenEntry = (entryId: number | string) => {
        push({
          mode: 'edit',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          entryId,
          onSelect: (val: SelectOption) => {
            form.setValue(node.code, val.raw ?? null)
            handleValueChange?.()
          },
        })
      }

      return (
        <DictField
          {...commonProps}
          options={optionsMap[node.code] ?? []}
          searchUrl={searchUrl}
          disabled={disabled}
          // DSL-отбор: тело POST + признак пустого набора; `af=`-params не нужны.
          searchParams={isDsl ? undefined : searchParams}
          searchBody={dslBody}
          searchEmpty={dslEmpty}
          // readOnly (в т.ч. fail-closed) блокирует и выбор из справочника,
          // и создание новой записи.
          onShowAll={isReadOnly ? undefined : handleShowAll}
          onAdd={isReadOnly ? undefined : handleAdd}
          onOpenEntry={handleOpenEntry}
        />
      )
    }

    switch (dataType) {
      case 'STRING':
        return <TextField {...commonProps} />
      case 'TEXT':
        return <TextareaField {...commonProps} />
      case 'INTEGER':
      case 'DECIMAL':
        return <NumberField {...commonProps} decimal={dataType === 'DECIMAL'} />
      case 'BOOLEAN':
        return <CheckboxField {...commonProps} />
      case 'DATE':
      case 'DATETIME':
        return <DateTimeField {...commonProps} dateOnly={dataType === 'DATE'} />
      case 'ENUMS':
        return <EnumField {...commonProps} enumTypeCode={getEnumTypeCode()} />
      default:
        return <TextField {...commonProps} />
    }
  }

  return <div style={{ flex: node.flex }}>{renderField()}</div>
}
