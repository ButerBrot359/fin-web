import { describe, expect, it } from 'vitest'

import type { ValidationMessage } from '@/entities/validation-report'

import { targetBinding } from './target-binding'
import { subtreeHasBinding } from './subtree-has-binding'
import type { ViewNode } from '../../types/view'

const base: Omit<ValidationMessage, 'target' | 'attributeCode'> = {
  id: 'm1',
  severity: 'ERROR',
  source: null,
  blocking: true,
  message: 'текст',
}

describe('targetBinding', () => {
  it('FIELD → fieldCode, TABLE/TABLE_CELL → tableCode', () => {
    expect(
      targetBinding({
        ...base,
        target: { kind: 'FIELD', fieldCode: 'MOL' },
        attributeCode: null,
      })
    ).toBe('MOL')
    expect(
      targetBinding({
        ...base,
        target: {
          kind: 'TABLE_CELL',
          tableCode: 'TMZ',
          rowIndex: 2,
          columnCode: 'Spetsifika',
        },
        attributeCode: null,
      })
    ).toBe('TMZ')
  })

  it('без target пробует легаси-attributeCode (v2 §2.6); DOCUMENT — нет', () => {
    expect(targetBinding({ ...base, target: null, attributeCode: 'TMZ' })).toBe(
      'TMZ'
    )
    expect(
      targetBinding({
        ...base,
        target: { kind: 'DOCUMENT' },
        attributeCode: 'TMZ',
      })
    ).toBeNull()
  })
})

describe('subtreeHasBinding', () => {
  const tree = {
    id: 'tab1',
    type: 'TAB',
    children: [
      { id: 'v', type: 'VSTACK', children: [{ id: 'f', binding: 'MOL' }] },
    ],
  } as unknown as ViewNode

  it('находит binding в глубине и не находит чужой', () => {
    expect(subtreeHasBinding(tree, 'MOL')).toBe(true)
    expect(subtreeHasBinding(tree, 'FKR')).toBe(false)
  })
})
