import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18next from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import { ItogiHierarchyTable } from './itogi-hierarchy-table'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof I18next>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ getValue: (k: string) => state[k] }),
  useBindingValue: (k?: string) => (k ? state[k] : undefined),
}))

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <span data-testid="toolbar-node">{node.id}</span>
  ),
}))

const column = (
  binding: string,
  label: string,
  dataType: string,
  props: Record<string, unknown> = {}
): ViewNode =>
  ({
    id: 'table.itogi.col.' + binding,
    type: 'TABLE_COLUMN',
    binding,
    props: { label, dataType, ...props },
  }) as unknown as ViewNode

const columns = [
  column('NomerPoPoryadku', '№ п/п', 'INTEGER'),
  column(
    'Derevo',
    'Физическое лицо\nПодразделение организации\nСотрудник\nВид начисления',
    'STRING'
  ),
  column('DerevoPravo', '\nПериод регистрации\nДолжность\n', 'STRING'),
  column('Nachisleno', 'Начислено', 'DECIMAL', { precision: 2 }),
  column('KVyplate', 'К выплате', 'DECIMAL', {
    precision: 2,
    textColor: '#0000FF',
  }),
]

const rowAppearance = JSON.stringify([
  { binding: '__stil', equals: 'L1', backgroundColor: '#E4F0DD' },
  { binding: '__stil', equals: 'L2', backgroundColor: '#F0F6EF' },
  { binding: '__stil', equals: 'L3', backgroundColor: '#F0F6EF' },
  { binding: '__stil', equals: 'ITOGO', backgroundColor: '#D6E5CB' },
])

const node = {
  id: 'table.itogi',
  type: 'TABLE',
  binding: 'Itogi',
  props: { hierarchical: true, rowAppearance },
  children: columns,
} as unknown as ViewNode

const asanov = 'FizicheskoeLitso:FizicheskoeLitso=3;'
const podrazdelenie = asanov + '/PodrazdeleniePeriod:1;'

const makeRows = () => [
  {
    rowId: asanov,
    __level: 0,
    __parentRowId: null,
    __stil: 'L1',
    __gruppirovka: 'FizicheskoeLitso',
    NomerPoPoryadku: 3,
    Derevo: 'Асанов Ринат Саинович',
    DerevoPravo: null,
    Nachisleno: 11896.8,
    KVyplate: 9422,
  },
  {
    rowId: podrazdelenie,
    __level: 1,
    __parentRowId: asanov,
    __stil: 'L2',
    __gruppirovka: 'PodrazdeleniePeriod',
    NomerPoPoryadku: null,
    Derevo: 'Альбина',
    DerevoPravo: '01.09.2026',
    Nachisleno: null,
    KVyplate: null,
  },
  {
    rowId: podrazdelenie + '/Sotrudnik:1;',
    __level: 2,
    __parentRowId: podrazdelenie,
    __stil: 'L3',
    __gruppirovka: 'SotrudnikDolzhnost',
    NomerPoPoryadku: null,
    Derevo: 'Асанов Ринат Саинович',
    DerevoPravo: 'ОХРАННИКИ',
    Nachisleno: 11896.8,
    KVyplate: 0,
  },
  {
    rowId: '__itogo',
    __level: 0,
    __parentRowId: null,
    __stil: 'ITOGO',
    __gruppirovka: 'Itogo',
    NomerPoPoryadku: null,
    Derevo: 'Итого',
    DerevoPravo: null,
    Nachisleno: 559146.8,
    KVyplate: 453494,
  },
]

const bodyRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr'))

