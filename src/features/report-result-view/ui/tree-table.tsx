import type { MouseEvent as ReactMouseEvent } from 'react'
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
import { cssVar, palette } from '@/shared/design/tokens'

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
  isNumericCell,
  isRightAligned,
  resolveReportLang,
  indicatorSubLabels,
} from '../lib/cell-helpers'
import { buildHeadModel } from '../lib/head-model'
import { ReportCell } from './report-cell'

interface TreeTableProps {
  result: ReportResultDto
  columns: ReportColumnDto[]
  /** Отступ одного уровня дерева в px (1С: обычный 13, уменьшенный 8). */
  indentPx?: number
  onRowDoubleClick?: (
    row: ReportRowDto,
    ancestors: ReportRowDto[],
    event: ReactMouseEvent
  ) => void
  /**
   * Правый клик по строке — тот же набор действий, что и по двойному клику
   * (1С открывает меню выбора обоими способами). Штатное меню браузера
   * подавляется только когда обработчик передан.
   */
  onRowContextMenu?: (
    row: ReportRowDto,
    ancestors: ReportRowDto[],
    event: ReactMouseEvent
  ) => void
}

/**
 * Атрибуты строки для расшифровки: курсор и оба способа вызова меню — двойной
 * клик и правый, как в 1С. Общая для обоих деревьев: раньше их пробрасывало
 * только плоское, и у отчётов с этажами (ОСВ по счёту) расшифровка молча
 * пропадала.
 */
const rowInteraction = (
  row: Row<ReportRowDto>,
  onRowDoubleClick?: TreeTableProps['onRowDoubleClick'],
  onRowContextMenu?: TreeTableProps['onRowContextMenu']
) => ({
  className: `hover:bg-ui-07 ${
    onRowDoubleClick || onRowContextMenu ? 'cursor-pointer' : ''
  }`,
  onDoubleClick: onRowDoubleClick
    ? (e: ReactMouseEvent) => {
        window.getSelection()?.removeAllRanges()
        onRowDoubleClick(
          row.original,
          row.getParentRows().map((p) => p.original),
          e
        )
      }
    : undefined,
  onContextMenu: onRowContextMenu
    ? (e: ReactMouseEvent) => {
        e.preventDefault()
        onRowContextMenu(
          row.original,
          row.getParentRows().map((p) => p.original),
          e
        )
      }
    : undefined,
})

/** Сетка 1С: тонкие серые линии, плотные ячейки. */
const tdBase =
  'overflow-hidden whitespace-nowrap border border-pending-gray-1 px-1.5 py-0.5'
const thBase =
  'whitespace-nowrap border border-pending-gray-1 px-1.5 py-1 text-left'

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

/** Опции сборки шапки tree-table: разбор склейки « — » включён (LEVEL_SEP). */
const HEAD_OPTS = { parseLevelSep: true } as const

/**
 * TREE-таблица результата (как ОСВ в 1С): рекурсивное дерево по
 * `rows[].children`, раскрыто по умолчанию. Первая колонка — группа
 * (значение `groupValue`, заголовок берётся из первой DIMENSION-колонки,
 * которая сама в теле не дублируется). Группы и «Итого» — жирные
 * тёмно-зелёные без заливок; двухуровневая шапка через `groupTitleRu`.
 */
/**
 * Роутер рендера дерева: при наличии `result.groupFloorCodes` — 1С-«Ведомость»
 * (группировки этажами + полосы-бэнды), иначе — обычное дерево-с-отступами (ОСВ).
 */
export const TreeTable = (props: TreeTableProps) => {
  if (props.result.groupFloorCodes && props.result.groupFloorCodes.length > 0) {
    return <FloorTreeTable {...props} />
  }
  return <PlainTreeTable {...props} />
}

