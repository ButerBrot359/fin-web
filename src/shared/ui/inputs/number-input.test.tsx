import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NumberInput } from './number-input'

/**
 * Поле-владелец хранит ЧИСЛО и отдаёт его обратно инпуту — как NUMBER_FIELD и
 * ячейка ТЧ. Именно на этом кругу и терялись незавершённые состояния набора.
 */
const Host = ({
  initial = null,
  decimal,
  precision,
}: {
  initial?: number | null
  decimal?: boolean
  precision?: number
}) => {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <NumberInput
        value={value === null ? '' : String(value)}
        decimal={decimal}
        precision={precision}
        onChange={(e) => {
          const raw = e.target.value
          setValue(raw === '' ? null : parseFloat(raw))
        }}
      />
      <span data-testid="owner">{value === null ? 'null' : String(value)}</span>
    </>
  )
}

const input = () => screen.getByRole<HTMLInputElement>('textbox')
const owner = () => screen.getByTestId('owner').textContent

/** Набор по одному символу — как руками, а не вставкой целиком. */
const type = (text: string) => {
  for (const ch of text) {
    fireEvent.change(input(), { target: { value: input().value + ch } })
  }
}

describe('NumberInput — ввод дробных', () => {
  afterEach(cleanup)

  // Репорт 20.08.2026: в 1С «Тарифный коэффициент» = 1,02, у нас получалось 102.
  // Значение 2.86 в том же поле приехало миграцией — то есть поле дробное, и
  // запрет стоял только на ручном вводе.
  it('«1,02» по символам даёт 1.02, а не 102', () => {
    render(<Host decimal />)
    type('1,02')
    expect(owner()).toBe('1.02')
  })

  // Разделитель на экране один и тот же — и у набранного, и у пришедшего из
  // базы (миграционные 2.86 показываются точкой).
  it('набранная запятая показывается точкой', () => {
    render(<Host decimal />)
    type('1,02')
    expect(input().value).toBe('1.02')
  })

  it('точка как разделитель работает так же', () => {
    render(<Host decimal />)
    type('1.02')
    expect(owner()).toBe('1.02')
  })

  // Хвостовой ноль не доживал по той же причине: parseFloat("1.10") = 1.1,
  // владелец отдавал "1.1", и следующий символ дописывался не туда.
  it('хвостовой ноль не съедается при наборе', () => {
    render(<Host decimal />)
    type('1,10')
    expect(input().value).toBe('1.10')
  })

  it('после blur показывается каноничное значение владельца', () => {
    render(<Host decimal />)
    type('1,0')
    fireEvent.blur(input())
    expect(input().value).toBe('1')
    expect(owner()).toBe('1')
  })

  it('целочисленное поле (precision: 0) запятую по-прежнему не принимает', () => {
    render(<Host decimal={false} />)
    type('1,02')
    expect(owner()).toBe('102')
  })
})

// Бэк присылает props.precision; эталон 1С показывает значения с хвостовыми
// нулями: «Ставка» 1,500, «Тарифный коэффициент» 1,02, пустое поле 0,00.
describe('NumberInput — хвостовые нули по precision', () => {
  afterEach(cleanup)

  it('значение дополняется нулями до разрядности', () => {
    render(<Host initial={1.5} decimal precision={3} />)
    expect(input().value).toBe('1.500')
  })

  it('ноль показывается как 0.00 при разрядности 2', () => {
    render(<Host initial={0} decimal precision={2} />)
    expect(input().value).toBe('0.00')
  })

  // Пока идёт набор, нули не дописываются — иначе они лезли бы под курсор на
  // каждый символ.
  it('во время набора нули не дописываются, появляются после blur', () => {
    render(<Host decimal precision={3} />)
    type('1,5')
    expect(input().value).toBe('1.5')

    fireEvent.blur(input())
    expect(input().value).toBe('1.500')
    expect(owner()).toBe('1.5')
  })

  // Сервер лишний знак не нормализует, ограничения ввода нет ни на одной
  // стороне — значит показывать «1.23» при 1.2346 в базе нельзя.
  it('лишние знаки не обрезаются', () => {
    render(<Host initial={1.2346} decimal precision={2} />)
    expect(input().value).toBe('1.2346')
  })

  it('precision: 0 — целое, без дописывания', () => {
    render(<Host initial={5} precision={0} />)
    expect(input().value).toBe('5')
  })

  it('пустое поле остаётся пустым', () => {
    render(<Host decimal precision={2} />)
    expect(input().value).toBe('')
  })
})

// Согласовано с бэком 21.08.2026: ввод ограничивается с обеих сторон. Наша
// половина — не дать набрать знак сверх разрядности; серверная — нормализация
// на случай значений из API, ввода на основании и импорта.
describe('NumberInput — предел разрядности', () => {
  afterEach(cleanup)

  it('precision: 2 — третий знак не набирается', () => {
    render(<Host decimal precision={2} />)
    type('1,234')
    expect(input().value).toBe('1.23')
    expect(owner()).toBe('1.23')
  })

  it('precision: 3 — три знака проходят', () => {
    render(<Host decimal precision={3} />)
    type('1,500')
    expect(input().value).toBe('1.500')
  })

  // Потолок хранилища NUMERIC(19,4) действует и без precision — метаданные
  // разрядности заполнены пока не везде, а знак теряется уже сейчас.
  it('без precision предел — 4 знака (потолок хранилища)', () => {
    render(<Host decimal />)
    type('1,23456')
    expect(input().value).toBe('1.2345')
  })

  // Значение с лишними знаками могло прийти извне: показываем как есть и НЕ
  // запираем — иначе его нельзя было бы даже стереть.
  it('пришедшее извне значение сверх предела стирается по символу', () => {
    render(<Host initial={1.23456} decimal precision={2} />)
    expect(input().value).toBe('1.23456')

    fireEvent.change(input(), { target: { value: '1.2345' } })
    expect(input().value).toBe('1.2345')
    fireEvent.change(input(), { target: { value: '1.234' } })
    expect(input().value).toBe('1.234')
  })
})

describe('NumberInput — стирание', () => {
  afterEach(cleanup)

  /** Backspace в конце строки. */
  const backspace = () => {
    fireEvent.change(input(), { target: { value: input().value.slice(0, -1) } })
  }

  // Второй симптом того же репорта: поле нельзя было очистить по одному
  // символу, приходилось выделять значение целиком.
  it('дробное значение стирается по символу до пустого', () => {
    render(<Host initial={1.02} decimal />)
    expect(input().value).toBe('1.02')

    backspace()
    expect(input().value).toBe('1.0')
    backspace()
    expect(input().value).toBe('1.')
    backspace()
    expect(input().value).toBe('1')
    backspace()
    expect(input().value).toBe('')
    expect(owner()).toBe('null')
  })

  // Колонка объявлена целочисленной, а значение пришло дробным: стереть его
  // было нельзя вовсе — ни одно промежуточное состояние не проходило проверку.
  it('дробное значение стирается и в целочисленном поле', () => {
    render(<Host initial={1.02} decimal={false} />)

    backspace()
    backspace()
    backspace()
    expect(input().value).toBe('1')
    backspace()
    expect(input().value).toBe('')
  })
})
