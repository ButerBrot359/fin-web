import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import { viewTransport, ViewHttpError } from '../api/view-transport'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { useSduiDispatch } from './dispatch'
import { useConfirmStore } from './stores/confirm-store'
import { showToast } from '@/shared/ui/toast/show-toast'

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

vi.mock('@/shared/ui/toast/show-toast', () => ({
  showToast: vi.fn(),
}))

const openResponse = {
  formSessionId: 'fs-1',
  revision: 1,
  state: {},
} as unknown as ViewResponse

describe('useSduiDispatch: wire-route OPEN-запроса', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.restoreAllMocks()
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
  })

  // Пин WI-F (SCRUM-265): route обязан включать query string — бэк читает
  // ?basisId= из route OPEN-запроса (applyBasisFill). Ключи кэша/вкладок
  // при этом остаются pathname-based (см. sdui-screen / sdui-cache-store).
  it('route содержит query string, когда она есть в URL (?basisId)', async () => {
    router.search = '?basisId=42'
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
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

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
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
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    vi.spyOn(viewTransport, 'post').mockResolvedValue(commandResponse)
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('flush вызван при flushPendingTables: true', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true },
    )
    expect(flushAllPendingTableCommits).toHaveBeenCalledTimes(1)
  })

  it('flush НЕ вызван при flushPendingTables: false', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'reread' },
      { flushPendingTables: false },
    )
    expect(flushAllPendingTableCommits).not.toHaveBeenCalled()
  })

  it('flush вызван при behavior: undefined (безопасный фолбэк ?? true)', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'save' })
    expect(flushAllPendingTableCommits).toHaveBeenCalledTimes(1)
  })

  it('resetsDirty: true → resetDirty вызван, closeAfter — нет', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: false },
    )
    expect(sessionMock.resetDirty).toHaveBeenCalledTimes(1)
    expect(sessionMock.closeAfter).not.toHaveBeenCalled()
  })

  it('closeAfter: true → closeAfter вызван', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'saveAndClose' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: true },
    )
    expect(sessionMock.closeAfter).toHaveBeenCalledTimes(1)
  })

  it('resetsDirty по умолчанию false: без флага dirty не сбрасывается', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'copy' }, {})
    expect(sessionMock.resetDirty).not.toHaveBeenCalled()
  })
})

// Провод эффекта confirm (SCRUM-244 v3 §1.2): по «Да» — COMMAND с confirmCommand
// в ту же сессию, по «Нет» — no-op. confirmCommand передаётся дословно.
describe('useSduiDispatch: эффект confirm (SCRUM-244 v3)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  const confirmResponse = {
    formSessionId: 'fs-1',
    revision: 2,
    patches: [],
    statePatch: {},
    effects: [
      {
        type: 'confirm',
        message: 'Данные будут записаны.',
        confirmCommand: 'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
      },
    ],
  } as unknown as ViewResponse

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('confirm-эффект открывает диалог с message с сервера', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue(confirmResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'nav.open:X' })

    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe('Данные будут записаны.')
    useConfirmStore.getState().answer(false) // очистка стора после теста
  })

  it('по «Да» шлётся COMMAND с confirmCommand дословно в ту же сессию', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValueOnce(confirmResponse)
      .mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'nav.open:X' })

    useConfirmStore.getState().answer(true)
    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2)
    })
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: {
          type: 'COMMAND',
          command: 'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
        },
      }),
    )
  })

  it('по «Нет» — ни одного запроса сверх исходного (no-op)', async () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(confirmResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'nav.open:X' })

    useConfirmStore.getState().answer(false)
    // дать шанс микрозадачам: если бы был провод — post ушёл бы вторым
    await Promise.resolve()
    await Promise.resolve()
    expect(post).toHaveBeenCalledTimes(1)
  })
})

// I-1 (ревью SCRUM-244): 404 на OPEN — штатный гейт раскатки, но тост должен
// подавляться ТОЛЬКО когда хост реально обрабатывает фолбэк (opts.onOpenNotFound
// передан). Без обработчика — прежнее поведение (тост), иначе документы без
// фолбэка на легаси молча остаются на пустом скелетоне.
describe('useSduiDispatch: 404 на OPEN (SCRUM-244 I-1)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    vi.spyOn(viewTransport, 'post').mockRejectedValue(new ViewHttpError('Not Found', 404))
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('с opts.onOpenNotFound: колбэк вызван, showToast НЕ вызван', async () => {
    const onOpenNotFound = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current(
      { type: 'OPEN', layoutCode: 'X.ФормаОбъекта' },
      null,
      false,
      { onOpenNotFound },
    )

    expect(ok).toBe(false)
    expect(onOpenNotFound).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('без opts: showToast вызван (прежнее поведение документов без фолбэка)', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({ type: 'OPEN', layoutCode: 'X.ФормаОбъекта' })

    expect(ok).toBe(false)
    expect(showToast).toHaveBeenCalledTimes(1)
  })
})
