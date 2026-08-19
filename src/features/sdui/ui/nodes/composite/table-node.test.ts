import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { extractEditableColumns, kalendariTableKind } from './table-node'

describe('kalendariTableKind', () => {
  it('binding ShablonZapolneniya → template', () => {
    expect(kalendariTableKind('ShablonZapolneniya')).toBe('template')
  })
  it('binding RaspisanieRaboty → schedule', () => {
    expect(kalendariTableKind('RaspisanieRaboty')).toBe('schedule')
  })
  it('прочие binding → null', () => {
    expect(kalendariTableKind('SomeOtherTable')).toBeNull()
    expect(kalendariTableKind(undefined)).toBeNull()
  })
})

// Регресс-пин к §111/§273: скрытые колонки ОБЯЗАНЫ оставаться в наборе, который
// уходит в useTableSync — из него собирается новая строка (buildEmptyRow) и
// полный снимок в EVENT. На скрытых колонках держатся ключи master-detail
// (vychetIPNKey в ИПН): отфильтруй их здесь — и новая строка выпадет из
// detail-фильтра. Фильтрация visible живёт в рендере (EditableTable), не тут.
describe('extractEditableColumns', () => {
  const columns = [
    {
      id: 'c1',
      type: 'TABLE_COLUMN',
      binding: 'Nomen',
      props: { label: 'Номенклатура' },
    },
    {
      id: 'c2',
      type: 'TABLE_COLUMN',
      binding: 'VychetIPNKey',
      props: { label: 'Ключ связи', visible: false },
    },
  ] as unknown as ViewNode[]

  it('скрытые колонки остаются — на них держатся данные строки и EVENT', () => {
    expect(extractEditableColumns(columns).map((c) => c.binding)).toEqual([
      'Nomen',
      'VychetIPNKey',
    ])
  })
})
