import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceCellEditor } from './reference-cell-editor'

const fetchMock = vi.fn<(...args: unknown[]) => Promise<SelectOption[]>>()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

const openPickerMock = vi.fn<(req: Record<string, unknown>) => void>()
vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: (req: Record<string, unknown>) => {
    openPickerMock(req)
  },
}))

// Вынесено из reference-cell-editor.test.tsx отдельным файлом — тот файл уже
// на лимите ~300 строк (CLAUDE.md), а этот кейс (SCRUM-332 §3) самодостаточен
// и не делит контекст ни с одним другим describe-блоком того файла.
describe('ReferenceCellEditor — rowFilter/__rowParentIds (SCRUM-332 §3)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 5, code: '5', label: 'ИПН 10%' }])
    openPickerMock.mockReset()
  })

  it('extraParams уходят в запрос опций (сужение по __rowParentIds)', async () => {
    render(
      <ReferenceCellEditor
        colProps={{
          optionsSource: { url: '/api/dictionary-entries/VidyVNA/entries' },
        }}
        extraParams={{ parent: '4711' }}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    await screen.findByText('ИПН 10%')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ parent: '4711' }),
      })
    )
  })
})
