import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { afterEach, describe, expect, it } from 'vitest'

import { zoomAwareResizeHandler } from './zoom-aware-resize-handler'

const columns: ColumnDef<{ name: string }>[] = [
  { accessorKey: 'name', header: 'Имя', size: 200 },
]

const Table = () => {
  const table = useReactTable({
    data: [{ name: 'А' }],
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  })
  const header = table.getHeaderGroups()[0].headers[0]
  return (
    <div>
      <div
        data-testid="handle"
        onMouseDown={zoomAwareResizeHandler(header)}
        onTouchStart={zoomAwareResizeHandler(header)}
      />
      <span data-testid="size">{header.getSize()}</span>
    </div>
  )
}

const setZoom = (zoom: number | undefined) => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  if (zoom == null) Reflect.deleteProperty(proto, 'currentCSSZoom')
  else
    Object.defineProperty(proto, 'currentCSSZoom', {
      configurable: true,
      get: () => zoom,
    })
}

afterEach(() => {
  setZoom(undefined)
  cleanup()
})

const drag = (from: number, to: number) => {
  fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: from })
  fireEvent.mouseMove(document, { clientX: to })
  fireEvent.mouseUp(document, { clientX: to })
}

describe('zoomAwareResizeHandler', () => {
  it('без масштаба ширина меняется ровно на сдвиг курсора', () => {
    render(<Table />)

    drag(100, 150)

    expect(screen.getByTestId('size').textContent).toBe('250')
  })

  it('при масштабе 150% сдвиг курсора переводится в px таблицы', () => {
    setZoom(1.5)
    render(<Table />)

    drag(100, 250)

    expect(screen.getByTestId('size').textContent).toBe('300')
  })

  it('после отпускания слушатели документа сняты', () => {
    setZoom(1.5)
    render(<Table />)

    drag(100, 250)
    fireEvent.mouseMove(document, { clientX: 400 })

    expect(screen.getByTestId('size').textContent).toBe('300')
  })

  it('касание при масштабе тоже переводится в px таблицы', () => {
    setZoom(2)
    render(<Table />)

    fireEvent.touchStart(screen.getByTestId('handle'), {
      touches: [{ clientX: 100 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(document, { touches: [] })

    expect(screen.getByTestId('size').textContent).toBe('300')
  })
})
