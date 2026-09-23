import type { MouseEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { navestiFokusNaTablitsu } from './table-keyboard-focus'

function razmetka(): { konteyner: HTMLElement; poisk: HTMLInputElement } {
  document.body.innerHTML = `
    <div data-sdui-table-keyboard="true" tabindex="-1">
      <input id="poisk" />
      <table><thead><tr><th id="shapka">Сумма</th></tr></thead>
        <tbody><tr><td id="pusto">Нет данных</td></tr></tbody>
      </table>
    </div>`
  return {
    konteyner: document.querySelector<HTMLElement>(
      '[data-sdui-table-keyboard="true"]'
    )!,
    poisk: document.querySelector<HTMLInputElement>('#poisk')!,
  }
}

const klik = (id: string): MouseEvent<HTMLElement> =>
  ({
    target: document.getElementById(id),
  }) as unknown as MouseEvent<HTMLElement>

describe('navestiFokusNaTablitsu', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('клик по шапке и по пустой таблице даёт фокус контейнеру хоткеев', () => {
    const { konteyner } = razmetka()
    navestiFokusNaTablitsu(klik('shapka'))
    expect(document.activeElement).toBe(konteyner)

    document.body.focus()
    navestiFokusNaTablitsu(klik('pusto'))
    expect(document.activeElement).toBe(konteyner)
  })

  it('клик по полю поиска фокус не отбирает', () => {
    const { poisk } = razmetka()
    navestiFokusNaTablitsu(klik('poisk'))
    expect(document.activeElement).not.toBe(poisk.parentElement)
  })

  it('фокус уже внутри таблицы (ячейка на правке) — остаётся там', () => {
    const { poisk } = razmetka()
    poisk.focus()
    navestiFokusNaTablitsu(klik('shapka'))
    expect(document.activeElement).toBe(poisk)
  })
})
