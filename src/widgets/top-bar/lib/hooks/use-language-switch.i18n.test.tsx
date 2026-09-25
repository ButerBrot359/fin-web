import { act, renderHook } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import type { ViewRequest } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { useLanguageSwitch } from './use-language-switch'

const requests: ViewRequest[] = []

vi.mock('@/features/sdui/api/view-transport', () => ({
  viewTransport: {
    post: vi.fn((req: ViewRequest) => {
      requests.push(req)
      return Promise.resolve({
        formSessionId: 'fs-bg',
        revision: 1,
        tab: { kind: 'MODULE', title: `kz:${req.route ?? ''}` },
      })
    }),
    closeBeacon: vi.fn(),
  },
}))

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { ru: { common: {} }, kz: { common: {} } },
    defaultNS: 'common',
    lng: 'ru',
    supportedLngs: ['ru', 'kz'],
  })
})

beforeEach(async () => {
  requests.length = 0
  useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  await i18n.changeLanguage('ru')
})

it('с настоящим i18n обновляет заголовки неактивных вкладок на новом языке', async () => {
  const store = useWorkspaceTabsStore.getState()
  store.activateOrCreate('/modules/Sklad', '', 'module')
  store.activateOrCreate('/modules/Tarifikatsiya', '', 'module')

  const { result } = renderHook(() => useLanguageSwitch())
  await act(async () => {
    result.current.requestToggle()
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2)
    })
  })

  expect(i18n.language).toBe('kz')
  expect(requests[0]).toMatchObject({
    route: '/modules/Sklad',
    action: { type: 'OPEN' },
  })
  expect(requests[1]).toEqual({
    formSessionId: 'fs-bg',
    action: { type: 'CLOSE' },
  })
  expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.title)).toEqual([
    'kz:/modules/Sklad',
    '',
  ])
})
