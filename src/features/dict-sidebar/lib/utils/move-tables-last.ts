import type { FormConfig, FormNode } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

export function moveTablesLast(
  config: FormConfig,
  attributes: DocumentAttribute[]
): FormConfig {
  const { layout } = config

  if (layout.type !== 'VStack' || !('children' in layout)) return config

  const tableCodes = new Set(
    attributes.filter((a) => a.dataType === 'TABLE').map((a) => a.code)
  )

  const nonTableChildren: FormNode[] = []
  const tableChildren: FormNode[] = []

  for (const child of layout.children) {
    if (child.type === 'Field' && tableCodes.has(child.code)) {
      tableChildren.push(child)
    } else {
      nonTableChildren.push(child)
    }
  }

  if (tableChildren.length === 0) return config

  return {
    ...config,
    layout: {
      ...layout,
      children: [...nonTableChildren, ...tableChildren],
    },
  }
}
