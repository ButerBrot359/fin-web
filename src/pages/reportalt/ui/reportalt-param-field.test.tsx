import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'

import type { ReportAltParameterDto } from '../types/reportalt'
import { ReportAltParamField } from './reportalt-param-field'

const fetchOptionsMock =
  vi.fn<
    (args: {
      url: string
      params?: Record<string, unknown>
      search?: string
    }) => Promise<SelectOption[]>
  >()
vi.mock('@/features/sdui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchReferenceOptions: (args: {
    url: string
    params?: Record<string, unknown>
    search?: string
  }) => fetchOptionsMock(args),
}))

const fetchActiveMock = vi.fn()
const fetchByIdMock = vi.fn()
vi.mock('@/shared/lib/dictionary-entry/dictionary-entry-api', () => ({
  fetchDictionaryEntries: (...args: unknown[]) =>
    fetchActiveMock(...args) as unknown,
  fetchDictionaryEntryById: (...args: unknown[]) =>
    fetchByIdMock(...args) as unknown,
}))

afterEach(cleanup)

const programma: ReportAltParameterDto = {
  code: 'Programma',
  titleRu: 'Функциональная классификация расходов',
  dataType: 'DICTIONARY_REF',
  required: false,
  referenceDomain: 'FunktsionalnayaKlassifikatsiyaRaskhodov',
}

const renderField = (node: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  )
}

describe('ReportAltParamField — ссылка на большой справочник', () => {
  beforeEach(() => {
    fetchOptionsMock.mockReset()
    fetchActiveMock.mockReset()
    fetchByIdMock.mockReset()
  })

  it('не грузит справочник целиком, а ищет на сервере при открытии и вводе', async () => {
    fetchOptionsMock.mockResolvedValue([
      { id: 7, code: '7', label: '01 1 101 001 Программа' },
    ])
    const onChange = vi.fn()

    renderField(
      <ReportAltParamField param={programma} value="" onChange={onChange} />
    )

    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    await screen.findByText('01 1 101 001 Программа')
    expect(fetchActiveMock).not.toHaveBeenCalled()
    expect(fetchOptionsMock).toHaveBeenCalledWith({
      url: '/api/dictionary-entries/FunktsionalnayaKlassifikatsiyaRaskhodov/entries',
      params: undefined,
      search: undefined,
    })

    fireEvent.change(input, { target: { value: '101' } })
    await waitFor(() => {
      expect(fetchOptionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '101' })
      )
    })

    fireEvent.click(await screen.findByText('01 1 101 001 Программа'))
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('пока идёт запрос, показывает загрузку, а не «Нет вариантов»', async () => {
    let resolve: (v: SelectOption[]) => void = () => undefined
    fetchOptionsMock.mockReturnValue(
      new Promise<SelectOption[]>((r) => {
        resolve = r
      })
    )

    renderField(
      <ReportAltParamField param={programma} value="" onChange={vi.fn()} />
    )
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })

    expect(await screen.findByText('Загрузка...')).toBeTruthy()
    expect(screen.queryByText('Нет вариантов')).toBeNull()

    resolve([{ id: 7, code: '7', label: 'Программа' }])
    await screen.findByText('Программа')
  })

  it('подпись уже выбранного значения берёт по id, не открывая список', async () => {
    fetchByIdMock.mockResolvedValue({ id: 42, nameRu: 'Выбранная программа' })

    renderField(
      <ReportAltParamField param={programma} value={42} onChange={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe(
        'Выбранная программа'
      )
    })
    expect(fetchByIdMock).toHaveBeenCalledWith(42, expect.anything())
    expect(fetchOptionsMock).not.toHaveBeenCalled()
  })

  it('набранный поверх выбранного значения текст не стирается', async () => {
    fetchByIdMock.mockResolvedValue({ id: 42, nameRu: 'Выбранная программа' })
    fetchOptionsMock.mockResolvedValue([])

    renderField(
      <ReportAltParamField param={programma} value={42} onChange={vi.fn()} />
    )
    const input = screen.getByRole<HTMLInputElement>('combobox')
    await waitFor(() => {
      expect(input.value).toBe('Выбранная программа')
    })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '101' } })
    await waitFor(() => {
      expect(fetchOptionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '101' })
      )
    })
    expect(input.value).toBe('101')
  })
})
