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

import {
  enrollFaceIdProfile,
  getFaceIdProfile,
  replaceFaceIdProfile,
} from '../api/face-id-api'
import type { FaceIdPhotoTarget } from '../types/face-id'
import { FaceIdPhotoForm } from './face-id-photo-form'

vi.mock('../api/face-id-api', () => ({
  getFaceIdProfile: vi.fn(),
  enrollFaceIdProfile: vi.fn(),
  replaceFaceIdProfile: vi.fn(),
  faceIdHttpStatus: (error: { status?: number }) => error.status,
}))
vi.mock('../lib/prepare-photo', () => ({
  prepareFaceIdPhoto: () =>
    Promise.resolve({
      image: 'jpeg-test',
      preview: 'data:image/jpeg;base64,dGVzdA==',
    }),
}))

const registered = (profileId = 'profile-1') => ({
  userEntryId: 123,
  userName: 'Current user',
  accountAvailable: true,
  canManage: true,
  canReplace: true,
  registered: true,
  profile: {
    id: profileId,
    subject: 'webbuh:7',
    source: 'trusted_photo',
    created: null,
  },
})
const self = { kind: 'self', accountId: 7 } as const
const file = new File(['synthetic'], 'test.jpg', { type: 'image/jpeg' })
function mount(target: FaceIdPhotoTarget = self) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const ui = (next: FaceIdPhotoTarget) => (
    <QueryClientProvider client={client}>
      <FaceIdPhotoForm target={next} />
    </QueryClientProvider>
  )
  return { ...render(ui(target)), ui }
}
async function pickAndConsent() {
  fireEvent.change(screen.getByLabelText('Выбрать фото'), {
    target: { files: [file] },
  })
  await screen.findByAltText('Фото выбранного пользователя перед сохранением')
  fireEvent.click(screen.getByRole('checkbox'))
}
async function beginReplacement() {
  fireEvent.click(await screen.findByRole('button', { name: 'Заменить фото' }))
  await pickAndConsent()
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить новое фото' }))
}

beforeEach(() => {
  vi.mocked(getFaceIdProfile).mockResolvedValue(registered())
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Face ID self photo and replacement', () => {
  it('self enrollment targets self only and requires its own consent', async () => {
    vi.mocked(getFaceIdProfile).mockResolvedValue({
      ...registered(),
      registered: false,
      profile: null,
      canReplace: false,
    })
    vi.mocked(enrollFaceIdProfile).mockResolvedValue(registered())
    mount()
    await screen.findByText('Current user')
    expect(
      screen.getByText(
        'Даю согласие на обработку моей биометрии и подтверждаю, что на фото я.'
      )
    ).toBeTruthy()
    await pickAndConsent()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить лицо' }))
    await waitFor(() => {
      expect(enrollFaceIdProfile).toHaveBeenCalledExactlyOnceWith(
        self,
        'jpeg-test'
      )
    })
    expect(replaceFaceIdProfile).not.toHaveBeenCalled()
  })

  it('replaces using the profile from GET after a separate explicit action', async () => {
    vi.mocked(replaceFaceIdProfile).mockResolvedValue(registered('profile-2'))
    mount()
    await screen.findByRole('button', { name: 'Заменить фото' })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    await beginReplacement()
    await waitFor(() => {
      expect(replaceFaceIdProfile).toHaveBeenCalledExactlyOnceWith(
        self,
        'jpeg-test',
        'profile-1'
      )
    })
    await screen.findByText('Фото для Face ID заменено.')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('refreshes 409 but never automatically resubmits with a newer profile', async () => {
    vi.mocked(replaceFaceIdProfile)
      .mockRejectedValueOnce({ status: 409 })
      .mockResolvedValueOnce(registered('profile-3'))
    vi.mocked(getFaceIdProfile)
      .mockResolvedValueOnce(registered())
      .mockResolvedValue(registered('profile-2'))
    mount()
    await beginReplacement()
    await screen.findByText(
      'Эталон изменился или больше не существует. Обновляем статус. Для новой попытки заново выберите фото и подтвердите согласие.'
    )
    await waitFor(() => {
      expect(getFaceIdProfile).toHaveBeenCalledTimes(2)
    })
    expect(replaceFaceIdProfile).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Заменить фото' }))
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false)
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Сохранить новое фото',
      }).disabled
    ).toBe(true)
    await pickAndConsent()
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить новое фото' })
    )
    await waitFor(() => {
      expect(replaceFaceIdProfile).toHaveBeenLastCalledWith(
        self,
        'jpeg-test',
        'profile-2'
      )
    })
  })

  it('reports rejected replacement without clearing the current profile', async () => {
    vi.mocked(replaceFaceIdProfile).mockRejectedValue({ status: 422 })
    mount()
    await beginReplacement()
    await screen.findByText(
      'Новое фото не прошло проверку. Для входа по-прежнему используется ранее добавленное фото. Выберите другое фото.'
    )
    expect(screen.getByText('Фото для входа уже добавлено.')).toBeTruthy()
    expect(screen.queryByText('Фото для Face ID заменено.')).toBeNull()
    expect(replaceFaceIdProfile).toHaveBeenCalledTimes(1)
  })

  it('requires explicit refresh after an uncertain response without claiming success', async () => {
    vi.mocked(replaceFaceIdProfile).mockRejectedValue({ status: 503 })
    mount()
    await beginReplacement()
    await screen.findByText(
      'Результат сохранения не подтверждён. Сначала обновите статус. Повторный запрос автоматически не отправляется.'
    )
    expect(screen.queryByText('Фото для Face ID заменено.')).toBeNull()
    expect(getFaceIdProfile).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Заменить фото' })
        .disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Обновить статус' }))
    await waitFor(() => {
      expect(getFaceIdProfile).toHaveBeenCalledTimes(2)
    })
    expect(replaceFaceIdProfile).toHaveBeenCalledTimes(1)
  })

  it('honors canReplace separately from first-enrollment permission', async () => {
    vi.mocked(getFaceIdProfile).mockResolvedValue({
      ...registered(),
      canManage: true,
      canReplace: false,
    })
    mount()
    expect(
      (
        await screen.findByRole<HTMLButtonElement>('button', {
          name: 'Заменить фото',
        })
      ).disabled
    ).toBe(true)
    expect(replaceFaceIdProfile).not.toHaveBeenCalled()
  })

  it('clears pending personal photo when the signed-in account changes', async () => {
    const view = mount()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Заменить фото' })
    )
    await pickAndConsent()
    vi.mocked(getFaceIdProfile).mockResolvedValue({
      ...registered(),
      userName: 'Another user',
    })
    view.rerender(view.ui({ kind: 'self', accountId: 8 }))
    await screen.findByText('Another user')
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(replaceFaceIdProfile).not.toHaveBeenCalled()
  })
})
