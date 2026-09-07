import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

// В vitest svg-импорты не проходят через svgr и приходят data-URI-строками.
vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/gear.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

import type { ViewNode } from '../../../types/view'
import { ToolbarNode } from './toolbar-node'

const toolbar = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'module.BankiIKassy.toolbar', type: 'TOOLBAR', props }) as ViewNode

// SCRUM-181 v3: TOOLBAR(variant module-workspace) — серверный title, закрытие
// локальной навигацией на props.route, без SDUI-действий.
describe('ToolbarNode: variant=module-workspace', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('рендерит серверный заголовок модуля', () => {
    render(
      <MemoryRouter>
        <ToolbarNode
          node={toolbar({
            variant: 'module-workspace',
            title: 'Банк и касса',
            route: '/',
          })}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Банк и касса')).toBeTruthy()
  })

  it('закрытие навигирует локально на props.route', () => {
    render(
      <MemoryRouter>
        <ToolbarNode
          node={toolbar({
            variant: 'module-workspace',
            title: 'Банк и касса',
            route: '/',
          })}
        />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
