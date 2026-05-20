export interface InformationRegisterEntry {
  id: number
  /** ISO datetime / date — системное поле регистра. */
  period?: string | null
  /**
   * Reference на DocumentEntry, но без конкретного typeCode (бэк отдаёт
   * только ID). UI поиска документа по ID — gap, см. TODO(phase-3-frontend)
   * в `value-controls.tsx`.
   */
  recorderDocumentEntryId?: number | null
  isActive?: boolean
  attributes: Record<string, unknown> | null
}
