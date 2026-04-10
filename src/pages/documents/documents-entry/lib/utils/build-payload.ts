import type {
  CreateDocumentEntryPayload,
  DocumentEntry,
} from '@/entities/document-entry'

export const buildPayload = (
  isPosted: boolean,
  attributes: Record<string, unknown>,
  isNew: boolean,
  existingEntry: DocumentEntry | null
): CreateDocumentEntryPayload => ({
  code: isNew ? '' : (existingEntry?.code ?? ''),
  nameRu: isNew ? '' : (existingEntry?.nameRu ?? ''),
  nameKz: isNew ? '' : (existingEntry?.nameKz ?? ''),
  parentId: isNew ? null : (existingEntry?.parentId ?? null),
  sortOrder: isNew ? 0 : (existingEntry?.sortOrder ?? 0),
  isPosted,
  attributes,
})
