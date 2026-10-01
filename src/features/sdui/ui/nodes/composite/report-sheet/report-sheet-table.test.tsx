import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Экземпляр i18next инициализирует app-конфиг по цепочке импортов
// сетки (shared/lib/utils → app/config/i18n) — в тесте тот же синглтон.
import i18n from 'i18next'
import { useValidationReportStore } from '@/entities/validation-report'

import type { ViewAction } from '../../../../types/view'
import { useViewStateStore } from '../../../../lib/stores/view-state-store'
import { findTargetAnchor } from '../../../../lib/validation/find-target-anchor'
import { TableNode } from '../table-node'
import {
  EMPTY_PAYLOAD,
  HANDOFF_PAYLOAD,
  REPORT_SHEET_NODE,
  RICH_PAYLOAD,
} from './report-sheet-fixtures'

// Transport мокается; сессия — root (глобальные сторы), как у карточки.
const dispatched: ViewAction[] = []
vi.mock('../../../../lib/dispatch', () => ({
  useSduiDispatch: () => (action: ViewAction) => {
    dispatched.push(action)
    return Promise.resolve(true)
  },
}))

const BINDING = 'ReportSheet'
const SCREEN = '/documents/UniversalnyyReglamentirovannyyOtchet/1'

const renderSheet = (value: unknown) => {
  useViewStateStore.getState().replaceAll({ [BINDING]: value })
  // Обёртка якоря — как у NodeRenderer для цели текущего отчёта
  return render(
    <span style={{ display: 'contents' }} data-sdui-anchor={BINDING}>
      <TableNode node={REPORT_SHEET_NODE} />
    </span>
  )
}

const cellOf = (key: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(
    `[data-sdui-report-cell="${key}"]`
  )
  if (!el) throw new Error(`cell ${key} not rendered`)
  return el
}

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)))

beforeEach(() => {
  dispatched.length = 0
})

afterEach(() => {
  useValidationReportStore.getState().clear(SCREEN)
  useValidationReportStore.getState().setScreenKey(null)
})

