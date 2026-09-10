import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useTableViewportMaxHeight } from './use-table-viewport-max-height'

const mount = (stretched: boolean) => {
  const host = document.createElement('div')
  if (stretched) host.dataset.stretch = 'true'
  const container = document.createElement('div')
  host.appendChild(container)
  document.body.appendChild(host)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

const withScroller = (footerHeight: number) => {
  const scroller = document.createElement('div')
  Object.defineProperty(scroller, 'clientHeight', {
    value: 800,
    configurable: true,
  })
  Object.defineProperty(scroller, 'scrollHeight', {
    value: 600 + footerHeight,
    configurable: true,
  })
  scroller.style.overflowY = 'auto'
  const container = document.createElement('div')
  Object.defineProperty(container, 'offsetHeight', {
    value: 500,
    configurable: true,
  })
  container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
  scroller.appendChild(container)
  document.body.appendChild(scroller)
  return container
}

const measure = (container: HTMLElement) => {
  const { result } = renderHook(() => useTableViewportMaxHeight())
  act(() => {
    result.current.setNode(container)
    window.dispatchEvent(new Event('resize'))
  })
  return result.current.maxHeight
}

describe('высота контейнера ТЧ', () => {
  it('в обычной карточке замеряется по вьюпорту', () => {
    const container = mount(false)
    const { result } = renderHook(() => useTableViewportMaxHeight())
    act(() => {
      result.current.setNode(container)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.maxHeight).toBeGreaterThan(0)
    expect(result.current.minHeight).toBeNull()
  })

  it('под растянутым предком (data-stretch) высоту задаёт flex, а не замер', () => {
    const container = mount(true)
    const { result } = renderHook(() => useTableViewportMaxHeight())
    act(() => {
      result.current.setNode(container)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.maxHeight).toBeNull()
    // …но и схлопнуться в полоску не даём: пол высоты остаётся, иначе при
    // высокой шапке и низком окне от ТЧ видна одна шапка колонок.
    expect(result.current.minHeight).toBe(240)
  })

  it('высокий подвал формы урезает таблицу — иначе она уедет под итоги', () => {
    const tall = measure(withScroller(300))
    const short = measure(withScroller(100))

    expect(tall).not.toBeNull()
    expect(short).not.toBeNull()
    expect(tall!).toBeLessThan(short!)
  })

  it('низкий подвал не поднимает таблицу выше прежнего запаса в 148px', () => {
    expect(measure(withScroller(10))).toBe(800 - 100 - 148)
  })
})
