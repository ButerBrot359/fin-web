import { afterEach, describe, expect, it } from 'vitest'

import { cssZoomOf } from './css-zoom'

describe('cssZoomOf', () => {
  const el = document.createElement('div')

  afterEach(() => {
    Reflect.deleteProperty(el, 'currentCSSZoom')
  })

  it('возвращает эффективный zoom элемента', () => {
    Object.defineProperty(el, 'currentCSSZoom', {
      configurable: true,
      value: 1.32,
    })

    expect(cssZoomOf(el)).toBe(1.32)
  })

  it('без поддержки currentCSSZoom и без элемента — 1', () => {
    expect(cssZoomOf(el)).toBe(1)
    expect(cssZoomOf(null)).toBe(1)
  })

  it('некорректный zoom трактуется как 1', () => {
    Object.defineProperty(el, 'currentCSSZoom', {
      configurable: true,
      value: 0,
    })

    expect(cssZoomOf(el)).toBe(1)
  })
})
