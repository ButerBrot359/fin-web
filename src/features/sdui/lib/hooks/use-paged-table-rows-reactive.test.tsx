import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useViewStateStore } from '../stores/view-state-store'
import { usePagedTableRows } from './use-paged-table-rows'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const node: ViewNode = { id: 't', type: 'TABLE', binding: 'rows' }

// Настоящий стор корневой формы, без мока сессии: строки, пришедшие мимо
// dispatch формы (ретрансляция «Применить» из диалога в родителя пишет
// setFromServer напрямую), обязаны перерисовать таблицу. Раньше хук читал
// state через getValue без подписки — таблица правил конструктора отчётности
// показывала старую строку до перезагрузки страницы (highload, 03.10.2026).
describe('usePagedTableRows — подписка на строки state', () => {
  beforeEach(() => {
    useViewStateStore
      .getState()
      .replaceAll({ rows: [{ rowId: 'r1', znak: 'минус' }] })
  })

  it('setFromServer по binding таблицы перерисовывает строки', () => {
    const { result } = renderHook(() => usePagedTableRows(node), { wrapper })
    expect(result.current.rows).toEqual([{ rowId: 'r1', znak: 'минус' }])

    act(() => {
      useViewStateStore
        .getState()
        .setFromServer('rows', [{ rowId: 'r1', znak: 'плюс' }])
    })

    expect(result.current.rows).toEqual([{ rowId: 'r1', znak: 'плюс' }])
  })
})
