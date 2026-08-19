import { describe, it, expect } from 'vitest'

import { computeOverflow, type OverflowItem } from './compute-overflow'

const item = (
  id: string,
  width: number,
  pinned = false,
  overflowHost = false
): OverflowItem => ({
  id,
  width,
  pinned,
  overflowHost,
})

describe('computeOverflow', () => {
  const items: OverflowItem[] = [
    item('btn.postClose', 100, true),
    item('btn.save', 80),
    item('btn.post', 80),
    item('btn.print', 80),
    item('btn.reports', 80),
    item('spacer.more', 0, true),
    item('btn.more', 60, true, true),
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

  it('B-5: резерв под «Ещё» определяется overflowHost, а не id хозяина', () => {
    // Хозяин с произвольным id: его ширина уже в pinned-сумме, moreWidth
    // дополнительно НЕ резервируется — как раньше при id 'btn.more'.
    const customHost: OverflowItem[] = [
      item('btn.postClose', 100, true),
      item('btn.save', 80),
      item('btn.post', 80),
      item('btn.print', 80),
      item('btn.reports', 80),
      item('toolbar.overflowMenu', 60, true, true),
    ]
    expect(computeOverflow(customHost, 300, 60)).toEqual([
      'btn.reports',
      'btn.print',
      'btn.post',
    ])
  })

  it('B-5: без хозяина в items moreWidth резервируется сверх pinned', () => {
    // Есть элемент с id 'btn.more', но он НЕ хозяин (overflowHost: false) —
    // резерв под «Ещё» добавляется, id больше ничего не значит.
    const noHost: OverflowItem[] = [
      item('btn.postClose', 100, true),
      item('btn.more', 60, true, false),
      item('btn.save', 80),
    ]
    // pinned = 160, хозяина нет → reserved = 160 + 60 = 220.
    // available 260 → бюджет 40 < 80 → save сворачивается.
    expect(computeOverflow(noHost, 260, 60)).toEqual(['btn.save'])
    // При наличии хозяина той же ширины резерв не удваивается: бюджет 100 ≥ 80.
    const withHost: OverflowItem[] = [
      item('btn.postClose', 100, true),
      item('btn.more', 60, true, true),
      item('btn.save', 80),
    ]
    expect(computeOverflow(withHost, 260, 60)).toEqual([])
  })
})
