import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ColumnMetaDto } from '@/shared/lib/eav'

import { ValueControl } from './value-controls'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))

const values = [
  {
    id: 31,
    code: 'PerechisleniePostavshchiku',
    name: 'Перечисление поставщику',
  },
  { id: 42, code: 'ProcheePerechislenie', name: 'Прочее перечисление' },
]

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(() => Promise.resolve({ data: values })) },
}))

const column: ColumnMetaDto = {
  code: 'VidOperatsii',
  nameRu: 'Вид операции',
  dataType: 'ENUMS',
  isSystem: false,
  referencedTypeCode: 'VidyOperatsiySchetKOplate',
  referencedDomainKind: 'ENUMS',
  allowedOps: ['eq', 'ne'],
}

const renderControl = (onChange = vi.fn()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ValueControl
        column={column}
        op="eq"
        value={undefined}
        onChange={onChange}
      />
    </QueryClientProvider>
  )
  return onChange
}

describe('ValueControl / ENUMS', () => {
  afterEach(cleanup)

  it('выбор значения из списка уходит в onChange объектом {id, code, label}', async () => {
    const onChange = renderControl()

    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.mouseDown(screen.getByRole('combobox'))

    const option = await screen.findByText('Прочее перечисление')
    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith({
      id: 42,
      code: 'ProcheePerechislenie',
      label: 'Прочее перечисление',
    })
  })
})
