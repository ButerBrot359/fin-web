import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReportResultDto } from '@/pages/reports/report-list/types/report'

import { ReportResultView } from './report-result-view'

afterEach(cleanup)

const PREAMBULA = [
  'Приложение 57',
  'к приказу Министра финансов',
  'Республики Казахстан',
  'от 22 апреля 2025 года № 187',
  '',
  'Форма № 417',
]

const PRAVYY_BLOK = {
  side: 'RIGHT' as const,
  lines: PREAMBULA,
  underline: false,
  caption: null,
}

const blank = (
  headerBlocks: ReportResultDto['headerBlocks']
): ReportResultDto =>
  ({
    reportCode: 'LitsevoySchet417Forma',
    reportNameRu: 'Лицевой счёт (ф.417)',
    appliedParameters: {},
    columns: [],
    rows: [],
    total: {},
    layout: 'FORM',
    headerBlocks,
    form: {
      title: 'Карточка-справка (Лицевой счет)',
      sections: [
        {
          columns: [{ code: 'IIN', titleRu: 'ИИН' }],
          rows: [{ level: 0, cells: { IIN: '810627450137' } }],
        },
      ],
    },
  }) as unknown as ReportResultDto

describe('бланк FORM — блок «Приложение N к приказу» над бланком', () => {
  it('выводится справа над бланком, как в макете 1С', () => {
    render(<ReportResultView result={blank([PRAVYY_BLOK])} />)

    const prilozhenie = screen.getByText('Приложение 57')
    expect(screen.getByText('от 22 апреля 2025 года № 187')).toBeTruthy()
    expect(screen.getByText('Форма № 417')).toBeTruthy()
    expect(
      prilozhenie.compareDocumentPosition(
        screen.getByText('Карточка-справка (Лицевой счет)')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('стоит на белом листе бланка вместе с формой, а не на фоне страницы', () => {
    render(<ReportResultView result={blank([PRAVYY_BLOK])} />)

    const list = screen.getByTestId('report-form-blank')
    expect(list).toHaveClass('bg-white')
    expect(list).toContainElement(screen.getByText('Приложение 57'))
    expect(list).toContainElement(
      screen.getByText('Карточка-справка (Лицевой счет)')
    )
  })

  it('пустая строка блока остаётся видимым отступом перед номером формы', () => {
    render(<ReportResultView result={blank([PRAVYY_BLOK])} />)

    const forma = screen.getByText('Форма № 417')
    expect(forma.previousElementSibling?.textContent).toBe(' ')
  })

  it('без блоков бланк рендерится как раньше', () => {
    render(<ReportResultView result={blank([])} />)

    expect(screen.queryByText('Приложение 57')).toBeNull()
    expect(screen.getByText('810627450137')).toBeTruthy()
  })
})
