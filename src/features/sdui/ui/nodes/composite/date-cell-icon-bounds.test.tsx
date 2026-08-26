import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

import { theme } from '@/app/theme/theme'
import { DateCellEditor } from './date-cell-editor'
import { dateCellSx } from './table-cell-editor-styles'

/**
 * Иконка календаря не должна выходить за границы ячейки ТЧ. В «Начислениях»
 * она садилась верхом на линию сетки между «Началом периода» и «Норм.
 * нагрузкой» — и половина иконки оказывалась в чужой колонке.
 *
 * Виноваты были два правила MUI, а не одно, поэтому и проверяем оба:
 *   1) кнопка пикера приходит с `edge="end"`, а это `margin-right: -12px`;
 *   2) поле пикера берёт ширину по содержимому (контейнер разрядов объявлен
 *      `width: 182px`), то есть в узкой колонке само шире ячейки.
 *
 * Тест на СТИЛЯХ, а не на координатах: jsdom не раскладывает страницу, но
 * каскад классов считает — а обе причины именно в каскаде и живут.
 */
const renderCell = () =>
  render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DateCellEditor
          value="2026-07-01"
          dateOnly
          sx={dateCellSx}
          onChange={() => undefined}
          onCommit={() => undefined}
        />
      </LocalizationProvider>
    </ThemeProvider>
  )

describe('иконка календаря в ячейке ТЧ', () => {
  afterEach(cleanup)

  it('кнопка пикера без отрицательного отступа edge="end"', () => {
    const { container } = renderCell()
    const buttons = container.querySelectorAll<HTMLElement>(
      '.MuiInputAdornment-root .MuiIconButton-root'
    )
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(getComputedStyle(button).marginRight).toBe('0px')
    }
  })

  it('поле пикера шириной строго по ячейке, а не по содержимому', () => {
    const { container } = renderCell()
    const root = container.querySelector<HTMLElement>(
      '.MuiPickersInputBase-root'
    )
    expect(root).toBeTruthy()
    expect(getComputedStyle(root!).width).toBe('100%')

    // Те самые 182px контейнера разрядов: с ними поле не сжималось до колонки.
    const sections = container.querySelector<HTMLElement>(
      '.MuiPickersInputBase-sectionsContainer'
    )
    expect(getComputedStyle(sections!).width).toBe('auto')
  })
})
