import { describe, expect, it } from 'vitest'

import type { ViewNode, ViewPatch } from '../types/view'
import { applyPatches, applyValuePatches, clearErrors } from './patch-applier'

const tree: ViewNode = {
  id: 'root',
  type: 'PAGE',
  children: [
    { id: 'f1', type: 'TEXT_FIELD', props: { label: 'A', error: 'bad' } },
    { id: 'f2', type: 'TEXT_FIELD', props: { label: 'B' } },
  ],
} as ViewNode

describe('applyPatches', () => {
  it('setProp обновляет prop узла, не мутируя исходное дерево', () => {
    const patch: ViewPatch = { op: 'setProp', nodeId: 'f2', key: 'label', value: 'C' } as ViewPatch
    const next = applyPatches(tree, [patch])
    expect(next.children![1].props!.label).toBe('C')
    expect(tree.children![1].props!.label).toBe('B')
  })

  it('removeNode удаляет узел', () => {
    const next = applyPatches(tree, [{ op: 'removeNode', nodeId: 'f1' } as ViewPatch])
    expect(next.children).toHaveLength(1)
  })
})

describe('clearErrors', () => {
  it('обнуляет props.error по всему дереву', () => {
    const next = clearErrors(tree)
    expect(next.children![0].props!.error).toBeNull()
  })
})

describe('applyValuePatches', () => {
  it('вызывает setter только для setValue-патчей с binding', () => {
    const calls: Array<[string, unknown]> = []
    applyValuePatches(
      [
        { op: 'setValue', binding: 'x', value: 1 } as ViewPatch,
        { op: 'setProp', nodeId: 'f1', key: 'label', value: 'Z' } as ViewPatch,
      ],
      (b, v) => calls.push([b, v]),
    )
    expect(calls).toEqual([['x', 1]])
  })
})
