import { describe, expect, it } from 'vitest'

import { buildHeadModel, type HeadModelColumn } from './head-model'

const col = (
  code: string,
  title: string,
  group?: string,
  sub?: string
): HeadModelColumn => ({
  code,
  titleRu: title,
  groupTitleRu: group,
  subGroupTitleRu: sub,
})

describe('buildHeadModel — профиль tree-table (levels 2, parseLevelSep)', () => {
  const opts = { isKz: false, levels: 2, parseLevelSep: true } as const

  it('группы colspan, одиночные rowSpan=2, листья в нижнем ряду', () => {
    const cols = [
      col('acc', 'Счёт'),
      col('dt', 'Сумма', 'Дебет'),
      col('dtQ', 'Кол.', 'Дебет'),
      col('kt', 'Сумма', 'Кредит'),
    ]
    const model = buildHeadModel(cols, opts)
    expect(model.hasGroups).toBe(true)
    expect(model.topRow).toMatchObject([
      { key: 'acc', title: 'Счёт', colSpan: 1, rowSpan: 2, col0: 0 },
      { key: 'grp-dt', title: 'Дебет', colSpan: 2, rowSpan: 1, col0: 1 },
      { key: 'grp-kt', title: 'Кредит', colSpan: 1, rowSpan: 1, col0: 3 },
    ])
    expect(model.leafRow.map((l) => [l.key, l.col0])).toEqual([
      ['dt', 1],
      ['dtQ', 2],
      ['kt', 3],
    ])
  })

  it('склейка «Группа — Подгруппа» режется по em-dash: группа — левая часть', () => {
    const cols = [
      col('a', 'Кол.', 'Оборот с 01.01 - 31.01 — Итого приход'),
      col('b', 'Сумма', 'Оборот с 01.01 - 31.01 — Итого приход'),
    ]
    const model = buildHeadModel(cols, opts)
    // Внутренний « - » (обычный дефис) не режется, em-dash — режется.
    expect(model.topRow).toMatchObject([
      { key: 'grp-a', title: 'Оборот с 01.01 - 31.01', colSpan: 2 },
    ])
    expect(model.hasSub).toBe(true) // правая часть склейки — подгруппа
  })

  it('при явном subGroupTitle склейка не разбирается', () => {
    const cols = [col('a', 'Кол.', 'Оборот — приход', 'Дебет')]
    const model = buildHeadModel(cols, opts)
    expect(model.topRow[0].title).toBe('Оборот — приход')
  })

  it('без групп — hasGroups=false (потребитель показывает одноуровневую шапку)', () => {
    const model = buildHeadModel([col('a', 'Счёт'), col('b', 'Сумма')], opts)
    expect(model.hasGroups).toBe(false)
    expect(model.leafRow).toEqual([])
  })
})

describe('buildHeadModel — профиль tree-table 3 уровня (levels 3, parseLevelSep)', () => {
  const opts = { isKz: false, levels: 3, parseLevelSep: true } as const

  it('group → subGroup → title; группа без подгруппы — mid rowSpan=2', () => {
    const cols = [
      col('name', 'Наименование'),
      col('ost', 'Сумма', 'Остаток'),
      col('dtQ', 'Кол.', 'Оборот', 'Дебет'),
      col('dtS', 'Сумма', 'Оборот', 'Дебет'),
      col('ktS', 'Сумма', 'Оборот', 'Кредит'),
    ]
    const model = buildHeadModel(cols, opts)
    expect(model.topRow).toMatchObject([
      { key: 'name', title: 'Наименование', colSpan: 1, rowSpan: 3, col0: 0 },
      { key: 'grp-ost', title: 'Остаток', colSpan: 1, rowSpan: 1, col0: 1 },
      { key: 'grp-dtQ', title: 'Оборот', colSpan: 3, rowSpan: 1, col0: 2 },
    ])
    expect(model.midRow).toMatchObject([
      { key: 'ost', title: 'Сумма', colSpan: 1, rowSpan: 2, col0: 1 },
      { key: 'sub-dtQ', title: 'Дебет', colSpan: 2, rowSpan: 1, col0: 2 },
      { key: 'sub-ktS', title: 'Кредит', colSpan: 1, rowSpan: 1, col0: 4 },
    ])
    // В нижний ряд попадают только листья подгрупп (не «Остаток»).
    expect(model.leafRow.map((l) => l.key)).toEqual(['dtQ', 'dtS', 'ktS'])
    // Подгруппы без опции subEmphasis не помечаются.
    expect(model.midRow[1].emphasis).toBeUndefined()
  })

  it('гейт hasSub: группы есть, подгрупп нет', () => {
    const model = buildHeadModel(
      [col('a', 'Сумма', 'Дебет'), col('b', 'Кол.', 'Дебет')],
      opts
    )
    expect(model.hasSub).toBe(false) // headModel3 не показывается
    expect(model.hasGroups).toBe(true) // measureHead3 показывается
    expect(model.midRow.map((c) => c.rowSpan)).toEqual([2, 2])
    expect(model.leafRow).toEqual([])
  })
})

