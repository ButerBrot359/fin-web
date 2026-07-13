import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table'

import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import {
  DATA_FS,
  GREEN_1C,
  HEAD_FS,
  isHighlightRow,
  isMeasure,
  isRightAligned,
} from '../lib/cell-helpers'
import { ReportCell } from './report-cell'

interface TreeTableProps {
  result: ReportResultDto
  columns: ReportColumnDto[]
  /** Отступ одного уровня дерева в px (1С: обычный 13, уменьшенный 8). */
  indentPx?: number
}

/** Сетка 1С: тонкие серые линии, плотные ячейки. */
const tdBase =
  'overflow-hidden whitespace-nowrap border border-[#d9d9d9] px-1.5 py-0.5'
const thBase = 'whitespace-nowrap border border-[#d9d9d9] px-1.5 py-1 text-left'

/** Стиль текста шапки колонок 1С: жирный тёмно-зелёный, 13px, без капса. */
const thTextSx = { color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }

/** Ширина одного символа колонки (`width` приходит в символах, как в 1С). */
const CHAR_PX = 8

/** Дефолт-ширина колонки «дерева» (наименование группы) без backend-width. */
const TREE_COL_DEFAULT_PX = 240

/**
 * Ширина колонки тела в px: приоритет — backend-`width` (символы × CHAR_PX);
 * при её отсутствии — дефолт по роли. Нужна для table-fixed раскладки, чтобы
 * колонки имели натуральную ширину и таблица не растягивалась на весь экран.
 */
const bodyColWidthPx = (col: ReportColumnDto): number => {
  if (col.width != null) return col.width * CHAR_PX
  switch (col.role) {
    case 'MEASURE':
      return 120
    case 'PERIOD':
      return 90
    case 'DIMENSION':
      return 180
    default:
      return 150
  }
}

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Локализованный верхний ряд шапки (группа «Сальдо на начало периода» и т.п.). */
const columnGroupTitle = (col: ReportColumnDto, isKz: boolean): string =>
  ((isKz ? col.groupTitleKz : col.groupTitleRu) || col.groupTitleRu) ?? ''

/** Локализованный средний ряд шапки (подгруппа «Итого приход» / счёт «7060»). */
const columnSubGroupTitle = (col: ReportColumnDto, isKz: boolean): string =>
  ((isKz ? col.subGroupTitleKz : col.subGroupTitleRu) || col.subGroupTitleRu) ??
  ''

/**
 * TREE-таблица результата (как ОСВ в 1С): рекурсивное дерево по
 * `rows[].children`, раскрыто по умолчанию. Первая колонка — группа
 * (значение `groupValue`, заголовок берётся из первой DIMENSION-колонки,
 * которая сама в теле не дублируется). Группы и «Итого» — жирные
 * тёмно-зелёные без заливок; двухуровневая шапка через `groupTitleRu`.
 */
