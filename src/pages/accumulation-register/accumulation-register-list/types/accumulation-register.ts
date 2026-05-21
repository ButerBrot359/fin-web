export type AccumulationRegisterMovementKind = 'RECEIPT' | 'EXPENSE'

export interface AccumulationRegisterEntry {
  id: number
  /** ISO datetime — системное поле регистра. */
  period?: string | null
  /** Приход / Расход — только для регистров вида BALANCE. */
  movementKind?: AccumulationRegisterMovementKind | null
  /**
   * Reference на DocumentEntry, но без конкретного typeCode (бэк отдаёт
   * только ID). UI-разрешения по ID — см. TODO(phase-3-frontend)
   * в `value-controls.tsx`.
   */
  recorderDocumentEntryId?: number | null
  lineNo?: number | null
  isActive?: boolean
  attributes: Record<string, unknown> | null
}
