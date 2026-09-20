import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'

import { isStretchedRoot } from './stretched-root'

const uzel = (type: string, flex?: number): ViewNode =>
  ({
    id: 'root',
    type,
    props: flex === undefined ? {} : { flex },
    children: [],
  }) as unknown as ViewNode

describe('Растянутый корень экрана — формы без узла PAGE', () => {
  it('VSTACK-корень с flex тянется на высоту окна', () => {
    expect(isStretchedRoot(uzel('VSTACK', 1))).toBe(true)
  })

  it('VSTACK-корень без flex остаётся высотой по содержимому', () => {
    expect(isStretchedRoot(uzel('VSTACK'))).toBe(false)
  })

  it('PAGE-корень не трогаем: режимом растяжки заведует PageNode', () => {
    expect(isStretchedRoot(uzel('PAGE', 1))).toBe(false)
  })

  it('дерева нет — растягивать нечего', () => {
    expect(isStretchedRoot(null)).toBe(false)
  })
})
