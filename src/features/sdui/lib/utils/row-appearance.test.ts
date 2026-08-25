import { describe, expect, it } from 'vitest'

import { parseRowAppearance, resolveRowBackground } from './row-appearance'

const GREEN = 'rgb(200, 255, 210)'

describe('parseRowAppearance', () => {
  it('читает правила из props узла таблицы', () => {
    const rules = parseRowAppearance({
      rowAppearance: [
        {
          binding: 'RabotnikRasschitan',
          equals: true,
          backgroundColor: GREEN,
        },
      ],
    })
    expect(rules).toEqual([
      { binding: 'RabotnikRasschitan', equals: true, backgroundColor: GREEN },
    ])
  })

  it('без `equals` правило означает булев признак «включено»', () => {
    const rules = parseRowAppearance({
      rowAppearance: [
        { binding: 'RabotnikRasschitan', backgroundColor: GREEN },
      ],
    })
    expect(rules[0].equals).toBe(true)
  })

  // Сид раскладки кладёт JSON текстом, а бэк приводит к Java-типу только
  // INTEGER/BOOLEAN — на фронт проп приезжает СТРОКОЙ (NodeBuilder.coerceProp).
  it('разбирает проп, приехавший строкой JSON', () => {
    const rules = parseRowAppearance({
      rowAppearance:
        '[{"binding":"RabotnikRasschitan","equals":true,"backgroundColor":"rgb(200, 255, 210)"}]',
    })
    expect(rules).toEqual([
      { binding: 'RabotnikRasschitan', equals: true, backgroundColor: GREEN },
    ])
  })

  // Раскладка приезжает с сервера: одно кривое правило не должно стоить
  // пользователю всей таблицы — оно молча отбрасывается.
  it('отбрасывает непригодные правила и чужие типы пропа', () => {
    expect(parseRowAppearance(undefined)).toEqual([])
    expect(parseRowAppearance({})).toEqual([])
    expect(parseRowAppearance({ rowAppearance: 'green' })).toEqual([])
    expect(parseRowAppearance({ rowAppearance: '{"binding":"A"}' })).toEqual([])
    expect(parseRowAppearance({ rowAppearance: 42 })).toEqual([])
    expect(
      parseRowAppearance({
        rowAppearance: [
          null,
          'green',
          { binding: '', backgroundColor: GREEN },
          { binding: 'A' },
          { binding: 'B', backgroundColor: '' },
          { binding: 'C', backgroundColor: GREEN },
        ],
      })
    ).toEqual([{ binding: 'C', equals: true, backgroundColor: GREEN }])
  })
})

describe('resolveRowBackground', () => {
  const rules = parseRowAppearance({
    rowAppearance: [
      { binding: 'RabotnikRasschitan', equals: true, backgroundColor: GREEN },
    ],
  })

  it('заливает строку с признаком и не трогает остальные', () => {
    expect(
      resolveRowBackground(rules, { rowId: '1', RabotnikRasschitan: true })
    ).toBe(GREEN)
    expect(
      resolveRowBackground(rules, { rowId: '2', RabotnikRasschitan: false })
    ).toBeUndefined()
    // Ключа нет вовсе — признак не приехал, заливки нет.
    expect(resolveRowBackground(rules, { rowId: '3' })).toBeUndefined()
  })

  // Булев признак может приехать строкой: форма записи не должна менять отбор.
  it('строковый "true"/"false" равнозначен булеву', () => {
    expect(
      resolveRowBackground(rules, { rowId: '1', RabotnikRasschitan: 'true' })
    ).toBe(GREEN)
    expect(
      resolveRowBackground(rules, { rowId: '2', RabotnikRasschitan: 'false' })
    ).toBeUndefined()
  })

  it('ссылочное значение сравнивается по id, а не по представлению', () => {
    const byRef = parseRowAppearance({
      rowAppearance: [
        { binding: 'Status', equals: 7, backgroundColor: GREEN },
      ],
    })
    expect(
      resolveRowBackground(byRef, {
        rowId: '1',
        Status: { id: 7, presentation: 'Рассчитан' },
      })
    ).toBe(GREEN)
    expect(
      resolveRowBackground(byRef, {
        rowId: '2',
        Status: { id: 8, presentation: 'Не рассчитан' },
      })
    ).toBeUndefined()
  })

  it('`equals: null` — отбор «значения нет»', () => {
    const empty = parseRowAppearance({
      rowAppearance: [
        { binding: 'Dolzhnost', equals: null, backgroundColor: GREEN },
      ],
    })
    expect(resolveRowBackground(empty, { rowId: '1' })).toBe(GREEN)
    expect(resolveRowBackground(empty, { rowId: '2', Dolzhnost: null })).toBe(
      GREEN
    )
    expect(resolveRowBackground(empty, { rowId: '3', Dolzhnost: '' })).toBe(
      GREEN
    )
    expect(
      resolveRowBackground(empty, { rowId: '4', Dolzhnost: 'Врач' })
    ).toBeUndefined()
  })

  it('побеждает первое сработавшее правило — порядок задаёт бэк', () => {
    const two = parseRowAppearance({
      rowAppearance: [
        { binding: 'A', equals: true, backgroundColor: 'red' },
        { binding: 'B', equals: true, backgroundColor: GREEN },
      ],
    })
    expect(resolveRowBackground(two, { rowId: '1', A: true, B: true })).toBe(
      'red'
    )
    expect(resolveRowBackground(two, { rowId: '2', B: true })).toBe(GREEN)
  })

  it('без правил заливки нет', () => {
    expect(resolveRowBackground([], { rowId: '1', X: true })).toBeUndefined()
  })
})
