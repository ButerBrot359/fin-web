import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Экземпляр i18next инициализирует app-конфиг по цепочке импортов
// сетки (shared/lib/utils → app/config/i18n) — в тесте тот же синглтон.
import i18n from 'i18next'

import type { ViewAction } from '../../../../types/view'
import { buildGenerationEvent } from '../../../../lib/hooks/use-generation-command-queue'
import { useReportSheetActions } from './use-report-sheet-actions'
import { RICH_PAYLOAD } from './report-sheet-fixtures'

// Сессия отдаёт текущий payload; dispatch — контролируемый мок, который
// «применяет патч» ответа: новый ПОЛНЫЙ payload со следующей generation.
const state: { payload: Record<string, unknown> } = { payload: {} }
const dispatched: ViewAction[] = []
let resolveDispatch: (() => void) | null = null

vi.mock('../../../../lib/dispatch', () => ({
  useSduiDispatch: () => (action: ViewAction) => {
    dispatched.push(action)
    if (action.type === 'COMMAND') return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      resolveDispatch = () => {
        state.payload = {
          ...state.payload,
          generation: (state.payload.generation as number) + 1,
        }
        resolve(true)
      }
    })
  },
}))

vi.mock('../../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ getValue: () => state.payload }),
}))

const toasts: string[] = []
vi.mock('@/shared/ui/toast/show-toast', () => ({
  showToast: (_level: string, message: string) => {
    toasts.push(message)
  },
}))

const flush = () => new Promise((r) => setTimeout(r, 0))

const renderActions = () =>
  renderHook(() => useReportSheetActions('table.reportSheet', 'ReportSheet'))

describe('useReportSheetActions: EDIT_CELL (report-sheet/v1)', () => {
  beforeEach(() => {
    state.payload = structuredClone(RICH_PAYLOAD)
    dispatched.length = 0
    toasts.length = 0
    resolveDispatch = null
  })

  it('EVENT change на сам узел: адрес ячейки, decimal-строка, baseGeneration из payload', async () => {
    const { result } = renderActions()
    const p = result.current.editCell(
      { pokazatelId: 4501, indeks: 0 },
      '123,45'
    )
    await flush()

    expect(dispatched).toEqual([
      {
        type: 'EVENT',
        sourceNodeId: 'table.reportSheet',
        trigger: 'change',
        value: {
          type: 'EDIT_CELL',
          pokazatelId: 4501,
          indeks: 0,
          value: '123.45',
          baseGeneration: 7,
        },
      },
    ])
    resolveDispatch?.()
    await expect(p).resolves.toBe(true)
  })

  it('вторая правка собирается ПОСЛЕ ответа первой — с новой generation', async () => {
    const { result } = renderActions()
    const p1 = result.current.editCell({ pokazatelId: 4501, indeks: 0 }, '1')
    const p2 = result.current.editCell({ pokazatelId: 4511, indeks: 1 }, '2')
    await flush()
    expect(dispatched).toHaveLength(1)

    resolveDispatch?.()
    await p1
    await flush()
    expect(dispatched).toHaveLength(2)
    expect(dispatched[1].value).toMatchObject({
      pokazatelId: 4511,
      indeks: 1,
      baseGeneration: 8,
    })
    resolveDispatch?.()
    await expect(p2).resolves.toBe(true)
  })

  it('не число — предупреждение, в transport ничего не уходит', async () => {
    const { result } = renderActions()
    expect(
      result.current.editCell({ pokazatelId: 4501, indeks: 0 }, 'abc')
    ).toBe(false)
    await flush()
    expect(dispatched).toHaveLength(0)
    expect(toasts).toEqual([i18n.t('sdui.reportSheet.invalidNumber')])
  })

  it('значение не изменилось или ячейка вычисляемая — команда отменяется', async () => {
    const { result } = renderActions()
    await expect(
      result.current.editCell({ pokazatelId: 4501, indeks: 0 }, '120 000')
    ).resolves.toBe(false)
    await expect(
      result.current.editCell({ pokazatelId: 4599, indeks: 0 }, '1')
    ).resolves.toBe(false)
    expect(dispatched).toHaveLength(0)
  })
})

describe('useReportSheetActions: расшифровка', () => {
  beforeEach(() => {
    state.payload = structuredClone(RICH_PAYLOAD)
    dispatched.length = 0
  })

  it('COMMAND otchetnost.rasshifrovka с адресом ячейки', () => {
    const { result } = renderActions()
    result.current.openRasshifrovka({ pokazatelId: 4599, indeks: 0 })
    expect(dispatched).toEqual([
      {
        type: 'COMMAND',
        command: 'otchetnost.rasshifrovka',
        value: { pokazatelId: 4599, indeks: 0 },
      },
    ])
  })
})

describe('buildGenerationEvent', () => {
  it('baseGeneration перекрывает любое значение из тела команды', () => {
    expect(
      buildGenerationEvent(
        'table.reportSheet',
        { type: 'EDIT_CELL', baseGeneration: 1 },
        5
      )
    ).toEqual({
      type: 'EVENT',
      sourceNodeId: 'table.reportSheet',
      trigger: 'change',
      value: { type: 'EDIT_CELL', baseGeneration: 5 },
    })
  })
})
