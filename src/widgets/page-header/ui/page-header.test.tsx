import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInterfaceScaleStore } from '@/features/interface-scale'

import { PageHeader } from './page-header'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/features/favorite-button', () => ({ FavoriteButton: () => null }))
vi.mock('@/features/navigation-buttons', () => ({
  NavigationButtons: () => null,
}))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: mocks.showToast }))
vi.mock('@/shared/assets/icons/link.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/dots.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  mocks.showToast.mockClear()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  useInterfaceScaleStore.getState().resetScale()
})

afterEach(cleanup)

describe('PageHeader', () => {
  it('копирует ссылку страницы в буфер обмена', async () => {
    render(<PageHeader title="Форма" />)

    fireEvent.click(screen.getByLabelText('actions.link'))
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(window.location.href)
    })
    expect(mocks.showToast).toHaveBeenCalledWith('info', 'actions.linkCopied')
  })

  it('сообщает об ошибке, если буфер обмена недоступен', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<PageHeader title="Форма" />)

    fireEvent.click(screen.getByLabelText('actions.link'))
    await vi.waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith('error', 'actions.copyError')
    })
  })

  it('открывает окно с разделом масштаба и меняет масштаб', () => {
    render(<PageHeader title="Форма" />)
    expect(screen.queryByText('interfaceScale.title')).toBeNull()

    fireEvent.click(screen.getByLabelText('actions.more'))
    expect(screen.getByText('interfaceScale.title')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('interfaceScale.increase'))
    expect(useInterfaceScaleStore.getState().scale).toBe(1.1)
    expect(screen.getByText('110%')).toBeTruthy()
  })
})
