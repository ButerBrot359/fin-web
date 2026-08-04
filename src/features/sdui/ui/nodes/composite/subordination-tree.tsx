import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'

import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'

import type { NodeProps } from '../../../types/view'
import type { RelatedTreeRow } from '../../../types/related-docs'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useRelatedDocsStore } from '../../../lib/stores/related-docs-store'

// Шаг отступа уровня дерева; базовые 8px — обычный горизонтальный padding ячейки
const INDENT_STEP_PX = 24
const BASE_PADDING_PX = 8

// Приоритет: пометка на удаление → проведён → черновик (бэк-спека §4.1)
const StatusIcon: FC<{ row: RelatedTreeRow }> = ({ row }) => {
  if (row._isDeletionMarked)
    return <DocDeletedIcon className="h-4 w-4 shrink-0" />
  if (row._isPosted) return <DocPostedIcon className="h-4 w-4 shrink-0" />
  return <DocDraftIcon className="h-4 w-4 shrink-0" />
}

// Дерево структуры подчинённости (SCRUM-301): плоский список строк с бэка,
// порядок строк = порядок отрисовки. Одиночный клик — выделение (для команд
// тулбара), двойной — проваливание в документ; маркеры обрыва инертны.
export const SubordinationTree: FC<NodeProps> = ({ node }) => {
  const navigate = useNavigate()
  const anchorId = (node.props?.anchorId as string | undefined) ?? ''
  const { getValue } = useSduiSession()
  const rows = (getValue(node.binding) as RelatedTreeRow[] | undefined) ?? []
  const selected = useRelatedDocsStore((s) => s.selected[anchorId])
  const select = useRelatedDocsStore((s) => s.select)

  const handleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    select(anchorId, {
      rowId: row.rowId,
      isDeletionMarked: row._isDeletionMarked,
    })
  }

  const handleDoubleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    const ref = row._type?.entityRef
    const route =
      row._route ??
      (ref ? `/documents/${ref.typeCode}/${String(ref.id)}` : undefined)
    if (route) void navigate(route)
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.rowId}
              hover={row._isTruncated !== true}
              selected={selected?.rowId === row.rowId}
              title={row._status}
              onClick={() => {
                handleClick(row)
              }}
              onDoubleClick={() => {
                handleDoubleClick(row)
              }}
              sx={{ cursor: row._isTruncated === true ? 'default' : 'pointer' }}
            >
              <TableCell
                style={{
                  paddingLeft: `${String(BASE_PADDING_PX + row._level * INDENT_STEP_PX)}px`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {row._isTruncated !== true && <StatusIcon row={row} />}
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: row._isCurrent ? 600 : 400 }}
                  >
                    {row._presentation}
                  </Typography>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
