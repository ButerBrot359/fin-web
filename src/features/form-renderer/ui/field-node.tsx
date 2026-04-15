import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { FieldNode as FieldNodeType } from '@/entities/form-config'
import {
  IGNORED_DATA_TYPES,
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
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

  const searchParams = useMemo(() => {
    if (!dependency || !sourceValue?.id) return undefined
    return { af: `${dependency.targetAttributeCode}:${String(sourceValue.id)}` }
  }, [dependency, sourceValue?.id])

  if (!attribute) return null

  const { dataType, readonly: isReadOnly } = attribute

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
    const resolved = resolveAttributeDomain(attribute)

    if (resolved && REFERENCE_DOMAIN_KINDS.has(resolved.domain)) {
      const searchUrl = getUniversalSearchUrl(
        resolved.domain,
        resolved.typeCode
      )

      const push = useDictSidebarStore.getState().push

      const handleShowAll = (onSelect: (value: SelectOption) => void) => {
        push({
          mode: 'list',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
          searchParams,
          onSelect,
        })
      }

      const handleAdd = () => {
        push({
          mode: 'create',
          domain: resolved.domain,
          typeCode: resolved.typeCode,
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
          searchParams={searchParams}
          onShowAll={handleShowAll}
          onAdd={handleAdd}
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
