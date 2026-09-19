import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ReportResultView } from './report-result-view'
import type { ReportResultDto } from '@/pages/reports/report-list/types/report'

const base: ReportResultDto = {
  reportCode: 'Forma420',
  reportNameRu: 'Сводный отчёт по расходам (Форма 4-20)',
  appliedParameters: {},
  columns: [{ code: 'Naimenovanie', titleRu: 'Наименование' }],
  rows: [],
  total: {},
  layout: 'LEDGER',
} as unknown as ReportResultDto

describe('подписи приказного бланка', () => {
  it('две колонки и «М.П.»: слева казначейство, справа учреждение', () => {
    render(
      <ReportResultView
        result={{
          ...base,
          footerBlocks: [
            {
              role: 'Руководитель территориального подразделения казначейства',
              name: '',
              captions: ['(подпись)', '(ФИО)'],
              side: 'LEFT',
              stampAfter: true,
            },
            {
              role: 'Ответственный исполнитель',
              name: '',
              captions: ['(подпись)', '(ФИО)'],
              side: 'LEFT',
            },
            {
              role: 'Руководитель ГУ',
              name: 'Троеглазова Н.В.',
              captions: ['(подпись)', '(ФИО)'],
              side: 'RIGHT',
              stampAfter: true,
            },
            {
              role: 'Главный бухгалтер ГУ',
              name: 'Скорикова С.Н.',
              captions: ['(подпись)', '(ФИО)'],
              side: 'RIGHT',
            },
          ],
        }}
      />
    )

    expect(
      screen.getByText(
        /Руководитель территориального подразделения казначейства/
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Главный бухгалтер ГУ/)).toBeInTheDocument()
    expect(screen.getByText(/Скорикова С.Н./)).toBeInTheDocument()
    // «М.П.» — по одному на колонку.
    expect(screen.getAllByText('М.П.')).toHaveLength(2)
  })

  it('печатаются обе подписи, когда их две', () => {
    render(
      <ReportResultView
        result={{
          ...base,
          footerBlocks: [
            {
              role: 'Руководитель ГУ',
              name: 'Троеглазова Н.В.',
              captions: ['(подпись)', '(ФИО)'],
            },
            {
              role: 'Главный бухгалтер ГУ',
              name: 'Скорикова С.Н.',
              captions: ['(подпись)', '(ФИО)'],
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/Руководитель ГУ/)).toBeInTheDocument()
    expect(screen.getByText(/Троеглазова Н.В./)).toBeInTheDocument()
    expect(screen.getByText(/Главный бухгалтер ГУ/)).toBeInTheDocument()
    expect(screen.getByText(/Скорикова С.Н./)).toBeInTheDocument()
  })

  it('одиночная подпись прежнего контракта продолжает работать', () => {
    render(
      <ReportResultView
        result={{
          ...base,
          footerBlock: {
            role: 'Главный бухгалтер',
            name: 'Иванов И.И.',
            captions: ['(подпись)', '(ФИО)'],
          },
        }}
      />
    )

    expect(screen.getByText(/Главный бухгалтер/)).toBeInTheDocument()
    expect(screen.getByText(/Иванов И.И./)).toBeInTheDocument()
  })
})
