import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useRowOpen } from './use-row-open'

const mockDispatch = vi.fn<
  (action: unknown, behavior?: unknown) => Promise<boolean>
>(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const behavior = {
  flushPendingTables: false,
  resetsDirty: false,
  closeAfter: false,
}

// Свёртка «Итоги по работникам» Тарификации — первый и пока единственный
// потребитель: бэк точечно добавляет action при props.rowOpen у TABLE-узла.
const nodeWithOpen: ViewNode = {
  id: 'table.itogiPoRabotnikam',
  type: 'TABLE',
  binding: 'ItogiPoRabotnikam',
  props: { editable: true, rowOpen: true },
  actions: [
    { trigger: 'change', actionId: 'fieldEvent' },
    {
      trigger: 'activate',
      actionId: 'command',
      command: 'table.rowActivate:ItogiPoRabotnikam',
      behavior,
    },
    {
      trigger: 'open',
      actionId: 'command',
      command: 'table.rowOpen:ItogiPoRabotnikam',
      behavior,
    },
  ],
} as ViewNode

const nodeWithoutOpen: ViewNode = {
  id: 'table.grafikPlatezhey',
  type: 'TABLE',
  binding: 'GrafikPlatezhey',
  props: { editable: true },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
} as ViewNode

beforeEach(() => {
  mockDispatch.mockClear()
})

describe('useRowOpen', () => {
  it('шлёт готовую команду бэка с rowId (не id) и его behavior', () => {
    const { result } = renderHook(() => useRowOpen(nodeWithOpen))

    act(() => {
      result.current('3')
    })

    expect(mockDispatch).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'COMMAND',
        command: 'table.rowOpen:ItogiPoRabotnikam',
        value: { rowId: '3' },
      },
      behavior
    )
  })

  it('берёт команду из action.command, а не конструирует из имени таблицы', () => {
    const renamed = {
      ...nodeWithOpen,
      actions: [
        {
          trigger: 'open',
          actionId: 'command',
          command: 'tarifikatsiya.otkrytFormuStroki',
          behavior,
        },
      ],
    } as ViewNode
    const { result } = renderHook(() => useRowOpen(renamed))

    act(() => {
      result.current('3')
    })

    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      command: 'tarifikatsiya.otkrytFormuStroki',
    })
  })

  it('нет action с trigger=open → двойной клик запроса не порождает (§8 п.9)', () => {
    const { result } = renderHook(() => useRowOpen(nodeWithoutOpen))

    act(() => {
      result.current('3')
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('есть props.rowOpen, но action не пришёл → команду не конструируем', () => {
    const broken = {
      ...nodeWithoutOpen,
      props: { editable: true, rowOpen: true },
    } as ViewNode
    const { result } = renderHook(() => useRowOpen(broken))

    act(() => {
      result.current('3')
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('регресс-пин §2.6: повторный двойной клик по ТОЙ ЖЕ строке шлёт запрос СНОВА', () => {
    // Дедупа здесь нет намеренно — в отличие от useRowActivate. Пользователь
    // закрыл диалог и кликнул снова: окно обязано открыться. Тест валится, если
    // кто-то «оптимизирует» хук копипастой lastActivatedRef.
    const { result } = renderHook(() => useRowOpen(nodeWithOpen))

    act(() => {
      result.current('3')
    })
    act(() => {
      result.current('3')
    })
    act(() => {
      result.current('3')
    })

    expect(mockDispatch).toHaveBeenCalledTimes(3)
  })

  it('пустой rowId → не шлём (§3: сервер строку сам не определит)', () => {
    const { result } = renderHook(() => useRowOpen(nodeWithOpen))

    act(() => {
      result.current('')
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('undefined rowId → не шлём', () => {
    const { result } = renderHook(() => useRowOpen(nodeWithOpen))

    act(() => {
      result.current(undefined)
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // Guard — ДОПОЛНЕНИЕ к спеке (не её требование): onDoubleClick висит на <tr>
  // и всплывает из редакторов ячеек, где двойной клик — жест выделения слова.
  describe('guard: двойной клик внутри редактора ячейки', () => {
    it.each(['input', 'textarea', 'select'])(
      'цель — сам <%s> → команду не шлём',
      (tag) => {
        const { result } = renderHook(() => useRowOpen(nodeWithOpen))
        const target = document.createElement(tag)

        act(() => {
          result.current('3', { target })
        })

        expect(mockDispatch).not.toHaveBeenCalled()
      }
    )

    it('цель — узел ВНУТРИ contenteditable → команду не шлём', () => {
      const { result } = renderHook(() => useRowOpen(nodeWithOpen))
      const editor = document.createElement('div')
      editor.setAttribute('contenteditable', 'true')
      const inner = document.createElement('span')
      editor.appendChild(inner)

      act(() => {
        result.current('3', { target: inner })
      })

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('цель — обычная ячейка (readonly-колонка) → команду шлём', () => {
      const { result } = renderHook(() => useRowOpen(nodeWithOpen))
      const cell = document.createElement('td')

      act(() => {
        result.current('3', { target: cell })
      })

      expect(mockDispatch).toHaveBeenCalledTimes(1)
    })

    it('event не передан вовсе → команду шлём', () => {
      const { result } = renderHook(() => useRowOpen(nodeWithOpen))

      act(() => {
        result.current('3')
      })

      expect(mockDispatch).toHaveBeenCalledTimes(1)
    })
  })
})
