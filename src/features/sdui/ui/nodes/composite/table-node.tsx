import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  nodeToTableColumnDef,
  renderCellValue,
} from '../../../lib/utils/build-column-defs'
import type { TableColumnDef } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { ComplexEditableTable } from './complex-editable-table'
import { AccountingPostingsBlock } from './accounting-postings-block'

interface ReadOnlyColumnDef {
  id: string
  label: string
  binding?: string
  flex?: number | string
}

/** Рекурсивно собирает листовые TABLE_COLUMN (включая вложенные в COLUMN_GROUP) в порядке документа. */
function collectLeafColumns(node: ViewNode): ViewNode[] {
  if (node.type === 'TABLE_COLUMN') return [node]
  if (node.type === 'COLUMN_GROUP') return (node.children ?? []).flatMap(collectLeafColumns)
  return []
}

export function extractReadOnlyColumns(
  children: ViewNode[] | undefined,
): ReadOnlyColumnDef[] {
  if (!children) return []
  return children.flatMap(collectLeafColumns).map((c) => {
    const col = nodeToTableColumnDef(c)
    return {
      id: col.id,
      label: col.label,
      binding: col.binding,
      flex: col.flex,
    }
  })
}

interface HeaderCell {
  id: string
  label: string
  colSpan?: number
  rowSpan?: number
  align?: 'center'
}

interface HeaderModel {
  hasGroups: boolean
  topRow: HeaderCell[]
  bottomRow: HeaderCell[]
}

/**
 * Модель двухрядной шапки read-only таблицы.
 * COLUMN_GROUP → ячейка верхнего ряда (colSpan = число листьев), листья → нижний ряд.
 * Плоский TABLE_COLUMN при наличии групп → rowSpan=2.
 * Без групп colSpan/rowSpan не проставляются — DOM идентичен прежнему рендеру.
 * Пустые COLUMN_GROUP пропускаются (colSpan: 0 невалиден).
 */
export function buildHeaderModel(children: ViewNode[] | undefined): HeaderModel {
  const nodes = children ?? []

  // First pass: check if there are any non-empty groups
  const hasNonEmptyGroups = nodes.some((node) => {
    if (node.type === 'COLUMN_GROUP') {
      return collectLeafColumns(node).length > 0
    }
    return false
  })

  const topRow: HeaderCell[] = []
  const bottomRow: HeaderCell[] = []

  // Second pass: build rows
  for (const node of nodes) {
    if (node.type === 'TABLE_COLUMN') {
      const col = nodeToTableColumnDef(node)
      topRow.push({
        id: col.id,
        label: col.label,
        ...(hasNonEmptyGroups ? { rowSpan: 2 } : {}),
      })
    } else if (node.type === 'COLUMN_GROUP') {
      const leaves = collectLeafColumns(node)
      if (leaves.length === 0) {
        // Skip empty groups entirely
        continue
      }
      topRow.push({
        id: node.id,
        label: (node.props?.label as string | undefined) ?? '',
        colSpan: leaves.length,
        align: 'center',
      })
      for (const leaf of leaves) {
        const col = nodeToTableColumnDef(leaf)
        bottomRow.push({ id: col.id, label: col.label })
      }
    }
  }

  return { hasGroups: hasNonEmptyGroups, topRow, bottomRow }
}

function extractEditableColumns(
  children: ViewNode[] | undefined,
): TableColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => nodeToTableColumnDef(c))
}

interface SimpleTableRow {
  rowId: string
  [key: string]: unknown
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const editable = (node.props?.editable as boolean | undefined) ?? true

  if (editable) {
    // Route to complex table if COLUMN_GROUP children exist or master-detail props present
    const hasGroups = node.children?.some((c) => c.type === 'COLUMN_GROUP')
    const hasMasterDetail = !!(node.props?.masterTable && node.props?.masterKey && node.props?.detailKey)
    const hasFooter = node.children?.some(
      (c) => c.type === 'TABLE_COLUMN' && c.props?.footer === true,
    ) || node.children?.some(
      (c) => c.type === 'COLUMN_GROUP' && c.children?.some(
        (cc) => cc.props?.footer === true,
      ),
    )

    if (hasGroups || hasMasterDetail || hasFooter) {
      return <ComplexEditableTable node={node} />
    }

    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  // Read-only path: бухрегистр — 1С-блок, остальные — прежняя таблица
  if (node.props?.regKind === 'ACCOUNTING') {
    return <AccountingPostingsBlock node={node} />
  }
  return <ReadOnlyTable node={node} />
}

const ReadOnlyTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const label = node.props?.label as string | undefined
  const allowAdd = node.props?.allowAdd as boolean | undefined
  const allowDelete = node.props?.allowDelete as boolean | undefined

  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as SimpleTableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractReadOnlyColumns(node.children)
  const headerModel = buildHeaderModel(node.children)

  const handleAdd = () => {
    void dispatch({ type: 'COMMAND', command: `addRow:${node.binding}` })
  }

  const handleDelete = (rowId: string) => {
    void dispatch({
      type: 'COMMAND',
      command: `deleteRow:${node.binding}:${rowId}`,
    })
  }

  return (
    <div>
      {(label || allowAdd) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          }}
        >
          {label && (
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {label}
            </Typography>
          )}
          {allowAdd && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              variant="outlined"
            >
              {t('table.add')}
            </Button>
          )}
        </div>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headerModel.topRow.map((cell) => (
                <TableCell
                  key={cell.id}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  align={cell.align}
                >
                  {cell.label}
                </TableCell>
              ))}
              {allowDelete && (
                <TableCell
                  padding="checkbox"
                  rowSpan={headerModel.hasGroups ? 2 : undefined}
                />
              )}
            </TableRow>
            {headerModel.hasGroups && (
              <TableRow>
                {headerModel.bottomRow.map((cell) => (
                  <TableCell key={cell.id}>{cell.label}</TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (allowDelete ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.rowId}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      {col.binding !== undefined
                        ? renderCellValue(row[col.binding])
                        : ''}
                    </TableCell>
                  ))}
                  {allowDelete && (
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(row.rowId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
