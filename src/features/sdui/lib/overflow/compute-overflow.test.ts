import { describe, it, expect } from 'vitest'

import { computeOverflow, type OverflowItem } from './compute-overflow'

const item = (id: string, width: number, pinned = false): OverflowItem => ({
  id,
  width,
  pinned,
})

describe('computeOverflow', () => {
  const items: OverflowItem[] = [
    item('btn.postClose', 100, true),
    item('btn.save', 80),
    item('btn.post', 80),
    item('btn.print', 80),
    item('btn.reports', 80),
    item('spacer.more', 0, true),
    item('btn.more', 60, true),
  ]

  it('всё влезает → ничего не сворачивается', () => {
    expect(computeOverflow(items, 1000, 60)).toEqual([])
  })

  it('сворачивает справа-налево пока не влезет', () => {
    // pinned: postClose(100)+more(60)=160 всегда. Доступно 300 → бюджет под
    // непиновые = 300-160 = 140 → влезают save(80). print/reports/post(80*3)
    // уходят: сворачиваются reports, print, post (справа-налево), останется save.
    expect(computeOverflow(items, 300, 60)).toEqual([
      'btn.reports',
      'btn.print',
      'btn.post',
    ])
  })

  it('pinned не сворачиваются даже при нулевой ширине', () => {
    const collapsed = computeOverflow(items, 10, 60)
    expect(collapsed).not.toContain('btn.postClose')
    expect(collapsed).not.toContain('btn.more')
    expect(collapsed).not.toContain('spacer.more')
  })
})
