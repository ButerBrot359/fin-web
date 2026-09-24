import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ReportResultView } from './report-result-view'
import type { ReportResultDto } from '@/pages/reports/report-list/types/report'

const ABZATS =
  '         Неиспользованные доверенности возвращаются на следующий день после истечения срока действия доверенности.'

const base: ReportResultDto = {
  reportCode: 'ZhurnalVydannykhDoverennostey',
  reportNameRu: 'Журнал выданных доверенностей',
  appliedParameters: {},
  columns: [{ code: 'NomerDoverennosti', titleRu: '№ доверенности' }],
  rows: [],
  total: {},
  layout: 'LEDGER',
} as unknown as ReportResultDto

describe('примечание под таблицей отчёта', () => {
  it('выводится после таблицы, абзац сохраняет отступ, как в макете 1С', () => {
    render(
      <ReportResultView
        result={
          {
            ...base,
            rows: [
              {
                level: 0,
                rowKind: 'DATA',
                cells: { NomerDoverennosti: 'ААН00-00001' },
                children: [],
              },
            ],
            noteLines: ['Примечание:', ABZATS],
          } as unknown as ReportResultDto
        }
      />
    )

    const blok = screen.getByTestId('report-note-lines')
    expect(screen.getByText('Примечание:')).toBeInTheDocument()
    const abzats = screen.getByText((_, el) => el?.textContent === ABZATS)
    expect(abzats).toHaveStyle({ whiteSpace: 'pre-wrap' })
    expect(blok).toContainElement(abzats)
    expect(
      screen.getByText('ААН00-00001').compareDocumentPosition(blok) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('без примечания блок не рисуется', () => {
    render(<ReportResultView result={base} />)

    expect(screen.queryByTestId('report-note-lines')).toBeNull()
  })
})
