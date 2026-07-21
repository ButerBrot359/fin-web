import type { ModuleItems } from '../types/module'

/** Есть ли тип (документа/справочника) в структуре модуля: колонки → секции → элементы. */
export function moduleContainsType(
  items: ModuleItems,
  typeCode: string,
): boolean {
  return items.some((column) =>
    column.some((section) =>
      section.elements.some((el) => el.code === typeCode),
    ),
  )
}

/**
 * Первый модуль (в порядке сайдбара), содержащий тип (документа/справочника) (§3.6 SCRUM-268).
 * Никакого хардкода тип→раздел: только метаданные модулей.
 */
export function resolveTypePageCode(
  moduleCodes: string[],
  itemsByModuleCode: Record<string, ModuleItems | undefined>,
  typeCode: string,
): string | undefined {
  return moduleCodes.find((code) => {
    const items = itemsByModuleCode[code]
    return items ? moduleContainsType(items, typeCode) : false
  })
}
