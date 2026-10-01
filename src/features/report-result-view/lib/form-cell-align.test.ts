import { describe, expect, it } from 'vitest'

import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import {
  horizontalAlignClass,
  labelAlignClass,
  verticalAlignClass,
} from './form-cell-align'

const col = (align?: string): ReportColumnDto =>
  ({ code: 'C', titleRu: '', align }) as ReportColumnDto

describe('form-cell-align', () => {
  it('бланк по макету выравнивает графу строго по align', () => {
    expect(horizontalAlignClass(col('LEFT'), 0, true)).toBe('text-left')
    expect(horizontalAlignClass(col('CENTER'), 1, true)).toBe('text-center')
    expect(horizontalAlignClass(col('RIGHT'), 2, true)).toBe('text-right')
  })

  it('прочие бланки выравниваются как раньше: первая графа по центру', () => {
    expect(horizontalAlignClass(col('LEFT'), 0, false)).toBe('text-center')
    expect(horizontalAlignClass(col('LEFT'), 1, false)).toBe('')
    expect(horizontalAlignClass(col('RIGHT'), 1, false)).toBe('text-right')
  })

  it('вертикальное выравнивание графы, по умолчанию — по верху', () => {
    expect(verticalAlignClass('BOTTOM')).toBe('align-bottom')
    expect(verticalAlignClass('CENTER')).toBe('align-middle')
    expect(verticalAlignClass(undefined)).toBe('align-top')
  })

  it('подпись строки без выравнивания — по правому краю, как раньше', () => {
    expect(labelAlignClass(undefined)).toBe('text-right')
    expect(labelAlignClass('CENTER')).toBe('text-center')
  })
})
