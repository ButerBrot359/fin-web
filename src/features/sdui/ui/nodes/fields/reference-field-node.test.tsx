import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ReferenceFieldNode } from './reference-field-node'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => mockDispatch }))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: vi.fn(),
}))

const fetchMock = vi.fn()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

describe('ReferenceFieldNode — кэш опций', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 1, code: '1', label: 'Запись 1' }])
    delete state.ref
  })

  it('после выбора значения кэш сбрасывается и следующий onOpen перезапрашивает опции', async () => {
    const node = {
      id: 'f1',
      type: 'REFERENCE_FIELD',
      binding: 'ref',
      props: { label: 'Ссылка', optionsSource: { url: '/api/test-options' } },
    } as unknown as ViewNode

    render(<ReferenceFieldNode node={node} />)
    const input = screen.getByRole('combobox')

    // Первое открытие: кэш пуст → запрос №1
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(await screen.findByText('Запись 1')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Выбор значения → applySelected (должен сбросить кэш опций)
    fireEvent.click(screen.getByText('Запись 1'))

    // Повторное открытие: кэш снова пуст → запрос №2
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
