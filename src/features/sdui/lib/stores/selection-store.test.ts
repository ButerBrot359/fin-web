import { beforeEach, describe, expect, it } from 'vitest'

import { useSelectionStore } from './selection-store'

beforeEach(() => {
  useSelectionStore.setState({ selection: {} })
})

describe('selection-store — единый реестр (SCRUM-288 §2.2)', () => {
  it('хранит number (пикер) и string (дерево) под непрозрачными ключами', () => {
    useSelectionStore.getState().setSelection('ref.field', 42)
    useSelectionStore.getState().setSelection('related.anchor7', 'row-13')
    expect(useSelectionStore.getState().selection['ref.field']).toBe(42)
    expect(useSelectionStore.getState().selection['related.anchor7']).toBe(
      'row-13'
    )
  })

  it('clearSelection удаляет ключ', () => {
    useSelectionStore.getState().setSelection('k', 1)
    useSelectionStore.getState().clearSelection('k')
    expect('k' in useSelectionStore.getState().selection).toBe(false)
  })
})
