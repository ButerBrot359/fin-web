import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '@/app/config/i18n'

vi.mock('@/shared/assets/icons/user.svg', () => ({ default: () => null }))
vi.mock('@/shared/ui/icons', () => ({ figmaIcons: { 'eye-opened': null } }))
vi.mock('@/features/auth', () => ({
  LOGIN_ROUTE: '/login',
  useAuthStore: (selector: (value: unknown) => unknown) =>
    selector({ user: { id: 7, login: 'User' }, signOut: vi.fn() }),
}))
vi.mock('@/features/face-auth', () => ({
  FacePhotoDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="legacy-photo-dialog" /> : null,
}))

import { TopBarUser } from './top-bar-user'

afterEach(cleanup)

const mount = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<TopBarUser />} />
        <Route
          path="/profile/face-id"
          element={<div data-testid="self-face-id-page" />}
        />
      </Routes>
    </MemoryRouter>
  )

describe('User menu Face ID entries', () => {
  it('adds a distinct entry that opens the self route', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Меню пользователя' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Фото для входа по лицу' })
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Фото для входа по Face ID' })
    )
    expect(await screen.findByTestId('self-face-id-page')).toBeTruthy()
  })

  it('keeps the existing face-photo dialog separate', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Меню пользователя' }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Фото для входа по лицу' })
    )
    expect(screen.getByTestId('legacy-photo-dialog')).toBeTruthy()
    expect(screen.queryByTestId('self-face-id-page')).toBeNull()
  })
})
