import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import type { DocumentAttribute } from '@/entities/document-type'

import { buildDictColumns, mapDictColumns } from './dict-columns'
import type { DictColumnDto, DictEntry } from '../../api/dict-sidebar-api'

const t = ((k: string) => k) as unknown as TFunction

const entry = {
  id: 1,
  code: 'VVA-01',
  nameRu: 'Автомобильный транспорт',
  nameKz: 'Автомобиль көлігі',
  isActive: true,
  attributes: {
    SchetUcheta: { id: 900, code: '2350', nameRu: 'Транспортные средства' },
    Kontragent: { id: 7, code: 'K7', nameRu: 'ТОО Ромашка' },
  },
} as unknown as DictEntry

const renderCell = (node: ReactNode) => {
  render(<>{node}</>)
}

describe('dict-columns — счета показываются кодом (КБП-ПОК-ВИДВНА, «Показать все»)', () => {
  it('buildDictColumns: ссылка на счёт → code, прочая ссылка → имя', () => {
    const attrs = [
      {
        code: 'SchetUcheta',
        nameRu: 'Счёт учёта',
        nameKz: 'Есеп шоты',
        dataType: 'DICTIONARY',
        domainKind: 'ACCOUNT_PLAN',
        showInList: true,
        tableSortOrder: 1,
      },
      {
        code: 'Kontragent',
        nameRu: 'Контрагент',
        nameKz: 'Контрагент',
        dataType: 'DICTIONARY',
        domainKind: 'DICTIONARY',
        showInList: true,
        tableSortOrder: 2,
      },
    ] as unknown as DocumentAttribute[]

    const cols = buildDictColumns(attrs, 'VidyDolgosrochnykhAktivov', 'ru', t)
    const byId = (id: string) => cols.find((c) => c.id === id)!

    renderCell(byId('SchetUcheta').render(entry))
    expect(screen.getByText('2350')).toBeTruthy()
    expect(screen.queryByText('Транспортные средства')).toBeNull()

    renderCell(byId('Kontragent').render(entry))
    expect(screen.getByText('ТОО Ромашка')).toBeTruthy()
  })

  it('mapDictColumns: колонка с referencedDomainKind=ACCOUNT_PLAN → code', () => {
    const dtos: DictColumnDto[] = [
      {
        code: 'SchetUcheta',
        nameRu: 'Счёт учёта',
        dataType: 'DICTIONARY',
        referencedDomainKind: 'ACCOUNT_PLAN',
      },
      {
        code: 'Kontragent',
        nameRu: 'Контрагент',
        dataType: 'DICTIONARY',
        referencedDomainKind: 'DICTIONARY',
      },
    ]

    const cols = mapDictColumns(dtos, 'ru')
    const byId = (id: string) => cols.find((c) => c.id === id)!

    renderCell(byId('SchetUcheta').render(entry))
    expect(screen.getByText('2350')).toBeTruthy()

    renderCell(byId('Kontragent').render(entry))
    expect(screen.getByText('ТОО Ромашка')).toBeTruthy()
  })
})
