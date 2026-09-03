import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import {
  viewTransport,
  ViewHttpError,
  ViewConflictError,
} from '../api/view-transport'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { useSduiDispatch } from './dispatch'
import { useConfirmStore } from './stores/confirm-store'
import { useCommandInflightStore } from './stores/command-inflight-store'
import { useAsyncTaskStore } from '@/entities/async-task'
import { showToast } from '@/shared/ui/toast/show-toast'
import { apiService } from '@/shared/api/api'

// Мутабельная локация: тесты подменяют search между рендерами
const router = vi.hoisted(() => ({
  pathname: '/documents/SchetKOplate/new',
  search: '',
}))

// Мутабельная сессия: тесты читают spies (resetDirty/closeAfter) после dispatch
const sessionMock = vi.hoisted(() => ({
  getSession: () => ({
    formSessionId: null as string | null,
    revision: null as number | null,
  }),
  replaceAll: vi.fn(),
  merge: vi.fn(),
  setSession: vi.fn(),
  setRoot: vi.fn(),
  bumpRevision: vi.fn(),
  applyTreePatches: vi.fn(),
  clearAllErrors: vi.fn(),
  setFromServer: vi.fn(),
  resetDirty: vi.fn(),
  // SCRUM-288 T11 (заранее, безвредно сейчас): понадобится будущему тесту.
  setDirty: vi.fn(),
  closeAfter: vi.fn(),
  setOnDirtyClose: vi.fn(),
  getLayoutCode: (): string | null => null,
  setLayoutCode: vi.fn(),
}))

// Spy на setSearchParams — читается тестом replaceUrl (SCRUM-291 §7)
const setSearchParamsMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: router.pathname, search: router.search }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [
    new URLSearchParams(router.search),
    setSearchParamsMock,
  ],
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

vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    getFileBlob: vi.fn(),
    postFileBlob: vi.fn(),
  },
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
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  // Пин WI-F (SCRUM-265): route обязан включать query string — бэк читает
  // ?basisId= из route OPEN-запроса (applyBasisFill). Ключи кэша/вкладок
  // при этом остаются pathname-based (см. sdui-screen / sdui-cache-store).
  it('route содержит query string, когда она есть в URL (?basisId)', async () => {
    router.search = '?basisId=42'
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({
      type: 'OPEN',
      layoutCode: 'X.Layout',
    })

    expect(ok).toBe(true)
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/documents/SchetKOplate/new?basisId=42',
      })
    )
  })

  it('route без query string — чистый pathname', async () => {
    router.search = ''
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN', layoutCode: 'X.Layout' })

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/documents/SchetKOplate/new' })
    )
  })

  /**
   * Требование владельца: форма создания пустая ВСЕГДА, а возврат на свою вкладку возвращает
   * введённое. На проводе оба запроса — OPEN одного маршрута, различает их только идентификатор
   * экземпляра формы, поэтому он обязан быть на КАЖДОМ OPEN (бэк читает его только там).
   */
  it('OPEN несёт formInstanceId вкладки', async () => {
    router.search = ''
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' })

    const action = post.mock.calls[0][0].action as { formInstanceId?: string }
    expect(action.formInstanceId).toBeTruthy()
  })

  it('EVENT/COMMAND идентификатор экземпляра не несут — сервер читает его только на OPEN', async () => {
    router.search = ''
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'save' })

    const action = post.mock.calls[0][0].action as { formInstanceId?: string }
    expect(action.formInstanceId).toBeUndefined()
  })

  it('OPEN без layoutCode: ключ layoutCode отсутствует в запросе', async () => {
    router.search = ''
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' })

    const arg = post.mock.calls[0][0]
    expect('layoutCode' in arg).toBe(false)
    expect(arg).toEqual(
      expect.objectContaining({ route: '/documents/SchetKOplate/new' })
    )
  })

  it('OPEN c layoutCode: ключ передаётся как есть', async () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN', layoutCode: 'X.Layout' })

    expect(post.mock.calls[0][0]).toEqual(
      expect.objectContaining({ layoutCode: 'X.Layout' })
    )
  })

  it('OPEN прокидывает res.tab в onOpenTab', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...openResponse,
      tab: { kind: 'MODULE' },
    } as never)
    const onOpenTab = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' }, null, false, { onOpenTab })
    expect(onOpenTab).toHaveBeenCalledWith({ kind: 'MODULE' })
  })

  it('reopen после SESSION_NOT_FOUND без layoutCode шлёт route-only OPEN', async () => {
    sessionMock.getLayoutCode = () => null
    sessionMock.setLayoutCode = vi.fn()
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockRejectedValueOnce(
        new ViewConflictError({ code: 'SESSION_NOT_FOUND' })
      )
      .mockResolvedValue(openResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', sourceNodeId: 'n', trigger: 'blur' })

    const reopenArg = post.mock.calls.at(-1)?.[0]
    expect('layoutCode' in (reopenArg ?? {})).toBe(false)
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
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('flush вызван при flushPendingTables: true', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true }
    )
    expect(flushAllPendingTableCommits).toHaveBeenCalledTimes(1)
  })

  it('flush НЕ вызван при flushPendingTables: false', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'reread' },
      { flushPendingTables: false }
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
      { flushPendingTables: true, resetsDirty: true, closeAfter: false }
    )
    expect(sessionMock.resetDirty).toHaveBeenCalledTimes(1)
    expect(sessionMock.closeAfter).not.toHaveBeenCalled()
  })

  it('commandFailed: true → false, resetDirty/closeAfter НЕ вызваны (SCRUM-277 §3.1)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...commandResponse,
      commandFailed: true,
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: true }
    )
    expect(ok).toBe(false)
    expect(sessionMock.resetDirty).not.toHaveBeenCalled()
    expect(sessionMock.closeAfter).not.toHaveBeenCalled()
  })

  // SCRUM-276 v7: отклонённая matrix-команда (stale generation) — EVENT с
  // commandFailed: true. Патчи (refresh-payload) применяются, но результат
  // false, чтобы ячейка/очередь увидели отказ и откатили локальный буфер.
  it('EVENT + commandFailed: true → false, патчи применены', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...commandResponse,
      patches: [
        { op: 'setValue', binding: 'tabel.matrix', value: { generation: 4 } },
      ],
      commandFailed: true,
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({
      type: 'EVENT',
      sourceNodeId: 'table.uchetRabochegoVremeni.matrix',
      trigger: 'change',
    })
    expect(ok).toBe(false)
    expect(sessionMock.setFromServer).toHaveBeenCalledWith('tabel.matrix', {
      generation: 4,
    })
  })

  it('closeAfter: true, без navigate-эффекта → closeAfter(false) (SCRUM-283 v2)', async () => {
    // commandResponse.effects = [] → сервер не навигировал → хост сядет на соседнюю
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: true }
    )
    expect(sessionMock.closeAfter).toHaveBeenCalledTimes(1)
    expect(sessionMock.closeAfter).toHaveBeenCalledWith(false)
  })

  it('closeAfter: true + navigate-эффект → closeAfter(true), хост не навигирует (postAndClose)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      formSessionId: 'fs-1',
      revision: 2,
      patches: [],
      statePatch: {},
      effects: [{ type: 'navigate', route: '/documents/SchetKOplate' }],
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current(
      { type: 'COMMAND', command: 'postAndClose' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: true }
    )
    expect(sessionMock.closeAfter).toHaveBeenCalledWith(true)
  })

  it('resetsDirty по умолчанию false: без флага dirty не сбрасывается', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'copy' }, {})
    expect(sessionMock.resetDirty).not.toHaveBeenCalled()
  })
})

// Провод эффекта replaceUrl (SCRUM-291 §7 персист): dispatch инъектирует
// replaceUrl-мост в effect-handler → должен дойти до setSearchParams(search,
// {replace:true}) с ТОЛЬКО query-частью route (без pathname).
describe('useSduiDispatch: эффект replaceUrl (SCRUM-291 §7)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('вызывает setSearchParams только с query-частью route, с replace:true', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      formSessionId: 'fs-1',
      revision: 2,
      patches: [],
      statePatch: {},
      effects: [
        {
          type: 'replaceUrl',
          route: '/modules/gp/document/ZayavkaGP?ls=f1.eyJz',
        },
      ],
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'list.applySort' })
    expect(setSearchParamsMock).toHaveBeenCalledWith('ls=f1.eyJz', {
      replace: true,
    })
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
        confirmCommand:
          'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
      },
    ],
  } as unknown as ViewResponse

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
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
          command:
            'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
        },
      })
    )
  })

  it('по «Нет» — ни одного запроса сверх исходного (no-op)', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValue(confirmResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'nav.open:X' })

    useConfirmStore.getState().answer(false)
    // дать шанс микрозадачам: если бы был провод — post ушёл бы вторым
    await Promise.resolve()
    await Promise.resolve()
    expect(post).toHaveBeenCalledTimes(1)
  })

  // SCRUM-276: правка «Номера» — сервер даёт cancelCommand (field.rollback:Nomer),
  // и «Нет» обязан его отправить, иначе отменённое значение остаётся в сессии.
  it('по «Нет» с cancelCommand шлётся COMMAND с cancelCommand дословно', async () => {
    const cancelResponse = {
      ...confirmResponse,
      effects: [
        {
          type: 'confirm',
          message:
            'Номер будет заполнен автоматически при записи. Продолжить редактирование?',
          confirmCommand: 'field.confirm:Nomer',
          cancelCommand: 'field.rollback:Nomer',
        },
      ],
    } as unknown as ViewResponse
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValueOnce(cancelResponse)
      .mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'nav.open:X' })

    useConfirmStore.getState().answer(false)
    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2)
    })
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: { type: 'COMMAND', command: 'field.rollback:Nomer' },
      })
    )
  })
})