describe('TableNode → ReportSheetTable (report-sheet/v1)', () => {
  it('payload из handoff: шапка граф с номерами, группа, суммы по графам', () => {
    renderSheet(HANDOFF_PAYLOAD)
    const headers = screen
      .getAllByRole('columnheader')
      .map((c) => c.textContent)
    expect(headers).toEqual([
      i18n.t('sdui.reportSheet.nameColumn'),
      i18n.t('sdui.reportSheet.codeColumn'),
      `${i18n.t('sdui.reportSheet.grafaNumber', { nomer: 3 })}На начало отчётного периода`,
      `${i18n.t('sdui.reportSheet.grafaNumber', { nomer: 4 })}На конец отчётного периода`,
    ])
    const group = document.querySelector('[data-row-kind="group"]')!
    expect(group.textContent).toContain('Нефинансовые активы')
    expect(group.querySelectorAll('[data-sdui-report-cell]')).toHaveLength(0)
    expect(within(cellOf('4501:0')).getByRole('textbox')).toHaveValue('120 000')
    expect(within(cellOf('4502:0')).getByRole('textbox')).toHaveValue('135 000')
  })

  it('пустая сетка — аккуратное пустое состояние без таблицы', () => {
    renderSheet(EMPTY_PAYLOAD)
    expect(screen.getByTestId('report-sheet-empty')).toHaveTextContent(
      i18n.t('sdui.reportSheet.empty')
    )
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('битый payload — сообщение, а не падение и не обычная ТЧ', () => {
    renderSheet({ grafy: 'x' })
    expect(
      screen.getByText(i18n.t('sdui.reportSheet.payloadError'))
    ).toBeInTheDocument()
  })

  it('вычисляемая ячейка — только чтение; клик открывает расшифровку', () => {
    renderSheet(RICH_PAYLOAD)
    const itog = cellOf('4599:0')
    expect(within(itog).queryByRole('textbox')).toBeNull()
    fireEvent.click(within(itog).getByRole('button'))
    expect(dispatched).toEqual([
      {
        type: 'COMMAND',
        command: 'otchetnost.rasshifrovka',
        value: { pokazatelId: 4599, indeks: 0 },
      },
    ])
  })

  it('редактируемая ячейка: расшифровка — отдельной иконкой', () => {
    renderSheet(RICH_PAYLOAD)
    fireEvent.click(
      within(cellOf('4501:0')).getByRole('button', {
        name: i18n.t('sdui.reportSheet.rasshifrovka'),
      })
    )
    expect(dispatched[0]).toMatchObject({
      command: 'otchetnost.rasshifrovka',
      value: { pokazatelId: 4501, indeks: 0 },
    })
  })

  it('ввод + Enter → EDIT_CELL на узел с baseGeneration из value', async () => {
    renderSheet(RICH_PAYLOAD)
    const input = within(cellOf('4511:1')).getByRole('textbox')
    act(() => {
      input.focus()
    })
    fireEvent.change(input, { target: { value: '3 500,25' } })
    // Enter снимает фокус — коммит идёт через blur, как в матрице Табеля
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    expect(input).not.toHaveFocus()
    expect(dispatched).toEqual([
      {
        type: 'EVENT',
        sourceNodeId: 'table.reportSheet',
        trigger: 'change',
        value: {
          type: 'EDIT_CELL',
          pokazatelId: 4511,
          indeks: 1,
          value: '3500.25',
          baseGeneration: 7,
        },
      },
    ])
  })

  it('Esc откатывает ввод без отправки', async () => {
    renderSheet(RICH_PAYLOAD)
    const input = within(cellOf('4501:0')).getByRole('textbox')
    act(() => {
      input.focus()
    })
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    await flush()
    expect(dispatched).toHaveLength(0)
    expect(input).toHaveValue('120 000,0')
  })

  it('раскрытие — под своей строкой; ручная правка помечена уголком', () => {
    renderSheet(RICH_PAYLOAD)
    const kinds = Array.from(document.querySelectorAll('tbody tr')).map((r) =>
      r.getAttribute('data-row-kind')
    )
    expect(kinds).toEqual(['group', 'stroka', 'stroka', 'raskrytie', 'stroka'])
    expect(
      within(cellOf('4511:0')).getByTestId('report-cell-manual')
    ).toBeTruthy()
    expect(
      within(cellOf('4501:0')).queryByTestId('report-cell-manual')
    ).toBeNull()
  })
})

describe('цель проверки REPORT_CELL', () => {
  beforeEach(() => {
    // jsdom не считает раскладку: даём ячейкам ненулевую коробку, обёртке
    // якоря (display: contents) — нулевую, как в браузере.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const boxed = this.tagName !== 'SPAN'
        return { width: boxed ? 10 : 0, height: boxed ? 10 : 0 } as DOMRect
      }
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const message = (pokazatelId: number, indeks: number) => ({
    id: `m-${String(pokazatelId)}-${String(indeks)}`,
    severity: 'ERROR' as const,
    source: 'BUSINESS_RULE' as const,
    blocking: false,
    message: 'Контрольное соотношение не выполнено',
    target: { kind: 'REPORT_CELL' as const, pokazatelId, indeks },
    attributeCode: null,
  })

  it('навигация находит ячейку по {pokazatelId, indeks}, включая раскрытие', () => {
    const { container } = renderSheet(RICH_PAYLOAD)
    expect(findTargetAnchor(container, message(4511, 1))).toBe(cellOf('4511:1'))
    expect(findTargetAnchor(container, message(4599, 0))).toBe(cellOf('4599:0'))
  })

  it('ячейки нет в payload — деградация до всей сетки', () => {
    const { container } = renderSheet(RICH_PAYLOAD)
    const anchor = findTargetAnchor(container, message(1, 0))
    expect(anchor?.tagName).toBe('DIV')
    expect(anchor?.contains(cellOf('4501:0'))).toBe(true)
  })

  it('ячейка из отчёта подсвечивается рамкой ошибки', () => {
    const store = useValidationReportStore.getState()
    store.setScreenKey(SCREEN)
    store.setReport(SCREEN, {
      operation: 'otchetnost.flk',
      blockingCount: 0,
      messages: [message(4502, 0)],
    })
    renderSheet(RICH_PAYLOAD)
    expect(cellOf('4502:0')).toHaveAttribute('data-validation-error', 'true')
    expect(cellOf('4501:0')).not.toHaveAttribute('data-validation-error')
  })
})
