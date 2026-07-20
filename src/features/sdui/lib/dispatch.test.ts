import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import { viewTransport } from '../api/view-transport'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { useSduiDispatch } from './dispatch'

// Мутабельная локация: тесты подменяют search между рендерами
const router = vi.hoisted(() => ({
  pathname: '/documents/SchetKOplate/new',
  search: '',
}))

// Мутабельная сессия: тесты читают spies (resetDirty/closeAfter) после dispatch
const sessionMock = vi.hoisted(() => ({
  getSession: () => ({ formSessionId: null as string | null, revision: null as number | null }),
  replaceAll: vi.fn(),
  merge: vi.fn(),
  setSession: vi.fn(),
  setRoot: vi.fn(),
  bumpRevision: vi.fn(),
  applyTreePatches: vi.fn(),
  clearAllErrors: vi.fn(),
  setFromServer: vi.fn(),
  resetDirty: vi.fn(),
  closeAfter: vi.fn(),
  setOnDirtyClose: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: router.pathname, search: router.search }),
  useNavigate: () => vi.fn(),
}))

vi.mock('./sdui-session-context', () => ({
  useSduiSession: () => sessionMock,
}))

vi.mock('./pending-table-commits', () => ({
  flushAllPendingTableCommits: vi.fn().mockResolvedValue(undefined),
}))

const openResponse = {
  formSessionId: 'fs-1',
  revision: 1,
  state: {},
} as unknown as ViewResponse

describe('useSduiDispatch: wire-route OPEN-запроса', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Пин WI-F (SCRUM-265): route обязан включать query string — бэк читает
  // ?basisId= из route OPEN-запроса (applyBasisFill). Ключи кэша/вкладок
  // при этом остаются pathname-based (см. sdui-screen / sdui-cache-store).
  it('route содержит query string, когда она есть в URL (?basisId)', async () => {
    router.search = '?basisId=42'
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch())
    const ok = await result.current({ type: 'OPEN', layoutCode: 'X.ФормаОбъекта' })

    expect(ok).toBe(true)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/documents/SchetKOplate/new?basisId=42',
      }),
    )
  })

  it('route без query string — чистый pathname', async () => {
    router.search = ''
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch())
    await result.current({ type: 'OPEN', layoutCode: 'X.ФормаОбъекта' })

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/documents/SchetKOplate/new' }),
    )
  })
})

const commandResponse = {
  formSessionId: 'fs-1',
  revision: 2,
  patches: [],
  effects: [],
  statePatch: {},
} as unknown as ViewResponse

// Контракт действий (SCRUM-283 §4.2, критерий приёмки №6): поведение команды
// приходит с бэка, фронт не смотрит на имя. Флаг flush фолбэчит в true (защита
// данных), resetsDirty/closeAfter — в false.
describe('useSduiDispatch: поведение по behavior (SCRUM-283)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    vi.spyOn(viewTransport, 'post').mockResolvedValue(commandResponse)
  })

  it('flush вызван при flushPendingTables: true', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true },
    )
    expect(flushAllPendingTableCommits).toHaveBeenCalledTimes(1)
  })

  it('flush НЕ вызван при flushPendingTables: false', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current(
      { type: 'COMMAND', command: 'reread' },
      { flushPendingTables: false },
    )
    expect(flushAllPendingTableCommits).not.toHaveBeenCalled()
  })

  it('flush вызван при behavior: undefined (безопасный фолбэк ?? true)', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current({ type: 'COMMAND', command: 'save' })
    expect(flushAllPendingTableCommits).toHaveBeenCalledTimes(1)
  })

  it('resetsDirty: true → resetDirty вызван, closeAfter — нет', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: false },
    )
    expect(sessionMock.resetDirty).toHaveBeenCalledTimes(1)
    expect(sessionMock.closeAfter).not.toHaveBeenCalled()
  })

  it('closeAfter: true → closeAfter вызван', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current(
      { type: 'COMMAND', command: 'saveAndClose' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: true },
    )
    expect(sessionMock.closeAfter).toHaveBeenCalledTimes(1)
  })

  it('resetsDirty по умолчанию false: без флага dirty не сбрасывается', async () => {
    const { result } = renderHook(() => useSduiDispatch())
    await result.current({ type: 'COMMAND', command: 'copy' }, {})
    expect(sessionMock.resetDirty).not.toHaveBeenCalled()
  })
})