// Confirm-мост (SCRUM-288 §2.3/§2.4): confirmRequest исполняется мимо сессии
// (executeActionRequest → apiService), confirmCommand — COMMAND в сессию, и
// ТЕПЕРЬ с confirmBehavior вторым аргументом (§2.4 — раньше терялось).
describe('useSduiDispatch: confirm-мост (SCRUM-288 §2.3/§2.4)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('confirmCommand: по «Да» диспатчит COMMAND с confirmBehavior', async () => {
    const mockPost = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValueOnce({
        formSessionId: 's',
        revision: 2,
        effects: [
          {
            type: 'confirm',
            message: 'm',
            confirmCommand: 'setDeletionMark:confirmed',
            confirmBehavior: { resetsDirty: true },
          },
        ],
      } as unknown as ViewResponse)
      .mockResolvedValueOnce({
        formSessionId: 's',
        revision: 3,
      } as unknown as ViewResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const p = result.current({ type: 'COMMAND', command: 'setDeletionMark' })
    // Дождаться, пока confirm-эффект реально откроет диалог (цепочка await'ов
    // внутри dispatchAction длиннее одного тика микрозадач).
    await vi.waitFor(() => {
      expect(useConfirmStore.getState().open).toBe(true)
    })
    useConfirmStore.getState().answer(true)
    await p
    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2)
    })
    expect(sessionMock.resetDirty).toHaveBeenCalled()
  })

  it('confirmRequest: по «Да» исполняет запрос, НЕ диспатчит COMMAND в сессию', async () => {
    const mockPost = vi.spyOn(viewTransport, 'post').mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
      effects: [
        {
          type: 'confirm',
          message: 'm',
          confirmRequest: {
            method: 'POST',
            url: '/api/view/related-documents/toggle-deletion-mark?rootId=1&anchorId=2&selectedRowId=7&confirmed=true',
          },
        },
      ],
    } as unknown as ViewResponse)
    vi.mocked(apiService.post).mockResolvedValue({ data: {} } as never)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const p = result.current({ type: 'COMMAND', command: 'noop' })
    await vi.waitFor(() => {
      expect(useConfirmStore.getState().open).toBe(true)
    })
    useConfirmStore.getState().answer(true)
    await p
    await vi.waitFor(() => {
      expect(apiService.post).toHaveBeenCalledTimes(1)
    })
    // ровно один вызов viewTransport.post (исходный COMMAND); подтверждение
    // ушло мимо сессии — через apiService.post исполнителя
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})

describe('useSduiDispatch: res.dirty авторитетно (SCRUM-288 §2.5)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('res.dirty=false перекрывает клиентский флаг', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
      dirty: false,
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', command: 'x' })
    expect(sessionMock.setDirty).toHaveBeenCalledWith(false)
  })

  it('res.dirty отсутствует — setDirty не зовём (клиентский флаг как есть)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
    } as unknown as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', command: 'x' })
    expect(sessionMock.setDirty).not.toHaveBeenCalled()
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
    vi.spyOn(viewTransport, 'post').mockRejectedValue(
      new ViewHttpError('Not Found', 404)
    )
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('с opts.onOpenNotFound: колбэк вызван, showToast НЕ вызван', async () => {
    const onOpenNotFound = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current(
      { type: 'OPEN', layoutCode: 'X.Layout' },
      null,
      false,
      { onOpenNotFound }
    )

    expect(ok).toBe(false)
    expect(onOpenNotFound).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('без opts: showToast вызван (прежнее поведение документов без фолбэка)', async () => {
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({
      type: 'OPEN',
      layoutCode: 'X.Layout',
    })

    expect(ok).toBe(false)
    expect(showToast).toHaveBeenCalledTimes(1)
  })
})

