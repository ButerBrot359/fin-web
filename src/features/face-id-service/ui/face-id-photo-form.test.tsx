import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/app/config/i18n'

import { enrollFaceIdUser, getFaceIdUser } from '../api/face-id-api'
import { FaceIdPhotoForm } from './face-id-photo-form'

vi.mock('../api/face-id-api', () => ({
  getFaceIdUser: vi.fn(),
  enrollFaceIdUser: vi.fn(),
  faceIdHttpStatus: (error: { status?: number }) => error.status,
}))
vi.mock('../lib/prepare-photo', () => ({
  prepareFaceIdPhoto: () =>
    Promise.resolve({
      image: 'jpeg-test',
      preview: 'data:image/jpeg;base64,dGVzdA==',
    }),
}))

const user = (id: number) => ({
  userEntryId: id,
  userName: `User ${String(id)}`,
  accountAvailable: true,
  canManage: true,
  registered: false,
  profile: null,
})
const file = new File(['synthetic'], 'test.jpg', { type: 'image/jpeg' })
const pick = () => {
  fireEvent.change(screen.getByLabelText('Выбрать фото'), {
    target: { files: [file] },
  })
}

function mount(id: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const ui = (next: number) => (
    <QueryClientProvider client={client}>
      <FaceIdPhotoForm userEntryId={next} />
    </QueryClientProvider>
  )
  return { ...render(ui(id)), ui }
}

beforeEach(() => {
  vi.mocked(getFaceIdUser).mockImplementation((id) => Promise.resolve(user(id)))
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Face ID photo enrollment', () => {
  it('requires consent and sends only the selected dictionary ID with prepared image', async () => {
    vi.mocked(enrollFaceIdUser).mockResolvedValue({
      ...user(123),
      registered: true,
    })
    mount(123)
    expect(await screen.findByText('User 123')).toBeTruthy()
    pick()
    await screen.findByAltText('Фото выбранного пользователя перед сохранением')
    const save = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Добавить лицо',
    })
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(save)
    await waitFor(() => {
      expect(enrollFaceIdUser).toHaveBeenCalledExactlyOnceWith(123, 'jpeg-test')
    })
    expect(
      await screen.findByText(
        'Лицо уже добавлено. Повторная загрузка и замена в этой версии недоступны.'
      )
    ).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('clears photo and consent when switching users', async () => {
    const view = mount(123)
    await screen.findByText('User 123')
    pick()
    await screen.findByAltText('Фото выбранного пользователя перед сохранением')
    fireEvent.click(screen.getByRole('checkbox'))
    view.rerender(view.ui(456))
    await screen.findByText('User 456')
    expect(
      screen.queryByAltText('Фото выбранного пользователя перед сохранением')
    ).toBeNull()
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Добавить лицо' })
        .disabled
    ).toBe(true)
    expect(enrollFaceIdUser).not.toHaveBeenCalled()
  })

  it('blocks resubmission after uncertain result until an explicit status refresh', async () => {
    vi.mocked(enrollFaceIdUser).mockRejectedValue({ status: 503 })
    mount(123)
    await screen.findByText('User 123')
    pick()
    await screen.findByAltText('Фото выбранного пользователя перед сохранением')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить лицо' }))
    await screen.findByRole('alert')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Добавить лицо' })
        .disabled
    ).toBe(true)
    expect(enrollFaceIdUser).toHaveBeenCalledTimes(1)
    vi.mocked(getFaceIdUser).mockResolvedValue({
      ...user(123),
      registered: true,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Обновить статус' }))
    await screen.findByText(
      'Лицо уже добавлено. Повторная загрузка и замена в этой версии недоступны.'
    )
    expect(enrollFaceIdUser).toHaveBeenCalledTimes(1)
  })

  it('does not interpret a failed status request as an unregistered user', async () => {
    vi.mocked(getFaceIdUser).mockRejectedValue({ status: 403 })
    mount(123)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Добавить лицо' })).toBeNull()
  })
})
