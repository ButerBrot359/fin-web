import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import '@/app/config/i18n'

import { InactivityLocksPage } from './inactivity-locks-page'

const getInactivityLocks = vi.fn()
const unlockInactivity = vi.fn()

vi.mock('../api/inactivity-locks-api', () => ({
  getInactivityLocks: () => getInactivityLocks() as Promise<unknown>,
  unlockInactivity: (appUserId: number, reason: string) =>
    unlockInactivity(appUserId, reason) as Promise<void>,
}))

const lock = {
  appUserId: 42,
  login: 'Иванов Иван',
  displayName: 'Иванов Иван Иванович',
  lastLoginAt: '2026-08-01T09:00:00',
  countFrom: '2026-08-01T09:00:00',
  inactiveWorkingDays: 27,
  thresholdWorkingDays: 3,
}

/**
 * Экран снятия блокировок (§А4).
 *
 * Главное, что проверяется: без основания разблокировать нельзя. Требование заказчика —
 * «открывать только с согласия руководства», и кнопка, работающая при пустом поле, превращала бы
 * это согласие в формальность.
 */
describe('InactivityLocksPage', () => {
  afterEach(() => {
    cleanup()
    getInactivityLocks.mockReset()
    unlockInactivity.mockReset()
  })

  it('показывает заблокированных с числом дней и порогом', async () => {
    getInactivityLocks.mockResolvedValue([lock])

    render(<InactivityLocksPage />)

    expect(await screen.findByText('Иванов Иван Иванович')).toBeTruthy()
    expect(screen.getByText('27 / 3')).toBeTruthy()
  })

  it('не даёт разблокировать без основания', async () => {
    getInactivityLocks.mockResolvedValue([lock])

    render(<InactivityLocksPage />)
    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Разблокировать',
    })

    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(unlockInactivity).not.toHaveBeenCalled()
  })

  it('отправляет основание и перечитывает список', async () => {
    getInactivityLocks.mockResolvedValueOnce([lock]).mockResolvedValueOnce([])
    unlockInactivity.mockResolvedValue(undefined)

    render(<InactivityLocksPage />)
    const field = await screen.findByPlaceholderText(
      'Кто согласовал и на каком основании'
    )
    fireEvent.change(field, { target: { value: 'согласовано с директором' } })
    fireEvent.click(screen.getByRole('button', { name: 'Разблокировать' }))

    await waitFor(() => {
      expect(unlockInactivity).toHaveBeenCalledWith(
        42,
        'согласовано с директором'
      )
    })
    expect(await screen.findByText('Заблокированных нет')).toBeTruthy()
  })

  it('пустой список — не ошибка, а обычное состояние', async () => {
    getInactivityLocks.mockResolvedValue([])

    render(<InactivityLocksPage />)

    expect(await screen.findByText('Заблокированных нет')).toBeTruthy()
  })
})
