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

  it('строки подвала — между таблицей и подписями, примечание — после подписей', () => {
    render(
      <ReportResultView
        result={
          {
            ...base,
            footerLines: ['Всего: Сто тенге 00 тиын', 'Основание:'],
            footerBlocks: [
              {
                role: 'Руководитель:',
                name: 'Иванов И.И.',
                captions: ['(подпись)', '(ФИО)'],
              },
            ],
            noteLines: ['Примечание:'],
          } as unknown as ReportResultDto
        }
      />
    )

    const podval = screen.getByTestId('report-footer-lines')
    const podpis = screen.getByText('Руководитель:')
    const primechanie = screen.getByTestId('report-note-lines')
    expect(podval).toHaveTextContent('Всего: Сто тенге 00 тиын')
    expect(
      podval.compareDocumentPosition(podpis) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      podpis.compareDocumentPosition(primechanie) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
