import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/app/config/i18n'
import { DateTimeInput } from '@/shared/ui/inputs'

import { MuiProvider } from './mui-provider'

const renderEmptyDate = () =>
  render(
    <MuiProvider>
      <DateTimeInput dateOnly value="" onChange={() => undefined} />
    </MuiProvider>
  )

const placeholders = () =>
  screen.getAllByRole('spinbutton').map((section) => section.textContent)

describe('MuiProvider: подсказка формата в пустом поле даты', () => {
  afterEach(async () => {
    cleanup()
    await act(() => i18n.changeLanguage('ru'))
  })

  it('на русском интерфейсе — ДД.ММ.ГГГГ', async () => {
    await act(() => i18n.changeLanguage('ru'))
    renderEmptyDate()
    expect(placeholders()).toEqual(['ДД', 'ММ', 'ГГГГ'])
  })

  it('на казахском интерфейсе — по-казахски', async () => {
    await act(() => i18n.changeLanguage('kz'))
    renderEmptyDate()
    expect(placeholders()).toEqual(['КК', 'AA', 'ЖЖЖЖ'])
  })
})
