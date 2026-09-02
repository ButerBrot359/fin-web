import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { extractReadOnlyColumns } from '../../../lib/utils/read-only-header-model'

const LEVEL_INDENT = 18

interface ItogiRow {
  rowId: string
  __level: number
  __parentRowId: string | null
  [key: string]: unknown
}

export const ItogiHierarchyTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const { getValue } = useSduiSession()

  const columns = useMemo(
    () => extractReadOnlyColumns(node.children),
    [node.children]
  )

  const rows = useMemo<ItogiRow[]>(() => {
    const raw = node.binding ? getValue(node.binding) : undefined
    return Array.isArray(raw) ? (raw as ItogiRow[]) : []
  }, [getValue, node.binding])

  const [expanded, setExpanded] = useState<Set<string> | null>(null)

  const hasChildren = useMemo(() => {
    const parents = new Set<string>()
    for (const row of rows) {
      if (row.__parentRowId) parents.add(row.__parentRowId)
    }
    return parents
  }, [rows])

  const isExpanded = (rowId: string) => expanded?.has(rowId) === true

  const visibleRows = useMemo(() => {
    const byParent = new Map<string | null, ItogiRow[]>()
    for (const row of rows) {
      const key = row.__parentRowId ?? null
      const list = byParent.get(key)
      if (list) list.push(row)
      else byParent.set(key, [row])
    }
    const out: ItogiRow[] = []
    const raskryt = (rowId: string) => expanded?.has(rowId) === true
    const walk = (parent: string | null) => {
      for (const row of byParent.get(parent) ?? []) {
        out.push(row)
        if (raskryt(row.rowId)) walk(row.rowId)
      }
    }
    walk(null)
    return out
  }, [rows, expanded])

  const toggle = (rowId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  if ((node.props?.visible as boolean | undefined) === false) return null

  const firstColumn = columns[0]

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-2">
        <Button
          variant="secondary"
          onClick={() => {
            setExpanded(new Set())
          }}
        >
          {t('table.collapseAll')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setExpanded(new Set(hasChildren))
          }}
        >
          {t('table.expandAll')}
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id}>
                  <Typography variant="body2" fontWeight={600}>
                    {col.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
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
            {visibleRows.map((row) => {
              const expandable = hasChildren.has(row.rowId)
              return (
                <TableRow key={row.rowId} hover>
                  {columns.map((col) => {
                    const value = renderCellValue(
                      col.binding ? row[col.binding] : undefined
                    )
                    if (col.id !== firstColumn.id) {
                      return (
                        <TableCell key={col.id} sx={{ color: col.textColor }}>
                          {value}
                        </TableCell>
                      )
                    }
                    return (
                      <TableCell key={col.id} sx={{ color: col.textColor }}>
                        <Box
                          className="flex items-center gap-1"
                          style={{ paddingLeft: row.__level * LEVEL_INDENT }}
                        >
                          {expandable ? (
                            <Box
                              component="span"
                              role="button"
                              aria-label={
                                isExpanded(row.rowId)
                                  ? t('table.collapseRow')
                                  : t('table.expandRow')
                              }
                              className="flex cursor-pointer"
                              onClick={() => {
                                toggle(row.rowId)
                              }}
                            >
                              {isExpanded(row.rowId) ? (
                                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                              )}
                            </Box>
                          ) : (
                            <Box component="span" sx={{ width: 18 }} />
                          )}
                          <span>{value}</span>
                        </Box>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
