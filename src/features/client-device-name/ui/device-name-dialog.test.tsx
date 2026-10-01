import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import '@/app/config/i18n'
import { DEVICE_NAME_STORAGE_KEY } from '@/shared/lib/client-context/device-name'

import { DeviceNameDialog } from './device-name-dialog'

describe('DeviceNameDialog (SCRUM-371)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('показывает сохранённое имя и сохраняет новое', () => {
    window.localStorage.setItem(DEVICE_NAME_STORAGE_KEY, 'Кабинет 204')
    const onClose = vi.fn()

    render(<DeviceNameDialog open onClose={onClose} />)

    const input = screen.getByRole('textbox', { name: 'Имя компьютера' })
    expect(input).toHaveValue('Кабинет 204')

    fireEvent.change(input, { target: { value: '  Бухгалтерия-1 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBe(
      'Бухгалтерия-1'
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('«Отмена» ничего не сохраняет, пустое имя — сброс', () => {
    window.localStorage.setItem(DEVICE_NAME_STORAGE_KEY, 'Кабинет 204')
    const onClose = vi.fn()
    render(<DeviceNameDialog open onClose={onClose} />)

    const input = screen.getByRole('textbox', { name: 'Имя компьютера' })
    fireEvent.change(input, { target: { value: 'Черновик' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBe(
      'Кабинет 204'
    )

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBeNull()
  })
})
