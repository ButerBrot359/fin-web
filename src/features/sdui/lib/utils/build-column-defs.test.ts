import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { nodeToTableColumnDef } from './build-column-defs'

describe('nodeToTableColumnDef', () => {
  it('приоритет binding: node.binding > props.binding > node.id', () => {
    expect(
      nodeToTableColumnDef({ id: 'c1', type: 'TABLE_COLUMN', binding: 'top' } as ViewNode).binding,
    ).toBe('top')
    expect(
      nodeToTableColumnDef({
        id: 'c1',
        type: 'TABLE_COLUMN',
        props: { binding: 'inProps' },
      } as ViewNode).binding,
    ).toBe('inProps')
    expect(
      nodeToTableColumnDef({ id: 'c1', type: 'TABLE_COLUMN' } as ViewNode).binding,
    ).toBe('c1')
  })
})
