import { describe, expect, it } from 'vitest'

import { resolveOptionsParams } from './resolve-options-params'

const noValues = () => undefined

describe('resolveOptionsParams', () => {
  it('undefined params → пустой объект', () => {
    expect(resolveOptionsParams(undefined, noValues)).toEqual({})
  })

  it('строковый параметр проходит как есть', () => {
    expect(resolveOptionsParams({ Status: 'active' }, noValues)).toEqual({
      Status: 'active',
    })
  })

  it('{ fromBinding } → String(id) значения поля-объекта', () => {
    const getValue = (b: string) => (b === 'Kontragent' ? { id: 123 } : undefined)
    expect(
      resolveOptionsParams({ Vladelets: { fromBinding: 'Kontragent' } }, getValue),
    ).toEqual({ Vladelets: '123' })
  })

  it('{ fromBinding } с примитивным значением → String(value)', () => {
    const getValue = () => 42
    expect(
      resolveOptionsParams({ Vladelets: { fromBinding: 'X' } }, getValue),
    ).toEqual({ Vladelets: '42' })
  })

  it('{ fromBinding } с пустым значением → параметр опущен (нет фильтра)', () => {
    expect(
      resolveOptionsParams({ Vladelets: { fromBinding: 'Kontragent' } }, noValues),
    ).toEqual({})
  })

  it('{ fromBinding } с объектом без id (id == null) → опущен', () => {
    const getValue = () => ({ presentation: 'X' })
    expect(
      resolveOptionsParams({ Vladelets: { fromBinding: 'K' } }, getValue),
    ).toEqual({})
  })

  it('смешанные params: строка остаётся, fromBinding резолвится, пустой опускается', () => {
    const getValue = (b: string) => (b === 'K' ? { id: 7 } : undefined)
    expect(
      resolveOptionsParams(
        {
          Status: 'active',
          Vladelets: { fromBinding: 'K' },
          Owner: { fromBinding: 'Missing' },
        },
        getValue,
      ),
    ).toEqual({ Status: 'active', Vladelets: '7' })
  })

  it('id === 0 сохраняется (не считается пустым)', () => {
    const getValue = () => ({ id: 0 })
    expect(
      resolveOptionsParams({ P: { fromBinding: 'B' } }, getValue),
    ).toEqual({ P: '0' })
  })
})
