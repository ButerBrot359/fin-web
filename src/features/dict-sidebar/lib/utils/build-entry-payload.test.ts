import { describe, expect, it } from 'vitest'

import type { DocumentAttribute } from '@/entities/document-type'
import { buildEntryPayload, normalizeTableRows } from './build-entry-payload'

const attr = (code: string, dataType: string): DocumentAttribute =>
  ({ code, dataType }) as DocumentAttribute

// Карточка ПВР «Виды начислений/удержаний организации»: скалярные реквизиты +
// ТЧ «Базовые виды расчёта».
const PVR_ATTRIBUTES = [
  attr('Predopredelennyy', 'BOOLEAN'),
  attr('SposobRascheta', 'ENUMS'),
  attr('BazovyeVidyRascheta', 'TABLE'),
]

describe('buildEntryPayload', () => {
  it('встроенные поля уходят отдельно от attributes', () => {
    const payload = buildEntryPayload(
      {
        nameRu: 'Оклад',
        nameKz: 'Оклад kz',
        code: '000001',
        SposobRascheta: 2,
      },
      PVR_ATTRIBUTES
    )

    expect(payload).toMatchObject({
      nameRu: 'Оклад',
      nameKz: 'Оклад kz',
      code: '000001',
      attributes: { SposobRascheta: 2 },
    })
    expect(payload.attributes).not.toHaveProperty('nameRu')
  })

  // Главный дефект: добавленная на форме строка уходила без идентификатора, и
  // сервер её не сохранял — «Запись сохранена», а после переоткрытия строки нет.
  it('новой строке ТЧ проставляется временный нечисловой rowId', () => {
    const payload = buildEntryPayload(
      {
        nameRu: 'Оклад',
        BazovyeVidyRascheta: [
          {
            VidRascheta: { id: 7, presentation: 'Оклад' },
            Predopredelennyy: false,
          },
          {
            VidRascheta: { id: 9, presentation: 'Премия' },
            Predopredelennyy: false,
          },
        ],
      },
      PVR_ATTRIBUTES
    )

    const rows = payload.attributes.BazovyeVidyRascheta as Record<
      string,
      unknown
    >[]
    expect(rows.map((row) => row.rowId)).toEqual(['tmp-1', 'tmp-2'])
    // Значения строки не трогаем — ссылка уходит объектом, как её ждёт бэк.
    expect(rows[0].VidRascheta).toEqual({ id: 7, presentation: 'Оклад' })
  })

  it('существующая строка сохраняет свой числовой rowId', () => {
    const payload = buildEntryPayload(
      {
        nameRu: 'Оклад',
        BazovyeVidyRascheta: [
          { rowId: 41, VidRascheta: { id: 7 } },
          { id: '42', VidRascheta: { id: 8 } },
          { VidRascheta: { id: 9 } },
        ],
      },
      PVR_ATTRIBUTES
    )

    const rows = payload.attributes.BazovyeVidyRascheta as Record<
      string,
      unknown
    >[]
    expect(rows.map((row) => row.rowId)).toEqual([41, 42, 'tmp-1'])
  })

  // Пустой массив = «строк нет». Форма отдаёт его и когда ТЧ просто не
  // загрузилась, поэтому такой ключ не отправляем вовсе (см. док-комментарий).
  it('пустая ТЧ в запрос не попадает', () => {
    const payload = buildEntryPayload(
      { nameRu: 'Оклад', BazovyeVidyRascheta: [], SposobRascheta: 1 },
      PVR_ATTRIBUTES
    )

    expect(payload.attributes).not.toHaveProperty('BazovyeVidyRascheta')
    expect(payload.attributes).toHaveProperty('SposobRascheta', 1)
  })

  it('не-TABLE массив (напр. множественный выбор) уходит как есть', () => {
    const payload = buildEntryPayload({ nameRu: 'x', Tegi: [1, 2] }, [
      attr('Tegi', 'ARRAY'),
    ])

    expect(payload.attributes.Tegi).toEqual([1, 2])
  })
})

describe('normalizeTableRows', () => {
  it('нумерует только новые строки, сквозным счётчиком', () => {
    expect(
      normalizeTableRows([{ rowId: 5 }, {}, { rowId: 'tmp-99' }, {}]).map(
        (row) => row.rowId
      )
    ).toEqual([5, 'tmp-1', 'tmp-2', 'tmp-3'])
  })
})
