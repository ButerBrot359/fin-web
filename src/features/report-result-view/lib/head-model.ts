/**
 * Единый сборщик модели многоуровневой шапки отчётов
 * `groupTitle → subGroupTitle → title`.
 *
 * Алгоритм один (соседние колонки с одинаковым groupTitle объединяются в
 * группу colspan; внутри группы соседние одинаковые subGroupTitle — в
 * подгруппу; колонка без группы занимает всю высоту шапки rowSpan=levels),
 * но исторические потребители (tree-table, ledger-table, form-view,
 * XLSX-экспорт) успели разъехаться в деталях. Расхождения НЕ унифицируются —
 * они вынесены в явные опции, и каждый потребитель передаёт СВОИ параметры:
 * - `parseLevelSep` — разбор склейки «Группа — Подгруппа» (только tree-table);
 * - `levels` — глубина шапки 2/3 либо 'auto' по наличию титулов (form-view);
 * - `groupKeyPrefix`/`subKeyPrefix` — префиксы React-ключей ('grp-'/'sub-'
 *   в tree-table, 'g-'/'s-' в form-view);
 * - `subEmphasis` — пометка подгрупп для жирного курсива (form-view).
 */

/** Минимум полей колонки, нужных для сборки шапки (структурная совместимость
 *  с ReportColumnDto и ReportAltColumnDto). */
export interface HeadModelColumn {
  code: string
  titleRu: string
  titleKz?: string
  groupTitleRu?: string
  groupTitleKz?: string
  subGroupTitleRu?: string
  subGroupTitleKz?: string
}

export interface HeadModelOptions {
  /** Язык рендера: kz ⇒ titleKz с фолбэком на titleRu. */
  isKz: boolean
  /**
   * Глубина шапки: 2 (группа→титул), 3 (группа→подгруппа→титул) или 'auto' —
   * по наличию титулов (hasSub ⇒ 3, hasGroups ⇒ 2, иначе 1 — модель пустая).
   */
  levels: 2 | 3 | 'auto'
  /** Разбор склейки «Группа — Подгруппа» по « — » (см. LEVEL_SEP). */
  parseLevelSep?: boolean
  /** Префикс ключа групповой ячейки (по умолчанию 'grp-'). */
  groupKeyPrefix?: string
  /** Префикс ключа ячейки подгруппы (по умолчанию 'sub-'). */
  subKeyPrefix?: string
  /** Помечать ячейки подгрупп `emphasis: true` (form-view: жирный курсив). */
  subEmphasis?: boolean
}

/** Ячейка верхнего/среднего ряда шапки. */
export interface HeadModelCell<C extends HeadModelColumn = HeadModelColumn> {
  key: string
  title: string
  colSpan: number
  rowSpan: number
  /** 0-based индекс первой колонки ячейки в переданном массиве. */
  col0: number
  /** Исходная колонка (только у одиночных ячеек: без группы / без подгруппы). */
  col?: C
  /** Подгруппа среднего ряда (form-view печатает её жирным курсивом). */
  emphasis?: boolean
}

/** Листовая колонка нижнего ряда шапки. */
export interface HeadModelLeaf<C extends HeadModelColumn = HeadModelColumn> {
  key: string
  col: C
  /** 0-based индекс колонки в переданном массиве. */
  col0: number
}

export interface HeadModel<C extends HeadModelColumn = HeadModelColumn> {
  /** Фактическая глубина модели (1 ⇒ ряды пустые, шапка одноуровневая). */
  levels: 1 | 2 | 3
  /** Есть ли хоть один groupTitle (с учётом parseLevelSep). */
  hasGroups: boolean
  /** Есть ли хоть один subGroupTitle (с учётом разбора склейки). */
  hasSub: boolean
  topRow: HeadModelCell<C>[]
  /** Средний ряд (только при levels=3). */
  midRow: HeadModelCell<C>[]
  /** Нижний ряд: листовые колонки групп (без колонок, занявших rowSpan). */
  leafRow: HeadModelLeaf<C>[]
}

// Разделитель уровней при ВРЕМЕННОЙ склейке от бэка: « — » (em-dash в пробелах).
// Пока бэк не отдаёт subGroupTitle, он склеивает «Группа — Подгруппа» в groupTitle
// (напр. «Оборот с … — Итого приход»); внутренний период — обычный дефис « - »,
// поэтому режем строго по em-dash. Когда бэк начнёт слать subGroupTitle — он
// приоритетнее, и разбор не задействуется.
const LEVEL_SEP = /\s—\s/

