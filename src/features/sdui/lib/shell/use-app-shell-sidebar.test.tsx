import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'ru' } }),
}))

import * as api from '../../api/fetch-app-shell'
import { useAppShellSidebar } from './use-app-shell-sidebar'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const shellTree = {
  id: 'shell',
  type: 'APP_SHELL',
  children: [
    { id: 'tb', type: 'TOP_BAR' },
    {
      id: 'sb',
      type: 'SIDEBAR',
      props: { collapsed: false },
      children: [
        { id: 'n1', type: 'LINK', props: { label: 'Главная', route: '/' } },
      ],
    },
    { id: 'ws', type: 'WORKSPACE' },
  ],
}

describe('useAppShellSidebar', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('возвращает поддерево SIDEBAR из дерева APP_SHELL', async () => {
    vi.spyOn(api, 'fetchAppShellTree').mockResolvedValue(shellTree as never)
    const { result } = renderHook(() => useAppShellSidebar(), { wrapper })
    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.sidebarNode?.id).toBe('sb')
    expect(result.current.isError).toBe(false)
  })

  it('ошибка запроса → isError, sidebarNode = null', async () => {
    vi.spyOn(api, 'fetchAppShellTree').mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useAppShellSidebar(), { wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.sidebarNode).toBeNull()
  })
})