describe('ItogiHierarchyTable — свод «Итоги»', () => {
  beforeEach(() => {
    cleanup()
    state.Itogi = makeRows()
  })

  it('при открытии свёрнуто до физлиц, «Итого» — последней строкой', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    const rows = bodyRows(container)
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Асанов Ринат Саинович')
    expect(rows[1].textContent).toContain('Итого')
  })

  it('суммы — в формате 1С, пустые и нулевые — пустой ячейкой', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    expect(screen.getByText('559 146,80')).toBeTruthy()
    expect(screen.getByText('453 494,00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    const podr = bodyRows(container)[1]
    const cells = Array.from(podr.querySelectorAll('td')).map(
      (td) => td.textContent
    )
    expect(cells).toEqual(['', '−Альбина', '01.09.2026', '', ''])
    const sotrudnik = bodyRows(container)[2]
    expect(sotrudnik.querySelectorAll('td')[4].textContent).toBe('')
  })

  it('раскрытие строки показывает её детей, повторный клик — прячет', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)

    fireEvent.click(screen.getByRole('button', { name: 'table.expandRow' }))
    expect(bodyRows(container)).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'table.collapseRow' }))
    expect(bodyRows(container)).toHaveLength(2)
  })

  it('«Развернуть» раскрывает все уровни, «Свернуть» — возвращает к физлицам', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)

    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    expect(bodyRows(container)).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'table.collapseAll' }))
    expect(bodyRows(container)).toHaveLength(2)
  })

  it('новое значение свода с сервера снова сворачивает его до физлиц', () => {
    const { container, rerender } = render(<ItogiHierarchyTable node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    expect(bodyRows(container)).toHaveLength(4)

    state.Itogi = makeRows()
    rerender(<ItogiHierarchyTable node={node} />)
    expect(bodyRows(container)).toHaveLength(2)
  })

  it('отступ в колонке-дереве растёт с уровнем', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    const indent = (i: number) =>
      (
        bodyRows(container)[i].querySelector('td[colspan], td:nth-child(2)')
          ?.firstElementChild as HTMLElement
      ).style.paddingLeft
    expect(indent(0)).toBe('0px')
    expect(indent(1)).toBe('12px')
    expect(indent(2)).toBe('24px')
  })

  it('шапка многострочная: суммы на всю высоту, «Вид начисления» с колонки номера', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    const headRows = container.querySelectorAll('thead tr')
    expect(headRows).toHaveLength(4)
    const nachisleno = screen.getByText('Начислено').closest('th')
    expect(nachisleno?.getAttribute('rowspan')).toBe('4')
    const vid = screen.getByText('Вид начисления').closest('th')
    expect(vid?.getAttribute('colspan')).toBe('3')
    expect(screen.getByText('Период регистрации')).toBeTruthy()
  })

  it('шапка закреплена при внутренней прокрутке', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    const thead = container.querySelector('thead')
    expect(getComputedStyle(thead!).position).toBe('sticky')
  })

  it('фон строки — по правилам rowAppearance и __stil', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    const [fiz, itogo] = bodyRows(container)
    expect(getComputedStyle(fiz).backgroundColor).toBe('rgb(228, 240, 221)')
    expect(getComputedStyle(itogo).backgroundColor).toBe('rgb(214, 229, 203)')
  })

  it('физлицо и «Итого» — жирным крупным, глубокие уровни — обычным мелким', () => {
    const { container } = render(<ItogiHierarchyTable node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.expandAll' }))
    const style = (i: number) =>
      getComputedStyle(bodyRows(container)[i].querySelector('td')!)
    expect(style(0).fontWeight).toBe('700')
    expect(style(0).fontSize).toBe('13px')
    expect(style(1).fontWeight).toBe('700')
    expect(style(1).fontSize).toBe('11px')
    expect(style(2).fontWeight).toBe('400')
    expect(style(3).fontWeight).toBe('700')
  })

  it('«К выплате» синим — и в строках, и в шапке', () => {
    render(<ItogiHierarchyTable node={node} />)
    const cell = screen.getByText('453 494,00').closest('td')
    expect(getComputedStyle(cell!).color).toBe('rgb(0, 0, 255)')
    const head = screen.getByText('К выплате').closest('th')
    expect(getComputedStyle(head!).color).toBe('rgb(0, 0, 255)')
  })

  it('суммы и номер — по правому краю', () => {
    render(<ItogiHierarchyTable node={node} />)
    const sum = screen.getByText('559 146,80').closest('td')
    expect(getComputedStyle(sum!).textAlign).toBe('right')
    const nomer = screen.getByText('3').closest('td')
    expect(getComputedStyle(nomer!).textAlign).toBe('right')
  })

  it('не-колоночные дети узла встают в командную строку после «Развернуть»', () => {
    const withToolbar = {
      ...node,
      children: [
        ...columns,
        { id: 'btn.itogi.sokhranitKak', type: 'BUTTON', props: {} },
        { id: 'field.sUchetomFKR', type: 'CHECKBOX', props: {} },
      ],
    } as unknown as ViewNode
    render(<ItogiHierarchyTable node={withToolbar} />)
    expect(
      screen.getAllByTestId('toolbar-node').map((n) => n.textContent)
    ).toEqual(['btn.itogi.sokhranitKak', 'field.sUchetomFKR'])
  })

  it('пустой свод показывает заглушку, а не падает', () => {
    state.Itogi = []
    render(<ItogiHierarchyTable node={node} />)
    expect(screen.getByText('table.empty')).toBeTruthy()
  })
})
