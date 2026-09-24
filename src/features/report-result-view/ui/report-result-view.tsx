import type { MouseEvent as ReactMouseEvent } from 'react'
import { useMemo } from 'react'
import { Typography } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import { formatReportTitle } from '../lib/format-title'
import { FormView } from './form-view'
import { SpreadsheetView } from './spreadsheet-view'
import { LedgerTable } from './ledger-table'
import { TreeTable } from './tree-table'
import { ReportHeaderBlocks } from './report-header-blocks'
import { ReportSignatures } from './report-signatures'
import { ReportNoteLines } from './report-note-lines'

/** Настройки вкладки «Оформление» (проброс из панели настроек отчёта). */
export interface ReportResultAppearance {
  /** Выделять отрицательные значения красным. */
  highlightNegatives: boolean
  /** Уменьшенный автоотступ уровней дерева. */
  reducedIndent: boolean
}

interface ReportResultViewProps {
  result: ReportResultDto
  /** Коды колонок, скрытых настройками (показатели/группировка). */
  hiddenColumns?: Set<string>
  /** Оформление (вкладка «Оформление»). Отсутствие ⇒ текущее поведение 1С. */
  appearance?: ReportResultAppearance
  /**
   * Двойной клик по строке данных (rowKind DATA) LEDGER-таблицы — открыть
   * документ-регистратор (drill-down, как в 1С). Навигацию выполняет страница.
   */
  onOpenDocument?: (row: ReportRowDto) => void
  /** Серверная расшифровка строки LEDGER (SCRUM-370 блок В) — см. LedgerTable. */
  onDrilldown?: (row: ReportRowDto) => void
  onRowDoubleClick?: (
    row: ReportRowDto,
    ancestors: ReportRowDto[],
    event: ReactMouseEvent
  ) => void
  /** Значения клеток бланка, вписанные пользователем (layout=FORM с табличным документом). */
  blankValues?: Record<string, string>
  /** Изменение клетки бланка; отсутствие ⇒ бланк только для чтения. */
  onBlankValueChange?: (field: string, value: string) => void
  /** Имя области выделенной клетки бланка — источник расшифровки. */
  vybrannayaOblast?: string | null
  /** Клик по клетке бланка. */
  onVyborOblasti?: (oblast: string | null) => void
  /** Активная страница бланка и её выбор — нужны командам очистки страницы. */
  aktivnayaStranitsa?: number
  onVyborStranitsy?: (indeks: number) => void
  /** Правый клик по строке дерева — те же действия, что по двойному клику. */
  onRowContextMenu?: (
    row: ReportRowDto,
    ancestors: ReportRowDto[],
    event: ReactMouseEvent
  ) => void
}

/**
 * Единый 1С-fidelity рендерер результата отчёта (ReportResultDto). Шапка как в
 * табличном документе 1С: строка организации (жирная) → заголовок отчёта
 * (жирный, крупный) → строки «Выводимые данные: …». Диспатч по `result.layout`:
 * `LEDGER` ⇒ плоский регистр (карточка-счёта-стиль со span-строками),
 * иначе (`TREE`/отсутствие) ⇒ раскрываемое дерево.
 */
