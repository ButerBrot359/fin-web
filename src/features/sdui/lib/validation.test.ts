import { describe, expect, it, vi } from 'vitest'

import { validatePatches } from './validation'

describe('validatePatches', () => {
  it('пропускает валидные патчи всех op', () => {
    const patches = [
      { op: 'setProp', nodeId: 'a', key: 'label', value: 'X' },
      { op: 'setValue', binding: 'b', value: 1 },
      { op: 'removeNode', nodeId: 'a' },
      { op: 'replaceNode', nodeId: 'a', node: { id: 'a', type: 'PAGE' } },
      { op: 'insertNode', parentId: 'a', index: 0, node: { id: 'c', type: 'TEXT' } },
      { op: 'moveNode', nodeId: 'a', parentId: 'r', index: 1 },
      { op: 'setOptions', nodeId: 'a', options: [] },
    ]
    expect(validatePatches(patches)).toHaveLength(7)
  })

  it('отбрасывает малформленные патчи с warn, не бросая', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validatePatches([
      { op: 'setProp' }, // нет nodeId/key
      { op: 'unknown-op' },
      { op: 'setValue', binding: 'b', value: 2 },
    ])
    expect(result).toEqual([{ op: 'setValue', binding: 'b', value: 2 }])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
