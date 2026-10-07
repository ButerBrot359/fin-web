import { describe, expect, it } from 'vitest'

import {
  consumeAdoptedScreen,
  requestScreenRebind,
  takeScreenRebind,
} from './screen-rebind'

describe('screen-rebind', () => {
  it('экран нового адреса принимает форму один раз', () => {
    requestScreenRebind('/documents/T/new?fi=a', '/documents/T/1')

    expect(takeScreenRebind('/documents/T/new?fi=a', '/documents/T/1')).toBe(
      true
    )
    expect(consumeAdoptedScreen('/documents/T/1')).toBe(true)
    expect(consumeAdoptedScreen('/documents/T/1')).toBe(false)
  })

  it('уход не туда, куда просили, снимает запрос без принятия формы', () => {
    requestScreenRebind('/documents/T/new?fi=b', '/documents/T/2')

    expect(takeScreenRebind('/documents/T/new?fi=b', '/documents/T')).toBe(
      false
    )
    expect(takeScreenRebind('/documents/T/new?fi=b', '/documents/T/2')).toBe(
      false
    )
    expect(consumeAdoptedScreen('/documents/T/2')).toBe(false)
  })

  it('перепривязка на тот же адрес не запрашивается', () => {
    requestScreenRebind('/documents/T/3', '/documents/T/3')

    expect(takeScreenRebind('/documents/T/3', '/documents/T/3')).toBe(false)
  })
})
