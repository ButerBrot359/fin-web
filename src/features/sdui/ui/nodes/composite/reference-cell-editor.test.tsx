import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceCellEditor } from './reference-cell-editor'

const fetchMock = vi.fn<(...args: unknown[]) => Promise<SelectOption[]>>()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

describe('ReferenceCellEditor', () => {
  afterEach(cleanup)

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 5, code: '5', label: 'ИПН 10%' }])
  })

  it('выбор опции → onChange({id, presentation}) + onCommit', async () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <ReferenceCellEditor
        colProps={{
          optionsSource: { url: '/api/dictionary-entries/VychetyIPN/entries' },
        }}
        value={null}
        onChange={onChange}
        onCommit={onCommit}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByText('ИПН 10%'))
    expect(onChange).toHaveBeenCalledWith({ id: 5, presentation: 'ИПН 10%' })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('текущее значение показывает presentation, не объект', () => {
    render(
      <ReferenceCellEditor
        colProps={{ optionsSource: { url: '/x' } }}
        value={{ id: '5', presentation: 'ИПН 10%' }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    )
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
      'ИПН 10%',
    )
  })

  it('без optionsSource и targetTypeCode — нейтральное отображение, не падает', () => {
    render(
      <ReferenceCellEditor
        colProps={{}}
        value={{ id: 1, presentation: 'Значение' }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    )
    expect(screen.getByText('Значение')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
