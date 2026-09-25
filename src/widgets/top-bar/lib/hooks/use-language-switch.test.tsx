import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  closeAllSduiSessions,
  hasSduiUnsavedWork,
  refreshTabTitles,
} from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { useLanguageSwitch } from './use-language-switch'

vi.mock('@/features/sdui', () => ({
  hasSduiUnsavedWork: vi.fn(),
  closeAllSduiSessions: vi.fn().mockResolvedValue(undefined),
  refreshTabTitles: vi.fn().mockResolvedValue(undefined),
}))

const setTabTitle = vi.fn()

vi.mock('@/features/workspace-tabs', () => ({
  useWorkspaceTabsStore: { getState: vi.fn() },
}))

const changeLanguage = vi.fn().mockResolvedValue(undefined)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage },
  }),
}))

describe('useLanguageSwitch', () => {
  beforeEach(() => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(false)
    vi.mocked(closeAllSduiSessions).mockClear()
    changeLanguage.mockClear()
    setTabTitle.mockClear()
    vi.mocked(refreshTabTitles).mockClear()
    vi.mocked(useWorkspaceTabsStore.getState).mockReturnValue({
      tabs: [
        {
          id: '/modules/a',
          path: '/modules/a',
          search: '',
          pageType: 'module',
        },
        {
          id: '/modules/b',
          path: '/modules/b',
          search: '',
          pageType: 'module',
        },
        { id: 'panel', path: '', search: '', pageType: 'sdui-panel' },
      ],
      activeTabId: '/modules/a',
      setTabTitle,
    } as unknown as ReturnType<typeof useWorkspaceTabsStore.getState>)
  })

  it('после смены языка обновляет заголовки неактивных вкладок', async () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => {
      result.current.requestToggle()
    })

    await waitFor(() => {
      expect(refreshTabTitles).toHaveBeenCalledTimes(1)
    })
    const [targets, deps] = vi.mocked(refreshTabTitles).mock.calls[0]
    expect(targets.map((t) => t.id)).toEqual(['/modules/b'])
    expect(changeLanguage.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(refreshTabTitles).mock.invocationCallOrder[0]
    )
    deps.onTitle('/modules/b', 'Қойма')
    expect(setTabTitle).toHaveBeenCalledWith('/modules/b', 'Қойма')
    expect(deps.shouldRefresh?.('/modules/a')).toBe(false)
    expect(deps.shouldRefresh?.('/modules/b')).toBe(true)
  })

  it('без несохранённых изменений: сразу CLOSE сессий → changeLanguage', async () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => {
      result.current.requestToggle()
    })

    await waitFor(() => {
      expect(changeLanguage).toHaveBeenCalledWith('kz')
    })
    expect(closeAllSduiSessions).toHaveBeenCalledTimes(1)
    // Порядок критичен: сначала закрыть сессии/кэш, потом менять язык
    expect(
      vi.mocked(closeAllSduiSessions).mock.invocationCallOrder[0]
    ).toBeLessThan(changeLanguage.mock.invocationCallOrder[0])
    expect(result.current.confirmOpen).toBe(false)
  })

  it('с несохранёнными изменениями: открывает confirm, ничего не переключает', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => {
      result.current.requestToggle()
    })

    expect(result.current.confirmOpen).toBe(true)
    expect(closeAllSduiSessions).not.toHaveBeenCalled()
    expect(changeLanguage).not.toHaveBeenCalled()
  })

  it('confirmSwitch: закрывает диалог и переключает', async () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => {
      result.current.requestToggle()
    })
    act(() => {
      result.current.confirmSwitch()
    })

    await waitFor(() => {
      expect(changeLanguage).toHaveBeenCalledWith('kz')
    })
    expect(result.current.confirmOpen).toBe(false)
  })

  it('cancelSwitch: закрывает диалог, язык не меняется', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => {
      result.current.requestToggle()
    })
    act(() => {
      result.current.cancelSwitch()
    })

    expect(result.current.confirmOpen).toBe(false)
    expect(changeLanguage).not.toHaveBeenCalled()
  })
})
