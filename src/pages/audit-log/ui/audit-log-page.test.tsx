import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@/app/config/i18n'

import { AuditLogPage } from './audit-log-page'

// Страница живёт на useQuery и на адресной строке — тестам нужны оба провайдера. Клиент на
// каждый рендер свой (кэш не перетекает между тестами), retry выключен, чтобы тест отказа
// не ждал повторных попыток.
const renderPage = (initialEntry = '/admin/audit') =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuditLogPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

const getAuditLog = vi.fn()
const getAuditActions = vi.fn()
const getAuditLogRecord = vi.fn()

vi.mock('../api/audit-log-api', () => ({
  getAuditLog: (query: unknown) => getAuditLog(query) as Promise<unknown>,
  getAuditActions: () => getAuditActions() as Promise<unknown>,
  getAuditLogRecord: (id: unknown) => getAuditLogRecord(id) as Promise<unknown>,
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

const postRow = {
  ...sessionRow,
  id: 3001,
  action: 'POST',
  actionPresentation: 'Проведение',
  domainKind: 'DOCUMENT',
  entryId: 555,
  typeCode: 'PlatezhnoePoruchenie',
  typePresentation: 'Документ. Платежное поручение',
  entryPresentation: 'Платежное поручение № 12',
  message: 'Проведено',
  changes: JSON.stringify({ Summa: { before: '100', after: '250' } }),
  computer: 'Бухгалтерия-1',
  deviceId: '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  sessionId: '9a8b7c6d-1111-4222-8333-444455556666',
  serverNode: 'webbuh-api-7f9c',
  application: 'WEB_CLIENT',
  applicationPresentation: 'Веб-клиент',
  clientLocalIp: '192.168.1.15',
  clientPublicIp: '95.56.1.2',
  networkChain: [
    { ip: '192.168.1.15', role: 'LOCAL', source: 'CLIENT' },
    { ip: '10.20.0.3', role: 'PROXY', source: 'X_ORIGINAL_FORWARDED_FOR' },
    { ip: '95.56.1.2', role: 'PUBLIC', source: 'X_FORWARDED_FOR' },
    { ip: '10.244.0.12', role: 'EDGE', source: 'REMOTE_ADDR' },
  ],
}

const page = (overrides: Record<string, unknown> = {}) => ({
  content: [sessionRow],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 50,
  ...overrides,
})

const lastQuery = () =>
  getAuditLog.mock.calls.at(-1)?.[0] as Record<string, unknown>

/**
 * Журнал регистрации «как в 1С» (приказ МФ РК № 254, п. 27; SCRUM-371).
 *
 * Проверяется то, что отличает этот экран от обычной таблицы: подписи событий — С СЕРВЕРА,
 * пустые поля — «—», а не «нет данных», цепочка адресов «компьютер → роутер», карточка события
 * с быстрыми отборами и постраничность по ФАКТИЧЕСКОМУ ответу.
 */
describe('AuditLogPage', () => {
  afterEach(() => {
    cleanup()
    getAuditLog.mockReset()
    getAuditActions.mockReset()
    getAuditLogRecord.mockReset()
  })

  const setup = (overrides: Record<string, unknown> = {}) => {
    getAuditLog.mockResolvedValue(page(overrides))
    getAuditActions.mockResolvedValue([
      {
        code: 'LOGIN',
        presentation: 'Вход в систему',
        group: 'SESSION',
        groupPresentation: 'Сеанс',
      },
      {
        code: 'POST',
        presentation: 'Проведение',
        group: 'DATA',
        groupPresentation: 'Данные',
      },
      {
        code: 'UNPOST',
        presentation: 'Отмена проведения',
        group: 'DATA',
        groupPresentation: 'Данные',
      },
    ])
    getAuditLogRecord.mockRejectedValue(new Error('404'))
  }

  it('показывает запись с серверными подписями, а незаполненные поля — прочерком', async () => {
    setup()

    renderPage()

    const row = (await screen.findByText('Дорожкина Таисия')).closest('tr')
    expect(row).toBeTruthy()
    const cells = within(row as HTMLElement)
    expect(cells.getByText('Вход в систему')).toBeTruthy()
    expect(cells.getByText('Выполнено')).toBeTruthy()
    // Старая запись без SCRUM-371-полей: адрес — единственный clientAddress, остальное «—».
    expect(cells.getByText('204.168.204.132')).toBeTruthy()
    expect(cells.getAllByText('—').length).toBeGreaterThan(3)
  })

  it('показывает компьютер, приложение, сеанс, сервер и короткую IP-цепочку', async () => {
    setup({ content: [postRow] })

    renderPage()

    expect(await screen.findByText('Бухгалтерия-1')).toBeTruthy()
    expect(screen.getByText('Веб-клиент')).toBeTruthy()
    expect(screen.getByText('9a8b7c6d')).toBeTruthy()
    expect(screen.getByText('webbuh-api-7f9c')).toBeTruthy()
    expect(screen.getByText('192.168.1.15 → 95.56.1.2')).toBeTruthy()
    expect(screen.getByText('Документ. Платежное поручение')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Платежное поручение № 12' })
    ).toHaveAttribute('href', '/documents/PlatezhnoePoruchenie/555')
  })

  it('отправляет выбранные события и отборы, сбрасывая страницу', async () => {
    setup({ totalPages: 3, totalElements: 120 })

    renderPage()
    await screen.findByText('Дорожкина Таисия')

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }))
    await waitFor(() => {
      expect(lastQuery()).toEqual(expect.objectContaining({ page: 1 }))
    })

    fireEvent.change(screen.getByLabelText('Пользователь'), {
      target: { value: 'Иванов Иван' },
    })
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'События' }))
    const listbox = await screen.findByRole('listbox')
    // Группы — с сервера, как в 1С.
    expect(within(listbox).getByText('Данные')).toBeTruthy()
    fireEvent.click(within(listbox).getByText('Проведение'))
    fireEvent.click(within(listbox).getByText('Отмена проведения'))
    fireEvent.keyDown(listbox, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }))

    await waitFor(() => {
      expect(lastQuery()).toEqual(
        expect.objectContaining({
          userLogin: 'Иванов Иван',
          actions: ['POST', 'UNPOST'],
          page: 0,
        })
      )
    })
    expect(lastQuery().from).toBeUndefined()
  })

  it('отбор из адресной строки применяется сразу и раскрывает «Ещё отборы»', async () => {
    setup()

    renderPage('/admin/audit?sessionId=abc&page=2')

    await screen.findByText('Дорожкина Таисия')
    expect(lastQuery()).toEqual(
      expect.objectContaining({ sessionId: 'abc', page: 2 })
    )
    expect(screen.getByLabelText('Сеанс')).toHaveValue('abc')
  })

  it('карточка события: все поля, полная цепочка, «было → стало» и быстрый отбор', async () => {
    setup({ content: [postRow] })

    renderPage()
    fireEvent.click(await screen.findByText('Бухгалтерия-1'))

    const card = await screen.findByRole('presentation')
    const scope = within(card)
    expect(scope.getByText('Событие журнала регистрации')).toBeTruthy()
    expect(scope.getByText('10.20.0.3')).toBeTruthy()
    expect(scope.getByText(/Шлюз перед сервером/)).toBeTruthy()
    expect(scope.getByText('Summa')).toBeTruthy()
    expect(scope.getByText('100')).toBeTruthy()
    expect(scope.getByText('250')).toBeTruthy()

    fireEvent.click(
      scope.getByRole('button', { name: 'Все события этого сеанса' })
    )

    await waitFor(() => {
      expect(lastQuery()).toEqual(
        expect.objectContaining({
          sessionId: '9a8b7c6d-1111-4222-8333-444455556666',
          page: 0,
        })
      )
    })
    // Быстрый отбор — только по сеансу: прежние условия не примешиваются.
    expect(lastQuery().userLogin).toBe('')
  })

  it('пустая лента — обычное состояние', async () => {
    setup({ content: [], totalElements: 0, totalPages: 0 })

    renderPage()

    expect(await screen.findByText('Записей нет')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Выгрузить в Excel' })
    ).toBeDisabled()
  })

  it('одна страница — постраничности нет', async () => {
    setup()

    renderPage()
    await screen.findByText('Дорожкина Таисия')

    expect(screen.queryByRole('button', { name: 'Вперёд' })).toBeNull()
  })

  it('отказ сервера показывается сообщением, а не пустым экраном', async () => {
    setup()
    getAuditLog.mockRejectedValue(new Error('нет сети'))

    renderPage()

    expect(
      await screen.findByText('Не удалось получить журнал. Повторите попытку')
    ).toBeTruthy()
  })

  it('сервер без справочника событий — отбор по событиям всё равно работает', async () => {
    setup()
    getAuditActions.mockRejectedValue(new Error('404'))

    renderPage()
    await screen.findByText('Дорожкина Таисия')

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'События' }))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('Отмена проведения')).toBeTruthy()
  })
})
