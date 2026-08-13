import { type ReactElement, type RefObject } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { UseTableSyncResult } from '../hooks/use-table-sync'
import {
  buildColumnDefs,
  nodeToTableColumnDef,
  VERTICAL_SUB_ROW_HEIGHT,
} from './build-column-defs'
import { columnSizeProps } from './column-sizing'

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
  // Авто-cleanup RTL в проекте не включён (нет setupFiles) — убираем за собой
  // сами, иначе отрисованная шапка утекает в следующий describe.
  afterEach(cleanup)

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

  /**
   * Подписи под-строк. Содержимое под-строки — `ColumnHeaderLabel` (он держит
   * обрезку многоточием), поэтому текст берём из его пропа `label`, а не как
   * голую строку-child.
   */
  const renderedLabels = (header: unknown): string[] =>
    subRows(header).map(
      (row) =>
        (
          (row.props as { children: ReactElement }).children.props as {
            label: string
          }
        ).label
    )

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

    const { getByText } = render((defs[0].header as () => ReactElement)())
    expect(getByText('Предоставление вычета / основание')).toBeTruthy()
  })
})

// Маркер обязательности в шапке (SCRUM-329) поверх ColumnHeaderLabel: подпись
// рисуется через него ВСЕГДА (он держит обрезку многоточием — без неё длинный
// заголовок переносится и наезжает на соседний), а «*» добавляется только когда
// колонка required и не readonly.
describe('buildColumnDefs — required header marker', () => {
  // Без глобального setupFiles авто-cleanup RTL не включается: «*» от
  // предыдущего теста остался бы в document.body и queryByText('*') ниже
  // возвращал бы элемент вместо null.
  afterEach(cleanup)

  const syncRef = { current: null } as unknown as RefObject<UseTableSyncResult>

  function col(id: string, extra: Record<string, unknown>): ViewNode {
    return {
      id,
      type: 'TABLE_COLUMN',
      props: { label: id, ...extra },
    } as ViewNode
  }

  const renderHeader = (node: ViewNode) => {
    const header = buildColumnDefs([node], syncRef)[0].header
    expect(typeof header).toBe('function')
    return render((header as () => ReactElement)())
  }

  it('required && !readonly → label + «*»', () => {
    const { getByText } = renderHeader(col('c1', { required: true }))
    expect(getByText('c1')).toBeTruthy()
    expect(getByText('*')).toBeTruthy()
  })

  it('обычная колонка → только label, без «*»', () => {
    const { getByText, queryByText } = renderHeader(col('c2', {}))
    expect(getByText('c2')).toBeTruthy()
    expect(queryByText('*')).toBeNull()
  })

  it('required && readonly → без маркера', () => {
    const { getByText, queryByText } = renderHeader(
      col('c3', { required: true, readonly: true })
    )
    expect(getByText('c3')).toBeTruthy()
    expect(queryByText('*')).toBeNull()
  })
})

// Ширины колонок из контракта бэка доезжают до TableColumnDef и до ColumnDef.
describe('nodeToTableColumnDef / columnSizeProps — ширины', () => {
  const node = (props: Record<string, unknown>): ViewNode =>
    ({ id: 'tbl.col.a', type: 'TABLE_COLUMN', binding: 'a', props }) as ViewNode

  it('width/minWidth/resizable читаются из props', () => {
    const col = nodeToTableColumnDef(
      node({ label: 'A', width: 240, minWidth: 80, resizable: false })
    )
    expect(col.width).toBe(240)
    expect(col.minWidth).toBe(80)
    expect(col.resizable).toBe(false)
  })

  it('Long-строка приводится к числу, мусор отбрасывается', () => {
    expect(nodeToTableColumnDef(node({ width: '240' })).width).toBe(240)
    expect(nodeToTableColumnDef(node({ width: 0 })).width).toBeUndefined()
    expect(nodeToTableColumnDef(node({ width: 'wide' })).width).toBeUndefined()
    expect(nodeToTableColumnDef(node({})).minWidth).toBeUndefined()
  })

  it('columnSizeProps: minSize по умолчанию 40, enableResizing только при запрете', () => {
    expect(columnSizeProps({ width: 240 })).toEqual({ size: 240, minSize: 40 })
    expect(columnSizeProps({ width: 240, minWidth: 80 })).toEqual({
      size: 240,
      minSize: 80,
    })
    // Явного enableResizing:true быть не должно — он перекрыл бы мастер-выключатель
    // таблицы (enableColumnResizing) и включил бы ручки везде.
    expect(columnSizeProps({})).toEqual({ minSize: 40 })
    expect(columnSizeProps({ resizable: false })).toEqual({
      minSize: 40,
      enableResizing: false,
    })
  })

  it('buildColumnDefs прокидывает ширины в ColumnDef листовой колонки', () => {
    const syncRef = { current: null } as unknown as RefObject<UseTableSyncResult>
    const [def] = buildColumnDefs(
      [node({ label: 'A', width: 240, minWidth: 80, resizable: false })],
      syncRef
    )
    expect(def.size).toBe(240)
    expect(def.minSize).toBe(80)
    expect(def.enableResizing).toBe(false)
  })
})
