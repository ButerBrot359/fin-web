import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import '@/app/config/i18n'

import { AuditLogPage } from './audit-log-page'

const getAuditLog = vi.fn()

vi.mock('../api/audit-log-api', () => ({
  getAuditLog: (query: unknown) => getAuditLog(query) as Promise<unknown>,
}))

const sessionRow = {
  id: 2045,
  occurredAt: '2026-09-08T23:40:01.529308',
  action: 'LOGIN',
  actionPresentation: 'Вход в систему',
  outcome: 'SUCCESS',
  outcomePresentation: 'Выполнено',
  domainKind: null,
  entryId: null,
  typeCode: null,
  entryPresentation: 'Таисия Дорожкина',
  userEntryId: 79322,
  userLogin: 'Таисия Дорожкина',
  userName: 'Дорожкина Таисия',
  userIin: null,
  clientAddress: '204.168.204.132',
  userAgent: 'curl/8.14.1',
  taskId: null,
  message: null,
  changes: null,
}

const page = (overrides: Record<string, unknown> = {}) => ({
  content: [sessionRow],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 50,
  ...overrides,
})

/**
 * Журнал регистрации (приказ МФ РК № 254, п. 27).
 *
 * Проверяется то, что отличает этот экран от обычной таблицы: русские подписи действий берутся
 * С СЕРВЕРА (свой перевод рядом однажды разойдётся), пустые поля событий сессии — норма, а не
 * «нет данных», и постраничность считается по ФАКТИЧЕСКОМУ ответу, а не по запрошенному размеру.
 */
describe('AuditLogPage', () => {
  afterEach(() => {
    cleanup()
    getAuditLog.mockReset()
  })

  it('показывает запись с серверными подписями действия и исхода', async () => {
    getAuditLog.mockResolvedValue(page())

    render(<AuditLogPage />)

    expect(await screen.findByText('Вход в систему')).toBeTruthy()
    expect(screen.getByText('Выполнено')).toBeTruthy()
    expect(screen.getByText('Дорожкина Таисия')).toBeTruthy()
  })

  it('отправляет только заполненные отборы и сбрасывает страницу', async () => {
    getAuditLog.mockResolvedValue(page({ totalPages: 3, totalElements: 120 }))

    render(<AuditLogPage />)
    await screen.findByText('Вход в систему')

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }))
    await waitFor(() => {
      expect(getAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 })
      )
    })

    fireEvent.change(screen.getByLabelText('Пользователь'), {
      target: { value: 'Иванов Иван' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))

    await waitFor(() => {
      expect(getAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ userLogin: 'Иванов Иван', page: 0 })
      )
    })
    // Незаполненные отборы уходить не должны: сервер трактует пустое значение как значение.
    const lastCall = getAuditLog.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >
    expect(lastCall.action).toBe('')
    expect(lastCall.from).toBeUndefined()
  })

  it('пустая лента — обычное состояние', async () => {
    getAuditLog.mockResolvedValue(
      page({ content: [], totalElements: 0, totalPages: 0 })
    )

    render(<AuditLogPage />)

    expect(await screen.findByText('Записей нет')).toBeTruthy()
  })

  it('одна страница — постраничности нет', async () => {
    getAuditLog.mockResolvedValue(page())

    render(<AuditLogPage />)
    await screen.findByText('Вход в систему')

    expect(screen.queryByRole('button', { name: 'Вперёд' })).toBeNull()
  })

  it('отказ сервера показывается сообщением, а не пустым экраном', async () => {
    getAuditLog.mockRejectedValue(new Error('нет сети'))

    render(<AuditLogPage />)

    expect(
      await screen.findByText('Не удалось получить журнал. Повторите попытку')
    ).toBeTruthy()
  })
})
