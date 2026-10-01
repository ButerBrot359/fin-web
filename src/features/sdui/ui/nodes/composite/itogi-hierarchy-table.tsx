import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'
import { useBindingValue } from '../../../lib/sdui-session-context'
import {
  extractItogiColumns,
  itogiBodyCells,
  itogiTreeLayout,
  type ItogiRow,
} from '../../../lib/utils/itogi-columns'
import { buildItogiHeader } from '../../../lib/utils/itogi-header-model'
import { itogiParentIds, visibleItogiRows } from '../../../lib/utils/itogi-tree'
import {
  parseRowAppearance,
  resolveRowBackground,
} from '../../../lib/utils/row-appearance'
import { NodeRenderer } from '../../node-renderer'
import { ItogiHeader } from './itogi/itogi-header'
import { ItogiBodyRow } from './itogi/itogi-body-row'

const COLUMN_TYPES = new Set(['TABLE_COLUMN', 'COLUMN_GROUP'])

const NOTHING_OPEN: ReadonlySet<string> = new Set()

interface Expansion {
  source: unknown
  open: ReadonlySet<string>
}

export const ItogiHierarchyTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const raw = useBindingValue(node.binding)

  const columns = useMemo(
    () => extractItogiColumns(node.children),
    [node.children]
  )
  const layout = useMemo(() => itogiTreeLayout(columns), [columns])
  const header = useMemo(
    () => buildItogiHeader(columns, layout),
    [columns, layout]
  )
  const toolbarNodes = useMemo(
    () => (node.children ?? []).filter((c) => !COLUMN_TYPES.has(c.type)),
    [node.children]
  )
  const rowAppearance = useMemo(
    () => parseRowAppearance(node.props),
    [node.props]
  )

  const rows = useMemo<ItogiRow[]>(
    () => (Array.isArray(raw) ? (raw as ItogiRow[]) : []),
    [raw]
  )
  const parents = useMemo(() => itogiParentIds(rows), [rows])

  const [expansion, setExpansion] = useState<Expansion>({
    source: raw,
    open: NOTHING_OPEN,
  })
  const open = expansion.source === raw ? expansion.open : NOTHING_OPEN
  const setOpen = (next: ReadonlySet<string>) => {
    setExpansion({ source: raw, open: next })
  }

  const visibleRows = useMemo(() => visibleItogiRows(rows, open), [rows, open])

  const toggle = (rowId: string) => {
    const next = new Set(open)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    setOpen(next)
  }

  if ((node.props?.visible as boolean | undefined) === false) return null

  return (
    <Box className="flex min-h-0 flex-1 flex-col">
      <Box className="flex items-center gap-2 mb-2">
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(NOTHING_OPEN)
          }}
        >
          {t('table.collapseAll')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(new Set(parents))
          }}
        >
          {t('table.expandAll')}
        </Button>
        {toolbarNodes.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ flex: '1 1 auto', overflow: 'auto' }}
      >
        {/* Скролл живёт внутри свода — шапка колонок обязана оставаться видимой
            (та же причина, что у ТЧ: без stickyHeader заголовки уезжают вместе
            со строками). */}
        <Table size="small">
          <ItogiHeader rows={header} />
          <TableBody>
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)}>
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => (
              <ItogiBodyRow
                key={row.rowId}
                row={row}
                cells={itogiBodyCells(columns, layout, row)}
                background={resolveRowBackground(rowAppearance, row)}
                expandable={parents.has(row.rowId)}
                expanded={open.has(row.rowId)}
                onToggle={toggle}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
