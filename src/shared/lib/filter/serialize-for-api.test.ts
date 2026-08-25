import { describe, expect, it } from 'vitest'

import { serializeFilterForApi } from './serialize-for-api'

describe('serializeFilterForApi', () => {
  it('preserves quick q search together with structured filters', () => {
    expect(
      serializeFilterForApi({
        filters: [
          {
            field: 'Organizatsiya',
            op: 'eq',
            value: { id: 42, label: 'Qazyna' },
          },
        ],
        logic: 'AND',
        q: 'табель',
      })
    ).toEqual({
      filters: [{ field: 'Organizatsiya', op: 'eq', value: 42 }],
      logic: 'AND',
      q: 'табель',
    })
  })
})