export const ReportResultView = ({
  result,
  hiddenColumns,
  appearance,
  onOpenDocument,
  onDrilldown,
  onRowDoubleClick,
  onRowContextMenu,
  blankValues,
  onBlankValueChange,
  vybrannayaOblast,
  onVyborOblasti,
  aktivnayaStranitsa,
  onVyborStranitsy,
}: ReportResultViewProps) => {
  // Скрываем колонки, выключенные настройками (показатели/группировка), и —
  // когда «Выделять отрицательные» выключено — гасим negativeRed на колонках
  // (эффективно отключает красную окраску во всех ячейках, включая итоги).
  const columns = useMemo<ReportColumnDto[]>(() => {
    const base =
      hiddenColumns && hiddenColumns.size > 0
        ? result.columns.filter((c) => !hiddenColumns.has(c.code))
        : result.columns
    if (appearance && !appearance.highlightNegatives) {
      return base.map((c) => (c.negativeRed ? { ...c, negativeRed: false } : c))
    }
    return base
  }, [result.columns, hiddenColumns, appearance])

  // Автоотступ уровней дерева: 8px при «Уменьшенный автоотступ», иначе 13px
  // (дефолт = текущее поведение, когда appearance не задан).
  const indentPx = appearance ? (appearance.reducedIndent ? 8 : 13) : 13

  const title = formatReportTitle(result)
  const isLedger = result.layout === 'LEDGER'
  // Гос-бланк (М-44): титул и период центрируются над таблицей, как в 1С.
  const isBlank = !!result.headerBlocks && result.headerBlocks.length > 0

  // Утверждённый бланк, снятый с макета 1С, рисуется как табличный документ —
  // ровно тот же, что уходит в печать.
  if (result.spreadsheet && result.spreadsheet.sheets.length > 0) {
    return (
      <SpreadsheetView
        spreadsheet={result.spreadsheet}
        blankValues={blankValues}
        onBlankValueChange={onBlankValueChange}
        vybrannayaOblast={vybrannayaOblast}
        onVyborOblasti={onVyborOblasti}
        aktivnayaStranitsa={aktivnayaStranitsa}
        onVyborStranitsy={onVyborStranitsy}
      />
    )
  }

  // Официальный бланк (мемориальный ордер) — своя шапка, заголовок не нужен.
  if (result.layout === 'FORM' && result.form) {
    return <FormView form={result.form} language={result.language} />
  }

  return (
    <div className="flex flex-col gap-1">
      {result.headerBlocks && result.headerBlocks.length > 0 && (
        <ReportHeaderBlocks blocks={result.headerBlocks} />
      )}
      {result.organizationTitle && (
        <Typography
          variant="body2"
          sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
        >
          {result.organizationTitle}
        </Typography>
      )}
      {title && (
        <Typography
          variant="body1"
          sx={{
            color: cssVar(palette.pendingText1),
            fontWeight: 700,
            fontSize: 17,
            ...(isBlank ? { textAlign: 'center', maxWidth: 900 } : {}),
          }}
        >
          {title}
        </Typography>
      )}
      {/* Строка периода сразу под титулом (полужирно, мельче титула). */}
      {result.periodLine && (
        <Typography
          variant="body2"
          sx={{
            color: cssVar(palette.pendingText1),
            fontWeight: 700,
            ...(isBlank ? { textAlign: 'center', maxWidth: 900 } : {}),
          }}
        >
          {result.periodLine}
        </Typography>
      )}
      {result.subtitleLines?.map((line, i) => (
        <Typography
          key={i}
          variant="caption"
          sx={{ color: cssVar(palette.pendingText1) }}
        >
          {line}
        </Typography>
      ))}
      <div className="mt-2">
        {isLedger ? (
          <LedgerTable
            result={result}
            columns={columns}
            onOpenDocument={onOpenDocument}
            onDrilldown={onDrilldown}
          />
        ) : (
          <TreeTable
            result={result}
            columns={columns}
            indentPx={indentPx}
            onRowDoubleClick={onRowDoubleClick}
            onRowContextMenu={onRowContextMenu}
          />
        )}
      </div>
      {/* Подписей у приказного бланка может быть несколько (казначейство и учреждение):
          список главнее одиночной подписи, как и в печати. Сторона `side` раскладывает их
          в две колонки — слева казначейство, справа учреждение (макет формы 4-20). */}
      <ReportSignatures
        signatures={
          result.footerBlocks?.length
            ? result.footerBlocks
            : result.footerBlock
              ? [result.footerBlock]
              : []
        }
      />
      <ReportNoteLines lines={result.noteLines} />
    </div>
  )
}
