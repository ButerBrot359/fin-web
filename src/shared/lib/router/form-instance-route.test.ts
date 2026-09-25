import { describe, expect, it } from 'vitest'

import {
  formInstanceOf,
  tabRouteKey,
  withNewFormInstance,
} from './form-instance-route'

describe('form-instance-route', () => {
  it('withNewFormInstance добавляет экземпляр только маршруту создания', () => {
    const route = withNewFormInstance('/documents/RKO/new')
    expect(route).toMatch(/^\/documents\/RKO\/new\?fi=[0-9a-f-]{36}$/)
    expect(withNewFormInstance('/documents/RKO/15')).toBe('/documents/RKO/15')
    expect(withNewFormInstance('/documents/RKO')).toBe('/documents/RKO')
  })

  it('withNewFormInstance сохраняет прочие параметры и каждый раз даёт новый экземпляр', () => {
    const first = withNewFormInstance('/documents/RKO/new?copyFrom=5')
    const second = withNewFormInstance('/documents/RKO/new?copyFrom=5')
    const params = new URLSearchParams(first.split('?')[1])
    expect(params.get('copyFrom')).toBe('5')
    expect(first).not.toBe(second)
  })

  it('withNewFormInstance не заменяет уже заданный экземпляр', () => {
    expect(withNewFormInstance('/documents/RKO/new?fi=a1')).toBe(
      '/documents/RKO/new?fi=a1'
    )
  })

  it('formInstanceOf читает экземпляр только у маршрута создания', () => {
    expect(formInstanceOf('/documents/RKO/new', '?fi=a1&copyFrom=5')).toBe('a1')
    expect(formInstanceOf('/documents/RKO/new', '?copyFrom=5')).toBeNull()
    expect(formInstanceOf('/documents/RKO/15', '?fi=a1')).toBeNull()
  })

  it('tabRouteKey различает экземпляры и сохраняет маркер группы', () => {
    expect(tabRouteKey('/documents/RKO/new', '')).toBe('/documents/RKO/new')
    expect(tabRouteKey('/documents/RKO/new', '?copyFrom=5&fi=a1')).toBe(
      '/documents/RKO/new?fi=a1'
    )
    expect(tabRouteKey('/dictionaries/K/new', '?isGroup=true&fi=b2')).toBe(
      '/dictionaries/K/new?isGroup=true&fi=b2'
    )
    expect(tabRouteKey('/dictionaries/K/new', '?isGroup=true')).toBe(
      '/dictionaries/K/new?isGroup=true'
    )
    expect(tabRouteKey('/documents/RKO/15', '?fi=a1')).toBe('/documents/RKO/15')
  })
})
