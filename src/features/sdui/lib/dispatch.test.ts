import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from './dispatch'

// Мутабельная локация: тесты подменяют search между рендерами
const router = vi.hoisted(() => ({
  pathname: '/documents/SchetKOplate/new',
  search: '',
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: router.pathname, search: router.search }),
  useNavigate: () => vi.fn(),
}))

vi.mock('./sdui-session-context', () => ({
  useSduiSession: () => ({
    getSession: () => ({ formSessionId: null, revision: null }),
    replaceAll: vi.fn(),
    merge: vi.fn(),
    setSession: vi.fn(),
    setRoot: vi.fn(),
    bumpRevision: vi.fn(),
    applyTreePatches: vi.fn(),
    clearAllErrors: vi.fn(),
    setFromServer: vi.fn(),
    resetDirty: vi.fn(),
  }),
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
