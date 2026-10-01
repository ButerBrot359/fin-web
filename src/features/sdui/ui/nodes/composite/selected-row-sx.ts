import { cssVar, palette } from '@/shared/design/tokens'

/**
 * Текущая строка таблицы. Дефолт MUI (`Mui-selected` — primary на 8% прозрачности) на
 * зебре списка почти не читался: «границы и цвет выделенной строки практически не
 * отличаются от остальных строк» (тестировщик, 20.09.2026). В 1С текущая строка
 * залита сплошным цветом и отбита слева маркером, поэтому видно её сразу.
 *
 * <p>Селекторы с классом-модификатором специфичнее простого `backgroundColor` строки,
 * поэтому выделение остаётся видимым поверх условной заливки. Общие для редактируемых
 * ТЧ (TableBodyRow) и read-only таблиц с командной панелью.
 */
const VYDELENNAYA_STROKA_FON = cssVar(palette.ui08)
const VYDELENNAYA_STROKA_MARKER = cssVar(palette.accent02)

export const SELECTED_ROW_SX = {
  '&.MuiTableRow-root.Mui-selected': {
    backgroundColor: VYDELENNAYA_STROKA_FON,
  },
  '&.MuiTableRow-root.Mui-selected:hover': {
    backgroundColor: VYDELENNAYA_STROKA_FON,
  },
  '&.MuiTableRow-root.Mui-selected > td:first-of-type': {
    boxShadow: `inset 3px 0 0 ${VYDELENNAYA_STROKA_MARKER}`,
  },
}
