import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode, ViewRequest, ViewResponse } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { useSduiDispatch } from './dispatch'
import { showToast } from '@/shared/ui/toast/show-toast'

const store = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  dirty: false,
  tree: null as unknown,
  formSessionId: 'fs-old' as string | null,
  revision: 7 as number | null,
}))

const sessionMock = vi.hoisted(() => ({
  kind: 'root' as const,
  getSession: () => ({
    formSessionId: store.formSessionId,
    revision: store.revision,
  }),
  getValue: (b: string | undefined) => (b ? store.state[b] : undefined),
  setValue: (b: string, v: unknown) => {
    store.state = { ...store.state, [b]: v }
    store.dirty = true
  },
  setFromServer: (b: string, v: unknown) => {
    store.state = { ...store.state, [b]: v }
  },
  getAll: () => store.state,
  replaceAll: (s: Record<string, unknown>) => {
    store.state = s
    store.dirty = false
  },
  merge: (p: Record<string, unknown>) => {
    store.state = { ...store.state, ...p }
  },
  get isDirty() {
    return store.dirty
  },
  resetDirty: () => {
    store.dirty = false
  },
  setDirty: (v: boolean) => {
    store.dirty = v
  },
  get tree() {
    return store.tree
  },
  getTree: () => store.tree,
  setRoot: (n: unknown) => {
    store.tree = n
  },
  setSession: (id: string, rev: number) => {
    store.formSessionId = id
    store.revision = rev
  },
  bumpRevision: (rev: number) => {
    store.revision = rev
  },
  getLayoutCode: (): string | null => null,
  setLayoutCode: vi.fn(),
  setOnDirtyClose: vi.fn(),
  applyTreePatches: vi.fn(),
  clearAllErrors: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/documents/Bolnichnyy/42', search: '' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}))

vi.mock('./sdui-session-context', () => ({
  useSduiSession: () => sessionMock,
}))

vi.mock('./pending-table-commits', () => ({
  flushAllPendingTableCommits: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/ui/toast/show-toast', () => ({
  showToast: vi.fn(),
}))

const fieldEvent = [{ trigger: 'change', actionId: 'fieldEvent' }]

const tree: ViewNode = {
  id: 'root',
  type: 'VSTACK',
  children: [
    { id: 'f.s', type: 'DATE_FIELD', binding: 'DataS', actions: fieldEvent },
    { id: 'f.po', type: 'DATE_FIELD', binding: 'DataPo', actions: fieldEvent },
    {
      id: 'f.days',
      type: 'NUMBER_FIELD',
      binding: 'KolichestvoDney',
      props: { readonly: true },
      actions: fieldEvent,
    },
    {
      id: 'f.comment',
      type: 'STRING_FIELD',
      binding: 'Kommentariy',
      actions: fieldEvent,
    },
    {
      id: 't.rows',
      type: 'TABLE',
      binding: 'Nachisleniya',
      actions: fieldEvent,
      children: [{ id: 'c.sum', type: 'TABLE_COLUMN', binding: 'Summa' }],
    },
  ],
} as ViewNode

const clientRows = [{ rowId: 'r1', Summa: 100, __rowReadonly: false }]

const clientState = {
  DataS: '2026-10-10',
  DataPo: '2026-10-20',
  KolichestvoDney: 6,
  Kommentariy: 'больничный',
  Nachisleniya: clientRows,
}

const emptyOpenState = {
  DataS: null,
  DataPo: '2026-10-15',
  KolichestvoDney: 0,
  Kommentariy: null,
  Nachisleniya: [],
}

const conflict = () => new ViewConflictError({ code: 'SESSION_NOT_FOUND' })

const openResponse = (formDirty: boolean | null): ViewResponse =>
  ({
    formSessionId: 'fs-new',
    revision: 1,
    tree,
    state: { ...emptyOpenState },
    formDirty,
  }) as unknown as ViewResponse

const eventResponse = (
  revision: number,
  patches: unknown[] = []
): ViewResponse =>
  ({
    formSessionId: 'fs-new',
    revision,
    patches,
    effects: [],
  }) as unknown as ViewResponse

const editDataPo = {
  type: 'EVENT' as const,
  sourceNodeId: 'f.po',
  trigger: 'change',
  value: '2026-10-20',
}

function sent(post: { mock: { calls: unknown[][] } }): ViewRequest[] {
  return post.mock.calls.map((c) => c[0] as ViewRequest)
}

describe('useSduiDispatch: reopen после SESSION_NOT_FOUND не теряет данные клиента', () => {
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(showToast).mockClear()
    store.state = { ...clientState }
    store.dirty = true
    store.tree = tree
    store.formSessionId = 'fs-old'
    store.revision = 7
    const queryClient = new QueryClient()
    wrapper = ({ children }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('F1: OPEN без черновика — значения клиента переданы EVENT-ами в новую сессию и остались на экране', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(false))
      .mockResolvedValueOnce(eventResponse(2))
      .mockResolvedValueOnce(
        eventResponse(3, [
          { op: 'setValue', binding: 'Kommentariy', value: null },
        ])
      )
      .mockResolvedValueOnce(eventResponse(4))
      .mockResolvedValueOnce(
        eventResponse(5, [
          { op: 'setValue', binding: 'KolichestvoDney', value: 11 },
        ])
      )

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    expect(await result.current(editDataPo)).toBe(false)

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(6)
    })
    const requests = sent(post)
    expect(requests[1].action.type).toBe('OPEN')
    const restore = requests.slice(2, 5)
    expect(restore.map((r) => r.action.sourceNodeId)).toEqual([
      'f.s',
      'f.comment',
      't.rows',
    ])
    expect(restore.every((r) => r.formSessionId === 'fs-new')).toBe(true)
    expect(restore.map((r) => r.revision)).toEqual([1, 2, 3])
    expect(restore[0].action.value).toBe('2026-10-10')
    expect(restore[1].action.value).toBe('больничный')
    expect(restore[2].action).toMatchObject({
      fullSnapshot: true,
      value: [{ rowId: 'r1', Summa: 100 }],
    })
    expect(restore[2].action.value).toEqual([{ rowId: 'r1', Summa: 100 }])
    expect(requests[5]).toMatchObject({
      formSessionId: 'fs-new',
      revision: 4,
      action: editDataPo,
    })

    await vi.waitFor(() => {
      expect(store.state.KolichestvoDney).toBe(11)
    })
    expect(store.state).toMatchObject({
      DataS: '2026-10-10',
      DataPo: '2026-10-20',
      Kommentariy: 'больничный',
      Nachisleniya: clientRows,
      KolichestvoDney: 11,
    })
    expect(store.dirty).toBe(true)
    expect(showToast).toHaveBeenCalledWith('info', expect.any(String))
  })

  it('F3: черновик восстановлен (formDirty=true) — повтор EVENT, а на экране новое значение поля, не значение из OPEN', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(true))
      .mockResolvedValueOnce(
        eventResponse(2, [
          { op: 'setValue', binding: 'KolichestvoDney', value: 11 },
        ])
      )

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(editDataPo)

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(3)
    })
    const requests = sent(post)
    expect(requests[2]).toMatchObject({
      formSessionId: 'fs-new',
      action: editDataPo,
    })
    await vi.waitFor(() => {
      expect(store.state.KolichestvoDney).toBe(11)
    })
    expect(store.state.DataPo).toBe('2026-10-20')
    expect(store.state.DataS).toBeNull()
    expect(store.dirty).toBe(true)
  })

  it('F3: правка поля сохраняется на экране и при чистой форме до правки', async () => {
    store.dirty = false
    store.state = { ...emptyOpenState, DataPo: '2026-10-20' }
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(false))
      .mockResolvedValueOnce(eventResponse(2))

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(editDataPo)

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(3)
    })
    expect(sent(post)[2].action).toEqual(editDataPo)
    expect(store.state.DataPo).toBe('2026-10-20')
    expect(store.dirty).toBe(true)
  })

  it('сбой восстановления: значения клиента не затёрты, dirty сохранён, предупреждение, исходное действие не повторяется', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(false))
      .mockResolvedValueOnce(eventResponse(2))
      .mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(editDataPo)

    await vi.waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('warning', expect.any(String))
    })
    await vi.waitFor(() => {
      expect(
        vi.mocked(showToast).mock.calls.filter(([level]) => level === 'warning')
      ).toHaveLength(2)
    })
    expect(post).toHaveBeenCalledTimes(4)
    expect(store.state).toMatchObject({
      DataS: '2026-10-10',
      DataPo: '2026-10-20',
      Kommentariy: 'больничный',
      Nachisleniya: clientRows,
    })
    expect(store.dirty).toBe(true)
  })

  it('чистая форма и непишущая команда: восстановления нет, состояние — из OPEN', async () => {
    store.dirty = false
    store.state = { ...emptyOpenState }
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(false))
      .mockResolvedValueOnce(eventResponse(2))

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'refresh' }, null)

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(3)
    })
    expect(sent(post)[2].action).toEqual({
      type: 'COMMAND',
      command: 'refresh',
    })
    expect(store.state).toEqual(emptyOpenState)
    expect(store.dirty).toBe(false)
  })

  it('пишущая команда: данные восстановлены в сессию, но запись не повторяется автоматически', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(openResponse(false))
      .mockResolvedValue(eventResponse(2))

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { resetsDirty: true, flushPendingTables: false }
    )

    await vi.waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('info', expect.any(String))
    })
    const requests = sent(post)
    expect(requests).toHaveLength(6)
    expect(requests.slice(2).map((r) => r.action.sourceNodeId)).toEqual([
      'f.s',
      'f.po',
      'f.comment',
      't.rows',
    ])
    expect(requests.some((r, i) => i > 0 && r.action.command === 'save')).toBe(
      false
    )
    expect(store.state.DataPo).toBe('2026-10-20')
    expect(store.dirty).toBe(true)
  })
})
