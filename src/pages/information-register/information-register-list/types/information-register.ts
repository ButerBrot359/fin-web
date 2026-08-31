export interface InformationRegisterEntry {
  id: number
  /** ISO datetime / date — системное поле регистра. */
  period?: string | null
  /**
   * Готовое представление документа-регистратора «Тип №Номер от Дата» — то, что
   * показывает колонка «Регистратор». null у ручной корректировки без
   * регистратора: тогда ячейка пустая, а не «#id».
   */
  recorderDocumentName?: string | null
  /**
   * ID и тип документа-регистратора: показывать их не нужно (для этого есть
   * recorderDocumentName), но по ним открывается карточка документа.
   */
  recorderDocumentEntryId?: number | null
  recorderDocumentTypeCode?: string | null
  /** Номер документа-регистратора отдельным полем (часть представления). */
  recorderDocumentNumber?: string | null
  isActive?: boolean
  attributes: Record<string, unknown> | null
}