export const TreeTable = ({
  result,
  columns,
  indentPx = 13,
}: TreeTableProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'

  const data = useMemo(() => result.rows, [result.rows])

  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [result])

  // Первая DIMENSION-колонка, чьи значения лежат в groupValue строк, — это
  // «колонка дерева»: её заголовок вешаем на первую колонку и не дублируем.
  const treeColumn = useMemo<ReportColumnDto | null>(() => {
    const first = result.columns.find((c) => c.role === 'DIMENSION')
    if (!first) return null
    const usedAsGroup = result.rows.some((r) => r.groupCode === first.code)
    const hasOwnCells = result.rows.some(
      (r) => r.cells[first.code] != null && r.cells[first.code] !== ''
    )
    return usedAsGroup && !hasOwnCells ? first : null
  }, [result])

  // Колонки тела: без колонки дерева (она рендерится первой, из groupValue).
  const bodyColumns = useMemo(
    () =>
      treeColumn ? columns.filter((c) => c.code !== treeColumn.code) : columns,
    [columns, treeColumn]
  )

  // Колонка-заглушка для модели дерева TanStack; рендер тела кастомный.
  const tableColumns = useMemo<ColumnDef<ReportRowDto>[]>(
    () => [{ id: 'tree', accessorFn: (r) => r.groupValue ?? null }],
    []
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => (row.children.length > 0 ? row.children : undefined),
    state: { expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    getRowId: (_row, index, parent) =>
      parent ? `${parent.id}.${String(index)}` : String(index),
  })

  const headModel = useMemo(() => {
    const hasGroups = bodyColumns.some((c) => columnGroupTitle(c, isKz))
    if (!hasGroups) return null
    const topRow: {
      key: string
      title: string
      colSpan: number
      rowSpan: number
    }[] = []
    const subRow: { key: string; col: ReportColumnDto }[] = []
    let i = 0
    while (i < bodyColumns.length) {
      const col = bodyColumns[i]
      const group = columnGroupTitle(col, isKz)
      if (!group) {
        topRow.push({
          key: col.code,
          title: columnTitle(col, isKz),
          colSpan: 1,
          rowSpan: 2,
        })
        i++
        continue
      }
      let j = i
      while (
        j < bodyColumns.length &&
        columnGroupTitle(bodyColumns[j], isKz) === group
      ) {
        subRow.push({ key: bodyColumns[j].code, col: bodyColumns[j] })
        j++
      }
      topRow.push({
        key: `grp-${col.code}`,
        title: group,
        colSpan: j - i,
        rowSpan: 1,
      })
      i = j
    }
    return { topRow, subRow }
  }, [bodyColumns, isKz])

  // Трёхуровневая шапка (Блок Д): groupTitle → subGroupTitle → title. Строится
  // только если есть subGroupTitle; иначе используется 2-уровневая (headModel).
  //  - колонка без groupTitle → rowSpan=3 (верхний ряд);
  //  - группа без subGroupTitle у колонки → mid-ячейка rowSpan=2 (title колонки);
  //  - есть subGroupTitle → group (top) / subGroup (mid, colSpan) / title (bot).
  const headModel3 = useMemo(() => {
    const hasSub = bodyColumns.some((c) => columnSubGroupTitle(c, isKz))
    if (!hasSub) return null

    const topRow: {
      key: string
      title: string
      colSpan: number
      rowSpan: number
    }[] = []
    const midRow: {
      key: string
      title: string
      colSpan: number
      rowSpan: number
    }[] = []
    const botRow: { key: string; col: ReportColumnDto }[] = []

    let i = 0
    while (i < bodyColumns.length) {
      const col = bodyColumns[i]
      const group = columnGroupTitle(col, isKz)
      if (!group) {
        topRow.push({
          key: col.code,
          title: columnTitle(col, isKz),
          colSpan: 1,
          rowSpan: 3,
        })
        i++
        continue
      }
      let j = i
      while (
        j < bodyColumns.length &&
        columnGroupTitle(bodyColumns[j], isKz) === group
      ) {
        j++
      }
      topRow.push({
        key: `grp-${col.code}`,
        title: group,
        colSpan: j - i,
        rowSpan: 1,
      })
      let k = i
      while (k < j) {
        const c = bodyColumns[k]
        const sub = columnSubGroupTitle(c, isKz)
        if (!sub) {
          midRow.push({
            key: c.code,
            title: columnTitle(c, isKz),
            colSpan: 1,
            rowSpan: 2,
          })
          k++
          continue
        }
        let m = k
        while (m < j && columnSubGroupTitle(bodyColumns[m], isKz) === sub) {
          m++
        }
        midRow.push({
          key: `sub-${c.code}`,
          title: sub,
          colSpan: m - k,
          rowSpan: 1,
        })
        for (let x = k; x < m; x++) {
          botRow.push({ key: bodyColumns[x].code, col: bodyColumns[x] })
        }
        k = m
      }
      i = j
    }
    return { topRow, midRow, botRow }
  }, [bodyColumns, isKz])

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Typography variant="body2" className="text-ui-05">
          {t('reports.noData')}
        </Typography>
      </div>
    )
  }

  /** Выделенная 1С-строка: группа дерева либо строка-итог по rowKind. */
  const isGroupRow = (row: Row<ReportRowDto>): boolean =>
    isHighlightRow(row.original.rowKind) ||
    (row.original.rowKind == null && row.depth === 0) ||
    row.original.rowKind === 'GROUP_HEADER'

  const treeHeaderTitle = treeColumn
    ? columnTitle(treeColumn, isKz)
    : t('reports.group')

  // Ширина первой колонки (наименование группы): backend-width либо дефолт.
  const treeColWidthPx =
    treeColumn?.width != null ? treeColumn.width * CHAR_PX : TREE_COL_DEFAULT_PX

  // Первая колонка (наименование группы) со стрелкой разворота и отступом 1С (~13px).
  const renderGroupCell = (row: Row<ReportRowDto>) => {
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
    const bold = isGroupRow(row)
    const label = row.original.labelText ?? row.original.groupValue ?? ''
    return (
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: row.depth * indentPx }}
      >
        {canExpand ? (
          <button
            type="button"
            aria-label={
              isExpanded ? t('reports.collapse') : t('reports.expand')
            }
            className="flex h-4 w-4 items-center justify-center"
            onClick={() => {
              row.toggleExpanded()
            }}
          >
            <ArrowDownIcon
              className={`h-3 w-3 shrink-0 transition-transform ${
                isExpanded ? '' : '-rotate-90'
              }`}
            />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <Typography
          variant="body2"
          sx={
            bold
              ? { color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }
              : { color: '#333', fontSize: DATA_FS }
          }
        >
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-[#d9d9d9]">
      <table className="table-fixed border-collapse bg-white">
        <colgroup>
          <col style={{ width: treeColWidthPx }} />
          {bodyColumns.map((col) => (
            <col key={col.code} style={{ width: bodyColWidthPx(col) }} />
          ))}
        </colgroup>
        <thead>
          {headModel3 ? (
            <>
              <tr>
                <th rowSpan={3} className={thBase}>
                  <Typography variant="body2" sx={thTextSx}>
                    {treeHeaderTitle}
                  </Typography>
                </th>
                {headModel3.topRow.map((cell) => (
                  <th
                    key={cell.key}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={thBase}
                  >
                    <Typography variant="body2" sx={thTextSx}>
                      {cell.title}
                    </Typography>
                  </th>
                ))}
              </tr>
              <tr>
                {headModel3.midRow.map((cell) => (
                  <th
                    key={cell.key}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={thBase}
                  >
                    <Typography variant="body2" sx={thTextSx}>
                      {cell.title}
                    </Typography>
                  </th>
                ))}
              </tr>
              <tr>
                {headModel3.botRow.map(({ key, col }) => (
                  <th key={key} className={thBase}>
                    <Typography variant="body2" sx={thTextSx}>
                      {columnTitle(col, isKz)}
                    </Typography>
                  </th>
                ))}
              </tr>
            </>
          ) : headModel ? (
            <>
              <tr>
                <th rowSpan={2} className={thBase}>
                  <Typography variant="body2" sx={thTextSx}>
                    {treeHeaderTitle}
                  </Typography>
                </th>
                {headModel.topRow.map((cell) => (
                  <th
                    key={cell.key}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={thBase}
                  >
                    <Typography variant="body2" sx={thTextSx}>
                      {cell.title}
                    </Typography>
                  </th>
                ))}
              </tr>
              <tr>
                {headModel.subRow.map(({ key, col }) => (
                  <th key={key} className={thBase}>
                    <Typography variant="body2" sx={thTextSx}>
                      {columnTitle(col, isKz)}
                    </Typography>
                  </th>
                ))}
              </tr>
            </>
          ) : (
            <tr>
              <th className={thBase}>
                <Typography variant="body2" sx={thTextSx}>
                  {treeHeaderTitle}
                </Typography>
              </th>
              {bodyColumns.map((col) => (
                <th key={col.code} className={thBase}>
                  <Typography variant="body2" sx={thTextSx}>
                    {columnTitle(col, isKz)}
                  </Typography>
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const bold = isGroupRow(row)
            return (
              <tr key={row.id} className="hover:bg-ui-07">
                <td className={`${tdBase} align-top`}>
                  {renderGroupCell(row)}
                </td>
                {bodyColumns.map((col) => (
                  <td
                    key={col.code}
                    className={`${tdBase} align-top ${
                      isMeasure(col) || isRightAligned(col)
                        ? 'text-right tabular-nums'
                        : ''
                    }`}
                  >
                    <ReportCell
                      value={row.original.cells[col.code]}
                      col={col}
                      bold={bold}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {Object.keys(result.total).length > 0 && (
          <tfoot>
            <tr>
              <td className={tdBase}>
                <Typography
                  variant="body2"
                  sx={{ color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }}
                >
                  {t('reports.total')}
                </Typography>
              </td>
              {bodyColumns.map((col) => (
                <td
                  key={col.code}
                  className={`${tdBase} ${
                    isMeasure(col) ? 'text-right tabular-nums' : ''
                  }`}
                >
                  <ReportCell value={result.total[col.code]} col={col} bold />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
