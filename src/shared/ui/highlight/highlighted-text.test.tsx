import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HighlightedText } from './highlighted-text'

describe('HighlightedText', () => {
  afterEach(() => {
    cleanup()
  })

  it('выделяет вхождение запроса — видно, по какой колонке совпала строка', () => {
    const { container } = render(
      <HighlightedText text="Спецификация 521" query="52" />
    )

    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('52')
    expect(container.textContent).toBe('Спецификация 521')
  })

  it('регистр не важен и выделяются ВСЕ вхождения', () => {
    const { container } = render(
      <HighlightedText text="Охрана-АИДА, охрана объекта" query="охрана" />
    )

    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('Охрана')
    expect(marks[1].textContent).toBe('охрана')
  })

  it('без совпадения, с пустым запросом и на пустом тексте обёрток нет', () => {
    const { container: bezSovpadeniya } = render(
      <HighlightedText text="Прочие расходы" query="52" />
    )
    expect(bezSovpadeniya.querySelectorAll('mark')).toHaveLength(0)

    const { container: pustoyZapros } = render(
      <HighlightedText text="Прочие расходы" query="   " />
    )
    expect(pustoyZapros.querySelectorAll('mark')).toHaveLength(0)

    const { container: pustoyTekst } = render(
      <HighlightedText text="" query="52" />
    )
    expect(pustoyTekst.querySelectorAll('mark')).toHaveLength(0)
  })

  it('спецсимволы регулярных выражений ищутся буквально, а не как шаблон', () => {
    render(<HighlightedText text="ФКР 355/009 (соц.)" query="355/009" />)

    expect(screen.getByText('355/009').tagName).toBe('MARK')
  })
})
