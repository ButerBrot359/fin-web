import { useMemo, useRef, useState, type FC } from 'react'
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
  TextField,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
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
  const dispatch = useSduiDispatch()

  const columns = useMemo(
    () => extractReadOnlyColumns(node.children),
    [node.children]
  )

  const rows = useMemo<SelectionRow[]>(() => {
    const raw = node.binding ? getValue(node.binding) : undefined
    return Array.isArray(raw) ? (raw as SelectionRow[]) : []
  }, [getValue, node.binding])

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  // Список сотрудников документа может быть длинным (десятки строк), а панель
  // узкая — искать глазами неудобно. Фильтр чисто клиентский: строки уже
  // целиком загружены (витрина формы), сервер тут ни при чём.
  const [query, setQuery] = useState('')
  const visibleRows = useMemo(() => {
    const nuzhno = query.trim().toLowerCase()
    if (!nuzhno) return rows
    return rows.filter((row) =>
      columns.some((col) =>
        renderCellValue(col.binding ? row[col.binding] : undefined)
          .toLowerCase()
          .includes(nuzhno)
      )
    )
  }, [rows, columns, query])

  // Хвост очереди отправленных EVENT'ов этого узла. dispatch.ts даёт in-flight-
  // гард от параллельных запросов ТОЛЬКО action.type === 'COMMAND' (SCRUM-330,
  // строка 71); EVENT-путь им не защищён. При быстром переключении сотрудников
  // это гонка: два запроса уходят параллельно, и если ответ на БОЛЕЕ РАННИЙ
  // клик придёт по сети ПОЗЖЕ ответа на следующий, его patches применяются
  // последними и откатывают своды/подвалы «Итого» на прошлого сотрудника —
  // воспроизведено на стенде 03.09.2026 (footer показывал суммы предыдущего
  // выбора, хотя строки таблицы уже отфильтрованы по новому). Сериализация
  // очередью промисов гарантирует, что ответы применяются строго в порядке
  // кликов, а не в порядке прихода по сети.
  const pendingRef = useRef<Promise<unknown>>(Promise.resolve())

  // Выбор публикуется дважды: в сессию — для клиентского отбора строк ТЧ
  // (ОтборСтрокТабЧастей), и EVENT'ом на сервер — потому что от того же выбора
  // зависят свод «Итоги» (набор ФизЛица) и подвалы «Итого» вкладок
  // (ЗаполнитьПоляИтогиПоТабЧастям). Порт СписокСотрудниковВыбор :1103.
  const publish = (row: SelectionRow | null) => {
    const rowId = row?.rowId ?? null
    setSelectedRowId(rowId)
    if (node.binding) {
      setFromServer(node.binding + '.__selectedRowId', rowId)
    }
    if (
      node.actions?.some(
        (a) => a.trigger === 'change' && a.actionId === 'fieldEvent'
      )
    ) {
      pendingRef.current = pendingRef.current.then(() =>
        dispatch({
          type: 'EVENT',
          sourceNodeId: node.id,
          trigger: 'change',
          value: row,
        })
      )
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

      <TextField
        size="small"
        fullWidth
        placeholder={t('table.searchPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
        }}
        sx={{ mb: 1 }}
      />

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
              <TableRow
                key={row.rowId}
                hover
                selected={row.rowId === selectedRowId}
                className="cursor-pointer"
                onClick={() => {
                  publish(row.rowId === selectedRowId ? null : row)
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
