import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { relaySelectionToParent } from './relay-selection'
import { viewTransport } from '../api/view-transport'
import {
  registerPanelPatchSink,
  unregisterPanelPatchSink,
} from './panel-patch-registry'
import { applyValuePatches } from './patch-applier'
import type { ViewEffect } from '../types/view'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn() },
  ViewConflictError: class extends Error {},
}))
// Родитель-панель подставляется отдельно в своём describe.
const parentPanel: { value: { panelId: string } | undefined } = {
  value: undefined,
}
const updateSession = vi.fn()
vi.mock('./stores/panel-store', () => ({
  usePanelStore: {
    getState: () => ({
      findBySessionId: () => parentPanel.value,
      updateSession,
    }),
  },
}))
vi.mock('./stores/tree-store', () => ({
  useTreeStore: {
    getState: () => ({
      revision: 1,
      bumpRevision: vi.fn(),
      clearAllErrors: vi.fn(),
      applyPatches: vi.fn(),
    }),
  },
}))
vi.mock('./stores/view-state-store', () => ({
  useViewStateStore: {
    getState: () => ({ setFromServer: vi.fn(), merge: vi.fn() }),
  },
}))
vi.mock('./patch-applier', () => ({ applyValuePatches: vi.fn() }))
vi.mock('./validation', () => ({ validatePatches: (p: unknown) => p ?? [] }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const noop = vi.fn()

describe('relaySelectionToParent (SCRUM-284 Δ3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('шлёт applyToParentCommand дословно + value', () => {
    vi.mocked(viewTransport.post).mockResolvedValue({
      revision: 2,
      patches: [],
      effects: [],
    } as never)
    const effect = {
      type: 'closeDialog',
      applyToParentSessionId: 's1',
      applyToParentCommand: 'OPAQUE_CMD',
      applyToParentValue: { id: 7 },
    } as unknown as ViewEffect

    relaySelectionToParent(effect, noop)

    expect(viewTransport.post).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          command: 'OPAQUE_CMD',
          value: { id: 7 },
        }),
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

// Вложенный сценарий: панель выбора открыта ПОВЕРХ окна строки, и патчи ответа
// адресованы узлам окна-родителя. Раньше здесь обновлялась только ревизия —
// выбранное значение до поля родителя не доезжало.
describe('relaySelectionToParent — родитель-панель', () => {
  const PANEL_ID = 'tarifikatsiya.rowForm'
  const effect = {
    type: 'closeDialog',
    applyToParentSessionId: 's1',
    applyToParentCommand: 'OPAQUE_CMD',
    applyToParentValue: { id: 7 },
  } as unknown as ViewEffect

  const response = {
    revision: 5,
    patches: [
      {
        op: 'setValue',
        binding: 'KategoriyaSotrudnika',
        value: { id: 7, presentation: 'Педагог' },
      },
    ],
    statePatch: { Razmer: 100 },
    effects: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    parentPanel.value = { panelId: PANEL_ID }
    vi.mocked(viewTransport.post).mockResolvedValue(response as never)
  })

  afterEach(() => {
    parentPanel.value = undefined
    unregisterPanelPatchSink(PANEL_ID)
  })

  it('патчи ответа применяются к родительской панели', async () => {
    const sink = {
      applyTreePatches: vi.fn(),
      setFromServer: vi.fn(),
      merge: vi.fn(),
      clearAllErrors: vi.fn(),
    }
    registerPanelPatchSink(PANEL_ID, sink)

    relaySelectionToParent(effect, noop)
    await vi.waitFor(() => {
      expect(sink.applyTreePatches).toHaveBeenCalled()
    })

    expect(updateSession).toHaveBeenCalledWith(PANEL_ID, 5)
    expect(sink.clearAllErrors).toHaveBeenCalled()
    expect(sink.applyTreePatches).toHaveBeenCalledWith(response.patches)
    expect(applyValuePatches).toHaveBeenCalledWith(
      response.patches,
      sink.setFromServer
    )
    expect(sink.merge).toHaveBeenCalledWith({ Razmer: 100 })
  })

  it('панель успели закрыть — ревизия обновляется, падения нет', async () => {
    relaySelectionToParent(effect, noop)
    await vi.waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(PANEL_ID, 5)
    })
    expect(applyValuePatches).not.toHaveBeenCalled()
  })
})
