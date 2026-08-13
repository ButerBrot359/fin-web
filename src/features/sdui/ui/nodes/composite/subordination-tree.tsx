import { useEffect, type FC } from 'react'
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
import {
  useSelection,
  useSelectionStore,
} from '../../../lib/stores/selection-store'
import { armNewTab } from '../../../lib/workspace-tab-gateway'

// Шаг отступа уровня дерева; базовые 8px — обычный горизонтальный padding ячейки
const INDENT_STEP_PX = 24
const BASE_PADDING_PX = 8

// Стабильная ссылка для пустого списка строк — иначе `?? []` создавал бы
// новый массив на каждый рендер и дёргал useEffect-реконсиляцию зря.
const EMPTY_ROWS: RelatedTreeRow[] = []

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
  const anchorIdProp = node.props?.anchorId as string | undefined
  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as RelatedTreeRow[] | undefined) ?? EMPTY_ROWS

  // SCRUM-288 §2.2: выделение пишется в объединённый стор по selectionField
  // select-действия узла (тот же паттерн, что и у list-node/пикера). Без
  // select-действия (флаг выключён) — старый путь мёртв, ничего не пишем.
  const selectAction = node.actions?.find((a) => a.trigger === 'select')
  const selectionField = selectAction?.selectionField ?? undefined
  const setSelection = useSelectionStore((s) => s.setSelection)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  const selectedId = useSelection(selectionField ?? null)

  if (import.meta.env.DEV && !anchorIdProp) {
    console.warn('[sdui] SubordinationTree без anchorId в props')
  }

  // Реконсиляция выделения после перестроения дерева (фикс финального ревью
  // SCRUM-301, Important 1): снимок в сторе может отстать от нового rows —
  // строка могла пропасть после перестроения.
  useEffect(() => {
    if (!selectionField || selectedId == null) return
    if (!rows.some((r) => r.rowId === selectedId)) {
      clearSelection(selectionField)
    }
  }, [rows, selectedId, selectionField, clearSelection])

  const handleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    if (!selectionField) return // флаг выкл: select-действия нет — старый путь мёртв, ничего не пишем
    setSelection(selectionField, row.rowId)
  }

  const handleDoubleClick = (row: RelatedTreeRow) => {
    if (row._isTruncated === true) return
    const ref = row._type?.entityRef
    const route =
      row._route ??
      (ref ? `/documents/${ref.typeCode}/${String(ref.id)}` : undefined)
    if (!route) return
    // Активная вкладка — sdui-panel, и пока она активна, layout рендерит хост
    // панели вместо route-children: без активации обычной вкладки документа
    // navigate поменяет только URL (спека v2 SCRUM-301).
    // Порядок важен: armNewTab() строго после гарда !route — иначе взведённый one-shot флаг без навигации утёк бы в следующий переход.
    armNewTab()
    void navigate(route)
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.rowId}
              hover={row._isTruncated !== true}
              selected={selectedId === row.rowId}
              title={row._status}
              aria-label={row._status}
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
