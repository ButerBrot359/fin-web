import type { DocumentAttribute } from '@/entities/document-type'
import type { ColumnMetaDto } from '@/entities/document-entry'

export interface DocumentTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number, name: string) => void
  /**
   * Включает серверную фильтрацию: иконку фильтра в заголовках и
   * подключение стора к запросам. Передаётся только для whitelisted typeCode.
   */
  filterTableId?: string
  /** Метаданные колонок из `/columns`. Если не задано — иконки фильтра не рисуем. */
  columnsMeta?: ColumnMetaDto[]
}
