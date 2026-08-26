import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { HStackNode } from './hstack-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: vi.fn() }),
  useBindingValue: () => undefined,
}))

afterEach(cleanup)

// Бэк заворачивает «узкое» поле в строку HSTACK → [FIELD(flex), SPACER(flex:1)],
// где flex = CSS-shorthand «базис 240px, сжимается».
const row = (fieldFlex: string): ViewNode =>
  ({
    id: 'row.summaDokumenta',
    type: 'HSTACK',
    props: { gap: 2 },
    children: [
      {
        id: 'field.summaDokumenta',
        type: 'TEXT_FIELD',
        binding: 'SummaDokumenta',
        props: {
          label: 'Сумма документа',
          flex: fieldFlex,
          visible: true,
          enabled: true,
        },
      },
      { id: 'spacer.1', type: 'SPACER', props: { flex: 1, visible: true } },
    ],
  }) as ViewNode

describe('flex поля внутри HSTACK', () => {
  it('строковый basis остаётся на обёртке и не уходит в сам виджет', () => {
    const { container } = render(<HStackNode node={row('0 1 240px')} />)

    // Обёртка ребёнка — та самая строчная колонка из hstack-node: здесь basis
    // означает ШИРИНУ, и это правильное место для flex.
    const wrapper = container.firstElementChild
      ?.firstElementChild as HTMLElement
    expect(wrapper.style.flex).toBe('0 1 240px')

    // Сам контрол flex не несёт: обёртка колоночная, и тот же basis читался бы
    // в ней как ВЫСОТА — под полем появлялась полоса пустоты на 240px.
    const control = container.querySelector<HTMLElement>('.MuiFormControl-root')
    expect(control).toBeTruthy()
    expect(control?.style.flex).toBe('')
    expect(getComputedStyle(control!).flexBasis).not.toBe('240px')
    expect(getComputedStyle(control!).height).not.toBe('240px')
  })

  it('числовой flex из миграций тоже не дублируется в виджет', () => {
    const { container } = render(<HStackNode node={row('2')} />)
    const wrapper = container.firstElementChild
      ?.firstElementChild as HTMLElement
    // CSS нормализует число до полного shorthand
    expect(wrapper.style.flex).toBe('2 1 0%')
    const control = container.querySelector<HTMLElement>('.MuiFormControl-root')
    expect(control?.style.flex).toBe('')
  })
})
