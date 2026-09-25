import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useEffect } from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewRequest, ViewResponse } from '@/features/sdui/types/view'
import { useTreeStore, useViewStateStore } from '@/features/sdui'
import { useSduiCacheStore } from '@/features/sdui/lib/stores/sdui-cache-store'
import {
  markFreshFormInstance,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import { SduiCatchAllPage } from '@/pages/sdui-catch-all'
import { WorkspaceTabSync } from '@/widgets/workspace-tab-bar'

import { useWorkspaceTabGatewayBinding } from './providers/workspace-tab-binding'

interface FakeSession {
  alive: boolean
  revision: number
  scratch: Record<string, unknown>
}

const { server } = vi.hoisted(() => ({
  server: {
    calls: [] as ViewRequest[],
    seq: 0,
    networkDown: false,
    sessions: new Map<string, FakeSession>(),
    saved: [] as Record<string, unknown>[],
  },
}))

const BINDINGS: Record<string, string> = {
  'field.kommentariy': 'Kommentariy',
  'field.osnovanie': 'Osnovanie',
}

vi.mock('@/features/sdui/api/view-transport', () => {
  class ViewConflictError extends Error {
    constructor(public data: { code: string; formSessionId?: string }) {
      super(data.code)
    }
  }
  class ViewHttpError extends Error {
    constructor(
      message: string,
      public status: number | undefined
    ) {
      super(message)
    }
  }
  const field = (id: string, label: string) => ({
    id,
    type: 'TEXT_FIELD',
    binding: BINDINGS[id],
    props: { label, visible: true, enabled: true },
    actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
  })
  return {
    ViewConflictError,
    ViewHttpError,
    viewTransport: {
      post: (req: ViewRequest): Promise<ViewResponse> => {
        server.calls.push(req)
        if (server.networkDown) {
          return Promise.reject(new ViewHttpError('Network Error', undefined))
        }
        const action = req.action
        if (action.type === 'OPEN') {
          server.seq += 1
          const id = `S${String(server.seq)}`
          server.sessions.set(id, { alive: true, revision: 1, scratch: {} })
          const isDoc = (req.route ?? '').includes('/documents/')
          return Promise.resolve({
            formSessionId: id,
            revision: 1,
            tree: {
              id: 'root',
              type: 'PAGE',
              props: { title: isDoc ? 'РКО (создание)' : 'Контрагенты' },
              children: isDoc
                ? [
                    field('field.kommentariy', 'Комментарий'),
                    field('field.osnovanie', 'Основание'),
                    {
                      id: 'btn.save',
                      type: 'BUTTON',
                      props: {
                        label: 'Записать',
                        command: 'save',
                        enabled: true,
                        visible: true,
                      },
                    },
                  ]
                : [],
            },
            state: {},
            tab: { kind: isDoc ? 'DOCUMENT_NEW' : 'DICTIONARY' },
          } as ViewResponse)
        }
        const id = req.formSessionId ?? ''
        const session = server.sessions.get(id)
        if (!session?.alive) {
          if (action.type === 'CLOSE')
            return Promise.resolve({ formSessionId: id, revision: 0 })
          return Promise.reject(
            new ViewConflictError({
              code: 'SESSION_NOT_FOUND',
              formSessionId: id,
            })
          )
        }
        session.revision += 1
        if (action.type === 'EVENT') {
          const a = action as unknown as {
            sourceNodeId: string
            value: unknown
          }
          session.scratch[BINDINGS[a.sourceNodeId]] = a.value
        }
        if (
          action.type === 'COMMAND' &&
          (action as { command?: string }).command === 'save'
        ) {
          server.saved.push({ ...session.scratch })
          session.scratch = {}
        }
        if (action.type === 'CLOSE') session.alive = false
        return Promise.resolve({
          formSessionId: id,
          revision: session.revision,
          dirty: Object.keys(session.scratch).length > 0,
        } as ViewResponse)
      },
      heartbeat: () => Promise.resolve(true),
      closeBeacon: () => undefined,
    },
  }
})

vi.mock('@/widgets/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => (
    <div data-testid="page-header">{title}</div>
  ),
}))

const router: { navigate: NavigateFunction | null } = { navigate: null }
const NavProbe = () => {
  const navigate = useNavigate()
  useEffect(() => {
    router.navigate = navigate
  }, [navigate])
  return null
}

const go = (route: string) => {
  act(() => {
    void router.navigate?.(route)
  })
}

const Binding = () => {
  useWorkspaceTabGatewayBinding()
  return null
}

