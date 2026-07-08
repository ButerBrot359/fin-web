import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { closeAllSduiSessions, hasSduiUnsavedWork } from '@/features/sdui'

import { useLanguageSwitch } from './use-language-switch'

vi.mock('@/features/sdui', () => ({
  hasSduiUnsavedWork: vi.fn(),
  closeAllSduiSessions: vi.fn().mockResolvedValue(undefined),
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
  })

  it('без несохранённых изменений: сразу CLOSE сессий → changeLanguage', async () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())

    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('kz'))
    expect(closeAllSduiSessions).toHaveBeenCalledTimes(1)
    // Порядок критичен: сначала закрыть сессии/кэш, потом менять язык
    expect(vi.mocked(closeAllSduiSessions).mock.invocationCallOrder[0]).toBeLessThan(
      changeLanguage.mock.invocationCallOrder[0],
    )
    expect(result.current.confirmOpen).toBe(false)
  })

  it('с несохранёнными изменениями: открывает confirm, ничего не переключает', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())

    expect(result.current.confirmOpen).toBe(true)
    expect(closeAllSduiSessions).not.toHaveBeenCalled()
    expect(changeLanguage).not.toHaveBeenCalled()
  })

  it('confirmSwitch: закрывает диалог и переключает', async () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())
    act(() => result.current.confirmSwitch())

    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('kz'))
    expect(result.current.confirmOpen).toBe(false)
  })

  it('cancelSwitch: закрывает диалог, язык не меняется', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())
    act(() => result.current.cancelSwitch())

    expect(result.current.confirmOpen).toBe(false)
    expect(changeLanguage).not.toHaveBeenCalled()
  })
})