describe('buildHeadModel — профиль ledger/export (levels 2, без разбора склейки)', () => {
  const opts = { isKz: false, levels: 2 } as const

  it('em-dash в groupTitle НЕ разбирается (историческое поведение LEDGER)', () => {
    const cols = [
      col('a', 'Счёт', 'Оборот — приход'),
      col('b', 'Сумма', 'Оборот — приход'),
    ]
    const model = buildHeadModel(cols, opts)
    expect(model.topRow).toMatchObject([
      { key: 'grp-a', title: 'Оборот — приход', colSpan: 2, rowSpan: 1 },
    ])
    expect(model.hasSub).toBe(false)
  })

  it('одиночная колонка несёт ссылку на исходную колонку (col)', () => {
    const cols = [col('date', 'Дата'), col('dt', 'Сумма', 'Дебет')]
    const model = buildHeadModel(cols, opts)
    expect(model.topRow[0].col).toBe(cols[0])
    expect(model.topRow[1].col).toBeUndefined()
  })
})

describe('buildHeadModel — профиль form-view (auto, ключи g-/s-, subEmphasis)', () => {
  const opts = {
    isKz: false,
    levels: 'auto',
    groupKeyPrefix: 'g-',
    subKeyPrefix: 's-',
    subEmphasis: true,
  } as const

  it('auto: подгруппы есть — 3 уровня, подгруппы с emphasis', () => {
    const cols = [
      col('npp', '№ п/п'),
      col('d1', '1010', 'Дебет субсчетов', '7060'),
      col('d2', '1030', 'Дебет субсчетов', '7060'),
    ]
    const model = buildHeadModel(cols, opts)
    expect(model.levels).toBe(3)
    expect(model.topRow).toMatchObject([
      { key: 'npp', rowSpan: 3 },
      { key: 'g-d1', title: 'Дебет субсчетов', colSpan: 2 },
    ])
    expect(model.midRow).toMatchObject([
      { key: 's-d1', title: '7060', colSpan: 2, rowSpan: 1, emphasis: true },
    ])
    expect(model.leafRow.map((l) => l.key)).toEqual(['d1', 'd2'])
  })

  it('auto: только группы — 2 уровня', () => {
    const model = buildHeadModel(
      [col('a', 'Сумма', 'Дебет'), col('b', 'Кол.', 'Дебет')],
      opts
    )
    expect(model.levels).toBe(2)
    expect(model.midRow).toEqual([])
    expect(model.leafRow.map((l) => l.key)).toEqual(['a', 'b'])
  })

  it('auto: без групп и подгрупп — уровень 1, ряды пустые', () => {
    const model = buildHeadModel([col('a', 'Сумма')], opts)
    expect(model.levels).toBe(1)
    expect(model.topRow).toEqual([])
    expect(model.leafRow).toEqual([])
  })
})

describe('buildHeadModel — локализация', () => {
  it('kz: titleKz/groupTitleKz с фолбэком на Ru', () => {
    const cols: HeadModelColumn[] = [
      {
        code: 'a',
        titleRu: 'Сумма',
        titleKz: 'Сомасы',
        groupTitleRu: 'Дебет',
        groupTitleKz: 'Дебет (кз)',
      },
      { code: 'b', titleRu: 'Кол.', titleKz: '', groupTitleRu: 'Дебет' },
    ]
    // groupTitleKz у второй колонки нет → фолбэк на Ru; заголовки разные →
    // с точки зрения kz это ОДНА группа не получится: 'Дебет (кз)' ≠ 'Дебет'.
    const model = buildHeadModel(cols, { isKz: true, levels: 2 })
    expect(model.topRow.map((c) => c.title)).toEqual(['Дебет (кз)', 'Дебет'])
    const ru = buildHeadModel(cols, { isKz: false, levels: 2 })
    expect(ru.topRow).toMatchObject([{ title: 'Дебет', colSpan: 2 }])
    expect(ru.leafRow.map((l) => l.col.titleRu)).toEqual(['Сумма', 'Кол.'])
  })
})