// Гейт ошибок OPEN на 3 ветки (SCRUM-290 §2 бэк-спеки): ROUTE_UNKNOWN →
// onRouteUnknown; SCREEN_NOT_SDUI → onOpenNotFound({kind}); унаследованный
// 404 NOT_FOUND → onOpenNotFound() без kind. Без подходящего колбэка — тост.
describe('useSduiDispatch: гейт ошибок OPEN на 3 ветки (SCRUM-290)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('OPEN 422 SCREEN_NOT_SDUI → onOpenNotFound({kind}), без тоста', async () => {
    vi.spyOn(viewTransport, 'post').mockRejectedValue(
      new ViewHttpError('nope', 422, 'SCREEN_NOT_SDUI', 'DOCUMENT_LIST')
    )
    const onOpenNotFound = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({ type: 'OPEN' }, null, false, {
      onOpenNotFound,
    })

    expect(ok).toBe(false)
    expect(onOpenNotFound).toHaveBeenCalledWith({ kind: 'DOCUMENT_LIST' })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('OPEN 404 ROUTE_UNKNOWN → onRouteUnknown, без тоста', async () => {
    vi.spyOn(viewTransport, 'post').mockRejectedValue(
      new ViewHttpError('nope', 404, 'ROUTE_UNKNOWN')
    )
    const onRouteUnknown = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const ok = await result.current({ type: 'OPEN' }, null, false, {
      onRouteUnknown,
    })

    expect(ok).toBe(false)
    expect(onRouteUnknown).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('OPEN 404 NOT_FOUND → onOpenNotFound() без kind (унаследованный тракт)', async () => {
    vi.spyOn(viewTransport, 'post').mockRejectedValue(
      new ViewHttpError('nope', 404, 'NOT_FOUND')
    )
    const onOpenNotFound = vi.fn()
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' }, null, false, { onOpenNotFound })

    expect(onOpenNotFound).toHaveBeenCalledWith(undefined)
  })
})

// SCRUM-330 Работа 1: in-flight-гард от двойного клика — повторный COMMAND
// той же сессии дропается, пока первый не отвечен; EVENT не гардится.
describe('useSduiDispatch: in-flight-гард COMMAND (SCRUM-330)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode
  const originalGetSession = sessionMock.getSession

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    sessionStorage.clear()
    useCommandInflightStore.setState({ sessions: {} })
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  afterEach(() => {
    sessionMock.getSession = originalGetSession
  })

  it('второй COMMAND во время полёта первого дропается, после ответа гард снят', async () => {
    sessionMock.getSession = () => ({ formSessionId: 'fs-guard', revision: 1 })
    let resolvePost: ((v: ViewResponse) => void) | undefined
    const post = vi.spyOn(viewTransport, 'post').mockImplementation(
      () =>
        new Promise<ViewResponse>((res) => {
          resolvePost = res
        })
    )

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const first = result.current({ type: 'COMMAND', command: 'save' })
    const second = await result.current({ type: 'COMMAND', command: 'save' })

    expect(second).toBe(false)
    expect(post).toHaveBeenCalledTimes(1)

    resolvePost?.(commandResponse)
    await expect(first).resolves.toBe(true)

    post.mockResolvedValue(commandResponse)
    const third = await result.current({ type: 'COMMAND', command: 'save' })
    expect(third).toBe(true)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('EVENT не гардится: уходит, пока COMMAND в полёте', async () => {
    sessionMock.getSession = () => ({ formSessionId: 'fs-guard2', revision: 1 })
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockImplementation(() => new Promise<ViewResponse>(() => undefined))

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    void result.current({ type: 'COMMAND', command: 'save' })
    void result.current({ type: 'EVENT', sourceNodeId: 'n1', trigger: 'blur' })

    // COMMAND доходит до post после await flush — ждём микротаски
    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2)
    })
  })
})

