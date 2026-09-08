import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import '@/app/config/i18n'

import type { FaceCaptureState } from '../lib/hooks/use-face-capture'
import { FaceLoginButton } from './face-login-button'

const run = vi.fn()
const reset = vi.fn()
let state: FaceCaptureState
let flashEnabled: boolean

vi.mock('../lib/hooks/use-face-capture', () => ({
  useFaceCapture: () => ({ state, run, reset }),
}))

vi.mock('../lib/consts/flash-config', () => ({
  get FLASH_ENABLED() {
    return flashEnabled
  },
}))

const idle: FaceCaptureState = {
  phase: 'idle',
  fillColor: null,
  progress: 0,
  outcome: null,
}

beforeEach(() => {
  state = idle
  flashEnabled = true
  run.mockReset()
  run.mockResolvedValue({ kind: 'success' })
  reset.mockReset()
})

afterEach(cleanup)

const faceButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Войти по лицу' })

const clickFaceButton = () => fireEvent.click(faceButton())

describe('FaceLoginButton', () => {
  it('не даёт начать без логина', () => {
    // Серверу нужно знать, чей эталон сверять: челлендж выдаётся под конкретную учётную запись.
    render(<FaceLoginButton login="  " onSuccess={vi.fn()} />)

    expect(faceButton().disabled).toBe(true)
  })

  it('перед съёмкой показывает предупреждение и НЕ запускает камеру', async () => {
    // Требование §D11: предупреждение о световой вспышке показывается ДО начала съёмки.
    // Запуск камеры сразу по нажатию нарушил бы его самым буквальным образом.
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)

    clickFaceButton()

    expect(await screen.findByText(/экран будет ярко мигать/i)).toBeTruthy()
    expect(run).not.toHaveBeenCalled()
  })

  it('отказ в диалоге закрывает его, не начав съёмку', async () => {
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)
    clickFaceButton()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Войти по паролю' })
    )

    expect(run).not.toHaveBeenCalled()
  })

  it('согласие запускает съёмку и сообщает об успехе', async () => {
    const onSuccess = vi.fn()
    render(<FaceLoginButton login="Иванов Иван" onSuccess={onSuccess} />)
    clickFaceButton()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Понятно, начать' })
    )

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('Иванов Иван')
    })
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('во время попытки кнопка заблокирована', () => {
    // Измеренная причина: на остывшем движке ответ идёт 8–10 секунд. Повторное нажатие
    // израсходовало бы второй челлендж и вторую попытку из пяти — человек приблизился бы
    // к блокировке, ничего не сделав неправильно.
    state = { ...idle, phase: 'capturing', progress: 0.4, fillColor: '#FF0000' }
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)

    expect(faceButton().disabled).toBe(true)
  })

  it('на отказ по существу показывает текст без причины', () => {
    state = { ...idle, phase: 'done', outcome: { kind: 'rejected' } }
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toMatch(
      /не удалось подтвердить личность/i
    )
  })

  it('на причину качества показывает конкретную подсказку', () => {
    state = {
      ...idle,
      phase: 'done',
      outcome: { kind: 'quality', reason: 'FACE_TOO_SMALL' },
    }
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toMatch(/придвиньтесь ближе/i)
  })

  it('при выключенной вспышке предупреждение пропускается и съёмка стартует сразу', async () => {
    flashEnabled = false
    render(<FaceLoginButton login="Иванов Иван" onSuccess={vi.fn()} />)

    clickFaceButton()

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('Иванов Иван')
    })
    expect(screen.queryByText(/экран будет ярко мигать/i)).toBeNull()
  })
})
