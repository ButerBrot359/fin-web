import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { flushAllPendingTableCommits } from '../pending-table-commits'
import { useTableSync } from './use-table-sync'

const mockDispatch =
  vi.fn<(action: Record<string, unknown>) => Promise<boolean>>()
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const sessionState: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))

const node = { id: 'tbl', type: 'TABLE', binding: 'rows' } as ViewNode

/** Последний action, ушедший в dispatch. */
function lastAction(): Record<string, unknown> | undefined {
  return mockDispatch.mock.calls.at(-1)?.[0]
}

describe('useTableSync', () => {
  // Автоочистки в проекте нет (в vitest.config нет setupFiles), а хук на
  // монтировании регистрируется в глобальном реестре flush'ей. Без явного
  // cleanup хуки прошлых тестов остаются смонтированными и участвуют в
  // flushAllPendingTableCommits соседнего теста.
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    delete sessionState.rows
    mockDispatch.mockReset()
    mockDispatch.mockResolvedValue(true)
  })

  it('не зацикливается, когда canon-значение отсутствует в сторе', () => {
    delete sessionState.rows
    // При баге C1 renderHook падает с "Maximum update depth exceeded"
    const { result, rerender } = renderHook(() => useTableSync(node, []))
    rerender()
    expect(result.current.rows).toEqual([])
  })

  it('flushPending отклоняется, если dispatch вернул false (ошибка сети)', async () => {
    delete sessionState.rows
    mockDispatch.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useTableSync(node, []))
    act(() => {
      result.current.updateCell('tmp-x', 'a', 1) // локальное изменение
    })
    await act(async () => {
      await expect(flushAllPendingTableCommits()).rejects.toThrow()
    })
  })

  it('commitCell шлёт table-level EVENT с fullSnapshot: true и полным массивом строк', () => {
    sessionState.rows = [{ rowId: '1', a: 1 }]
    const { result } = renderHook(() => useTableSync(node, []))
    act(() => {
      result.current.updateCell('1', 'a', 2)
    })
    act(() => {
      result.current.commitCell()
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'tbl',
      trigger: 'change',
      value: [{ rowId: '1', a: 2 }],
      fullSnapshot: true,
    })
  })

  it('addRow с presetValues проставляет значения поверх пустой строки', () => {
    sessionState.rows = []
    const columns = [
      {
        id: 'c1',
        label: 'Вычет',
        binding: 'VychetIPN',
        cellWidget: 'TEXT',
        dataType: 'STRING',
        readonly: true,
        props: {},
      },
    ]
    const { result } = renderHook(() => useTableSync(node, columns))
    act(() => {
      result.current.addRow(columns, { VychetIPN: 'key-A' })
    })
    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].VychetIPN).toBe('key-A')
  })

  // ── SCRUM-314 §6: правка ячейки ТЧ не должна теряться при записи ──
  //
  // Инвариант: flushPending() разрешается ТОЛЬКО когда серверу отправлен
  // актуальный локальный снимок. Каждый тест ниже — отдельный способ этот
  // инвариант нарушить; все три воспроизводились на живой форме.
  describe('flush-before-save не теряет правки (§6)', () => {
    it('ждёт правку, сделанную пока предыдущий commit был в полёте', async () => {
      sessionState.rows = [{ rowId: '1', months: 0, days: 0 }]

      // Первый EVENT «зависает» — ответ придёт, когда мы его отпустим руками.
      let releaseFirst: (ok: boolean) => void = () => undefined
      mockDispatch.mockImplementationOnce(
        () =>
          new Promise<boolean>((res) => {
            releaseFirst = res
          })
      )

      const { result } = renderHook(() => useTableSync(node, []))

      // 1–2. значение в первую ячейку, уход из неё → EVENT улетел
      act(() => {
        result.current.updateCell('1', 'months', 77)
      })
      act(() => {
        result.current.commitCell()
      })
      expect(mockDispatch).toHaveBeenCalledTimes(1)

      // 3. НЕ дожидаясь ответа — значение в соседнюю ячейку…
      act(() => {
        result.current.updateCell('1', 'days', 88)
      })

      // 4. …и сразу «Записать»
      let flushed = false
      const flush = flushAllPendingTableCommits().then(() => {
        flushed = true
      })

      await act(async () => {
        await Promise.resolve()
      })
      // Промис не имеет права разрешиться: 88 сервер ещё не видел.
      expect(flushed).toBe(false)

      // Приходит ответ на первый EVENT — вот теперь второй должен уехать.
      await act(async () => {
        releaseFirst(true)
        await flush
      })

      expect(flushed).toBe(true)
      expect(lastAction()).toMatchObject({
        type: 'EVENT',
        value: [{ rowId: '1', months: 77, days: 88 }],
      })
    })

    it('правка без commit-а уезжает на flush (ввод и сразу «Записать»)', async () => {
      sessionState.rows = [{ rowId: '1', a: 1 }]
      const { result } = renderHook(() => useTableSync(node, []))

      act(() => {
        result.current.updateCell('1', 'a', 42)
      })
      await act(async () => {
        await flushAllPendingTableCommits()
      })

      expect(mockDispatch).toHaveBeenCalledTimes(1)
      expect(lastAction()).toMatchObject({
        type: 'EVENT',
        value: [{ rowId: '1', a: 42 }],
      })
    })

    // Корневая причина §6. `statePatch` в контракте бэка (ViewResponseDto) —
    // ОПЦИОНАЛЬНОЕ зеркало: сервер вправе не прислать эхо таблицы. Тогда
    // canonRows не меняется и useEffect([canonRows]) не срабатывает вовсе.
    // Раньше на этом хук навсегда застревал «в полёте», а flush отваливался по
    // 5-секундному таймауту, унося правки. Фейковые таймеры здесь и есть гейт:
    // время НЕ двигаем, значит промис обязан разрешиться сам, без предохранителя.
    it('не виснет, когда сервер не прислал эхо таблицы', async () => {
      vi.useFakeTimers()
      sessionState.rows = [{ rowId: '1', a: 1 }]
      const { result } = renderHook(() => useTableSync(node, []))

      act(() => {
        result.current.updateCell('1', 'a', 2)
      })
      act(() => {
        result.current.commitCell()
      })

      // canon (sessionState.rows) намеренно не трогаем и не ре-рендерим.
      await act(async () => {
        await flushAllPendingTableCommits()
      })

      expect(mockDispatch).toHaveBeenCalledTimes(1)
      expect(lastAction()).toMatchObject({ value: [{ rowId: '1', a: 2 }] })
    })

    it('ошибка сети на in-flight EVENT роняет flush — «Записать» не выполнится', async () => {
      sessionState.rows = [{ rowId: '1', a: 1 }]

      let releaseFirst: (ok: boolean) => void = () => undefined
      mockDispatch.mockImplementationOnce(
        () =>
          new Promise<boolean>((res) => {
            releaseFirst = res
          })
      )

      const { result } = renderHook(() => useTableSync(node, []))
      act(() => {
        result.current.updateCell('1', 'a', 2)
      })
      act(() => {
        result.current.commitCell()
      })

      const flush = flushAllPendingTableCommits()
      await act(async () => {
        releaseFirst(false)
        await expect(flush).rejects.toThrow()
      })
    })

    it('регресс: две правки с ожиданием ответа между ними — доезжают обе', async () => {
      sessionState.rows = [{ rowId: '1', months: 0, days: 0 }]
      const { result, rerender } = renderHook(() => useTableSync(node, []))

      act(() => {
        result.current.updateCell('1', 'months', 77)
      })
      await act(async () => {
        result.current.commitCell()
        // Спускаем микротаски: .then(dispatch) → drain() отрабатывает здесь.
        await Promise.resolve()
      })

      // Канон от сервера: правка принята.
      sessionState.rows = [{ rowId: '1', months: 77, days: 0 }]
      act(() => {
        rerender()
      })

      act(() => {
        result.current.updateCell('1', 'days', 88)
      })
      await act(async () => {
        result.current.commitCell()
        // Спускаем микротаски: .then(dispatch) → drain() отрабатывает здесь.
        await Promise.resolve()
      })

      expect(lastAction()).toMatchObject({
        value: [{ rowId: '1', months: 77, days: 88 }],
      })

      // Ничего не осталось несинхронизированным — flush резолвится сразу.
      await act(async () => {
        await flushAllPendingTableCommits()
      })
    })
  })
})
