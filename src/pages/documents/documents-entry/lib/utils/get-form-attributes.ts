import type { DocumentAttribute } from '@/entities/document-type'

export const getFormAttributes = (
  attributes: DocumentAttribute[]
): DocumentAttribute[] =>
  attributes
    .filter((attr) => attr.showInForm)
    .sort((a, b) => a.sortOrder - b.sortOrder)
