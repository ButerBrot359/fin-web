import { describe, it, expect, vi, beforeEach } from 'vitest'

import { relaySelectionToParent } from './relay-selection'
import { viewTransport } from '../api/view-transport'
import type { ViewEffect } from '../types/view'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn() },
  ViewConflictError: class extends Error {},
}))
vi.mock('./stores/panel-store', () => ({
  usePanelStore: { getState: () => ({ findBySessionId: () => undefined, updateSession: vi.fn() }) },
}))
vi.mock('./stores/tree-store', () => ({
  useTreeStore: { getState: () => ({ revision: 1, bumpRevision: vi.fn(), clearAllErrors: vi.fn(), applyPatches: vi.fn() }) },
}))
vi.mock('./stores/view-state-store', () => ({
  useViewStateStore: { getState: () => ({ setFromServer: vi.fn(), merge: vi.fn() }) },
}))
vi.mock('./patch-applier', () => ({ applyValuePatches: vi.fn() }))
vi.mock('./validation', () => ({ validatePatches: (p: unknown) => p ?? [] }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const noop = vi.fn()

describe('relaySelectionToParent (SCRUM-284 Δ3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('шлёт applyToParentCommand дословно + value', () => {
    vi.mocked(viewTransport.post).mockResolvedValue({ revision: 2, patches: [], effects: [] } as never)
    const effect = {
      type: 'closeDialog',
      applyToParentSessionId: 's1',
      applyToParentCommand: 'OPAQUE_CMD',
      applyToParentValue: { id: 7 },
    } as unknown as ViewEffect

    relaySelectionToParent(effect, noop)

    expect(viewTransport.post).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ command: 'OPAQUE_CMD', value: { id: 7 } }),
      })
    )
  })

  it('без applyToParentCommand — no-op (не строит ref.select)', () => {
    const effect = {
      type: 'closeDialog',
      applyToParentSessionId: 's1',
      applyToParentTargetNodeId: 'n1',
      applyToParentValue: { id: 7 },
    } as unknown as ViewEffect

    relaySelectionToParent(effect, noop)

    expect(viewTransport.post).not.toHaveBeenCalled()
  })
})
