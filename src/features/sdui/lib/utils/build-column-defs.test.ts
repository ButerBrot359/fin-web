import { type ReactElement, type RefObject } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { UseTableSyncResult } from '../hooks/use-table-sync'
import {
  buildColumnDefs,
  nodeToTableColumnDef,
  VERTICAL_SUB_ROW_HEIGHT,
} from './build-column-defs'

describe('nodeToTableColumnDef', () => {
  it('приоритет binding: node.binding > props.binding > node.id', () => {
    expect(
      nodeToTableColumnDef({
        id: 'c1',
        type: 'TABLE_COLUMN',
        binding: 'top',
      } as ViewNode).binding
    ).toBe('top')
    expect(
      nodeToTableColumnDef({
        id: 'c1',
        type: 'TABLE_COLUMN',
        props: { binding: 'inProps' },
      } as ViewNode).binding
    ).toBe('inProps')
    expect(
      nodeToTableColumnDef({ id: 'c1', type: 'TABLE_COLUMN' } as ViewNode)
        .binding
    ).toBe('c1')
  })
})

// Шапка VERTICAL-группы (frontend-spec-ipn-vertical-group-header.md §1): 1С показывает
// подписи под-колонок стопкой, по одной над своим редактором, а не единый заголовок группы.
describe('buildColumnDefs — шапка COLUMN_GROUP orientation=VERTICAL', () => {
  const syncRef = { current: null } as unknown as RefObject<UseTableSyncResult>

  const verticalGroup = (children: ViewNode[]): ViewNode =>
    ({
      id: 'colgroup.osnovaniePredostavlyat',
      type: 'COLUMN_GROUP',
      props: {
        label: 'Предоставление вычета / основание',
        orientation: 'VERTICAL',
      },
      children,
    }) as ViewNode

  /**
   * Под-строки, которые шапка реально отрисует (children корневого div).
   * Единственного ребёнка createElement кладёт в props.children НЕ массивом —
   * нормализуем, иначе кейс с одной видимой под-колонкой падал бы на .map.
   */
  const subRows = (header: unknown): ReactElement[] => {
    const element = (header as () => ReactElement)()
    const children = (
      element.props as { children: ReactElement | ReactElement[] }
    ).children
    return Array.isArray(children) ? children : [children]
  }

  const renderedLabels = (header: unknown): string[] =>
    subRows(header).map((row) => (row.props as { children: string }).children)

  it('рендерит подписи видимых под-колонок стопкой вместо label группы', () => {
    const defs = buildColumnDefs(
      [
        verticalGroup([
          {
            id: 'col.predostavlyat',
            type: 'TABLE_COLUMN',
            binding: 'PredostavlyatVychet',
            props: {
              label: 'Предоставлять вычет',
              cellWidget: 'CHECKBOX_FIELD',
            },
          } as ViewNode,
          {
            id: 'col.osnovanie',
            type: 'TABLE_COLUMN',
            binding: 'Osnovanie',
            props: { label: 'Основание', cellWidget: 'TEXT_FIELD' },
          } as ViewNode,
        ]),
      ],
      syncRef
    )

    expect(defs).toHaveLength(1)
    expect(typeof defs[0].header).toBe('function')
    // Порядок подписей = порядок под-колонок = порядок редакторов в ячейке.
    expect(renderedLabels(defs[0].header)).toEqual([
      'Предоставлять вычет',
      'Основание',
    ])
  })

  it('скрытая под-колонка не даёт подписи в шапке', () => {
    const defs = buildColumnDefs(
      [
        verticalGroup([
          {
            id: 'col.predostavlyat',
            type: 'TABLE_COLUMN',
            binding: 'PredostavlyatVychet',
            props: { label: 'Предоставлять вычет' },
          } as ViewNode,
          {
            id: 'col.hidden',
            type: 'TABLE_COLUMN',
            binding: 'Skrytaya',
            props: { label: 'Скрытая', visible: false },
          } as ViewNode,
        ]),
      ],
      syncRef
    )

    expect(renderedLabels(defs[0].header)).toEqual(['Предоставлять вычет'])
  })

  it('под-строки одной высоты, разделитель — между ними, а не сверху первой', () => {
    const defs = buildColumnDefs(
      [
        verticalGroup([
          {
            id: 'col.nachalo',
            type: 'TABLE_COLUMN',
            binding: 'PeriodDeystviyaNachalo',
            props: { label: 'Дата начала' },
          } as ViewNode,
          {
            id: 'col.konets',
            type: 'TABLE_COLUMN',
            binding: 'PeriodDeystviyaKonets',
            props: { label: 'Дата окончания' },
          } as ViewNode,
        ]),
      ],
      syncRef
    )

    const rows = subRows(defs[0].header)
    // Одинаковая высота под-строк в шапке и в ячейке — за счёт неё i-я подпись
    // встаёт над i-м редактором (сетка общая, VERTICAL_SUB_ROW_HEIGHT).
    for (const row of rows) {
      expect((row.props as { style: { height: number } }).style.height).toBe(
        VERTICAL_SUB_ROW_HEIGHT
      )
    }
    // Линия-разделитель как в 1С: только у второй под-строки, иначе получилась бы
    // лишняя черта под шапкой таблицы.
    const classNames = rows.map(
      (row) => (row.props as { className?: string }).className
    )
    expect(classNames[0]).toBeUndefined()
    expect(classNames[1]).toContain('border-t')
  })

  it('без подписей у под-колонок остаётся label группы — шапка не пустеет', () => {
    const defs = buildColumnDefs(
      [
        verticalGroup([
          { id: 'col.a', type: 'TABLE_COLUMN', binding: 'A' } as ViewNode,
          { id: 'col.b', type: 'TABLE_COLUMN', binding: 'B' } as ViewNode,
        ]),
      ],
      syncRef
    )

    expect(defs[0].header).toBe('Предоставление вычета / основание')
  })
})

// Маркер обязательности в шапке (SCRUM-329): RequiredMark вместо строки-label,
// когда колонка required и не readonly.
describe('buildColumnDefs — required header marker', () => {
  const syncRef = { current: null } as unknown as RefObject<UseTableSyncResult>

  function col(id: string, extra: Record<string, unknown>): ViewNode {
    return {
      id,
      type: 'TABLE_COLUMN',
      props: { label: id, ...extra },
    } as ViewNode
  }

  it('required && !readonly → header это render-функция, в ней label + «*»', () => {
    const defs = buildColumnDefs([col('c1', { required: true })], syncRef)
    const header = defs[0].header
    expect(typeof header).toBe('function')
    const { getByText } = render((header as () => ReactElement)())
    expect(getByText('*')).toBeTruthy()
  })

  it('обычная колонка → header это строка-label', () => {
    const defs = buildColumnDefs([col('c2', {})], syncRef)
    expect(defs[0].header).toBe('c2')
  })

  it('required && readonly → без маркера (строка)', () => {
    const defs = buildColumnDefs(
      [col('c3', { required: true, readonly: true })],
      syncRef
    )
    expect(defs[0].header).toBe('c3')
  })
})
