import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TreasuryExportTable } from './treasury-export-table'
import type { TreasuryExportPreviewRow } from '../types/treasury-export'

const rows: TreasuryExportPreviewRow[] = [
  {
    n: 1,
    documentId: 42,
    typeCode: 'ZayavkaNaRegistratsiyuGPSdelki',
    presentation: 'Заявка AAC00-00007',
    amount: 5000,
    errors: ['Не указан номер счета банка контрагента!'],
    fileName: 'ЗаявкаГПСAAC00-00007.xml',
  },
]

describe('TreasuryExportTable', () => {
  it('рендерит презентацию, имя файла и построчные ошибки', () => {
    render(<TreasuryExportTable rows={rows} />)
    expect(screen.getByText('Заявка AAC00-00007')).toBeTruthy()
    expect(screen.getByText('ЗаявкаГПСAAC00-00007.xml')).toBeTruthy()
    expect(
      screen.getByText(/Не указан номер счета банка контрагента!/)
    ).toBeTruthy()
  })
})
