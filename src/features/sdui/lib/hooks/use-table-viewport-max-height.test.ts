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

describe('высота контейнера ТЧ', () => {
  it('в обычной карточке замеряется по вьюпорту', () => {
    const container = mount(false)
    const { result } = renderHook(() => useTableViewportMaxHeight())
    act(() => {
      result.current.setNode(container)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.maxHeight).toBeGreaterThan(0)
  })

  it('под растянутым предком (data-stretch) высоту задаёт flex, а не замер', () => {
    const container = mount(true)
    const { result } = renderHook(() => useTableViewportMaxHeight())
    act(() => {
      result.current.setNode(container)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.maxHeight).toBeNull()
  })
})
