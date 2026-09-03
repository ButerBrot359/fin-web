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

import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { extractReadOnlyColumns } from '../../../lib/utils/read-only-header-model'

interface SelectionRow {
  rowId: string
  [key: string]: unknown
}

/**
 * Список-ОТБОР: витрина формы, выбор строки в которой фильтрует другие таблицы
 * (`useExternalRowFilter`). Порт панели «Отбор по сотруднику» формы «Начисление
 * зарплаты сотрудникам»: слева список сотрудников документа, клик по строке
 * оставляет в табличных частях только его записи.
 *
 * Выбор публикуется в сессию под `<binding>.__selectedRowId` — тот же ключ, что
 * у master-detail, поэтому отбирающая сторона одна на оба механизма. Повторный
 * клик по выбранной строке снимает отбор (в эталоне ту же роль играет крестик
 * очистки поля отбора).
 */
export const SelectionListTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const { getValue, setFromServer } = useSduiSession()

  const columns = useMemo(
    () => extractReadOnlyColumns(node.children),
    [node.children]
  )

  const rows = useMemo<SelectionRow[]>(() => {
    const raw = node.binding ? getValue(node.binding) : undefined
    return Array.isArray(raw) ? (raw as SelectionRow[]) : []
  }, [getValue, node.binding])

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const publish = (rowId: string | null) => {
    setSelectedRowId(rowId)
    if (node.binding) {
      setFromServer(node.binding + '.__selectedRowId', rowId)
    }
  }

  if ((node.props?.visible as boolean | undefined) === false) return null

  return (
    <Box className="flex min-h-0 flex-1 flex-col">
      <Box className="mb-2 flex items-center gap-2">
        <Typography variant="body2" fontWeight={600}>
          {(node.props?.label as string | undefined) ?? ''}
        </Typography>
        <Button
          variant="secondary"
          disabled={selectedRowId === null}
          onClick={() => {
            publish(null)
          }}
        >
          {t('table.clearFilter')}
        </Button>
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ flex: '1 1 auto', overflowY: 'auto' }}
      >
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)}>
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.rowId}
                hover
                selected={row.rowId === selectedRowId}
                className="cursor-pointer"
                onClick={() => {
                  publish(row.rowId === selectedRowId ? null : row.rowId)
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    {renderCellValue(
                      col.binding ? row[col.binding] : undefined
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
