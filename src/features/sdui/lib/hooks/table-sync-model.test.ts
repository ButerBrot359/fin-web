import { describe, expect, it } from 'vitest'

import type { TableColumnDef, TableRow } from './use-table-sync'
import {
  TMP_ROW_ID_PREFIX,
  buildEmptyRow,
  reconcileRows,
  sameRows,
} from './table-sync-model'

const col = (binding: string, dataType: string): TableColumnDef =>
  ({
    id: binding,
    label: binding,
    binding,
    cellWidget: 'TEXT_FIELD',
    dataType,
    props: {},
  }) as TableColumnDef

describe('buildEmptyRow', () => {
  it('генерирует tmp-rowId (локальная строка, которой сервер не видел)', () => {
    const row = buildEmptyRow([])
    expect(row.rowId.startsWith(TMP_ROW_ID_PREFIX)).toBe(true)
    // Идентификаторы уникальны — иначе две подряд добавленные строки склеятся.
    expect(buildEmptyRow([]).rowId).not.toBe(row.rowId)
  })

  it('дефолты по dataType: строки — "", числа — 0, boolean — false, прочее — null', () => {
    const row = buildEmptyRow([
      col('s', 'STRING'),
      col('t', 'TEXT'),
      col('i', 'INTEGER'),
      col('d', 'DECIMAL'),
      col('b', 'BOOLEAN'),
      col('ref', 'REFERENCE'),
    ])
    expect(row.s).toBe('')
    expect(row.t).toBe('')
    expect(row.i).toBe(0)
    expect(row.d).toBe(0)
    expect(row.b).toBe(false)
    expect(row.ref).toBeNull()
  })
})

describe('sameRows', () => {
  it('порядок ключей не считается расхождением', () => {
    expect(
      sameRows(
        [{ rowId: '1', a: 1, b: 'x' } as TableRow],
        [{ b: 'x', a: 1, rowId: '1' } as TableRow]
      )
    ).toBe(true)
  })

  it('разные значения — расхождение', () => {
    expect(
      sameRows(
        [{ rowId: '1', a: 1 } as TableRow],
        [{ rowId: '1', a: 2 } as TableRow]
      )
    ).toBe(false)
  })

  it('undefined-поля игнорируются, null против null-снимка различает', () => {
    expect(
      sameRows(
        [{ rowId: '1', a: undefined } as TableRow],
        [{ rowId: '1' } as TableRow]
      )
    ).toBe(true)
    expect(sameRows(null, [])).toBe(false)
    expect(sameRows(null, null)).toBe(true)
  })
})

describe('reconcileRows', () => {
  const noReadonly = new Set<string>()

  it('без dirty возвращает канон как есть (канон новее)', () => {
    const canon = [{ rowId: '1', a: 1 } as TableRow]
    const merged = reconcileRows(canon, new Map(), noReadonly)
    expect(merged).toEqual(canon)
    // Строки не пересобираются — та же ссылка, что в каноне.
    expect(merged[0]).toBe(canon[0])
  })

  it('dirty-патч ложится поверх канона, нетронутые поля — из канона', () => {
    const canon = [
      { rowId: '1', a: 1, b: 'server' } as TableRow,
      { rowId: '2', a: 2 } as TableRow,
    ]
    const dirty = new Map([['1', { a: 99 }]])
    const merged = reconcileRows(canon, dirty, noReadonly)
    expect(merged).toEqual([
      { rowId: '1', a: 99, b: 'server' },
      { rowId: '2', a: 2 },
    ])
  })

  it('readonly-биндинги патчем не перекрываются — их значения серверные', () => {
    const canon = [{ rowId: '1', total: 100, name: 'old' } as TableRow]
    const dirty = new Map([['1', { total: 5, name: 'new' }]])
    const merged = reconcileRows(canon, dirty, new Set(['total']))
    expect(merged).toEqual([{ rowId: '1', total: 100, name: 'new' }])
  })

  it('tmp-строка, которой нет в каноне, воскресает из dirty', () => {
    const canon = [{ rowId: '1', a: 1 } as TableRow]
    const tmpId = `${TMP_ROW_ID_PREFIX}abc`
    const dirty = new Map([[tmpId, { a: 7 }]])
    const merged = reconcileRows(canon, dirty, noReadonly)
    expect(merged).toEqual([
      { rowId: '1', a: 1 },
      { rowId: tmpId, a: 7 },
    ])
  })

  it('патч СЕРВЕРНОЙ строки, выпавшей из канона, отбрасывается (не строка-дубль)', () => {
    const canon = [{ rowId: '1', a: 1 } as TableRow]
    const dirty = new Map([['deleted-server-row', { a: 7 }]])
    const merged = reconcileRows(canon, dirty, noReadonly)
    expect(merged).toEqual([{ rowId: '1', a: 1 }])
  })

  it('tmp-строка, уже попавшая в канон, не дублируется', () => {
    const tmpId = `${TMP_ROW_ID_PREFIX}abc`
    const canon = [{ rowId: tmpId, a: 1 } as TableRow]
    const dirty = new Map([[tmpId, { a: 7 }]])
    const merged = reconcileRows(canon, dirty, noReadonly)
    expect(merged).toEqual([{ rowId: tmpId, a: 7 }])
  })
})
