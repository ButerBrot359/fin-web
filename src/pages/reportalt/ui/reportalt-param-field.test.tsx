import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReportAltParameterDto } from '../types/reportalt'

import { ReportAltParamField } from './reportalt-param-field'

vi.mock('@/entities/account-plan', () => ({
  SUBCONTO_BU_TYPE_CODE: 'VidySubcontoBu',
  useAccountPlanList: () => ({ entries: [] }),
  useSubcontoBuTypes: () => ({ subcontoTypes: [] }),
}))

vi.mock('@/shared/lib/dictionary-entry/use-dictionary-entries', () => ({
  useDictionaryEntries: () => ({
    entries: [
      { id: 1, code: '1', nameRu: 'Отдел финансов' },
      { id: 2, code: '2', nameRu: 'Аппарат акима' },
    ],
  }),
}))

vi.mock('@/features/sdui', () => ({
  fetchReferenceOptions: vi.fn(),
  useReferenceOptions: () => ({ options: [] }),
}))

afterEach(cleanup)

const param = {
  code: 'Organizatsiya',
  titleRu: 'Организация',
  dataType: 'REF_LIST',
  required: false,
  referenceDomain: 'Organizatsii',
  allowedValues: [],
} as unknown as ReportAltParameterDto

describe('ReportAltParamField — множественный выбор', () => {
  it('«Отметить все» отмечает все организации списка, «Снять все» очищает выбор', () => {
    const onChange = vi.fn()
    render(
      <ReportAltParamField param={param} value={[2]} onChange={onChange} />
    )

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('inputs.checkAll'))
    expect(onChange).toHaveBeenLastCalledWith([2, 1])

    fireEvent.click(screen.getByText('inputs.uncheckAll'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})