// SCRUM-330 Работа 2: formSessionId переживает F5 в sessionStorage
describe('useSduiDispatch: formSessionId в sessionStorage (SCRUM-330)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    sessionStorage.clear()
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('OPEN сохраняет formSessionId по роуту и шлёт его на повторном OPEN', async () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })

    await result.current({ type: 'OPEN' })
    expect(
      sessionStorage.getItem('sdui-form-session:/documents/SchetKOplate/new')
    ).toBe('fs-1')

    await result.current({ type: 'OPEN' })
    expect(post.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ formSessionId: 'fs-1' })
    )
  })

  it('CLOSE чистит сохранённый formSessionId роута', async () => {
    sessionStorage.setItem(
      'sdui-form-session:/documents/SchetKOplate/new',
      'fs-old'
    )
    vi.spyOn(viewTransport, 'post').mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })

    await result.current({ type: 'CLOSE' })
    expect(
      sessionStorage.getItem('sdui-form-session:/documents/SchetKOplate/new')
    ).toBeNull()
  })
})

// SCRUM-330 §3.3: эффект taskStarted регистрирует задачу с сессией-источником
describe('useSduiDispatch: эффект taskStarted (SCRUM-330)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode
  const originalGetSession = sessionMock.getSession

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    sessionStorage.clear()
    useAsyncTaskStore.setState({ entries: {} })
    useCommandInflightStore.setState({ sessions: {} })
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  afterEach(() => {
    sessionMock.getSession = originalGetSession
  })

  it('кладёт задачу из эффекта в стор с formSessionId сессии', async () => {
    sessionMock.getSession = () => ({ formSessionId: 'fs-task', revision: 1 })
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...commandResponse,
      effects: [
        {
          type: 'taskStarted',
          task: {
            id: 't1',
            kind: 'DOCUMENT_POST',
            title: 'Проведение',
            status: 'QUEUED',
          },
        },
      ],
    } as never)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'post' })

    const entry = useAsyncTaskStore.getState().entries.t1
    expect(entry.formSessionId).toBe('fs-task')
    expect(entry.task.status).toBe('QUEUED')
  })
})

// SCRUM-276 (черновики форм): серверный formDirty латчит клиентский dirty
// (true поднимает, false НЕ сбрасывает), CLOSE передаёт discardDraft как есть.
describe('useSduiDispatch: formDirty и CLOSE discardDraft (SCRUM-276)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('OPEN с formDirty=true → setDirty(true) (черновик подмешан)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...openResponse,
      formDirty: true,
    } as never)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' })
    expect(sessionMock.setDirty).toHaveBeenCalledWith(true)
  })

  it('COMMAND с formDirty=true → setDirty(true)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...commandResponse,
      formDirty: true,
    } as never)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'COMMAND', command: 'fill' })
    expect(sessionMock.setDirty).toHaveBeenCalledWith(true)
  })

  it('formDirty=false клиентский dirty НЕ сбрасывает (условие «ИЛИ»)', async () => {
    vi.spyOn(viewTransport, 'post').mockResolvedValue({
      ...commandResponse,
      formDirty: false,
    } as never)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', sourceNodeId: 'n', trigger: 'blur' })
    expect(sessionMock.setDirty).not.toHaveBeenCalled()
  })

  it('CLOSE с discardDraft=true уходит в transport дословно', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'CLOSE', discardDraft: true })
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ type: 'CLOSE', discardDraft: true }),
      })
    )
  })

  it('CLOSE без интента — без ключа discardDraft', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'CLOSE' })
    const action = (post.mock.calls[0][0] as { action: object }).action
    expect('discardDraft' in action).toBe(false)
  })
})

// SCRUM-312: стабильный id вкладки на OPEN — ключ серверного черновика формы.
describe('useSduiDispatch: formInstanceId на OPEN (SCRUM-312)', () => {
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactNode

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    router.search = ''
    queryClient = new QueryClient()
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      )
  })

  it('OPEN несёт formInstanceId; повторный OPEN того же маршрута — тот же id', async () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'OPEN' })
    await result.current({ type: 'OPEN' })

    const first = (post.mock.calls[0][0].action as { formInstanceId?: string })
      .formInstanceId
    const second = (post.mock.calls[1][0].action as { formInstanceId?: string })
      .formInstanceId
    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it('EVENT и CLOSE идут без formInstanceId', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValue(commandResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', sourceNodeId: 'n', trigger: 'blur' })
    await result.current({ type: 'CLOSE' })
    for (const call of post.mock.calls) {
      expect('formInstanceId' in (call[0].action as object)).toBe(false)
    }
  })
})
