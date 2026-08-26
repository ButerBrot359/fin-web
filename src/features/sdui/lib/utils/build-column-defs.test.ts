import { type ReactElement, type RefObject } from 'react'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CellContext } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import type { TableRow, UseTableSyncResult } from '../hooks/use-table-sync'
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

  // В ЯЧЕЙКЕ высота под-строки минимальная, а не жёсткая: перенесённое на вторую
  // строку readonly-значение иначе легло бы поверх разделителя и соседней
  // под-строки. В шапке высота остаётся жёсткой (тест выше).
  it('под-строки ЯЧЕЙКИ держат minHeight, а не height', () => {
    const defs = buildColumnDefs(
      [
        verticalGroup([
          {
            id: 'col.a',
            type: 'TABLE_COLUMN',
            binding: 'A',
            props: { label: 'А', cellWidget: 'TEXT_FIELD' },
          } as ViewNode,
          {
            id: 'col.b',
            type: 'TABLE_COLUMN',
            binding: 'B',
            props: { label: 'Б', cellWidget: 'TEXT_FIELD' },
          } as ViewNode,
        ]),
      ],
      syncRef
    )

    const cell = defs[0].cell as (
      info: CellContext<TableRow, unknown>
    ) => ReactElement
    // Строка — с явным типом TableRow: у литерала в месте приведения тип узкий
    // ({rowId; A; B}), и `as CellContext` на него уже не проходит — перекрытия
    // с CellContext нет ни в одну сторону.
    const original: TableRow = { rowId: '1', A: 'a', B: 'b' }
    // subRows ждёт render-функцию (как TanStack `header`), ячейке же контекст
    // передаём сами — оборачиваем результат.
    const rows = subRows(() =>
      cell({ row: { original } } as CellContext<TableRow, unknown>)
    )
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const style = row.props as {
        style: { height?: number; minHeight?: number }
      }
      expect(style.style.minHeight).toBe(VERTICAL_SUB_ROW_HEIGHT)
      expect(style.style.height).toBeUndefined()
    }
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
    const syncRef = {
      current: null,
    } as unknown as RefObject<UseTableSyncResult>
    const [def] = buildColumnDefs(
      [node({ label: 'A', width: 240, minWidth: 80, resizable: false })],
      syncRef
    )
    expect(def.size).toBe(240)
    expect(def.minSize).toBe(80)
    expect(def.enableResizing).toBe(false)
  })
})

// Условное состояние строки: бэк помечает ячейки служебными ключами
// `__requiredCells` / `__readonlyCells` / `__rowReadonly` (например, «Код
// платных услуг» обязателен при источнике «Деньги от реализации…» и недоступен
// при любом другом). Колоночные props.required/readonly этого не выражают —
// они пометили бы и строки с бюджетным источником.
describe('buildColumnDefs — условное состояние ячейки', () => {
  // Авто-cleanup RTL в проекте не включён (нет setupFiles) — как в тестах выше.
  afterEach(cleanup)

  // Здесь ячейка реально рендерится и получает blur — в отличие от тестов шапки,
  // sync-колбэки вызываются, поэтому нужны заглушки, а не null.
  const syncRef = {
    current: { updateCell: () => undefined, commitCell: () => undefined },
  } as unknown as RefObject<UseTableSyncResult>
  const ERR = '[data-required-error="true"]'

  const columnNode = {
    id: 'col.kodPlatnykhUslug',
    type: 'TABLE_COLUMN',
    binding: 'KodPlatnykhUslug',
    props: { label: 'Код платных услуг', cellWidget: 'TEXT_FIELD' },
  } as ViewNode

  /** Ячейка колонки для конкретной строки — как её отрисует TanStack. */
  const renderCell = (row: TableRow) => {
    const defs = buildColumnDefs([columnNode], syncRef)
    const cell = defs[0].cell as (
      info: CellContext<TableRow, unknown>
    ) => ReactElement
    return render(
      cell({ row: { original: row } } as CellContext<TableRow, unknown>)
    )
  }

  it('строка с ключом → пустая ячейка подсвечивается как обязательная', () => {
    const { container } = renderCell({
      rowId: '1',
      KodPlatnykhUslug: '',
      __requiredCells: ['KodPlatnykhUslug'],
    })
    fireEvent.blur(container.querySelector('input, textarea')!)
    expect(container.querySelector(ERR)).toBeTruthy()
  })

  it('соседняя строка без ключа → та же колонка не обязательна', () => {
    const { container } = renderCell({ rowId: '2', KodPlatnykhUslug: '' })
    fireEvent.blur(container.querySelector('input, textarea')!)
    expect(container.querySelector(ERR)).toBeNull()
  })

  it('ключ не превращается в колонку — колонки только из ViewNode', () => {
    const defs = buildColumnDefs([columnNode], syncRef)
    expect(defs.map((d) => d.id)).toEqual(['col.kodPlatnykhUslug'])
  })

  // Недоступная ячейка рендерится как текст: readonly-ветка TableCellEditor
  // отдаёт span, а не редактор — вводить в неё нечего.
  it('binding в __readonlyCells → ячейка без редактора', () => {
    const { container } = renderCell({
      rowId: '1',
      KodPlatnykhUslug: 'Услуга',
      __readonlyCells: ['KodPlatnykhUslug'],
    })
    expect(container.querySelector('input, textarea')).toBeNull()
    expect(container.textContent).toContain('Услуга')
  })

  it('__rowReadonly → ячейка без редактора даже без списка колонок', () => {
    const { container } = renderCell({
      rowId: '1',
      KodPlatnykhUslug: '',
      __rowReadonly: true,
    })
    expect(container.querySelector('input, textarea')).toBeNull()
  })

  // §3.3: взаимоисключающих комбинаций бэк не присылает, но правило должно
  // давать тот же результат — рамки обязательности у заблокированной нет.
  it('readonly сильнее required', () => {
    const { container } = renderCell({
      rowId: '1',
      KodPlatnykhUslug: '',
      __requiredCells: ['KodPlatnykhUslug'],
      __readonlyCells: ['KodPlatnykhUslug'],
    })
    expect(container.querySelector('input, textarea')).toBeNull()
    expect(container.querySelector(ERR)).toBeNull()
  })

  it('соседняя строка без ключей остаётся редактируемой', () => {
    const { container } = renderCell({ rowId: '2', KodPlatnykhUslug: '' })
    expect(container.querySelector('input, textarea')).toBeTruthy()
  })
})
