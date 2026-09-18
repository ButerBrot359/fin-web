// ─── Стили (styles.xml) ──────────────────────────────────────────────────────
// Фиксированная палитра «бизнес-стиля» в фирменном тёмно-зелёном 1С.

const COLOR_HEADER_FILL = 'FF1E5945' // шапка — тёмно-зелёный
const COLOR_HEADER_TEXT = 'FFFFFFFF'
const COLOR_TEXT = 'FF333333'
const COLOR_TITLE = 'FF1E3A2F'
const COLOR_SUBTLE = 'FF6B7280' // подзаголовки — приглушённый серый
const COLOR_HIGHLIGHT_FILL = 'FFE9F2EC' // итоги — светло-зелёная подложка
const COLOR_HIGHLIGHT_TEXT = 'FF003F2F' // текст итогов — зелёный 1С
const COLOR_BORDER = 'FFBFC9C4'

/** Индексы cellXfs в styles.xml (порядок в buildStylesXml). */
export const XF = {
  DEFAULT: 0,
  TITLE: 1,
  SUBTITLE: 2,
  HEADER: 3,
  DATA_LEFT: 4,
  DATA_RIGHT: 5,
  DATA_MONEY: 6,
  DATA_QTY: 7,
  HL_LEFT: 8,
  HL_RIGHT: 9,
  HL_MONEY: 10,
  HL_QTY: 11,
} as const

const NUMFMT_MONEY = 164 // # ##0.00
const NUMFMT_QTY = 165 // # ##0.000

export const buildStylesXml = (): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  `<numFmts count="2">` +
  `<numFmt numFmtId="${String(NUMFMT_MONEY)}" formatCode="#,##0.00"/>` +
  `<numFmt numFmtId="${String(NUMFMT_QTY)}" formatCode="#,##0.000"/>` +
  '</numFmts>' +
  '<fonts count="5">' +
  `<font><sz val="10"/><color rgb="${COLOR_TEXT}"/><name val="Arial"/></font>` + // 0 данные
  `<font><b/><sz val="14"/><color rgb="${COLOR_TITLE}"/><name val="Arial"/></font>` + // 1 заголовок
  `<font><sz val="9"/><color rgb="${COLOR_SUBTLE}"/><name val="Arial"/></font>` + // 2 подзаголовок
  `<font><b/><sz val="10"/><color rgb="${COLOR_HEADER_TEXT}"/><name val="Arial"/></font>` + // 3 шапка
  `<font><b/><sz val="10"/><color rgb="${COLOR_HIGHLIGHT_TEXT}"/><name val="Arial"/></font>` + // 4 итоги
  '</fonts>' +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' + // 0 (обязательный)
  '<fill><patternFill patternType="gray125"/></fill>' + // 1 (обязательный)
  `<fill><patternFill patternType="solid"><fgColor rgb="${COLOR_HEADER_FILL}"/></patternFill></fill>` + // 2 шапка
  `<fill><patternFill patternType="solid"><fgColor rgb="${COLOR_HIGHLIGHT_FILL}"/></patternFill></fill>` + // 3 итоги
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' + // 0 без границ
  `<border>` + // 1 тонкая сетка
  `<left style="thin"><color rgb="${COLOR_BORDER}"/></left>` +
  `<right style="thin"><color rgb="${COLOR_BORDER}"/></right>` +
  `<top style="thin"><color rgb="${COLOR_BORDER}"/></top>` +
  `<bottom style="thin"><color rgb="${COLOR_BORDER}"/></bottom>` +
  `<diagonal/></border>` +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  // 0 DEFAULT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  // 1 TITLE
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
  '<alignment vertical="center"/></xf>' +
  // 2 SUBTITLE
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
  '<alignment vertical="center"/></xf>' +
  // 3 HEADER
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  // 4 DATA_LEFT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="left" vertical="top" wrapText="1"/></xf>' +
  // 5 DATA_RIGHT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1"/></xf>' +
  // 6 DATA_MONEY
  `<xf numFmtId="${String(NUMFMT_MONEY)}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 7 DATA_QTY
  `<xf numFmtId="${String(NUMFMT_QTY)}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 8 HL_LEFT
  '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="left" vertical="top" wrapText="1"/></xf>' +
  // 9 HL_RIGHT
  '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1"/></xf>' +
  // 10 HL_MONEY
  `<xf numFmtId="${String(NUMFMT_MONEY)}" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 11 HL_QTY
  `<xf numFmtId="${String(NUMFMT_QTY)}" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'
