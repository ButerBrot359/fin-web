import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TextFieldNode } from './text-field-node'
import { DateFieldNode } from './date-field-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: vi.fn() }),
  useBindingValue: () => undefined,
}))
// Пикер даты требует LocalizationProvider и здесь не предмет проверки —
// подменяем, чтобы остался только внешний контейнер поля с потолком ширины.
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: () => <input data-testid="date" />,
}))

afterEach(cleanup)

// Ширина приезжает числом (304), но раскладки 1С знают и строковую форму.
const node = (type: string, maxWidth?: unknown): ViewNode =>
  ({
    id: 'field.schetUchetaBU',
    type,
    binding: 'SchetUchetaBU',
    props: {
      label: 'Счет учета',
      visible: true,
      enabled: true,
      ...(maxWidth === undefined ? {} : { maxWidth }),
    },
  }) as ViewNode

/** Контрол, к которому применён потолок: sx у MUI-поля, style у обёртки. */
const boxOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.MuiFormControl-root, div[style]')

describe('maxWidth у полей', () => {
  it('TEXT_FIELD: число из дерева становится потолком ширины', () => {
    const { container } = render(
      <TextFieldNode node={node('TEXT_FIELD', 174)} />
    )
    const box = boxOf(container)!
    expect(getComputedStyle(box).maxWidth).toBe('174px')
  })

  it('TEXT_FIELD: строковая форма тоже применяется', () => {
    const { container } = render(
      <TextFieldNode node={node('TEXT_FIELD', '174')} />
    )
    expect(getComputedStyle(boxOf(container)!).maxWidth).toBe('174px')
  })

  it('TEXT_FIELD: без пропа потолка нет — поле тянется по колонке', () => {
    const { container } = render(<TextFieldNode node={node('TEXT_FIELD')} />)
    const mw = getComputedStyle(boxOf(container)!).maxWidth
    expect(mw === '' || mw === 'none').toBe(true)
  })

  it('DATE_FIELD: потолок висит на обёртке поля', () => {
    const { container } = render(
      <DateFieldNode node={node('DATE_FIELD', 200)} />
    )
    expect((container.firstElementChild as HTMLElement).style.maxWidth).toBe(
      '200px'
    )
  })

  it('мусорное значение не схлопывает поле в ноль', () => {
    const { container } = render(
      <TextFieldNode node={node('TEXT_FIELD', 'широкое')} />
    )
    const mw = getComputedStyle(boxOf(container)!).maxWidth
    expect(mw === '' || mw === 'none').toBe(true)
  })
})
