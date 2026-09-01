import type { TabPageType } from '@/features/workspace-tabs'

// Только SDUI-поддержанные виды экрана дают tab на 200 (§3 бэк-спеки).
const KIND_TO_PAGE_TYPE: Record<string, TabPageType> = {
  MODULE: 'module',
  DOCUMENT: 'document-entry',
  DOCUMENT_NEW: 'document-entry',
  DICTIONARY: 'dictionary-entry',
  DICTIONARY_NEW: 'dictionary-entry',
  // SCRUM-353: карточка записи регистра сведений (создание и правка — один kind,
  // бэк не разводит REGISTER_NEW).
  REGISTER: 'information-register-entry',
}

export function mapKindToPageType(kind: string): TabPageType | null {
  return KIND_TO_PAGE_TYPE[kind] ?? null
}
