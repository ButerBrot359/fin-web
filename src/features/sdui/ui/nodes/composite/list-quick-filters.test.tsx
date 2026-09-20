import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

import { ListQuickFilters, readQuickFilters } from './list-quick-filters'

afterEach(cleanup)

const column = (
  field: string,
  title: string,
  extra: Record<string, unknown> = {}
): ViewNode =>
  ({
    id: `col.${field}`,
    type: 'TABLE_COLUMN',
    props: {
      title,
      filterField: field,
      filterOps: ['equals'],
      filterValueOptions: [{ value: '1', label: 'Первый' }],
      ...extra,
    },
  }) as unknown as ViewNode

const listNode = (quickFilterFields: unknown): ViewNode =>
  ({
    id: 'list',
    type: 'LIST',
    props: { quickFilterFields },
  }) as unknown as ViewNode

describe('Панель отбора списка', () => {
  it('поля панели собираются по quickFilterFields в порядке сервера', () => {
    const filters = readQuickFilters(
      listNode(['Organizatsiya', 'VidOtcheta']),
      [
        column('VidOtcheta', 'Вид отчёта'),
        column('Organizatsiya', 'Организация'),
      ],
      {}
    )

    expect(filters.map((f) => f.field)).toEqual(['Organizatsiya', 'VidOtcheta'])
    expect(filters[0].label).toBe('Организация')
  })

  it('подпись берётся из header колонки — сервер кладёт её именно туда', () => {
    // Колонка списка приходит с props.header (NodeProps.HEADER), без title/label: пока панель
    // читала только title, пользователь видел технический код поля («Organizatsiya»).
    const kolonkaSHeader = {
      id: 'col.Organizatsiya',
      type: 'TABLE_COLUMN',
      props: {
        header: 'Организация',
        filterField: 'Organizatsiya',
        filterOps: ['equals'],
        filterValueOptions: [{ value: '1', label: 'Первый' }],
      },
    } as unknown as ViewNode

    const [filtr] = readQuickFilters(
      listNode(['Organizatsiya']),
      [kolonkaSHeader],
      {}
    )

    expect(filtr.label).toBe('Организация')
  })

  it('операция берётся из filterDefaultOp, иначе — первая доступная', () => {
    const [sDefault] = readQuickFilters(
      listNode(['A']),
      [column('A', 'А', { filterDefaultOp: 'in' })],
      {}
    )
    const [bezDefault] = readQuickFilters(
      listNode(['B']),
      [column('B', 'Б')],
      {}
    )

    expect(sDefault.op).toBe('in')
    expect(bezDefault.op).toBe('equals')
  })

  it('поле без колонки рисуется по quickFilterMeta — отбор эталона может не быть колонкой', () => {
    // «Подразделение» у «Корректировки параметров учёта ОС»: в отборах формы 1С есть, среди
    // колонок списка нет. Метаданные такого поля сервер шлёт в props.quickFilterMeta.
    const spisok = {
      id: 'list',
      type: 'LIST',
      props: {
        quickFilterFields: ['Podrazdelenie'],
        quickFilterMeta: {
          Podrazdelenie: {
            header: 'Подразделение',
            filterField: 'Podrazdelenie',
            filterOps: ['equals'],
            filterValueOptions: [{ value: '1', label: 'Первый' }],
          },
        },
      },
    } as unknown as ViewNode

    const [filtr] = readQuickFilters(spisok, [], {})

    expect(filtr.field).toBe('Podrazdelenie')
    expect(filtr.label).toBe('Подразделение')
    expect(filtr.op).toBe('equals')
  })

  it('поле без своей колонки в панель не попадает — сервер и колонки разошлись', () => {
    const filters = readQuickFilters(listNode(['Net']), [column('A', 'А')], {})

    expect(filters).toEqual([])
  })

  it('без quickFilterFields панель пуста и ничего не рисует', () => {
    expect(
      readQuickFilters(listNode(undefined), [column('A', 'А')], {})
    ).toEqual([])

    const { container } = render(
      <ListQuickFilters filters={[]} onApply={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('подпись поля выводится рядом с контролом', () => {
    const filters = readQuickFilters(
      listNode(['Organizatsiya']),
      [column('Organizatsiya', 'Организация')],
      {}
    )

    render(<ListQuickFilters filters={filters} onApply={vi.fn()} />)

    expect(screen.getByText('Организация')).toBeInTheDocument()
  })
})