const PlainTreeTable = ({
  result,
  columns,
  indentPx = 13,
  onRowDoubleClick,
  onRowContextMenu,
}: TreeTableProps) => {
  const { t, i18n } = useTranslation()
  // Язык РЕНДЕРА = язык, на котором отчёт сформировал бэк (result.language),
  // иначе — язык приложения. Так шапки колонок и итог на языке отчёта, даже
  // если UI приложения на другом языке (пер-отчётный язык / Accept-Language).
  const reportLang = resolveReportLang(result.language, i18n.language)
  const isKz = reportLang === 'kz'

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
    const model = buildHeadModel(bodyColumns, { isKz, levels: 2, ...HEAD_OPTS })
    return model.hasGroups
      ? { topRow: model.topRow, subRow: model.leafRow }
      : null
  }, [bodyColumns, isKz])

  // Трёхуровневая шапка (Блок Д): groupTitle → subGroupTitle → title. Строится
  // только если есть subGroupTitle; иначе используется 2-уровневая (headModel).
  //  - колонка без groupTitle → rowSpan=3 (верхний ряд);
  //  - группа без subGroupTitle у колонки → mid-ячейка rowSpan=2 (title колонки);
  //  - есть subGroupTitle → group (top) / subGroup (mid, colSpan) / title (bot).
  const headModel3 = useMemo(() => {
    const model = buildHeadModel(bodyColumns, { isKz, levels: 3, ...HEAD_OPTS })
    return model.hasSub
      ? { topRow: model.topRow, midRow: model.midRow, botRow: model.leafRow }
      : null
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
              : { color: cssVar(palette.pendingText1), fontSize: DATA_FS }
          }
        >
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-pending-gray-1">
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
              <tr
                key={row.id}
                {...rowInteraction(row, onRowDoubleClick, onRowContextMenu)}
              >
                <td className={`${tdBase} align-top`}>{renderGroupCell(row)}</td>
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
                      subLabels={indicatorSubLabels(row.original.cells)}
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
                  {t('reports.total', { lng: reportLang })}
                </Typography>
              </td>
              {bodyColumns.map((col) => (
                <td
                  key={col.code}
                  className={`${tdBase} ${
                    isNumericCell(col) ? 'text-right tabular-nums' : ''
                  }`}
                >
                  <ReportCell
                    subLabels={indicatorSubLabels(result.total)}
                    value={result.total[col.code]}
                    col={col}
                    bold
                  />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/**
 * TREE-таблица «этажами» (1С-«Ведомость», напр. Ведомость остатков ТМЗ):
 * группировки `result.groupFloorCodes` (Счёт / Подразделение / МОЛ) — НЕ колонки,
 * а вертикальные подписи-этажи в шапке + полосы-бэнды по телу (colspan по
 * детальным колонкам). Детальное зерно (Номенклатура) — листовые строки, чьи
 * реквизиты (№ п/п, Номенкл. номер, Наименование, Ед. изм.) — обычные колонки.
 * MEASURE (Количество/Сумма) — колонки на всю высоту шапки (rowSpan). Двухэтажный
 * заголовок детальной колонки (напр. «Дополнительные поля» над «Единица измерения»)
 * — через `groupTitleRu`.
 */
const FloorTreeTable = ({
  result,
  columns,
  indentPx = 13,
  onRowDoubleClick,
  onRowContextMenu,
}: TreeTableProps) => {
  const { t, i18n } = useTranslation()
  const reportLang = resolveReportLang(result.language, i18n.language)
  const isKz = reportLang === 'kz'

  const floorCodes = result.groupFloorCodes ?? []

  // Детальные колонки = всё, что НЕ измерение-группировка (роль ≠ DIMENSION):
  // листовые реквизиты (leaf) + суммовые (measures). Группировки-этажи из
  // `columns` исключаются — они рендерятся подписями-этажами и бэндами.
  const leafColumns = useMemo(
    () => columns.filter((c) => c.role !== 'DIMENSION' && !isMeasure(c)),
    [columns]
  )
  const measureColumns = useMemo(
    () => columns.filter((c) => isMeasure(c)),
    [columns]
  )

  // Двухэтажный заголовок детальных колонок (напр. «Дополнительные поля» над
  // «Единица измерения»): верхний ряд групп + нижний ряд титулов колонок группы.
  const leafHead = useMemo(() => {
    const model = buildHeadModel(leafColumns, { isKz, levels: 2, ...HEAD_OPTS })
    return {
      hasGroups: model.hasGroups,
      leafRows: model.hasGroups ? 2 : 1,
      topRow: model.topRow,
      subRow: model.leafRow,
    }
  }, [leafColumns, isKz])

  // Многоуровневая шапка МЕР (форма 326): groupTitle → subGroupTitle → title.
  // Раскладывается по рядам этажей: top → 1-й этаж, mid → 2-й этаж, bot → ряд листьев.
  // - колонка без groupTitle → rowSpan=3 (весь столбец шапки);
  // - группа без subGroupTitle (Остаток) → title в mid-ряду rowSpan=2;
  // - есть subGroupTitle (Оборот: Дебет/Кредит) → group/subGroup/title по рядам.
  const measureHead3 = useMemo(() => {
    const model = buildHeadModel(measureColumns, {
      isKz,
      levels: 3,
      ...HEAD_OPTS,
    })
    return model.hasGroups
      ? { topRow: model.topRow, midRow: model.midRow, botRow: model.leafRow }
      : null
  }, [measureColumns, isKz])

  const totalHeaderRows = floorCodes.length + leafHead.leafRows

  // Многоуровневую шапку мер выводим, когда этажей ровно 2 и лист-ряд один (форма 326):
  // top→этаж1, mid→этаж2, bot→ряд листьев. Иначе — прежний одноуровневый вывод мер.
  const useMeasure3 =
    measureHead3 != null && floorCodes.length === 2 && leafHead.leafRows === 1

  const data = useMemo(() => result.rows, [result.rows])
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [result])

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

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Typography variant="body2" className="text-ui-05">
          {t('reports.noData')}
        </Typography>
      </div>
    )
  }

  // Полоса-бэнд группировки: строка-узел дерева (есть дети) либо явный GROUP_HEADER.
  const isBandRow = (row: Row<ReportRowDto>): boolean =>
    row.getCanExpand() ||
    row.original.children.length > 0 ||
    row.original.rowKind === 'GROUP_HEADER'

  // Ячейка бэнда (colspan по детальным колонкам): стрелка + отступ уровня + подпись.
  const renderBandCell = (row: Row<ReportRowDto>) => {
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
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
          sx={{ color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }}
        >
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-pending-gray-1">
      <table className="table-fixed border-collapse bg-white">
        <colgroup>
          {leafColumns.map((col) => (
            <col key={col.code} style={{ width: bodyColWidthPx(col) }} />
          ))}
          {measureColumns.map((col) => (
            <col key={col.code} style={{ width: bodyColWidthPx(col) }} />
          ))}
        </colgroup>
        <thead>
          {floorCodes.map((code, idx) => {
            const col = result.columns.find((c) => c.code === code)
            const title = col ? columnTitle(col, isKz) : code
            return (
              <tr key={`floor-${code}`}>
                <th
                  colSpan={leafColumns.length}
                  className={`${thBase} align-bottom`}
                >
                  <Typography variant="body2" sx={thTextSx}>
                    {title}
                  </Typography>
                </th>
                {useMeasure3
                  ? (idx === 0
                      ? measureHead3.topRow
                      : idx === 1
                        ? measureHead3.midRow
                        : []
                    ).map((cell) => (
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
                    ))
                  : idx === 0 &&
                    measureColumns.map((m) => (
                      <th
                        key={m.code}
                        rowSpan={totalHeaderRows}
                        className={`${thBase} align-bottom`}
                      >
                        <Typography variant="body2" sx={thTextSx}>
                          {columnTitle(m, isKz)}
                        </Typography>
                      </th>
                    ))}
              </tr>
            )
          })}
          {leafHead.hasGroups ? (
            <>
              <tr>
                {leafHead.topRow.map((cell) => (
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
                {leafHead.subRow.map(({ key, col }) => (
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
              {leafColumns.map((col) => (
                <th key={col.code} className={thBase}>
                  <Typography variant="body2" sx={thTextSx}>
                    {columnTitle(col, isKz)}
                  </Typography>
                </th>
              ))}
              {/* Форма 326: нижний ряд шапки мер (Кол-во/Сумма под Дебет/Кредит). */}
              {useMeasure3 &&
                measureHead3.botRow.map(({ key, col }) => (
                  <th key={key} className={thBase}>
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
            if (isBandRow(row)) {
              return (
                <tr
                  key={row.id}
                  {...rowInteraction(row, onRowDoubleClick, onRowContextMenu)}
                >
                  <td
                    colSpan={leafColumns.length}
                    className={`${tdBase} align-top`}
                  >
                    {renderBandCell(row)}
                  </td>
                  {measureColumns.map((m) => (
                    <td
                      key={m.code}
                      className={`${tdBase} align-top text-right tabular-nums`}
                    >
                      <ReportCell
                        subLabels={indicatorSubLabels(row.original.cells)}
                        value={row.original.cells[m.code]}
                        col={m}
                        bold
                      />
                    </td>
                  ))}
                </tr>
              )
            }
            return (
              <tr
                key={row.id}
                {...rowInteraction(row, onRowDoubleClick, onRowContextMenu)}
              >
                {leafColumns.map((col) => (
                  <td
                    key={col.code}
                    className={`${tdBase} align-top ${
                      isRightAligned(col) ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    <ReportCell
                      subLabels={indicatorSubLabels(row.original.cells)}
                      value={row.original.cells[col.code]}
                      col={col}
                    />
                  </td>
                ))}
                {measureColumns.map((m) => (
                  <td
                    key={m.code}
                    className={`${tdBase} align-top text-right tabular-nums`}
                  >
                    <ReportCell
                      subLabels={indicatorSubLabels(row.original.cells)}
                      value={row.original.cells[m.code]}
                      col={m}
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
              <td colSpan={leafColumns.length} className={tdBase}>
                <Typography
                  variant="body2"
                  sx={{ color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }}
                >
                  {t('reports.total', { lng: reportLang })}
                </Typography>
              </td>
              {measureColumns.map((m) => (
                <td
                  key={m.code}
                  className={`${tdBase} text-right tabular-nums`}
                >
                  <ReportCell value={result.total[m.code]} col={m} bold />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
