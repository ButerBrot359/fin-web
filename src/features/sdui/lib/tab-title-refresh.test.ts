import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import { viewTransport } from '../api/view-transport'
import { refreshTabTitles } from './tab-title-refresh'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn(), closeBeacon: vi.fn() },
}))

const post = vi.mocked(viewTransport.post)

const openResponse = (formSessionId: string, title?: string) =>
  ({
    formSessionId,
    revision: 1,
    tab: title ? { kind: 'MODULE', title } : null,
  }) as ViewResponse

const target = (id: string) => ({ id, path: id, search: '' })

describe('refreshTabTitles', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('открывает маршрут вкладки, берёт заголовок и закрывает сессию', async () => {
    post.mockImplementation((req) =>
      Promise.resolve(
        req.action.type === 'OPEN'
          ? openResponse('fs-1', 'Қойма')
          : ({} as ViewResponse)
      )
    )
    const onTitle = vi.fn()

    await refreshTabTitles([target('/modules/sklad')], {
      onTitle,
      shouldContinue: () => true,
    })

    expect(onTitle).toHaveBeenCalledWith('/modules/sklad', 'Қойма')
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/modules/sklad',
        action: expect.objectContaining({ type: 'OPEN' }),
      })
    )
    expect(post).toHaveBeenCalledWith({
      formSessionId: 'fs-1',
      action: { type: 'CLOSE' },
    })
  })

  it('берёт заголовок из корня дерева, если в ответе нет tab', async () => {
    post.mockResolvedValue({
      formSessionId: 'fs-2',
      revision: 1,
      tree: { id: 'root', type: 'PAGE', props: { title: 'Склад' } },
    } as unknown as ViewResponse)
    const onTitle = vi.fn()

    await refreshTabTitles([target('/a')], {
      onTitle,
      shouldContinue: () => true,
    })

    expect(onTitle).toHaveBeenCalledWith('/a', 'Склад')
  })

  it('ошибка OPEN одной вкладки не мешает остальным', async () => {
    post.mockImplementation((req) => {
      if (req.action.type === 'CLOSE')
        return Promise.resolve({} as ViewResponse)
      return req.route === '/bad'
        ? Promise.reject(new Error('404'))
        : Promise.resolve(openResponse('fs-3', 'Ок'))
    })
    const onTitle = vi.fn()

    await refreshTabTitles([target('/bad'), target('/good')], {
      onTitle,
      shouldContinue: () => true,
      concurrency: 1,
    })

    expect(onTitle).toHaveBeenCalledTimes(1)
    expect(onTitle).toHaveBeenCalledWith('/good', 'Ок')
  })

  it('пропускает вкладки, которые не нужно обновлять', async () => {
    post.mockResolvedValue(openResponse('fs-4', 'X'))
    const onTitle = vi.fn()

    await refreshTabTitles([target('/active'), target('/other')], {
      onTitle,
      shouldContinue: () => true,
      shouldRefresh: (id) => id !== '/active',
    })

    expect(onTitle).toHaveBeenCalledTimes(1)
    expect(onTitle).toHaveBeenCalledWith('/other', 'X')
  })

  it('не применяет заголовок, если язык успели сменить снова', async () => {
    post.mockResolvedValue(openResponse('fs-5', 'Старый'))
    const onTitle = vi.fn()
    let current = true

    const run = refreshTabTitles([target('/a')], {
      onTitle,
      shouldContinue: () => current,
    })
    current = false
    await run

    expect(onTitle).not.toHaveBeenCalled()
  })
})
