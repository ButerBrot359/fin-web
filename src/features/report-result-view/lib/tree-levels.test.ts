import { describe, expect, it } from 'vitest'

import type { ReportRowDto } from '@/pages/reports/report-list/types/report'

import { expandedToLevel, treeLevelCount } from './tree-levels'

const leaf = (groupValue: string): ReportRowDto =>
  ({ level: 2, groupValue, cells: {}, children: [] }) as ReportRowDto

const node = (groupValue: string, children: ReportRowDto[]): ReportRowDto =>
  ({ level: 0, groupValue, cells: {}, children }) as ReportRowDto

const rows = [
  node('09.2026', [node('Иванов', [leaf('ИПН')]), leaf('Итого')]),
  node('10.2026', [leaf('Петров')]),
  leaf('Без группы'),
]

describe('treeLevelCount', () => {
  it('считает уровни группировки по самой глубокой ветке', () => {
    expect(treeLevelCount(rows)).toBe(3)
  })

  it('плоский список — один уровень', () => {
    expect(treeLevelCount([leaf('А'), leaf('Б')])).toBe(1)
  })
})

describe('expandedToLevel', () => {
  it('уровень 1 сворачивает всё', () => {
    expect(expandedToLevel(rows, 1)).toEqual({})
  })

  it('уровень 2 раскрывает только корневые группы', () => {
    expect(expandedToLevel(rows, 2)).toEqual({ '0': true, '1': true })
  })

  it('уровень 3 раскрывает вложенные группы с id по цепочке родителей', () => {
    expect(expandedToLevel(rows, 3)).toEqual({
      '0': true,
      '0.0': true,
      '1': true,
    })
  })
})
