import type { DocumentAttribute } from '@/entities/document-type'
import type { FormConfig, VStackNode } from '@/entities/form-config'

export const buildFallbackConfig = (
  attributes: DocumentAttribute[]
): FormConfig => ({
  name: 'fallback',
  title: '',
  layout: {
    type: 'VStack',
    gap: 4,
    children: attributes.map((attr) => ({
      type: 'Field' as const,
      code: attr.code,
    })),
  } satisfies VStackNode,
})
