import type { FC, ReactElement } from 'react'
import { Box, FormHelperText } from '@mui/material'

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
import { ItogiHierarchyTable } from './itogi-hierarchy-table'
import { SelectionListTable } from './selection-list-table'

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

const renderTable = (node: ViewNode): ReactElement | null => {
  // SCRUM-70: невидимая таблица ≠ пустая таблица (чек-лист ограничения
  // скрыт, пока гейт-флаг выключен). Строго `=== false`: у большинства
  // таблиц пропа нет вовсе — они рендерятся как раньше.
  if ((node.props?.visible as boolean | undefined) === false) return null

  // Матрица Табеля (SCRUM-276): все три признака дискриминатора обязаны
  // совпасть, иначе обычный рендер — без декодирования packed-строк.
  if (isTabelMatrixNode(node)) return <TabelMatrixTable node={node} />

  // Свод «Итоги» (Начисление зарплаты): строки приходят плоским списком с
  // __level/__parentRowId, показ — дерево со сворачиванием, а не таблица ТЧ.
  if (node.props?.hierarchical === true)
    return <ItogiHierarchyTable node={node} />

  // Список-отбор: витрина, выбор в которой фильтрует другие ТЧ формы.
  if (node.props?.selectionList === true)
    return <SelectionListTable node={node} />

  const editable = node.props?.editable === true

  if (editable) {
    const kalendariKind = kalendariTableKind(node.binding)
    if (kalendariKind === 'template')
      return <KalendariTemplateTable node={node} />
    // Расписание работы самостоятельно не рендерится (spec v3): его узел
    // остаётся в дереве как источник binding/id, а UI — колонка «Рабочее
    // время» и модалка внутри KalendariTemplateTable.
    if (kalendariKind === 'schedule') return null

    // SCRUM-363: потоковый ввод (autoAdvance) живёт в ComplexEditableTable —
    // плоская таблица с флагом тоже уходит туда.
    const hasAutoAdvance = node.props?.autoAdvance === true
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

    if (hasGroups || hasMasterDetail || hasFooter || hasAutoAdvance) {
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

export const TableNode: FC<NodeProps> = ({ node }) => {
  const content = renderTable(node)
  const error =
    typeof node.props?.error === 'string' && node.props.error !== ''
      ? node.props.error
      : null
  if (!content || !error) return content
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'error.main',
        borderRadius: 1,
        p: 0.5,
      }}
    >
      {content}
      <FormHelperText error>{error}</FormHelperText>
    </Box>
  )
}
