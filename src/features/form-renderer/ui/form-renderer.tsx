import { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type {
  FormConfig,
  ConditionalAppearance,
  FieldFilter,
} from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
import { useTypeDependencies } from '../lib/hooks/use-type-dependencies'
import { NodeRenderer } from './node-renderer'

export interface FormRendererHandle {
  triggerEvent(eventName: string): void
  clearAllTables(): void
}

const EMPTY_FIELD_FILTERS: NonNullable<FormConfig['fieldFilters']> = {}
const EMPTY_APPEARANCE: ConditionalAppearance[] = []

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
  handleRef?: RefObject<FormRendererHandle | null>
  sharedTableReplacersRef?: RefObject<Map<string, (rows: Record<string, unknown>[]) => void>>
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  typeCode,
  handleRef,
  sharedTableReplacersRef,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { dependencyMap } = useTypeDependencies({ attributes })
  const { optionsMap } = useFieldOptions({ attributes, dependencyMap })

  const localTableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  const tableReplacersRef = sharedTableReplacersRef ?? localTableReplacersRef

  const registerTableReplacer = useCallback(
    (code: string, replacer: (rows: Record<string, unknown>[]) => void) => {
      tableReplacersRef.current.set(code, replacer)
    },
    [tableReplacersRef]
  )

  const unregisterTableReplacer = useCallback(
    (code: string) => {
      tableReplacersRef.current.delete(code)
    },
    [tableReplacersRef]
  )

  // Динамическая видимость полей/колонок из formConfig.visibility (SCRUM-263).
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
    {}
  )

  // Условное оформление ячеек ТЧ из formConfig.conditionalAppearance: приходит на
  // OPEN и на событиях. Динамическое значение (если пришло) приоритетнее статического.
  const [dynamicAppearance, setDynamicAppearance] = useState<
    ConditionalAppearance[] | null
  >(null)

  // Отборы пикеров из переизданного дескриптора (§1 КБП-ВНО-ОТБОР). Дескриптор
  // переиздаётся на OnChange, поэтому фильтры полей из событий накапливаем
  // поверх статических (ключ = `<ТЧ><Колонка>`), не только из первого конфига.
  const [dynamicFieldFilters, setDynamicFieldFilters] = useState<Record<
    string,
    FieldFilter
  > | null>(null)

  const { onFieldChange, triggerEvent } = useFormEvents({
    typeCode,
    attributes,
    form,
    tableReplacersRef,
    onVisibility: setVisibilityMap,
    onConditionalAppearance: setDynamicAppearance,
    onFieldFilters: (filters) =>
      setDynamicFieldFilters((prev) => ({ ...prev, ...filters })),
  })

  const clearAllTables = useCallback(() => {
    for (const replacer of tableReplacersRef.current.values()) {
      replacer([])
    }
  }, [tableReplacersRef])

  useEffect(() => {
    if (!handleRef) return
    handleRef.current = { triggerEvent, clearAllTables }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, triggerEvent, clearAllTables])

  // Статические фильтры из OPEN-конфига + переизданные из событий (события
  // приоритетнее для своих ключей). Поля без фильтра нигде не появляются —
  // прочие пикеры не задеты.
  const fieldFilters = useMemo(
    () =>
      dynamicFieldFilters
        ? { ...config.fieldFilters, ...dynamicFieldFilters }
        : config.fieldFilters ?? EMPTY_FIELD_FILTERS,
    [config.fieldFilters, dynamicFieldFilters]
  )
  const conditionalAppearance =
    dynamicAppearance ?? config.conditionalAppearance ?? EMPTY_APPEARANCE

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      language: i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      fieldFilters,
      visibilityMap,
      conditionalAppearance,
      registerTableReplacer,
      unregisterTableReplacer,
    }),
    [
      attributes,
      form,
      i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      fieldFilters,
      visibilityMap,
      conditionalAppearance,
      registerTableReplacer,
      unregisterTableReplacer,
    ]
  )

  return (
    <FormRendererContext value={contextValue}>
      {/* Ошибка настройки метаданных (реквизит не найден): показываем сообщение,
          НЕ подставляя полный справочник. Прочие поля формы остаются доступны. */}
      {config.configError && (
        <div className="mb-3 rounded-md bg-ui-02 px-3 py-2 text-body2 text-error-01">
          {config.configError.message}
        </div>
      )}
      <NodeRenderer node={config.layout} />
    </FormRendererContext>
  )
}
