import type { FC } from 'react'

import type { NodeProps, ViewNode } from '../../../types/view'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import type { TableColumnDef } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { ComplexEditableTable } from './complex-editable-table'
import { AccountingPostingsBlock } from './accounting-postings-block'
import { ReadOnlyTable } from './read-only-table'
import { SubordinationTree } from './subordination-tree'

function extractEditableColumns(
  children: ViewNode[] | undefined
): TableColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => nodeToTableColumnDef(c))
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const editable = node.props?.editable === true

  if (editable) {
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
