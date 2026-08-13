import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ColumnHeaderLabel } from './column-header-label'

describe('ColumnHeaderLabel', () => {
  // В проекте нет глобального setupFiles, поэтому авто-cleanup RTL не включается
  // и DOM протекал бы между тестами: одинаковые подписи дали бы getByText
  // «found multiple elements» (так же делают соседние тесты SDUI).
  afterEach(cleanup)

  it('рендерит подпись, «*» не показывает', () => {
    render(<ColumnHeaderLabel label="Вычет ИПН" />)
    expect(screen.getByText('Вычет ИПН')).toBeTruthy()
    expect(screen.queryByText('*')).toBeNull()
  })

  it('required → подпись и красная «*»', () => {
    render(<ColumnHeaderLabel label="Вычет ИПН" required />)
    expect(screen.getByText('Вычет ИПН')).toBeTruthy()
    expect(screen.getByText('*')).toBeTruthy()
  })

  // Обрезка многоточием (`white-space:nowrap` + `text-overflow:ellipsis`)
  // здесь НЕ проверяется: это чистый CSS из emotion-класса, а cssstyle в jsdom
  // не поддерживает `text-overflow` — assert на getComputedStyle дал бы ложное
  // падение. Проверяем наблюдаемое следствие: полный текст доступен в тултипе,
  // потому что видимый обрезан.
  it('полный текст остаётся в title — обрезка ничего не скрывает', () => {
    render(<ColumnHeaderLabel label="Вид повременной оплаты труда" required />)
    expect(screen.getByTitle('Вид повременной оплаты труда')).toBeTruthy()
    expect(screen.getByText('*')).toBeTruthy()
  })

  it('пустая подпись не даёт пустого тултипа', () => {
    const { container } = render(<ColumnHeaderLabel label="" />)
    expect(container.querySelector('[title]')).toBeNull()
  })
})
