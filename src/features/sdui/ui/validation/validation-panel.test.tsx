// SCRUM-317 v6: панель — нижний этаж колонки правого нижнего угла. Публикует
// занятое место (верх с зазором + фактическую ширину) синхронно на рендере;
// jsdom раскладку не делает, поэтому offsetHeight/offsetWidth подменены.
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CORNER_BOTTOM_PX,
  CORNER_GAP_PX,
  CORNER_RIGHT_PX,
  CORNER_STACK_TOP_VAR,
  CORNER_STACK_WIDTH_VAR,
} from '@/shared/lib/utils/corner-stack'
import type { ValidationReport } from '@/entities/validation-report'

import { ValidationPanel } from './validation-panel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

const report = (count: number): ValidationReport => ({
  operation: 'doc.save',
  blockingCount: count,
  messages: Array.from({ length: count }, (_, i) => ({
    id: `m${String(i)}`,
    severity: 'ERROR',
    source: 'REQUIRED_ATTRIBUTE',
    blocking: true,
    message: `Ошибка ${String(i)}`,
    target: null,
    attributeCode: null,
  })),
})

const noop = () => undefined

// Мутируются между рендерами — геттеры прототипа читают актуальное значение.
let panelHeight = 120
let panelWidth = 390

const rootVar = (name: string) =>
  document.documentElement.style.getPropertyValue(name)

describe('ValidationPanel — колонка угла (v6)', () => {
  beforeEach(() => {
    panelHeight = 120
    panelWidth = 390
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => panelHeight,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => panelWidth,
    })
    // ResizeObserver-заглушка НИКОГДА не зовёт колбэк: перезамер на рендере
    // обязан работать без него (v6 §2.2 — на скрытой вкладке RO молчит).
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = noop
        disconnect = noop
        unobserve = noop
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>
    delete proto.offsetHeight
    delete proto.offsetWidth
    document.documentElement.style.removeProperty(CORNER_STACK_TOP_VAR)
    document.documentElement.style.removeProperty(CORNER_STACK_WIDTH_VAR)
  })

  const renderPanel = (r: ValidationReport = report(1)) =>
    render(
      <ValidationPanel
        report={r}
        activeId={null}
        onSelect={noop}
        onActivate={noop}
        onClose={noop}
      />
    )

  it('публикует верх занятого места: свой отступ + высота + зазор, не голую высоту', () => {
    renderPanel()
    expect(rootVar(CORNER_STACK_TOP_VAR)).toBe(
      `${String(CORNER_BOTTOM_PX + 120 + CORNER_GAP_PX)}px`
    )
  })

  it('публикует фактическую ширину (max-width на узком экране), а не номинальные 420', () => {
    renderPanel()
    expect(rootVar(CORNER_STACK_WIDTH_VAR)).toBe('390px')
  })

  it('стоит в координатах модуля угла — общий правый край с тостами', () => {
    const { getByTestId } = renderPanel()
    const el = getByTestId('validation-panel')
    expect(el.style.right).toBe(`${String(CORNER_RIGHT_PX)}px`)
    expect(el.style.bottom).toBe(`${String(CORNER_BOTTOM_PX)}px`)
  })

  it('перемеряет на рендере, не дожидаясь ResizeObserver', () => {
    const { rerender } = renderPanel(report(1))
    panelHeight = 360 // отчёт вырос с 1 до 9 строк в том же ответе, что и тост
    rerender(
      <ValidationPanel
        report={report(9)}
        activeId={null}
        onSelect={noop}
        onActivate={noop}
        onClose={noop}
      />
    )
    expect(rootVar(CORNER_STACK_TOP_VAR)).toBe(
      `${String(CORNER_BOTTOM_PX + 360 + CORNER_GAP_PX)}px`
    )
  })

  it('при размонтировании снимает обе переменные — тосты возвращаются на место', () => {
    const { unmount } = renderPanel()
    unmount()
    expect(rootVar(CORNER_STACK_TOP_VAR)).toBe('')
    expect(rootVar(CORNER_STACK_WIDTH_VAR)).toBe('')
  })
})
