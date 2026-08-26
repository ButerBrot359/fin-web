import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { CheckboxFieldNode } from './checkbox-field-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: vi.fn() }),
  useBindingValue: () => undefined,
}))

afterEach(cleanup)

const node = (): ViewNode =>
  ({
    id: 'field.oplacheno',
    type: 'CHECKBOX_FIELD',
    binding: 'Oplacheno',
    // visible/enabled явные — по контракту SCRUM-362 B-4 бэк всегда их проставляет
    props: { label: 'Оплачено', visible: true, enabled: true },
  }) as ViewNode

describe('CheckboxFieldNode ширина', () => {
  it('растягивается контейнер поля', () => {
    const { container } = render(
      <div style={{ display: 'block' }}>
        <CheckboxFieldNode node={node()} />
      </div>
    )
    const control = container.querySelector('.MuiFormControl-root')
    expect(control?.classList.contains('MuiFormControl-fullWidth')).toBe(true)
  })

  it('сам квадрат с подписью не растягивается — они остаются рядом', () => {
    const { container } = render(<CheckboxFieldNode node={node()} />)
    const label = container.querySelector('.MuiFormControlLabel-root')
    expect(label).toBeTruthy()
    expect(label?.classList.contains('MuiFormControl-fullWidth')).toBe(false)
    // подпись — сосед чекбокса внутри той же метки, а не отдельный блок
    expect(label?.querySelector('.MuiCheckbox-root')).toBeTruthy()
    expect(label?.textContent).toBe('Оплачено')
  })
})
