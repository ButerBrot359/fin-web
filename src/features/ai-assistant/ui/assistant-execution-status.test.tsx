import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AiAssistantExecution } from '@/entities/ai-assistant'
import '@/app/config/i18n'
import { AssistantExecutionStatus } from './assistant-execution-status'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  resume: vi.fn(),
  refresh: vi.fn(),
  blob: vi.fn(),
  download: vi.fn(),
}))
vi.mock('@/entities/ai-assistant', () => ({
  aiAssistantApi: { getExecution: mocks.get, resumeExecution: mocks.resume },
}))
vi.mock('@/shared/lib/refresh/open-views-refresh', () => ({
  requestOpenViewsRefresh: mocks.refresh,
}))
vi.mock('@/shared/api/api', () => ({ apiService: { getFileBlob: mocks.blob } }))
vi.mock('@/shared/lib/xlsx/write-xlsx', () => ({
  downloadBlob: mocks.download,
}))

const execution = (
  patch: Partial<AiAssistantExecution> = {}
): AiAssistantExecution => ({
  id: 'execution-1',
  requestId: 'request-1',
  status: 'COMPLETED',
  steps: [],
  ...patch,
})
const draw = (value: AiAssistantExecution) => {
  mocks.get.mockResolvedValue(value)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const onOpenDocument = vi.fn()
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AssistantExecutionStatus
          execution={value}
          disabled={false}
          onOpenDocument={onOpenDocument}
        />
      </QueryClientProvider>
    </MemoryRouter>
  )
  return { onOpenDocument }
}

describe('AssistantExecutionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.refresh.mockResolvedValue({ deferred: 0, failed: 0 })
  })
  afterEach(cleanup)

  it('частичный результат показывает завершённые и заблокированные действия', async () => {
    const { onOpenDocument } = draw(
      execution({
        status: 'PARTIAL',
        steps: [
          {
            id: 'create',
            tool: 'CREATE_DOCUMENT',
            status: 'SUCCEEDED',
            output: { document: { typeCode: 'OperatsiyaBukh', entryId: 42 } },
          },
          {
            id: 'check',
            tool: 'CHECK_DOCUMENT',
            status: 'FAILED',
            error: { message: 'Не заполнен счёт' },
          },
          {
            id: 'post',
            tool: 'POST_DOCUMENT',
            status: 'SKIPPED',
            blockedBy: ['check'],
          },
        ],
      })
    )
    expect(screen.getByText('Выполнено частично')).toBeTruthy()
    expect(screen.getByText('Не заполнен счёт')).toBeTruthy()
    expect(screen.getByText('Зависит от: Проверка заполнения')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Открыть документ №42' })
    )
    expect(onOpenDocument).toHaveBeenCalledWith('OperatsiyaBukh', 42)
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1)
    })
  })

  it('не повторяет действие с неизвестным результатом', async () => {
    draw(
      execution({
        status: 'INDETERMINATE',
        steps: [
          { id: 'post', tool: 'POST_DOCUMENT', status: 'INDETERMINATE' },
          { id: 'edit', tool: 'UPDATE_DOCUMENT', status: 'PENDING' },
        ],
      })
    )
    expect(screen.getByText('Результат требует проверки')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Продолжить|Повторить/ })
    ).toBeNull()
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1)
    })
    expect(mocks.resume).not.toHaveBeenCalled()
  })

  it('продолжение оставшихся шагов требует нажатия пользователя', async () => {
    const value = execution({
      status: 'WAITING_TASK',
      steps: [{ id: 'post', tool: 'POST_DOCUMENT', status: 'WAITING_TASK' }],
    })
    draw(value)
    mocks.resume.mockResolvedValue(execution())
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1)
    })
    expect(mocks.resume).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Продолжить оставшиеся действия' })
    )
    await waitFor(() => {
      expect(mocks.resume).toHaveBeenCalledWith('execution-1', false)
    })
  })

  it('скачивает файл через защищённый API по id, не по URL из результата', async () => {
    const blob = new Blob(['report'])
    mocks.blob.mockResolvedValue({ data: blob })
    draw(
      execution({
        steps: [
          {
            id: 'export',
            tool: 'EXPORT_REPORT',
            status: 'SUCCEEDED',
            output: {
              artifact: {
                id: 'artifact-1',
                fileName: 'Отчёт.xlsx',
                downloadUrl: 'https://untrusted.invalid/file',
              },
            },
          },
        ],
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Отчёт.xlsx' }))
    await waitFor(() => {
      expect(mocks.download).toHaveBeenCalledWith(blob, 'Отчёт.xlsx')
    })
    expect(mocks.blob).toHaveBeenCalledWith({
      url: '/api/ai-assistant/artifacts/artifact-1',
    })
  })

  it('открывает расшифровку справочника по внутреннему маршруту', async () => {
    draw(
      execution({
        steps: [
          {
            id: 'drilldown',
            tool: 'DRILLDOWN_REPORT',
            status: 'SUCCEEDED',
            output: {
              reference: {
                domain: 'DICTIONARY',
                typeCode: 'Kontragenty',
                entryId: 42,
              },
              route: 'https://untrusted.invalid',
            },
          },
        ],
      })
    )
    expect(
      screen
        .getByRole('link', { name: 'Открыть запись справочника №42' })
        .getAttribute('href')
    ).toBe('/dictionaries/Kontragenty/42')
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1)
    })
  })

  it('не скрывает неполноту и ошибки пакетной проверки', async () => {
    draw(
      execution({
        steps: [
          {
            id: 'check',
            tool: 'BATCH_CHECK_DOCUMENTS',
            status: 'SUCCEEDED',
            output: {
              complete: false,
              checked: 30,
              invalid: 1,
              results: [
                {
                  entryId: 42,
                  valid: false,
                  issues: [{ message: 'Ошибка реквизита' }],
                },
              ],
            },
          },
        ],
      })
    )
    expect(
      screen.getByText('Результат неполный: доступны не все записи.')
    ).toBeTruthy()
    expect(screen.getByText('Проверено: 30')).toBeTruthy()
    expect(screen.getByText('Ошибка реквизита')).toBeTruthy()
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1)
    })
  })
})
