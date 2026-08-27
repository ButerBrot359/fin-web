import type { FC } from 'react'

import type { NodeProps, ViewNode } from '../../../types/view'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import type { TableColumnDef } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { ComplexEditableTable } from './complex-editable-table'
import { AccountingPostingsBlock } from './accounting-postings-block'
import { ReadOnlyTable } from './read-only-table'
import { SubordinationTree } from './subordination-tree'
import { KalendariTemplateTable } from './kalendari-template-table'
import { isTabelMatrixNode } from './tabel/tabel-matrix-contract'
import { TabelMatrixTable } from './tabel/tabel-matrix-table'

/**
 * Дискриминатор kalendari-таблиц по binding (v2-back §1). Спец-пропа нет —
 * классификация намеренно ограничена карточкой Kalendari (реестр §9, D-10).
 */
export function kalendariTableKind(
  binding: string | undefined
): 'template' | 'schedule' | null {
  if (binding === 'ShablonZapolneniya') return 'template'
  if (binding === 'RaspisanieRaboty') return 'schedule'
  return null
}

export function extractEditableColumns(
  children: ViewNode[] | undefined
): TableColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => nodeToTableColumnDef(c))
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  // Матрица Табеля (SCRUM-276): все три признака дискриминатора обязаны
  // совпасть, иначе обычный рендер — без декодирования packed-строк.
  if (isTabelMatrixNode(node)) return <TabelMatrixTable node={node} />

  const editable = node.props?.editable === true

  if (editable) {
    const kalendariKind = kalendariTableKind(node.binding)
    if (kalendariKind === 'template')
      return <KalendariTemplateTable node={node} />
    // Расписание работы самостоятельно не рендерится (spec v3): его узел
    // остаётся в дереве как источник binding/id, а UI — колонка «Рабочее
    // время» и модалка внутри KalendariTemplateTable.
    if (kalendariKind === 'schedule') return null

    // Route to complex table if COLUMN_GROUP children exist or master-detail props present
    const hasGroups = node.children?.some((c) => c.type === 'COLUMN_GROUP')
    const hasMasterDetail = !!(
      node.props?.masterTable &&
      node.props.masterKey &&
      node.props.detailKey
    )
    const hasFooter =
      node.children?.some(
        (c) => c.type === 'TABLE_COLUMN' && c.props?.footer === true
      ) ||
      node.children?.some(
        (c) =>
          c.type === 'COLUMN_GROUP' &&
          c.children?.some((cc) => cc.props?.footer === true)
      )

    if (hasGroups || hasMasterDetail || hasFooter) {
      return <ComplexEditableTable node={node} />
    }

    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  // Read-only path: дерево связанных документов → отдельный рендер (SCRUM-301),
  // бухрегистр — 1С-блок, остальные — прежняя таблица
  if (node.props?.rowMode === 'TREE') {
    return <SubordinationTree node={node} />
  }
  if (node.props?.regKind === 'ACCOUNTING') {
    return <AccountingPostingsBlock node={node} />
  }
  return <ReadOnlyTable node={node} />
}
