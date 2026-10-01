import { describe, expect, it } from 'vitest'

import {
  formInstanceOf,
  tabRouteKey,
  withNewFormInstance,
} from './form-instance-route'

describe('form-instance-route', () => {
  it('withNewFormInstance добавляет fi только к форме создания', () => {
    const route = withNewFormInstance('/documents/RKO/new')
    expect(route).toMatch(/^\/documents\/RKO\/new\?fi=[0-9a-f-]{36}$/)
    expect(withNewFormInstance('/documents/RKO/12')).toBe('/documents/RKO/12')
    expect(withNewFormInstance('/documents/RKO')).toBe('/documents/RKO')
  })

  it('withNewFormInstance сохраняет прочий query и не меняет готовый fi', () => {
    const route = withNewFormInstance('/documents/RKO/new?VidOperatsii=X')
    expect(route).toMatch(/^\/documents\/RKO\/new\?VidOperatsii=X&fi=/)
    expect(withNewFormInstance('/documents/RKO/new?fi=abc')).toBe(
      '/documents/RKO/new?fi=abc'
    )
  })

  it('каждый вызов даёт новый экземпляр', () => {
    expect(withNewFormInstance('/documents/RKO/new')).not.toBe(
      withNewFormInstance('/documents/RKO/new')
    )
  })

  it('formInstanceOf читает fi только у формы создания', () => {
    expect(formInstanceOf('/documents/RKO/new', '?fi=abc')).toBe('abc')
    expect(formInstanceOf('/documents/RKO/new', '')).toBeNull()
    expect(formInstanceOf('/documents/RKO/12', '?fi=abc')).toBeNull()
  })

  it('tabRouteKey различает экземпляры и группу', () => {
    expect(tabRouteKey('/documents/RKO/new', '')).toBe('/documents/RKO/new')
    expect(tabRouteKey('/documents/RKO/new', '?fi=a&VidOperatsii=X')).toBe(
      '/documents/RKO/new?fi=a'
    )
    expect(tabRouteKey('/dictionaries/K/new', '?isGroup=true&fi=b')).toBe(
      '/dictionaries/K/new?isGroup=true&fi=b'
    )
    expect(tabRouteKey('/documents/RKO/12', '?fi=a')).toBe('/documents/RKO/12')
  })
})