/** Локализованный заголовок колонки. */
export const headColumnTitle = (col: HeadModelColumn, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

const rawGroupTitle = (col: HeadModelColumn, isKz: boolean): string =>
  ((isKz ? col.groupTitleKz : col.groupTitleRu) || col.groupTitleRu) ?? ''

const rawSubGroupTitle = (col: HeadModelColumn, isKz: boolean): string =>
  ((isKz ? col.subGroupTitleKz : col.subGroupTitleRu) || col.subGroupTitleRu) ??
  ''

/** Верхний ряд шапки: при parse и склейке без subGroupTitle — левая часть « — ». */
const groupTitleOf = (
  col: HeadModelColumn,
  isKz: boolean,
  parse: boolean
): string => {
  const raw = rawGroupTitle(col, isKz)
  if (parse && !rawSubGroupTitle(col, isKz)) {
    const parts = raw.split(LEVEL_SEP)
    if (parts.length > 1) return parts[0]
  }
  return raw
}

/** Средний ряд шапки: subGroupTitle бэка, иначе (при parse) правая часть склейки. */
const subGroupTitleOf = (
  col: HeadModelColumn,
  isKz: boolean,
  parse: boolean
): string => {
  const sub = rawSubGroupTitle(col, isKz)
  if (sub || !parse) return sub
  const parts = rawGroupTitle(col, isKz).split(LEVEL_SEP)
  return parts.length > 1 ? parts.slice(1).join('—') : ''
}

/**
 * Строит модель шапки: `topRow` (группы и одиночные колонки), при глубине 3 —
 * `midRow` (подгруппы и колонки группы без подгруппы), `leafRow` (листовые
 * колонки нижнего ряда). Гейтинг «показывать ли многоуровневую шапку» модель
 * не делает — потребитель решает сам по `hasGroups`/`hasSub`/`levels`.
 */
export const buildHeadModel = <C extends HeadModelColumn>(
  columns: C[],
  opts: HeadModelOptions
): HeadModel<C> => {
  const {
    isKz,
    parseLevelSep = false,
    groupKeyPrefix = 'grp-',
    subKeyPrefix = 'sub-',
    subEmphasis = false,
  } = opts
  const group = (c: C) => groupTitleOf(c, isKz, parseLevelSep)
  const sub = (c: C) => subGroupTitleOf(c, isKz, parseLevelSep)

  const hasGroups = columns.some((c) => group(c))
  const hasSub = columns.some((c) => sub(c))
  const levels: 1 | 2 | 3 =
    opts.levels === 'auto' ? (hasSub ? 3 : hasGroups ? 2 : 1) : opts.levels

  const topRow: HeadModelCell<C>[] = []
  const midRow: HeadModelCell<C>[] = []
  const leafRow: HeadModelLeaf<C>[] = []
  const model: HeadModel<C> = {
    levels,
    hasGroups,
    hasSub,
    topRow,
    midRow,
    leafRow,
  }
  if (levels === 1) return model

  let i = 0
  while (i < columns.length) {
    const col = columns[i]
    const g = group(col)
    if (!g) {
      // Колонка без группы — заголовок на всю высоту шапки.
      topRow.push({
        key: col.code,
        title: headColumnTitle(col, isKz),
        colSpan: 1,
        rowSpan: levels,
        col0: i,
        col,
      })
      i++
      continue
    }
    // Границы группы одинакового groupTitle.
    let j = i
    while (j < columns.length && group(columns[j]) === g) j++
    topRow.push({
      key: `${groupKeyPrefix}${col.code}`,
      title: g,
      colSpan: j - i,
      rowSpan: 1,
      col0: i,
    })

    if (levels === 2) {
      for (let k = i; k < j; k++) {
        leafRow.push({ key: columns[k].code, col: columns[k], col0: k })
      }
    } else {
      // Средний ряд подгрупп внутри [i, j).
      let k = i
      while (k < j) {
        const c = columns[k]
        const s = sub(c)
        if (!s) {
          // Колонка группы без подгруппы — заголовок на ряды 2–3.
          midRow.push({
            key: c.code,
            title: headColumnTitle(c, isKz),
            colSpan: 1,
            rowSpan: 2,
            col0: k,
            col: c,
          })
          k++
          continue
        }
        let m = k
        while (m < j && sub(columns[m]) === s) m++
        const subCell: HeadModelCell<C> = {
          key: `${subKeyPrefix}${c.code}`,
          title: s,
          colSpan: m - k,
          rowSpan: 1,
          col0: k,
        }
        if (subEmphasis) subCell.emphasis = true
        midRow.push(subCell)
        for (let x = k; x < m; x++) {
          leafRow.push({ key: columns[x].code, col: columns[x], col0: x })
        }
        k = m
      }
    }
    i = j
  }

  return model
}
