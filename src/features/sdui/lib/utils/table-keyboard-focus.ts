import type { MouseEvent } from 'react'

/** Контейнер таблицы, который слушает хоткеи (стрелки, Insert, Delete, F9, Ctrl+…). */
export const KONTEYNER_KLAVIATURY = '[data-sdui-table-keyboard="true"]'

/**
 * Элементы, у которых фокус свой: у них клавиатура работает сама, и забирать
 * у них фокус нельзя (поиск по ТЧ, ячейка на правке, кнопки панели).
 */
const SVOY_FOKUS =
  'input, textarea, select, button, a, [contenteditable="true"], [role="combobox"]'

/**
 * Клик по таблице переводит фокус на её контейнер — иначе хоткеи не доходят
 * вовсе: обработчик висит на контейнере (на форме несколько ТЧ, работает та, в
 * которой фокус), а клик по шапке или по пустому месту таблицы оставлял фокус
 * на `body`. У ПУСТОЙ табличной части других способов получить фокус и не было:
 * строки, по которой можно щёлкнуть, там нет, и Insert «не работал» — то же
 * самое, что описано в обращении по «Разукомплектации активов».
 *
 * Фокус уже внутри контейнера — не трогаем: ввод в ячейке и поиск по ТЧ должны
 * остаться там, где пользователь их оставил.
 */
export function navestiFokusNaTablitsu(event: MouseEvent<HTMLElement>): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest(SVOY_FOKUS) !== null) return
  const konteyner = target.closest(KONTEYNER_KLAVIATURY)
  if (!(konteyner instanceof HTMLElement)) return
  const aktivnyy = document.activeElement
  if (aktivnyy !== null && aktivnyy !== document.body) {
    if (konteyner.contains(aktivnyy)) return
  }
  konteyner.focus()
}