const Keyed = () => {
  const location = useLocation()
  return (
    <Routes>
      <Route path="*" element={<SduiCatchAllPage key={location.pathname} />} />
    </Routes>
  )
}

const DOC = '/documents/RKO/new'
const DICT = '/dictionaries/Kontragenty'

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[DOC]}>
        <Binding />
        <NavProbe />
        <WorkspaceTabSync />
        <Keyed />
      </MemoryRouter>
    </QueryClientProvider>
  )

const input = (label: string) => screen.findByLabelText<HTMLInputElement>(label)

const typeInto = async (label: string, value: string) => {
  const el = await input(label)
  fireEvent.focus(el)
  fireEvent.change(el, { target: { value } })
  fireEvent.blur(el)
}

const opensOf = (route: string) =>
  server.calls.filter((c) => c.action.type === 'OPEN' && c.route === route)
    .length

const typeAndLeave = async () => {
  renderApp()
  await typeInto('Комментарий', 'Оплата поставщику')
  await waitFor(() => {
    expect(server.sessions.get('S1')?.scratch.Kommentariy).toBe(
      'Оплата поставщику'
    )
  })
  go(DICT)
  await screen.findByText('Контрагенты')
}

const eventsFor = (nodeId: string) =>
  server.calls.filter(
    (c) =>
      c.action.type === 'EVENT' &&
      (c.action as { sourceNodeId?: string }).sourceNodeId === nodeId
  )

describe('сценарии потери незаписанных данных формы', () => {
  beforeEach(() => {
    server.calls = []
    server.seq = 0
    server.networkDown = false
    server.sessions.clear()
    server.saved = []
  })

  afterEach(() => {
    cleanup()
    useWorkspaceTabsStore.setState({
      tabs: [],
      activeTabId: null,
      activationOrder: [],
    })
    useSduiCacheStore.getState().clear()
    act(() => {
      useViewStateStore.getState().replaceAll({})
      useTreeStore.getState().reset()
    })
  })

  it('возврат на вкладку незаписанного документа возвращает введённое без переоткрытия', async () => {
    await typeAndLeave()
    go(DOC)

    expect((await input('Комментарий')).value).toBe('Оплата поставщику')
    expect(opensOf(DOC)).toBe(1)
    expect(server.sessions.get('S1')?.alive).toBe(true)
  })

  it.fails(
    '«Создать» того же типа не выбрасывает незаписанный новый документ',
    async () => {
      await typeAndLeave()

      act(() => {
        markFreshFormInstance(DOC)
        void router.navigate?.(DOC)
      })
      await waitFor(() => {
        expect(useTreeStore.getState().formSessionId).toBe('S3')
      })

      const kept = Object.values(useSduiCacheStore.getState().cache).some(
        (entry) => entry.viewState.Kommentariy === 'Оплата поставщику'
      )
      expect(kept).toBe(true)
    }
  )

  it.fails(
    'фоновая форма с истёкшей серверной сессией сохраняет введённое после переоткрытия',
    async () => {
      await typeAndLeave()
      const expired = server.sessions.get('S1')
      if (expired) expired.alive = false

      go(DOC)
      expect((await input('Комментарий')).value).toBe('Оплата поставщику')
      expect(opensOf(DOC)).toBe(1)

      await typeInto('Основание', 'Счёт 15')

      await waitFor(() => {
        expect(useTreeStore.getState().formSessionId).toBe('S3')
      })
      expect((await input('Комментарий')).value).toBe('Оплата поставщику')
      expect((await input('Основание')).value).toBe('Счёт 15')
    }
  )

  it.fails(
    'поле, введённое при пропавшей сети, доходит до сервера и попадает в запись',
    async () => {
      renderApp()
      await input('Комментарий')

      server.networkDown = true
      await typeInto('Комментарий', 'Оплата поставщику')
      await waitFor(() => {
        expect(eventsFor('field.kommentariy')).toHaveLength(1)
      })
      server.networkDown = false

      await typeInto('Основание', 'Счёт 15')
      await waitFor(() => {
        expect(server.sessions.get('S1')?.scratch.Osnovanie).toBe('Счёт 15')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Записать' }))
      await waitFor(() => {
        expect(server.saved).toHaveLength(1)
      })

      expect((await input('Комментарий')).value).toBe('Оплата поставщику')
      expect(server.saved[0]).toEqual({
        Kommentariy: 'Оплата поставщику',
        Osnovanie: 'Счёт 15',
      })
    }
  )
})
