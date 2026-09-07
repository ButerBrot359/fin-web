import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

import type { ViewNode } from '../../../types/view'
import { LinkNode } from './link-node'

const link = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'module.X.item.0.0.0', type: 'LINK', props }) as ViewNode

// SCRUM-181 v3: серверный route уходит в навигацию байт-в-байт, включая query;
// disabled-пункт не навигирует, но сохраняет геометрию строки и несёт tooltip.
describe('LinkNode: module-link (SCRUM-181 v3)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it.each([
    '/modules/BankiIKassy/document/PlanFinansirovaniyaOrganizatsii?skipDependsOn=true',
    '/modules/BankiIKassy/dictionary/Banki?domain=DICTIONARY',
    '/modules/Otchety/reportalt/OborotnoSaldovayaVedomost?skipDependsOn=true',
    '/modules/NasheUchrezhdenie/document/ReglamentnayaOperatsiya/new?VidOperatsii=ZakrytieOstatkovNaRaskhody&skipDependsOn=true',
  ])('href повторяет серверный route байт-в-байт: %s', (route) => {
    render(
      <MemoryRouter>
        <LinkNode
          node={link({ text: 'Пункт', variant: 'module-link', route })}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Пункт').getAttribute('href')).toBe(route)
  })

  it('disabled: нет href и навигации, aria-disabled, обычная строка', () => {
    render(
      <MemoryRouter>
        <LinkNode
          node={link({
            text: 'Группы долгосрочных активов',
            variant: 'module-link',
            disabled: true,
            tooltip: 'Команда без опубликованного приёмника',
          })}
        />
      </MemoryRouter>
    )
    const item = screen.getByText('Группы долгосрочных активов')
    expect(item.getAttribute('href')).toBeNull()
    expect(item.getAttribute('aria-disabled')).toBe('true')
  })

  it('disabled: тултип с сервера показывается на наведении', async () => {
    render(
      <MemoryRouter>
        <LinkNode
          node={link({
            text: 'Регламентированные отчеты',
            variant: 'module-link',
            disabled: true,
            tooltip: 'Появится в следующей волне',
          })}
        />
      </MemoryRouter>
    )
    fireEvent.mouseOver(screen.getByText('Регламентированные отчеты'))
    expect(await screen.findByText('Появится в следующей волне')).toBeTruthy()
  })
})
