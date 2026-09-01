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
  // SCRUM-370 блок А: ключ — TabKind С ПРОВОДА. TabMetaResolver.mapKind бэка
  // схлопывает REPORT/REPORT_ALT/ACCOUNTING_REPORT в один TabKind.REPORT;
  // 200 на этом kind сегодня даёт только контур reportalt. Если SDUI-ветка
  // появится у ОСВ/старого контура — запись делить по маршруту.
  REPORT: 'reportalt',
}

export function mapKindToPageType(kind: string): TabPageType | null {
  return KIND_TO_PAGE_TYPE[kind] ?? null
}
