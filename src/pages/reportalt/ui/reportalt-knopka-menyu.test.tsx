import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ReportAltKnopkaMenyu } from './reportalt-knopka-menyu'

describe('Выпадающая кнопка панели отчёта', () => {
  it('пункты показываются только после нажатия и вызывают своё действие', () => {
    const nazhato: string[] = []

    render(
      <ReportAltKnopkaMenyu
        label="Очистить"
        items={[
          {
            key: 'otchet',
            label: 'Очистить отчет',
            onClick: () => nazhato.push('otchet'),
          },
          {
            key: 'stranitsa',
            label: 'Очистить текущую страницу',
            onClick: () => nazhato.push('stranitsa'),
          },
        ]}
      />
    )

    expect(screen.queryByText('Очистить отчет')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Очистить ▾' }))
    fireEvent.click(screen.getByText('Очистить текущую страницу'))

    expect(nazhato).toEqual(['stranitsa'])
  })

  it('недоступный пункт виден, но не срабатывает — как серая команда меню 1С', () => {
    const nazhato: string[] = []

    render(
      <ReportAltKnopkaMenyu
        label="Выгрузить"
        items={[
          {
            key: 'xml',
            label: 'Выгрузить в XML',
            disabled: true,
            onClick: () => nazhato.push('xml'),
          },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить ▾' }))
    fireEvent.click(screen.getByText('Выгрузить в XML'))

    expect(nazhato).toEqual([])
  })

  it('без пунктов кнопка недоступна', () => {
    render(<ReportAltKnopkaMenyu label="Очистить" items={[]} />)

    expect(screen.getByRole('button', { name: 'Очистить ▾' })).toBeDisabled()
  })
})
