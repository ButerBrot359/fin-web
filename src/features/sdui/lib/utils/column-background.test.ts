import { describe, expect, it } from 'vitest'

import { buildColumnBackgroundMap, columnBackground } from './column-background'

describe('columnBackground', () => {
  it('цвет из props колонки', () => {
    expect(columnBackground({ backgroundColor: '#CCFFCC' })).toBe('#CCFFCC')
  })

  it('пропа нет — заливки нет (прежнее поведение)', () => {
    expect(columnBackground({})).toBeUndefined()
    expect(columnBackground(undefined)).toBeUndefined()
  })

  it('пустая строка и не-строка игнорируются', () => {
    expect(columnBackground({ backgroundColor: '   ' })).toBeUndefined()
    expect(columnBackground({ backgroundColor: 123 })).toBeUndefined()
  })
})

describe('buildColumnBackgroundMap', () => {
  it('в карту попадают только окрашенные колонки', () => {
    const map = buildColumnBackgroundMap([
      { id: 'col.summa', props: { backgroundColor: '#CCFFCC' } },
      { id: 'col.kolichestvo', props: { backgroundColor: '#DCDCDC' } },
      { id: 'col.nomer', props: {} },
      { id: 'col.bezProps' },
    ])
    expect(map.get('col.summa')).toBe('#CCFFCC')
    expect(map.get('col.kolichestvo')).toBe('#DCDCDC')
    expect(map.has('col.nomer')).toBe(false)
    expect(map.size).toBe(2)
  })
})
