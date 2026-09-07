import { useMemo } from 'react'

import type { SelectOption } from '@/shared/types/select-option'

/**
 * Стабилизирует ССЫЛКУ на значение `<Autocomplete value>`: пока содержимое не
 * изменилось, наружу отдаётся тот же объект/массив, что и в прошлый рендер.
 *
 * <p><b>Зачем.</b> MUI сбрасывает набранный текст при каждой смене ссылки на `value`
 * (`useAutocomplete`: эффект по `value` зовёт `resetInputValue` — в multiple-режиме на
 * пустую строку, в одиночном на `getOptionLabel(value)`). Ссылочные поля SDUI считают
 * `value` из состояния формы прямо в теле компонента (`toSelectOption` / `map`), то есть
 * НОВЫМ объектом на каждый рендер, — а рендер происходит на каждое нажатие клавиши
 * (`setInputValue`). Символ успевал попасть в стейт и тут же стирался: поле «не
 * принимает» ввод вовсе. У полей множественного выбора это ломало ввод ВСЕГДА (пустое
 * значение — тоже новый `[]`), у одиночных — как только в поле уже стоит запись.
 *
 * <p>Тождество считаем по содержимому опции (`id`/`code`/`label`): именно эти поля MUI и
 * показывает, всё остальное в `SelectOption` производно от них.
 */
function optionKey(option: SelectOption | null): string {
  return option
    ? [String(option.id), option.code, option.label].join('\u0001')
    : ''
}

export function useStableSelectOption(
  next: SelectOption | null
): SelectOption | null {
  const key = optionKey(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => next, [key])
}

export function useStableSelectOptions(next: SelectOption[]): SelectOption[] {
  const key = next.map(optionKey).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => next, [key])
}
